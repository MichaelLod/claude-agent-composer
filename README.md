# Claude Agent Composer

A visual workflow builder for composing, chaining, and orchestrating Claude agents locally using the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code).

Drag and drop agents onto a canvas, wire them together, set each to Sonnet or Opus, and run multi-step workflows with looping — all from a local web UI.

## Features

- **Visual drag-and-drop canvas** — build agent pipelines by dragging nodes and connecting them with edges
- **Agent chaining** — output from one agent feeds as context into the next
- **Per-agent model selection** — run each agent on Sonnet (fast) or Opus (deep reasoning)
- **Loop execution** — run workflows multiple times with configurable loop count
- **AI orchestrator** — describe what you want in natural language and the orchestrator builds the workflow for you
- **Preset agent library** — Code Writer, Code Reviewer, Bug Fixer, Architect, Security Auditor, Research Agent, and more
- **Custom agents** — create agents manually or with AI-assisted generation
- **Per-agent memory** — each agent has its own persistent workspace with memory files that survive across runs
- **Shared workspace** — agents can collaborate by reading/writing files to a shared folder
- **Access levels** — sandbox agents to their workspace, or give them full system access for testing (simulators, browsers, build tools)
- **Real-time status** — live node animations, execution log, and result inspection
- **Save/Load** — export and import workflows as JSON

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated (`claude` available in PATH)

## Quick Start

```bash
git clone https://github.com/MichaelLod/claude-agent-composer.git
cd claude-agent-composer
npm install
npm run dev
```

Open **http://localhost:5173**

## How It Works

### Architecture

```
Browser (React + React Flow)
    ↕ WebSocket + REST
Node.js Server (Express, port 3577)
    ↕ spawns processes
Claude Code CLI (claude -p)
```

Each agent runs as an isolated `claude -p` subprocess with its own system prompt, model selection, and working directory.

### Agent Workspaces

Every agent gets a private folder under `.composer/agents/<id>/`:

```
.composer/
├── agents/
│   └── <agent-id>/
│       ├── config.json       # agent settings
│       ├── instructions.md   # system prompt
│       └── memory/           # persistent memory (agent-managed)
├── shared/                   # shared workspace (all agents can read/write)
└── workflows/                # saved workflow files
```

- **Private workspace**: only the owning agent can access it
- **Shared workspace**: all agents can read/write — use it to pass files between agents
- **Memory**: agents can read/write `.md` files in their `memory/` folder to remember things across runs

### Access Levels

| Level | Bash | File Access | Use Case |
|-------|------|-------------|----------|
| **Sandboxed** | `ls`, `cat` only | Own workspace + shared folder | Prompt-only agents, analysis, writing |
| **Full Access** | Unrestricted | Workspace + shared + project dir | Testing, building, simulators, browsers |

### AI Orchestrator

Click the **Orchestrator** button (bottom-right) and describe your workflow in plain English:

- *"Build a pipeline that researches a topic, writes an article, then reviews it"*
- *"Create a testing loop for my project at /path/to/repo with iOS, Android, and browser tests"*
- *"Add a summarizer at the end and set it to 3 loops"*
- *"Switch the reviewer to Opus"*
- *"Run it"*

The orchestrator creates agents, sets prompts and models, wires connections, and can start/stop workflows.

## Usage

### Building Workflows Manually

1. **Add agents** — drag from the sidebar or click to add to canvas
2. **Connect** — drag from a node's bottom handle to another node's top handle
3. **Configure** — click a node to edit its name, prompt, model, and access level
4. **Set loops** — use the loop control in the toolbar
5. **Run** — hit the green Run button

### Creating Custom Agents

**Manual**: expand "Custom Agent" in the sidebar, fill in name/prompt/model, click Add

**AI-generated**: type a description in the "Create with AI" field (e.g., "an agent that reviews PRs for security issues") and it generates the config

### Full Access Agents

For agents that need to interact with the system (run tests, use simulators, build projects):

1. Select the agent node
2. Set Access Level to **Full Access**
3. Enter the **Project Directory** path
4. The agent gets unrestricted shell access scoped to its workspace + the project

## Project Structure

```
├── server/
│   ├── index.js          # Express server + API routes
│   ├── executor.js        # Workflow execution engine
│   ├── orchestrator.js    # AI orchestrator (natural language → actions)
│   ├── ai.js              # AI agent generation
│   └── storage.js         # File-based storage for agents/workflows
├── src/
│   ├── App.jsx            # Main app with WebSocket connection
│   ├── components/
│   │   ├── Canvas.jsx     # React Flow canvas
│   │   ├── AgentNode.jsx  # Custom node component
│   │   ├── Sidebar.jsx    # Agent library + creation
│   │   ├── ConfigPanel.jsx    # Agent config + memory viewer
│   │   ├── Toolbar.jsx        # Run/stop/loop controls
│   │   ├── ResultsPanel.jsx   # Execution log
│   │   └── OrchestratorPanel.jsx  # AI chat interface
│   └── store/
│       └── workflowStore.js   # Zustand state management
├── package.json
└── vite.config.js
```

## Tech Stack

- **Frontend**: React, React Flow, Zustand, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js, Express, WebSocket (ws)
- **Agent Runtime**: Claude Code CLI (`claude -p`)

## License

MIT
