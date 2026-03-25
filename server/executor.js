import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { agentDir, saveAgent, SHARED_DIR } from "./storage.js";

function buildGraph(nodes, edges) {
  const adjacency = new Map();
  const inDegree = new Map();

  for (const node of nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  return { adjacency, inDegree };
}

function getExecutionOrder(nodes, edges) {
  const { adjacency, inDegree } = buildGraph(nodes, edges);
  const order = [];
  const queue = [];

  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const visited = new Set();
  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    order.push(id);

    for (const next of adjacency.get(id) || []) {
      const newDeg = inDegree.get(next) - 1;
      inDegree.set(next, newDeg);
      if (newDeg <= 0 && !visited.has(next)) {
        queue.push(next);
      }
    }
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) order.push(node.id);
  }

  return order;
}

function getParentEdges(edges, nodeId) {
  return edges.filter((e) => e.target === nodeId);
}

function buildSystemPrompt(agentId, data) {
  const dir = agentDir(agentId);

  const instructionsPath = join(dir, "instructions.md");
  const instructions = existsSync(instructionsPath)
    ? readFileSync(instructionsPath, "utf-8")
    : data.prompt || "";

  const accessLevel = data.accessLevel || "sandboxed";
  const projectDir = data.projectDir || null;

  let workspaceSection = `
## Your Workspace

You have two workspaces available:

### Private workspace (current directory: \`./\`)
This is YOUR space — no other agent can access it.
- \`./instructions.md\` — your instructions (read to remind yourself of your task)
- \`./memory/\` — your persistent memory. Write .md files here to remember things across runs.
- \`./config.json\` — your configuration (read-only)

### Shared workspace (\`${SHARED_DIR}/\`)
A shared folder that ALL agents in the workflow can read and write.
- Pass files to other agents (data, code, reports, etc.)
- Read files left by other agents`;

  if (accessLevel === "full" && projectDir) {
    workspaceSection += `

### Project directory (\`${projectDir}/\`)
You have FULL access to the project codebase. You can:
- Read, edit, and create files in the project
- Run any shell commands (build, test, lint, etc.)
- Use simulators, emulators, and browser automation tools
- Run the project's test suites
- Interact with system tools (xcodebuild, xcrun simctl, adb, npm, etc.)

Write test results and reports to the shared workspace so other agents can see them.`;
  }

  workspaceSection += `

### Memory guidelines:
- Write concise, useful memories to \`./memory/\` — things you'd want to know on your next run
- Name memory files descriptively (e.g., \`memory/key-findings.md\`, \`memory/decisions.md\`)
- Keep memories focused — store conclusions and decisions, not raw data

### Collaboration guidelines:
- Write files to the shared workspace when other agents need them
- Check the shared workspace for files from upstream agents
- Use clear filenames so other agents know what each file contains`;

  return `${instructions}\n${workspaceSection}`;
}

function runAgent(prompt, systemPrompt, model, agentId, data, signal) {
  return new Promise((resolve, reject) => {
    const dir = agentDir(agentId);
    const modelArg = model === "opus" ? "opus" : "sonnet";
    const accessLevel = data.accessLevel || "sandboxed";
    const projectDir = data.projectDir || null;

    const args = [
      "-p",
      "--model", modelArg,
      "--output-format", "json",
      "--add-dir", SHARED_DIR,
      "--system-prompt", systemPrompt,
    ];

    if (accessLevel === "full") {
      // Full system access — unrestricted tools
      args.push("--tools", "Read,Write,Glob,Grep,Bash,Edit");
      args.push("--dangerously-skip-permissions");
      if (projectDir) {
        args.push("--add-dir", projectDir);
      }
    } else {
      // Sandboxed — limited tools
      args.push("--tools", "Read,Write,Glob,Grep,Bash");
      args.push("--allowedTools", "Read Write Glob Grep Bash(ls:*) Bash(cat:*)");
    }

    args.push(prompt);

    const proc = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: dir,
      env: { ...process.env },
    });

    proc.stdin.end();

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
      const filteredStderr = stderr.replace(/Warning: no stdin data.*?\n?/g, "").trim();
      if (code !== 0) {
        return reject(new Error(filteredStderr || `Process exited with code ${code}`));
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json.result || stdout);
      } catch {
        resolve(stdout.trim());
      }
    });

    proc.on("error", reject);

    if (signal) {
      signal.addEventListener("abort", () => {
        proc.kill("SIGTERM");
        reject(new DOMException("Aborted", "AbortError"));
      });
    }
  });
}

export async function executeWorkflow(
  workflowId,
  nodes,
  edges,
  loopCount,
  broadcast,
  signal
) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const results = new Map();

  // Ensure each agent's workspace exists with its config/instructions
  for (const node of nodes) {
    saveAgent({
      id: node.id,
      label: node.data?.label,
      prompt: node.data?.prompt,
      model: node.data?.model,
    });
  }

  broadcast({ type: "workflow:start", workflowId, loopCount });

  for (let loop = 0; loop < loopCount; loop++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    broadcast({ type: "loop:start", workflowId, loop: loop + 1, total: loopCount });

    const order = getExecutionOrder(nodes, edges);

    for (const nodeId of order) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const data = node.data || {};
      const parentEdges = getParentEdges(edges, nodeId);

      // Build context from parent results
      let context = "";
      if (parentEdges.length > 0) {
        const parentResults = parentEdges
          .map((e) => {
            const parentNode = nodeMap.get(e.source);
            const result = results.get(e.source);
            return result
              ? `[Result from "${parentNode?.data?.label || e.source}"]:\n${result}`
              : null;
          })
          .filter(Boolean);

        if (parentResults.length > 0) {
          context = parentResults.join("\n\n---\n\n") + "\n\n---\n\n";
        }
      }

      const systemPrompt = buildSystemPrompt(nodeId, data);
      const userPrompt = context || data.label || "Execute your task.";

      broadcast({
        type: "agent:start",
        workflowId,
        nodeId,
        loop: loop + 1,
        label: data.label,
        model: data.model || "sonnet",
      });

      try {
        const result = await runAgent(
          userPrompt,
          systemPrompt,
          data.model || "sonnet",
          nodeId,
          data,
          signal
        );
        results.set(nodeId, result);

        broadcast({
          type: "agent:complete",
          workflowId,
          nodeId,
          loop: loop + 1,
          label: data.label,
          result:
            typeof result === "string"
              ? result.slice(0, 5000)
              : JSON.stringify(result).slice(0, 5000),
        });
      } catch (err) {
        if (err.name === "AbortError") throw err;

        results.set(nodeId, `ERROR: ${err.message}`);
        broadcast({
          type: "agent:error",
          workflowId,
          nodeId,
          loop: loop + 1,
          label: data.label,
          error: err.message,
        });
      }
    }

    broadcast({ type: "loop:end", workflowId, loop: loop + 1, total: loopCount });
  }

  broadcast({ type: "workflow:complete", workflowId });
}

export function cancelWorkflow() {}
