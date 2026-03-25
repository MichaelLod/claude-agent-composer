import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  Cpu,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Zap,
} from "lucide-react";
import useWorkflowStore from "../store/workflowStore";

const statusColors = {
  idle: "border-border",
  running: "border-running animate-pulse-ring",
  complete: "border-success",
  error: "border-error",
};

const statusIcons = {
  idle: Cpu,
  running: Loader2,
  complete: CheckCircle2,
  error: XCircle,
};

function AgentNode({ id, data, selected }) {
  const status = useWorkflowStore((s) => s.agentStatuses[id]) || "idle";
  const selectNode = useWorkflowStore((s) => s.selectNode);

  const StatusIcon = statusIcons[status];
  const isOpus = data.model === "opus";

  return (
    <div
      className={`
        group relative min-w-[180px] rounded-xl border-2 transition-all duration-200 cursor-pointer
        ${statusColors[status]}
        ${selected ? "border-accent shadow-lg shadow-accent-glow" : ""}
        ${status === "idle" && !selected ? "hover:border-border-bright" : ""}
        bg-surface
      `}
      onClick={() => selectNode(id)}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!-top-[6px]"
      />

      {/* Access level badge */}
      {data.accessLevel === "full" && (
        <div className="absolute -top-2.5 left-3 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-warning/20 text-warning">
          Full
        </div>
      )}

      {/* Model badge */}
      <div
        className={`
          absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider
          ${isOpus ? "bg-opus/20 text-opus" : "bg-sonnet/20 text-sonnet"}
        `}
      >
        {isOpus ? (
          <span className="flex items-center gap-1">
            <Sparkles size={9} /> Opus
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Zap size={9} /> Sonnet
          </span>
        )}
      </div>

      <div className="px-4 py-3 pt-4">
        <div className="flex items-center gap-2">
          <StatusIcon
            size={16}
            className={`
              ${status === "running" ? "animate-spin-slow text-running" : ""}
              ${status === "complete" ? "text-success" : ""}
              ${status === "error" ? "text-error" : ""}
              ${status === "idle" ? "text-text-dim" : ""}
            `}
          />
          <span className="font-medium text-sm truncate max-w-[140px]">
            {data.label}
          </span>
        </div>

        {data.prompt && (
          <p className="text-[11px] text-text-dim mt-1.5 line-clamp-2 leading-tight">
            {data.prompt}
          </p>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!-bottom-[6px]"
      />
    </div>
  );
}

export default memo(AgentNode);
