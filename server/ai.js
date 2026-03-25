import { spawn } from "child_process";

export function generateAgentWithAI(description) {
  return new Promise((resolve, reject) => {
    const prompt = `You are helping create an agent configuration for a visual agent composer tool.
Given this description: "${description}"

Return ONLY a JSON object (no markdown, no explanation) with these fields:
- "label": a short name for the agent (2-4 words)
- "prompt": a detailed system prompt for what this agent should do
- "model": either "sonnet" or "opus" (use opus for complex reasoning tasks, sonnet for simpler ones)

Example response:
{"label":"Code Reviewer","prompt":"Review the provided code for bugs, security issues, and best practices. Provide specific suggestions with line references.","model":"sonnet"}`;

    const proc = spawn("claude", ["-p", "--model", "sonnet", "--output-format", "json", prompt], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdin.end();

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      const filteredStderr = stderr.replace(/Warning: no stdin data.*?\n?/g, "").trim();
      if (code !== 0) return reject(new Error(filteredStderr || "AI generation failed"));

      try {
        const json = JSON.parse(stdout);
        const text = json.result || stdout;
        // Try to extract JSON from the response
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          resolve(JSON.parse(match[0]));
        } else {
          reject(new Error("Could not parse agent configuration from AI response"));
        }
      } catch {
        const match = stdout.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            resolve(JSON.parse(match[0]));
          } catch {
            reject(new Error("Could not parse agent configuration"));
          }
        } else {
          reject(new Error("Could not parse agent configuration"));
        }
      }
    });

    proc.on("error", reject);
  });
}
