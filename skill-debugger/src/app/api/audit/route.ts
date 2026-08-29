import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const skillContent = body.content || "";

    if (!skillContent.trim()) {
      return NextResponse.json(
        { error: "Content is required for audit" },
        { status: 400 }
      );
    }

    // 1. Read custom skill auditor rules directly from .agents/skills/skill-auditor/SKILL.md
    let auditorRules = "";
    const possiblePaths = [
      path.join(process.cwd(), "..", ".agents", "skills", "skill-auditor", "SKILL.md"),
      path.join(process.cwd(), ".agents", "skills", "skill-auditor", "SKILL.md"),
      "D:\\skill\\.agents\\skills\\skill-auditor\\SKILL.md"
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
        auditorRules = fs.readFileSync(/*turbopackIgnore: true*/ p, "utf-8");
        break;
      }
    }

    if (!auditorRules) {
      return NextResponse.json(
        { error: "Failed to read .agents/skills/skill-auditor/SKILL.md" },
        { status: 500 }
      );
    }

    // 2. Prioritize OpenRouter API key, fallback to LatentStack API key
    const openRouterKey = process.env.OPENROUTER_API_KEY || "";
    const latentStackKey = process.env.LATENTSTACK_API_KEY || "";
    const apiKey = openRouterKey || latentStackKey;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is missing in environment variables" },
        { status: 500 }
      );
    }

    const systemPrompt = `You are an expert AI Agent Skill Auditor. You strictly evaluate AI agent skills (SKILL.md files) according to these exact audit rules loaded directly from .agents/skills/skill-auditor/SKILL.md:

--- RULES FROM SKILL.MD BEGIN ---
${auditorRules}
--- RULES FROM SKILL.MD END ---

CRITICAL AUDIT RULES:
1. Evaluate ONLY genuine violations of the 4 guidelines above in the provided text.
2. If the skill's "name:" field in frontmatter is strictly lowercase kebab-case (e.g. "code-reviewer", "app-optimizer", "my-cool-skill-v1" - using ONLY lowercase letters, numbers, and hyphens with NO uppercase letters, NO spaces, and NO underscores), do NOT flag frontmatter name issues.
3. If instruction steps contain specific tools or concrete commands (e.g., "eslint --fix", "ajv validate", "npm test", "read tool", "prettier --write"), do NOT flag them as ambiguous or vague.
4. If bulky schemas/manuals are replaced by links to "./references/..." or removed, do NOT flag progressive disclosure.
5. If the skill contains an "## Output Protocol" section describing the response format, do NOT flag output formatting.
6. If all 4 criteria pass, return "score": 100 and "issues": [].

CRITICAL: Return ONLY a valid JSON object matching this schema without any markdown wrapping or backticks:
{
  "score": <number 0-100>,
  "issues": [
    {
      "id": "<string>",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "category": "frontmatter" | "ambiguity" | "progressive-disclosure" | "output-format",
      "line": <number line location>,
      "description": "<string description of issue>",
      "recommendation": "<string concrete fix recommendation>",
      "fixText": "<string exact replacement text for the line or section at line location>"
    }
  ]
}`;

    // 3. Configure endpoint and model based on key type
    let endpoint = "https://openrouter.ai/api/v1/chat/completions";
    let modelName = "openai/gpt-4o-mini";

    if (apiKey.startsWith("ls-")) {
      endpoint = "https://latentstack.dev/v1/chat/completions";
      modelName = "latentrouter/gemini/gemini-3.7-flash";
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    };

    // 4. Call LLM API with the loaded SKILL.md rules
    let response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please audit the following SKILL.md file:\n\n${skillContent}` }
        ],
        temperature: 0.0,
        response_format: { type: "json_object" }
      })
    });

    // If primary endpoint fails, fallback to secondary key
    if (!response.ok && openRouterKey && apiKey.startsWith("ls-")) {
      const fallbackHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openRouterKey}`
      };
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: fallbackHeaders,
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Please audit the following SKILL.md file:\n\n${skillContent}` }
          ],
          temperature: 0.0,
          response_format: { type: "json_object" }
        })
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `LLM API Error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const apiResult = await response.json();
    const rawOutput = apiResult.choices?.[0]?.message?.content || "{}";

    // Clean JSON response string if wrapped in markdown code blocks
    const cleanedOutput = rawOutput
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .replace(/`/g, "")
      .trim();

    const parsedData = JSON.parse(cleanedOutput);

    // Ensure issue IDs and fixText exist
    if (Array.isArray(parsedData.issues)) {
      parsedData.issues = parsedData.issues.map((issue: Record<string, unknown>, idx: number) => ({
        id: issue.id || `issue-api-${idx}-${Date.now()}`,
        severity: issue.severity || "MEDIUM",
        category: issue.category || "ambiguity",
        line: typeof issue.line === "number" ? issue.line : 1,
        description: issue.description || "Unspecified quality concern.",
        recommendation: issue.recommendation || "Review and update line formatting.",
        fixText: typeof issue.fixText === "string" ? issue.fixText : ""
      }));
    }

    return NextResponse.json({
      score: typeof parsedData.score === "number" ? parsedData.score : 70,
      issues: parsedData.issues || []
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
