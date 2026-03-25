import {
  Play,
  Square,
  RotateCcw,
  Repeat,
  Minus,
  Plus,
  Save,
  Upload,
  Workflow,
} from "lucide-react";
import useWorkflowStore from "../store/workflowStore";

export default function Toolbar() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const isRunning = useWorkflowStore((s) => s.isRunning);
  const loopCount = useWorkflowStore((s) => s.loopCount);
  const currentLoop = useWorkflowStore((s) => s.currentLoop);
  const totalLoops = useWorkflowStore((s) => s.totalLoops);
  const setLoopCount = useWorkflowStore((s) => s.setLoopCount);
  const setRunning = useWorkflowStore((s) => s.setRunning);
  const setWorkflowId = useWorkflowStore((s) => s.setWorkflowId);
  const resetExecution = useWorkflowStore((s) => s.resetExecution);
  const clearAll = useWorkflowStore((s) => s.clearAll);
  const workflowId = useWorkflowStore((s) => s.workflowId);

  const handleRun = async () => {
    if (nodes.length === 0) return;
    resetExecution();
    setRunning(true);

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges, loopCount }),
      });
      const data = await res.json();
      setWorkflowId(data.workflowId);
    } catch {
      setRunning(false);
    }
  };

  const handleStop = async () => {
    if (!workflowId) return;
    try {
      await fetch(`/api/cancel/${workflowId}`, { method: "POST" });
    } catch {}
    setRunning(false);
  };

  const handleSave = () => {
    const data = JSON.stringify({ nodes, edges, loopCount }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workflow.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        const store = useWorkflowStore.getState();
        store.clearAll();
        if (data.nodes) store.setNodes(data.nodes);
        if (data.edges) store.setEdges(data.edges);
        if (data.loopCount) store.setLoopCount(data.loopCount);
      } catch {}
    };
    input.click();
  };

  return (
    <div className="h-12 bg-surface border-b border-border flex items-center px-4 gap-3 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <Workflow size={18} className="text-accent" />
        <span className="font-semibold text-sm tracking-tight">
          Agent Composer
        </span>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Run Controls */}
      <div className="flex items-center gap-1.5">
        {isRunning ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/20 hover:bg-error/30 text-error text-xs font-medium transition-colors"
          >
            <Square size={12} />
            Stop
          </button>
        ) : (
          <button
            onClick={handleRun}
            disabled={nodes.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/20 hover:bg-success/30 text-success text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Play size={12} />
            Run
          </button>
        )}

        <button
          onClick={resetExecution}
          disabled={isRunning}
          className="p-1.5 rounded-lg hover:bg-surface-2 text-text-dim hover:text-text disabled:opacity-40 transition-colors"
          title="Reset"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Loop Control */}
      <div className="flex items-center gap-1.5">
        <Repeat size={13} className="text-text-dim" />
        <span className="text-[11px] text-text-dim">Loops:</span>
        <div className="flex items-center bg-surface-2 rounded-lg border border-border">
          <button
            onClick={() => setLoopCount(loopCount - 1)}
            disabled={loopCount <= 1 || isRunning}
            className="p-1 hover:bg-surface-3 rounded-l-lg text-text-dim hover:text-text disabled:opacity-30 transition-colors"
          >
            <Minus size={12} />
          </button>
          <span className="px-2 text-xs font-medium min-w-[24px] text-center">
            {loopCount}
          </span>
          <button
            onClick={() => setLoopCount(loopCount + 1)}
            disabled={isRunning}
            className="p-1 hover:bg-surface-3 rounded-r-lg text-text-dim hover:text-text disabled:opacity-30 transition-colors"
          >
            <Plus size={12} />
          </button>
        </div>

        {isRunning && totalLoops > 0 && (
          <span className="text-[11px] text-running ml-1">
            {currentLoop}/{totalLoops}
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Status */}
      {isRunning && (
        <div className="flex items-center gap-2 mr-3">
          <div className="w-2 h-2 rounded-full bg-running animate-pulse" />
          <span className="text-[11px] text-running font-medium">Running</span>
        </div>
      )}

      {/* File Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleSave}
          className="p-1.5 rounded-lg hover:bg-surface-2 text-text-dim hover:text-text transition-colors"
          title="Save workflow"
        >
          <Save size={14} />
        </button>
        <button
          onClick={handleLoad}
          className="p-1.5 rounded-lg hover:bg-surface-2 text-text-dim hover:text-text transition-colors"
          title="Load workflow"
        >
          <Upload size={14} />
        </button>
        <button
          onClick={clearAll}
          disabled={isRunning}
          className="p-1.5 rounded-lg hover:bg-surface-2 text-text-dim hover:text-text disabled:opacity-40 transition-colors"
          title="Clear all"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
