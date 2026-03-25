import { useEffect, useRef, useCallback } from "react";
import Canvas from "./components/Canvas";
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import ConfigPanel from "./components/ConfigPanel";
import ResultsPanel from "./components/ResultsPanel";
import OrchestratorPanel from "./components/OrchestratorPanel";
import useWorkflowStore from "./store/workflowStore";

export default function App() {
  const wsRef = useRef(null);
  const store = useWorkflowStore();

  const connectWS = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const state = useWorkflowStore.getState();

      switch (msg.type) {
        case "workflow:start":
          break;
        case "loop:start":
          state.setCurrentLoop(msg.loop, msg.total);
          state.addLogEntry({
            type: "loop",
            message: `Loop ${msg.loop}/${msg.total} started`,
          });
          break;
        case "agent:start":
          state.updateAgentStatus(msg.nodeId, "running");
          state.addLogEntry({
            type: "agent-start",
            nodeId: msg.nodeId,
            message: `${msg.label} started (${msg.model})`,
          });
          break;
        case "agent:complete":
          state.updateAgentStatus(msg.nodeId, "complete");
          state.setAgentResult(msg.nodeId, msg.result);
          state.addLogEntry({
            type: "agent-complete",
            nodeId: msg.nodeId,
            message: `${msg.label} completed`,
          });
          break;
        case "agent:error":
          state.updateAgentStatus(msg.nodeId, "error");
          state.setAgentResult(msg.nodeId, `ERROR: ${msg.error}`);
          state.addLogEntry({
            type: "agent-error",
            nodeId: msg.nodeId,
            message: `${msg.label} failed: ${msg.error}`,
          });
          break;
        case "loop:end":
          state.addLogEntry({
            type: "loop",
            message: `Loop ${msg.loop}/${msg.total} completed`,
          });
          break;
        case "workflow:complete":
          state.setRunning(false);
          state.addLogEntry({
            type: "workflow",
            message: "Workflow completed",
          });
          break;
        case "workflow:error":
          state.setRunning(false);
          state.addLogEntry({
            type: "error",
            message: `Workflow error: ${msg.error}`,
          });
          break;
      }
    };

    ws.onclose = () => {
      setTimeout(connectWS, 2000);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connectWS();
    return () => wsRef.current?.close();
  }, [connectWS]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 relative">
          <Canvas />
        </div>
        <ConfigPanel />
      </div>
      <ResultsPanel />
      <OrchestratorPanel />
    </div>
  );
}
