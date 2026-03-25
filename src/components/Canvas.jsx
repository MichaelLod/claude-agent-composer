import { useCallback, useRef, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import AgentNode from "./AgentNode";
import useWorkflowStore from "../store/workflowStore";

const nodeTypes = { agent: AgentNode };

function Flow() {
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition } = useReactFlow();

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const addEdge = useWorkflowStore((s) => s.addEdge);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const addNode = useWorkflowStore((s) => s.addNode);
  const agentStatuses = useWorkflowStore((s) => s.agentStatuses);

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        animated: agentStatuses[edge.source] === "running",
        style: {
          stroke:
            agentStatuses[edge.source] === "complete"
              ? "var(--color-success)"
              : agentStatuses[edge.source] === "running"
              ? "var(--color-running)"
              : "var(--color-border-bright)",
          strokeWidth: 2,
        },
      })),
    [edges, agentStatuses]
  );

  const onNodesChange = useCallback(
    (changes) => {
      const state = useWorkflowStore.getState();
      let updated = [...state.nodes];
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          updated = updated.map((n) =>
            n.id === change.id ? { ...n, position: change.position } : n
          );
        } else if (change.type === "remove") {
          updated = updated.filter((n) => n.id !== change.id);
        } else if (change.type === "dimensions" && change.dimensions) {
          updated = updated.map((n) =>
            n.id === change.id
              ? { ...n, measured: { width: change.dimensions.width, height: change.dimensions.height } }
              : n
          );
        }
      }
      setNodes(updated);
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      const state = useWorkflowStore.getState();
      let updated = [...state.edges];
      for (const change of changes) {
        if (change.type === "remove") {
          updated = updated.filter((e) => e.id !== change.id);
        }
      }
      setEdges(updated);
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (connection) => {
      addEdge(connection);
    },
    [addEdge]
  );

  const onNodeClick = useCallback(
    (_, node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/agent-data");
      if (!raw) return;

      const agentData = JSON.parse(raw);
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode({ ...agentData, position });
    },
    [screenToFlowPosition, addNode]
  );

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Backspace"
        multiSelectionKeyCode="Meta"
        className="bg-canvas"
        defaultEdgeOptions={{
          type: "smoothstep",
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.05)"
        />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={(n) => {
            const status = useWorkflowStore.getState().agentStatuses[n.id];
            if (status === "running") return "var(--color-running)";
            if (status === "complete") return "var(--color-success)";
            if (status === "error") return "var(--color-error)";
            return "var(--color-surface-3)";
          }}
          maskColor="rgba(0,0,0,0.7)"
        />
      </ReactFlow>
    </div>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
