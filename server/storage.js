import {
  readFileSync, writeFileSync, mkdirSync, readdirSync,
  unlinkSync, existsSync, statSync, rmSync,
} from "fs";
import { join, resolve } from "path";

const DATA_DIR = join(process.cwd(), ".composer");
const WORKFLOWS_DIR = join(DATA_DIR, "workflows");
const SHARED_DIR = join(DATA_DIR, "shared");

export { SHARED_DIR };

mkdirSync(WORKFLOWS_DIR, { recursive: true });
mkdirSync(SHARED_DIR, { recursive: true });

// --- Per-agent workspace ---
// Each agent gets its own isolated folder:
//   .composer/agents/<agent-id>/
//   ├── config.json       # label, model, metadata
//   ├── instructions.md   # the agent's system prompt
//   └── memory/           # agent reads/writes its own memories here

export function agentDir(agentId) {
  const dir = resolve(DATA_DIR, "agents", agentId);
  mkdirSync(join(dir, "memory"), { recursive: true });
  return dir;
}

export function saveAgent(agent) {
  const id = agent.id || crypto.randomUUID();
  const dir = agentDir(id);

  const config = {
    id,
    label: agent.label || "Untitled Agent",
    model: agent.model || "sonnet",
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(join(dir, "config.json"), JSON.stringify(config, null, 2));
  writeFileSync(join(dir, "instructions.md"), agent.prompt || "");

  return { ...config, prompt: agent.prompt || "" };
}

export function getAgent(id) {
  const dir = agentDir(id);
  const configPath = join(dir, "config.json");
  if (!existsSync(configPath)) return null;

  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  const instructionsPath = join(dir, "instructions.md");
  const prompt = existsSync(instructionsPath)
    ? readFileSync(instructionsPath, "utf-8")
    : "";

  return { ...config, prompt };
}

export function listAgents() {
  const agentsDir = join(DATA_DIR, "agents");
  if (!existsSync(agentsDir)) return [];
  try {
    return readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => getAgent(d.name))
      .filter(Boolean)
      .sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  } catch {
    return [];
  }
}

export function deleteAgent(id) {
  const dir = resolve(DATA_DIR, "agents", id);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

// --- Per-agent memory (server-side read for UI) ---

export function loadMemories(agentId) {
  const dir = join(agentDir(agentId), "memory");
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const content = readFileSync(join(dir, f), "utf-8");
        const stat = statSync(join(dir, f));
        return {
          id: f.replace(/\.md$/, ""),
          filename: f,
          content,
          createdAt: stat.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } catch {
    return [];
  }
}

export function deleteMemory(agentId, memoryId) {
  const path = join(agentDir(agentId), "memory", `${memoryId}.md`);
  if (existsSync(path)) unlinkSync(path);
}

export function clearMemories(agentId) {
  const dir = join(agentDir(agentId), "memory");
  try {
    for (const f of readdirSync(dir)) unlinkSync(join(dir, f));
  } catch {}
}

// --- Workflow storage ---

export function saveWorkflow(workflow) {
  const id = workflow.id || crypto.randomUUID();
  const data = { ...workflow, id, updatedAt: new Date().toISOString() };
  writeFileSync(join(WORKFLOWS_DIR, `${id}.json`), JSON.stringify(data, null, 2));
  return data;
}

export function listWorkflows() {
  try {
    return readdirSync(WORKFLOWS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(WORKFLOWS_DIR, f), "utf-8")))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch {
    return [];
  }
}

export function getWorkflow(id) {
  const path = join(WORKFLOWS_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function deleteWorkflow(id) {
  const path = join(WORKFLOWS_DIR, `${id}.json`);
  if (existsSync(path)) unlinkSync(path);
}
