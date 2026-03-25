import { useState, useRef, useEffect } from "react";
import {
  BotMessageSquare,
  Send,
  Loader2,
  X,
  Sparkles,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import useWorkflowStore from "../store/workflowStore";

export default function OrchestratorPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "I'm your workflow orchestrator. Describe what you want to build and I'll set up the agents, connections, and configuration for you.\n\nTry: \"Build me a pipeline that researches a topic, writes a blog post, then reviews it for quality.\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const store = useWorkflowStore;
  const nodes = store((s) => s.nodes);
  const edges = store((s) => s.edges);
  const loopCount = store((s) => s.loopCount);
  const isRunning = store((s) => s.isRunning);
  const agentStatuses = store((s) => s.agentStatuses);
  const agentResults = store((s) => s.agentResults);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function applyActions(actions) {
    const state = store.getState();

    for (const action of actions) {
      switch (action.action) {
        case "add_agent": {
          state.addNode({
            label: action.label,
            prompt: action.prompt,
            model: action.model || "sonnet",
            accessLevel: action.accessLevel || "sandboxed",
            projectDir: action.projectDir || "",
            tools: action.tools || [],
            position: { x: action.x || 300, y: action.y || 200 },
          });
          break;
        }
        case "remove_agent": {
          state.removeNode(action.id);
          break;
        }
        case "connect": {
          // Resolve IDs — if the orchestrator returned labels we need to find the latest nodes
          const fromNode = resolveNodeId(action.from);
          const toNode = resolveNodeId(action.to);
          if (fromNode && toNode) {
            state.addEdge({ source: fromNode, target: toNode });
          }
          break;
        }
        case "disconnect": {
          const currentEdges = store.getState().edges;
          const fromId = resolveNodeId(action.from);
          const toId = resolveNodeId(action.to);
          const filtered = currentEdges.filter(
            (e) => !(e.source === fromId && e.target === toId)
          );
          state.setEdges(filtered);
          break;
        }
        case "update_agent": {
          const updates = {};
          if (action.label) updates.label = action.label;
          if (action.prompt) updates.prompt = action.prompt;
          if (action.model) updates.model = action.model;
          if (action.accessLevel) updates.accessLevel = action.accessLevel;
          if (action.projectDir !== undefined) updates.projectDir = action.projectDir;
          if (action.tools) updates.tools = action.tools;
          state.updateNodeData(action.id, updates);
          break;
        }
        case "set_loops": {
          state.setLoopCount(action.count);
          break;
        }
        case "run_workflow": {
          handleRunWorkflow();
          break;
        }
        case "stop_workflow": {
          handleStopWorkflow();
          break;
        }
        case "clear_all": {
          state.clearAll();
          break;
        }
      }
    }
  }

  function resolveNodeId(idOrLabel) {
    const currentNodes = store.getState().nodes;
    // Direct ID match
    const direct = currentNodes.find((n) => n.id === idOrLabel);
    if (direct) return direct.id;
    // Label match
    const byLabel = currentNodes.find(
      (n) => n.data?.label?.toLowerCase() === idOrLabel?.toLowerCase()
    );
    if (byLabel) return byLabel.id;
    return idOrLabel;
  }

  async function handleRunWorkflow() {
    const state = store.getState();
    if (state.nodes.length === 0) return;
    state.resetExecution();
    state.setRunning(true);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: state.nodes,
          edges: state.edges,
          loopCount: state.loopCount,
        }),
      });
      const data = await res.json();
      state.setWorkflowId(data.workflowId);
    } catch {
      state.setRunning(false);
    }
  }

  async function handleStopWorkflow() {
    const state = store.getState();
    if (!state.workflowId) return;
    try {
      await fetch(`/api/cancel/${state.workflowId}`, { method: "POST" });
    } catch {}
    state.setRunning(false);
  }

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      // Build workflow state with statuses and results for context
      const currentNodes = store.getState().nodes;
      const currentEdges = store.getState().edges;
      const workflowState = {
        nodes: currentNodes.map((n) => ({
          ...n,
          status: agentStatuses[n.id] || "idle",
          result: agentResults[n.id]?.slice(0, 500) || null,
        })),
        edges: currentEdges,
        loopCount,
        isRunning,
      };

      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, workflowState }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${data.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
            actions: data.actions,
          },
        ]);

        if (data.actions?.length > 0) {
          // Small delay so the user sees the message first
          setTimeout(() => applyActions(data.actions), 300);
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Failed to reach orchestrator: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-14 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent hover:bg-accent-dim text-white shadow-lg shadow-accent-glow transition-all"
      >
        <BotMessageSquare size={18} />
        <span className="text-sm font-medium">Orchestrator</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-14 right-4 z-50 w-[420px] h-[520px] bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <span className="font-semibold text-sm">Orchestrator</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded hover:bg-surface-3 text-text-dim hover:text-text transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent/20 text-text"
                  : "bg-surface-2 text-text"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.actions?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <span className="text-[10px] text-text-dim uppercase tracking-wider">
                    {msg.actions.length} action{msg.actions.length !== 1 && "s"} applied
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {msg.actions.map((a, j) => (
                      <div
                        key={j}
                        className="text-[11px] text-text-dim flex items-center gap-1"
                      >
                        <ChevronRight size={10} className="text-accent shrink-0" />
                        {formatAction(a)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-2 rounded-xl px-4 py-3">
              <Loader2 size={16} className="animate-spin text-accent" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Describe your workflow..."
            className="flex-1 bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim/50 focus:outline-none focus:border-accent"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-2.5 rounded-xl bg-accent hover:bg-accent-dim text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatAction(action) {
  switch (action.action) {
    case "add_agent":
      return `Add "${action.label}" (${action.model || "sonnet"}${action.tools?.length ? `, ${action.tools.length} tools` : ""})`;
    case "remove_agent":
      return `Remove agent ${action.id}`;
    case "connect":
      return `Connect ${action.from} → ${action.to}`;
    case "disconnect":
      return `Disconnect ${action.from} → ${action.to}`;
    case "update_agent":
      return `Update agent ${action.id}`;
    case "set_loops":
      return `Set loops to ${action.count}`;
    case "run_workflow":
      return "Run workflow";
    case "stop_workflow":
      return "Stop workflow";
    case "clear_all":
      return "Clear canvas";
    default:
      return JSON.stringify(action);
  }
}
