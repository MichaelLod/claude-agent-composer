import { create } from "zustand";
import { nanoid } from "nanoid";

const useWorkflowStore = create((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  workflowId: null,
  isRunning: false,
  loopCount: 1,
  agentResults: {},
  agentStatuses: {},
  currentLoop: 0,
  totalLoops: 0,
  executionLog: [],

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set((state) => {
      const updated = applyNodeChanges(state.nodes, changes);
      return { nodes: updated };
    });
  },

  addNode: (data) => {
    const id = nanoid(8);
    const newNode = {
      id,
      type: "agent",
      position: data.position || {
        x: 250 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      },
      data: {
        label: data.label || "New Agent",
        prompt: data.prompt || "",
        model: data.model || "sonnet",
        accessLevel: data.accessLevel || "sandboxed",
        projectDir: data.projectDir || "",
        tools: data.tools || [],
      },
    };
    set((state) => ({ nodes: [...state.nodes, newNode] }));
    return id;
  },

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }));
  },

  removeNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
      selectedNodeId:
        state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    }));
  },

  addEdge: (edge) => {
    const id = `e-${edge.source}-${edge.target}`;
    set((state) => {
      const exists = state.edges.some(
        (e) => e.source === edge.source && e.target === edge.target
      );
      if (exists) return state;
      return { edges: [...state.edges, { ...edge, id }] };
    });
  },

  removeEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    }));
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  setLoopCount: (count) => set({ loopCount: Math.max(1, count) }),

  setRunning: (running) => set({ isRunning: running }),

  setWorkflowId: (id) => set({ workflowId: id }),

  updateAgentStatus: (nodeId, status) => {
    set((state) => ({
      agentStatuses: { ...state.agentStatuses, [nodeId]: status },
    }));
  },

  setAgentResult: (nodeId, result) => {
    set((state) => ({
      agentResults: { ...state.agentResults, [nodeId]: result },
    }));
  },

  setCurrentLoop: (loop, total) => set({ currentLoop: loop, totalLoops: total }),

  addLogEntry: (entry) => {
    set((state) => ({
      executionLog: [...state.executionLog, { ...entry, timestamp: Date.now() }],
    }));
  },

  resetExecution: () =>
    set({
      agentResults: {},
      agentStatuses: {},
      currentLoop: 0,
      totalLoops: 0,
      executionLog: [],
    }),

  clearAll: () =>
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      workflowId: null,
      isRunning: false,
      agentResults: {},
      agentStatuses: {},
      currentLoop: 0,
      totalLoops: 0,
      executionLog: [],
    }),
}));

function applyNodeChanges(nodes, changes) {
  let result = [...nodes];
  for (const change of changes) {
    if (change.type === "position" && change.position) {
      result = result.map((n) =>
        n.id === change.id ? { ...n, position: change.position } : n
      );
    } else if (change.type === "remove") {
      result = result.filter((n) => n.id !== change.id);
    } else if (change.type === "select") {
      // handled elsewhere
    }
  }
  return result;
}

export default useWorkflowStore;
