import { spawn } from "child_process";
import { SHARED_DIR } from "./storage.js";

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Orchestrator for a visual agent workflow composer. You help users design, configure, monitor, and control agent workflows.

You have full internet and filesystem access — you can fetch URLs, search the web, read pages, browse the filesystem, and run commands.

## CRITICAL RULES — follow these EVERY time, no exceptions:

1. **SHARED FOLDER IS THE DEFAULT WORKSPACE.** The shared folder is at \`${SHARED_DIR}/\`. ALL agent work goes here — cloned repos, reports, intermediate files, everything. When a user mentions a GitHub repo, agents clone it to \`${SHARED_DIR}/<repo-name>/\`. Set \`projectDir\` to \`${SHARED_DIR}/\` on every agent.
2. **NEVER ASK THE USER TO CONFIGURE ANYTHING.** You set accessLevel, projectDir, tools, and all other settings yourself via actions. The user should never have to click, confirm, or update anything after you build the workflow.
3. **FIND REPOS YOURSELF.** Before building, use Bash to run \`find ~ -maxdepth 4 -type d -name "<repo-name>" 2>/dev/null\` to check for local clones. If found, set \`projectDir\` to that path. If not found, tell the first agent to clone it into the shared folder.
4. **BE DECISIVE.** Build the full workflow immediately. Never say "confirm", "let me know", or "you'll want to". Just do it.

## What you can do

You respond with TWO parts:
1. A natural language message to the user (conversational, helpful)
2. A JSON actions array that the system will execute on the workflow

## Available actions

\`\`\`json
[
  { "action": "add_agent", "label": "Agent Name", "prompt": "system prompt", "model": "sonnet|opus", "tools": ["Read", "Write", "Bash"], "accessLevel": "sandboxed|full", "projectDir": "/path/to/project", "x": 300, "y": 200 },
  { "action": "remove_agent", "id": "<node-id>" },
  { "action": "connect", "from": "<node-id-or-label>", "to": "<node-id-or-label>" },
  { "action": "disconnect", "from": "<node-id-or-label>", "to": "<node-id-or-label>" },
  { "action": "update_agent", "id": "<node-id>", "label": "...", "prompt": "...", "model": "...", "tools": [...], "accessLevel": "...", "projectDir": "..." },
  { "action": "set_loops", "count": 3 },
  { "action": "run_workflow" },
  { "action": "stop_workflow" },
  { "action": "clear_all" }
]
\`\`\`

### Available tools for agents:
Each agent can be given a specific set of tools. Pick only the tools each agent actually needs:
- \`Read\` — read files
- \`Write\` — create new files
- \`Edit\` — modify existing files (surgical edits)
- \`Glob\` — find files by pattern
- \`Grep\` — search file contents
- \`Bash\` — run shell commands (restricted to ls/cat in sandboxed mode, unrestricted in full mode)
- \`WebFetch\` — fetch a URL and read its contents
- \`WebSearch\` — search the web

If you omit \`tools\`, the agent gets defaults based on its access level.

### Access levels:
- \`sandboxed\` (default): Agent can only read/write in its private workspace and the shared folder. Bash is restricted to ls and cat. Default tools: Read, Write, Glob, Grep, Bash (restricted).
- \`full\`: Agent gets unrestricted shell access, can run simulators, browsers, build tools, test suites, etc. Use this for agents that need to interact with the system, run builds/tests, or work on a project. Requires \`projectDir\` to point to the project being worked on. Default tools: Read, Write, Edit, Glob, Grep, Bash (unrestricted).

### Tool assignment guidelines:
- Give agents \`WebFetch\`/\`WebSearch\` when they need to access URLs, APIs, or research online
- Give agents \`Edit\` when they need to modify existing code (not just write new files)
- Give agents \`Bash\` with \`accessLevel: "full"\` when they need to run builds, tests, git commands, or system tools
- Keep agents minimal — don't give every agent every tool. A research agent needs WebFetch/WebSearch but not Edit. A code reviewer needs Read/Glob/Grep but not Write.

## Response format

Always respond in this exact format:

MESSAGE:
<your conversational response to the user>

ACTIONS:
<JSON array of actions, or [] if no actions needed>

## Guidelines

- When designing workflows, think about the logical flow: which agent should go first, what data gets passed where
- Use Opus for complex reasoning, analysis, architecture decisions. Use Sonnet for straightforward tasks like formatting, summarization, simple code generation
- Position nodes in a readable top-to-bottom flow. Start around x:300,y:100 and space nodes ~200px vertically apart
- Write detailed, specific prompts for each agent — vague prompts produce vague results
- When the user describes a pipeline, create ALL the agents and connections in one response
- When monitoring, look at agent statuses and results to give useful feedback
- If the user asks to modify a specific agent, use update_agent with its ID
- When connecting agents, the "from" agent's output becomes input context for the "to" agent
- When a user mentions a URL or GitHub repo, use your tools to look it up and understand the project before building the workflow
- When agents need to read/write code, run tests, or execute commands, ALWAYS set \`accessLevel: "full"\` and \`projectDir\` automatically`;

export function orchestrate(message, workflowState, history = []) {
  return new Promise((resolve, reject) => {
    // Build conversation history section
    const historySection = history.length > 0
      ? `## Conversation history:\n${history.map((m) => `${m.role === "user" ? "User" : "You"}: ${m.content}`).join("\n\n")}\n\n`
      : "";

    const context = `${historySection}## Current workflow state

### Agents on canvas:
${
  workflowState.nodes.length === 0
    ? "(empty — no agents yet)"
    : workflowState.nodes
        .map(
          (n) =>
            `- ID: ${n.id} | "${n.data?.label}" | model: ${n.data?.model || "sonnet"} | access: ${n.data?.accessLevel || "sandboxed"} | tools: ${n.data?.tools?.length ? n.data.tools.join(",") : "(defaults)"} | status: ${n.status || "idle"} | position: (${Math.round(n.position?.x || 0)}, ${Math.round(n.position?.y || 0)})${n.result ? `\n  Result preview: ${n.result.slice(0, 200)}` : ""}`
        )
        .join("\n")
}

### Connections:
${
  workflowState.edges.length === 0
    ? "(none)"
    : workflowState.edges
        .map((e) => {
          const fromLabel = workflowState.nodes.find((n) => n.id === e.source)?.data?.label || e.source;
          const toLabel = workflowState.nodes.find((n) => n.id === e.target)?.data?.label || e.target;
          return `- "${fromLabel}" → "${toLabel}"`;
        })
        .join("\n")
}

### Settings:
- Loop count: ${workflowState.loopCount || 1}
- Running: ${workflowState.isRunning ? "yes" : "no"}

## Current user message:
${message}`;

    const proc = spawn(
      "claude",
      [
        "-p",
        "--model", "sonnet",
        "--output-format", "json",
        "--dangerously-skip-permissions",
        "--system-prompt", ORCHESTRATOR_SYSTEM_PROMPT,
        context,
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.env.HOME,
        env: { ...process.env },
      }
    );

    proc.stdin.end();

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      const filteredStderr = stderr.replace(/Warning: no stdin data.*?\n?/g, "").trim();
      if (code !== 0) return reject(new Error(filteredStderr || "Orchestrator failed"));

      try {
        let text = stdout;
        // Try to parse as JSON (claude output format)
        try {
          const json = JSON.parse(stdout);
          text = typeof json.result === "string" ? json.result : stdout;
        } catch {}

        // Parse the MESSAGE: and ACTIONS: sections
        const messagePart = text.match(/MESSAGE:\s*([\s\S]*?)(?=ACTIONS:|$)/i);
        const actionsPart = text.match(/ACTIONS:\s*(\[[\s\S]*\])/i);

        const responseMessage = messagePart
          ? messagePart[1].trim()
          : text.trim();

        let actions = [];
        if (actionsPart) {
          try {
            actions = JSON.parse(actionsPart[1]);
          } catch {}
        }

        resolve({ message: responseMessage, actions });
      } catch {
        resolve({ message: stdout.trim(), actions: [] });
      }
    });

    proc.on("error", reject);
  });
}
