import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import { executeWorkflow, cancelWorkflow } from "./executor.js";
import { generateAgentWithAI } from "./ai.js";
import { orchestrate } from "./orchestrator.js";
import {
  saveAgent, listAgents, getAgent, deleteAgent,
  saveWorkflow, listWorkflows, getWorkflow, deleteWorkflow,
  loadMemories, deleteMemory, clearMemories,
  SHARED_DIR,
} from "./storage.js";
import { readdirSync, readFileSync, statSync, existsSync, rmSync } from "fs";
import { join, relative } from "path";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

app.use(cors());
app.use(express.json());

const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

const runningWorkflows = new Map();

app.post("/api/execute", async (req, res) => {
  const { nodes, edges, loopCount = 1 } = req.body;
  const workflowId = crypto.randomUUID();

  res.json({ workflowId });

  const controller = new AbortController();
  runningWorkflows.set(workflowId, controller);

  try {
    await executeWorkflow(
      workflowId,
      nodes,
      edges,
      loopCount,
      broadcast,
      controller.signal
    );
  } catch (err) {
    if (err.name !== "AbortError") {
      broadcast({
        type: "workflow:error",
        workflowId,
        error: err.message,
      });
    }
  } finally {
    runningWorkflows.delete(workflowId);
  }
});

app.post("/api/cancel/:workflowId", (req, res) => {
  const controller = runningWorkflows.get(req.params.workflowId);
  if (controller) {
    controller.abort();
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: "Workflow not found" });
  }
});

app.post("/api/generate-agent", async (req, res) => {
  try {
    const agent = await generateAgentWithAI(req.body.description);
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Agent library CRUD ---
app.get("/api/agents", (req, res) => res.json(listAgents()));
app.post("/api/agents", (req, res) => res.json(saveAgent(req.body)));
app.get("/api/agents/:id", (req, res) => {
  const agent = getAgent(req.params.id);
  agent ? res.json(agent) : res.status(404).json({ error: "Not found" });
});
app.put("/api/agents/:id", (req, res) => {
  res.json(saveAgent({ ...req.body, id: req.params.id }));
});
app.delete("/api/agents/:id", (req, res) => {
  deleteAgent(req.params.id);
  res.json({ ok: true });
});

// --- Workflow CRUD ---
app.get("/api/workflows", (req, res) => res.json(listWorkflows()));
app.post("/api/workflows", (req, res) => res.json(saveWorkflow(req.body)));
app.get("/api/workflows/:id", (req, res) => {
  const wf = getWorkflow(req.params.id);
  wf ? res.json(wf) : res.status(404).json({ error: "Not found" });
});
app.put("/api/workflows/:id", (req, res) => {
  res.json(saveWorkflow({ ...req.body, id: req.params.id }));
});
app.delete("/api/workflows/:id", (req, res) => {
  deleteWorkflow(req.params.id);
  res.json({ ok: true });
});

// --- Per-agent memory ---
app.get("/api/agents/:id/memory", (req, res) => {
  res.json(loadMemories(req.params.id));
});
app.post("/api/agents/:id/memory", (req, res) => {
  res.json(saveMemory(req.params.id, req.body));
});
app.delete("/api/agents/:id/memory/:memoryId", (req, res) => {
  deleteMemory(req.params.id, req.params.memoryId);
  res.json({ ok: true });
});
app.delete("/api/agents/:id/memory", (req, res) => {
  clearMemories(req.params.id);
  res.json({ ok: true });
});

// --- Orchestrator ---
app.post("/api/orchestrate", async (req, res) => {
  try {
    const { message, workflowState } = req.body;
    const result = await orchestrate(message, workflowState);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Shared workspace ---
function listDirRecursive(dir, base = dir) {
  const entries = [];
  if (!existsSync(dir)) return entries;
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, d.name);
    const rel = relative(base, full);
    if (d.isDirectory()) {
      entries.push({ path: rel, type: "directory" });
      entries.push(...listDirRecursive(full, base));
    } else {
      const stat = statSync(full);
      entries.push({ path: rel, type: "file", size: stat.size, modified: stat.mtime.toISOString() });
    }
  }
  return entries;
}

app.get("/api/shared", (req, res) => {
  res.json(listDirRecursive(SHARED_DIR));
});

app.get("/api/shared/*splat", (req, res) => {
  const filePath = join(SHARED_DIR, req.params.splat);
  if (!filePath.startsWith(SHARED_DIR)) return res.status(403).json({ error: "Forbidden" });
  if (!existsSync(filePath)) return res.status(404).json({ error: "Not found" });
  try {
    const content = readFileSync(filePath, "utf-8");
    res.json({ path: req.params.splat, content });
  } catch {
    res.status(500).json({ error: "Could not read file" });
  }
});

app.delete("/api/shared/*splat", (req, res) => {
  const filePath = join(SHARED_DIR, req.params.splat);
  if (!filePath.startsWith(SHARED_DIR)) return res.status(403).json({ error: "Forbidden" });
  if (existsSync(filePath)) rmSync(filePath, { recursive: true, force: true });
  res.json({ ok: true });
});

const PORT = 3577;
server.listen(PORT, () => {
  console.log(`Agent Composer server running on http://localhost:${PORT}`);
});
