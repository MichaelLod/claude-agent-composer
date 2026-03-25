import { useState } from "react";
import {
  Plus,
  Wand2,
  Code2,
  FileSearch,
  Bug,
  PenTool,
  GitBranch,
  Shield,
  BookOpen,
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import useWorkflowStore from "../store/workflowStore";

const presetAgents = [
  {
    label: "Code Writer",
    prompt:
      "Write clean, well-structured code based on the requirements provided. Follow best practices and include error handling.",
    model: "sonnet",
    icon: Code2,
    category: "Development",
  },
  {
    label: "Code Reviewer",
    prompt:
      "Review the provided code for bugs, security issues, performance problems, and adherence to best practices. Provide specific, actionable feedback.",
    model: "sonnet",
    icon: FileSearch,
    category: "Development",
  },
  {
    label: "Bug Fixer",
    prompt:
      "Analyze the reported bug and the provided code. Identify the root cause and provide a fix with an explanation of what was wrong.",
    model: "sonnet",
    icon: Bug,
    category: "Development",
  },
  {
    label: "Technical Writer",
    prompt:
      "Write clear, comprehensive technical documentation for the provided code or system. Include examples and edge cases.",
    model: "sonnet",
    icon: PenTool,
    category: "Documentation",
  },
  {
    label: "Architect",
    prompt:
      "Design the system architecture for the given requirements. Consider scalability, maintainability, and separation of concerns. Provide a detailed plan.",
    model: "opus",
    icon: GitBranch,
    category: "Planning",
  },
  {
    label: "Security Auditor",
    prompt:
      "Perform a security audit of the provided code. Check for OWASP top 10 vulnerabilities, injection risks, authentication issues, and data exposure.",
    model: "opus",
    icon: Shield,
    category: "Quality",
  },
  {
    label: "Research Agent",
    prompt:
      "Research the given topic thoroughly. Provide a comprehensive summary with key findings, pros/cons, and recommendations.",
    model: "opus",
    icon: BookOpen,
    category: "Research",
  },
  {
    label: "Summarizer",
    prompt:
      "Summarize the provided content concisely while preserving all key information. Use bullet points for clarity.",
    model: "sonnet",
    icon: MessageSquare,
    category: "Utility",
  },
];

const categories = [...new Set(presetAgents.map((a) => a.category))];

export default function Sidebar() {
  const addNode = useWorkflowStore((s) => s.addNode);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customModel, setCustomModel] = useState("sonnet");
  const [expandedCategories, setExpandedCategories] = useState(
    new Set(categories)
  );

  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const onDragStart = (event, agent) => {
    event.dataTransfer.setData(
      "application/agent-data",
      JSON.stringify({
        label: agent.label,
        prompt: agent.prompt,
        model: agent.model,
      })
    );
    event.dataTransfer.effectAllowed = "move";
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt }),
      });
      const agent = await res.json();
      if (agent.error) throw new Error(agent.error);
      addNode(agent);
      setAiPrompt("");
    } catch (err) {
      console.error("Failed to generate agent:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddCustom = () => {
    if (!customLabel.trim()) return;
    addNode({
      label: customLabel,
      prompt: customPrompt,
      model: customModel,
    });
    setCustomLabel("");
    setCustomPrompt("");
    setCustomModel("sonnet");
    setShowCustom(false);
  };

  return (
    <div className="w-64 bg-surface border-r border-border flex flex-col overflow-hidden shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
          Agents
        </h2>
      </div>

      {/* AI Generate */}
      <div className="p-3 border-b border-border">
        <label className="text-[11px] font-medium text-text-dim uppercase tracking-wider mb-1.5 block">
          Create with AI
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="Describe your agent..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAIGenerate()}
            className="flex-1 bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-text-dim/50 focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleAIGenerate}
            disabled={isGenerating || !aiPrompt.trim()}
            className="p-1.5 rounded-lg bg-accent hover:bg-accent-dim text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wand2 size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Custom Agent */}
      <div className="p-3 border-b border-border">
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="flex items-center gap-1.5 text-xs text-text-dim hover:text-text transition-colors w-full"
        >
          <Plus size={13} />
          <span>Custom Agent</span>
          {showCustom ? <ChevronDown size={12} className="ml-auto" /> : <ChevronRight size={12} className="ml-auto" />}
        </button>

        {showCustom && (
          <div className="mt-2 space-y-2">
            <input
              type="text"
              placeholder="Agent name"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-text-dim/50 focus:outline-none focus:border-accent"
            />
            <textarea
              placeholder="Agent prompt..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              className="w-full bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-text-dim/50 focus:outline-none focus:border-accent resize-none"
            />
            <div className="flex gap-2 items-center">
              <select
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                className="flex-1 bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent"
              >
                <option value="sonnet">Sonnet</option>
                <option value="opus">Opus</option>
              </select>
              <button
                onClick={handleAddCustom}
                disabled={!customLabel.trim()}
                className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-dim text-white text-xs font-medium disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preset Agents */}
      <div className="flex-1 overflow-y-auto">
        {categories.map((cat) => (
          <div key={cat}>
            <button
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-dim hover:text-text transition-colors"
            >
              {expandedCategories.has(cat) ? (
                <ChevronDown size={11} />
              ) : (
                <ChevronRight size={11} />
              )}
              {cat}
            </button>

            {expandedCategories.has(cat) && (
              <div className="px-2 pb-2 space-y-1">
                {presetAgents
                  .filter((a) => a.category === cat)
                  .map((agent) => {
                    const Icon = agent.icon;
                    return (
                      <div
                        key={agent.label}
                        draggable
                        onDragStart={(e) => onDragStart(e, agent)}
                        onClick={() => addNode(agent)}
                        className="group flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-2 cursor-grab active:cursor-grabbing transition-colors"
                      >
                        <GripVertical
                          size={12}
                          className="text-text-dim/30 group-hover:text-text-dim/60 shrink-0"
                        />
                        <Icon size={14} className="text-text-dim shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {agent.label}
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-semibold uppercase ${
                            agent.model === "opus"
                              ? "text-opus"
                              : "text-sonnet"
                          }`}
                        >
                          {agent.model}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
