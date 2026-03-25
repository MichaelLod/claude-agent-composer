import { spawn } from "child_process";

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Orchestrator for a visual agent workflow composer. You help users design, configure, monitor, and control agent workflows.

## What you can do

You respond with TWO parts:
1. A natural language message to the user (conversational, helpful)
2. A JSON actions array that the system will execute on the workflow

## Available actions

\`\`\`json
[
  { "action": "add_agent", "label": "Agent Name", "prompt": "system prompt", "model": "sonnet|opus", "accessLevel": "sandboxed|full", "projectDir": "/path/to/project", "x": 300, "y": 200 },
  { "action": "remove_agent", "id": "<node-id>" },
  { "action": "connect", "from": "<node-id-or-label>", "to": "<node-id-or-label>" },
  { "action": "disconnect", "from": "<node-id-or-label>", "to": "<node-id-or-label>" },
  { "action": "update_agent", "id": "<node-id>", "label": "...", "prompt": "...", "model": "...", "accessLevel": "...", "projectDir": "..." },
  { "action": "set_loops", "count": 3 },
  { "action": "run_workflow" },
  { "action": "stop_workflow" },
  { "action": "clear_all" }
]
\`\`\`

### Access levels:
- \`sandboxed\` (default): Agent can only read/write in its private workspace and the shared folder. Bash is restricted to ls and cat.
- \`full\`: Agent gets unrestricted shell access, can run simulators, browsers, build tools, test suites, etc. Use this for testing agents, CI agents, or any agent that needs to interact with the system. Requires \`projectDir\` to point to the project being worked on.

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
- You can suggest improvements to existing workflows
- If the user asks to modify a specific agent, use update_agent with its ID
- When connecting agents, the "from" agent's output becomes input context for the "to" agent`;

export function orchestrate(message, workflowState) {
  return new Promise((resolve, reject) => {
    const context = `## Current workflow state

### Agents on canvas:
${
  workflowState.nodes.length === 0
    ? "(empty — no agents yet)"
    : workflowState.nodes
        .map(
          (n) =>
            `- ID: ${n.id} | "${n.data?.label}" | model: ${n.data?.model || "sonnet"} | status: ${n.status || "idle"} | position: (${Math.round(n.position?.x || 0)}, ${Math.round(n.position?.y || 0)})${n.result ? `\n  Result preview: ${n.result.slice(0, 200)}` : ""}`
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

## User message:
${message}`;

    const proc = spawn(
      "claude",
      [
        "-p",
        "--model", "sonnet",
        "--output-format", "json",
        "--system-prompt", ORCHESTRATOR_SYSTEM_PROMPT,
        context,
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
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
          text = json.result || stdout;
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
