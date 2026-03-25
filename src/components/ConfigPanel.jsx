import { useState, useEffect } from "react";
import { Sparkles, Zap, Trash2, X, Brain, Eraser, Shield, ShieldOff, FolderOpen } from "lucide-react";
import useWorkflowStore from "../store/workflowStore";

export default function ConfigPanel() {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const agentResults = useWorkflowStore((s) => s.agentResults);
  const agentStatuses = useWorkflowStore((s) => s.agentStatuses);

  const [memories, setMemories] = useState([]);
  const [memoryCount, setMemoryCount] = useState(0);

  const node = nodes.find((n) => n.id === selectedNodeId);

  useEffect(() => {
    if (!node) return;
    fetchMemories(node.id);
  }, [node?.id, agentStatuses[node?.id]]);

  async function fetchMemories(agentId) {
    try {
      const res = await fetch(`/api/agents/${agentId}/memory`);
      const data = await res.json();
      setMemories(data);
      setMemoryCount(data.length);
    } catch {
      setMemories([]);
      setMemoryCount(0);
    }
  }

  async function handleClearMemory() {
    if (!node) return;
    await fetch(`/api/agents/${node.id}/memory`, { method: "DELETE" });
    setMemories([]);
    setMemoryCount(0);
  }

  async function handleDeleteMemory(memoryId) {
    if (!node) return;
    await fetch(`/api/agents/${node.id}/memory/${memoryId}`, {
      method: "DELETE",
    });
    fetchMemories(node.id);
  }

  if (!node) return null;

  const data = node.data;
  const status = agentStatuses[node.id] || "idle";
  const result = agentResults[node.id];

  return (
    <div className="w-80 bg-surface border-l border-border flex flex-col overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
          Agent Config
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => removeNode(node.id)}
            className="p-1 rounded hover:bg-error/20 text-text-dim hover:text-error transition-colors"
            title="Delete agent"
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={() => selectNode(null)}
            className="p-1 rounded hover:bg-surface-2 text-text-dim hover:text-text transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Name */}
        <div>
          <label className="text-[11px] font-medium text-text-dim uppercase tracking-wider mb-1.5 block">
            Name
          </label>
          <input
            type="text"
            value={data.label}
            onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
          />
        </div>

        {/* Model */}
        <div>
          <label className="text-[11px] font-medium text-text-dim uppercase tracking-wider mb-1.5 block">
            Model
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateNodeData(node.id, { model: "sonnet" })}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                data.model === "sonnet"
                  ? "border-sonnet bg-sonnet/10 text-sonnet"
                  : "border-border text-text-dim hover:border-border-bright"
              }`}
            >
              <Zap size={12} />
              Sonnet
            </button>
            <button
              onClick={() => updateNodeData(node.id, { model: "opus" })}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                data.model === "opus"
                  ? "border-opus bg-opus/10 text-opus"
                  : "border-border text-text-dim hover:border-border-bright"
              }`}
            >
              <Sparkles size={12} />
              Opus
            </button>
          </div>
        </div>

        {/* Access Level */}
        <div>
          <label className="text-[11px] font-medium text-text-dim uppercase tracking-wider mb-1.5 block">
            Access Level
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateNodeData(node.id, { accessLevel: "sandboxed" })}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                (data.accessLevel || "sandboxed") === "sandboxed"
                  ? "border-success bg-success/10 text-success"
                  : "border-border text-text-dim hover:border-border-bright"
              }`}
            >
              <Shield size={12} />
              Sandboxed
            </button>
            <button
              onClick={() => updateNodeData(node.id, { accessLevel: "full" })}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                data.accessLevel === "full"
                  ? "border-warning bg-warning/10 text-warning"
                  : "border-border text-text-dim hover:border-border-bright"
              }`}
            >
              <ShieldOff size={12} />
              Full Access
            </button>
          </div>
          {data.accessLevel === "full" && (
            <p className="text-[10px] text-warning/70 mt-1.5 leading-tight">
              Full access agents can run any command, access simulators, browsers, and modify project files.
            </p>
          )}
        </div>

        {/* Project Directory */}
        {data.accessLevel === "full" && (
          <div>
            <label className="text-[11px] font-medium text-text-dim uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FolderOpen size={11} />
              Project Directory
            </label>
            <input
              type="text"
              value={data.projectDir || ""}
              onChange={(e) => updateNodeData(node.id, { projectDir: e.target.value })}
              placeholder="/path/to/your/project"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-text font-mono placeholder:text-text-dim/50 focus:outline-none focus:border-accent"
            />
          </div>
        )}

        {/* Prompt */}
        <div>
          <label className="text-[11px] font-medium text-text-dim uppercase tracking-wider mb-1.5 block">
            Prompt
          </label>
          <textarea
            value={data.prompt}
            onChange={(e) =>
              updateNodeData(node.id, { prompt: e.target.value })
            }
            rows={8}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-text leading-relaxed focus:outline-none focus:border-accent resize-none"
            placeholder="What should this agent do?"
          />
        </div>

        {/* Memory */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-medium text-text-dim uppercase tracking-wider flex items-center gap-1.5">
              <Brain size={11} />
              Memory ({memoryCount})
            </label>
            {memoryCount > 0 && (
              <button
                onClick={handleClearMemory}
                className="flex items-center gap-1 text-[10px] text-text-dim hover:text-error transition-colors"
                title="Clear all memories for this agent"
              >
                <Eraser size={10} />
                Clear
              </button>
            )}
          </div>

          {memories.length === 0 ? (
            <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-[11px] text-text-dim italic">
              No memories yet. Memories are created automatically after each run.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {memories.map((mem) => (
                <div
                  key={mem.id}
                  className="bg-surface-2 border border-border rounded-lg px-2.5 py-2 group"
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-[10px] text-text leading-tight line-clamp-3">
                      {mem.content}
                    </p>
                    <button
                      onClick={() => handleDeleteMemory(mem.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-text-dim hover:text-error transition-all shrink-0"
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <span className="text-[9px] text-text-dim/50 mt-1 block">
                    {new Date(mem.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="text-[11px] font-medium text-text-dim uppercase tracking-wider mb-1.5 block">
            Status
          </label>
          <div
            className={`px-3 py-2 rounded-lg text-xs font-medium ${
              status === "running"
                ? "bg-running/10 text-running"
                : status === "complete"
                ? "bg-success/10 text-success"
                : status === "error"
                ? "bg-error/10 text-error"
                : "bg-surface-2 text-text-dim"
            }`}
          >
            {status === "idle"
              ? "Idle"
              : status === "running"
              ? "Running..."
              : status === "complete"
              ? "Completed"
              : "Error"}
          </div>
        </div>

        {/* Result */}
        {result && (
          <div>
            <label className="text-[11px] font-medium text-text-dim uppercase tracking-wider mb-1.5 block">
              Result
            </label>
            <div className="bg-surface-2 border border-border rounded-lg p-3 max-h-60 overflow-y-auto">
              <pre className="text-[11px] text-text whitespace-pre-wrap break-words leading-relaxed font-mono">
                {result}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
