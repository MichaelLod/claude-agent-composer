import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  CircleDot,
  CheckCircle2,
  XCircle,
  Repeat,
  Workflow,
} from "lucide-react";
import useWorkflowStore from "../store/workflowStore";

const typeIcons = {
  "agent-start": CircleDot,
  "agent-complete": CheckCircle2,
  "agent-error": XCircle,
  loop: Repeat,
  workflow: Workflow,
  error: XCircle,
};

const typeColors = {
  "agent-start": "text-running",
  "agent-complete": "text-success",
  "agent-error": "text-error",
  loop: "text-warning",
  workflow: "text-accent",
  error: "text-error",
};

export default function ResultsPanel() {
  const [expanded, setExpanded] = useState(false);
  const executionLog = useWorkflowStore((s) => s.executionLog);
  const isRunning = useWorkflowStore((s) => s.isRunning);

  if (executionLog.length === 0 && !isRunning) return null;

  return (
    <div
      className={`bg-surface border-t border-border transition-all duration-200 ${
        expanded ? "h-52" : "h-9"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full h-9 px-4 flex items-center gap-2 text-xs hover:bg-surface-2 transition-colors"
      >
        {expanded ? (
          <ChevronDown size={12} className="text-text-dim" />
        ) : (
          <ChevronUp size={12} className="text-text-dim" />
        )}
        <span className="font-medium text-text-dim">Execution Log</span>
        <span className="text-text-dim/50">({executionLog.length})</span>
        {isRunning && (
          <div className="w-1.5 h-1.5 rounded-full bg-running animate-pulse ml-1" />
        )}
      </button>

      {expanded && (
        <div className="h-[calc(100%-36px)] overflow-y-auto px-4 pb-2">
          {executionLog.map((entry, i) => {
            const Icon = typeIcons[entry.type] || CircleDot;
            const color = typeColors[entry.type] || "text-text-dim";

            return (
              <div key={i} className="flex items-start gap-2 py-1">
                <Icon size={12} className={`${color} mt-0.5 shrink-0`} />
                <span className="text-[11px] text-text-dim">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-[11px] text-text">{entry.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
