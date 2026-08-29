"use client";

import React, { useState, useMemo, useRef } from "react";

// Types for Audit & Simulation
export interface AuditIssue {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "frontmatter" | "ambiguity" | "progressive-disclosure" | "output-format";
  line: number;
  description: string;
  recommendation: string;
  fixText?: string;
}

export interface AuditResult {
  score: number;
  issues: AuditIssue[];
}

export interface ConsoleLog {
  id: number;
  type: "info" | "warn" | "error" | "success";
  text: string;
  timestamp: string;
}

// Pre-defined Sample Templates
export const SAMPLE_SKILLS = {
  vague: `---
name: My Cool Skill_v1
description: A skill to optimize the app
---

# App Optimization Skill

1. Read the project files.
2. Clean up bad code and optimize performance.
3. Make sure it looks good and fix any errors you find.
4. Test the app to ensure everything works properly.

## User API Schema Reference
\`\`\`json
{
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "avatar": "string",
    "role": "string",
    "permissions": ["string"],
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "preferences": {
      "theme": "string",
      "notifications": "boolean",
      "language": "string"
    },
    "metadata": {
      "last_login": "timestamp",
      "login_count": "number",
      "ip_address": "string",
      "device": "string"
    }
  }
}
\`\`\`
`,
  optimized: `---
name: code-reviewer
description: Analyzes code diffs for security vulnerabilities, performance issues, and styling guidelines, outputting a structured JSON report.
tags: [code-quality, security, review]
---

# Code Reviewer & Security Auditor

Use this skill when reviewing pull requests or performing automated security audits on source code changes.

## Step-by-Step Instructions

1. Inspect the git diff or specified source file using the \`read\` tool.
2. Check for security risks: SQL injection, XSS vulnerabilities, and hardcoded secrets.
3. Run project linter using \`npm run lint\` and confirm exit code is 0.
4. For extensive API specifications, refer to [API Reference](./references/api-schema.json).

## Output Protocol

Format your final review summary as a JSON object matching this structure:

\`\`\`json
{
  "pass": true,
  "vulnerabilities": [],
  "score": 95
}
\`\`\`
`
};

export default function SkillDebugger() {
  // 1. Editor State
  const [skillMarkdown, setSkillMarkdown] = useState<string>(SAMPLE_SKILLS.vague);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [copiedStatus, setCopiedStatus] = useState<boolean>(false);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 2. Audit API State & Filter
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [apiAuditResult, setApiAuditResult] = useState<AuditResult | null>(null);

  // 3. Simulator & Console Logs State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simLogs, setSimLogs] = useState<ConsoleLog[]>([
    {
      id: 1,
      type: "info",
      text: "Simulator initialized. Ready to execute skill directives.",
      timestamp: ""
    }
  ]);

  // Derived Editor Calculations
  const lines = useMemo(() => skillMarkdown.split("\n"), [skillMarkdown]);
  const tokenCount = useMemo(() => Math.ceil(skillMarkdown.length / 4), [skillMarkdown]);
  const maxContext = 4096;
  const contextPercentage = Math.min(Math.round((tokenCount / maxContext) * 100), 100);

  // Live fallback audit computation (used when apiAuditResult is null)
  const fallbackAuditResult: AuditResult = useMemo(() => {
    const issues: AuditIssue[] = [];
    const linesList = skillMarkdown.split("\n");

    let hasFrontmatter = false;
    let frontmatterEnded = false;
    let nameVal = "";
    let descVal = "";

    // YAML Frontmatter Audit
    if (linesList[0]?.trim() === "---") {
      hasFrontmatter = true;
      for (let i = 1; i < linesList.length; i++) {
        const line = linesList[i].trim();
        if (line === "---") {
          frontmatterEnded = true;
          break;
        }
        if (line.startsWith("name:")) nameVal = line.replace("name:", "").trim();
        if (line.startsWith("description:")) descVal = line.replace("description:", "").trim();
      }
    }

    if (!hasFrontmatter || !frontmatterEnded) {
      issues.push({
        id: "fm-missing",
        severity: "LOW",
        category: "frontmatter",
        line: 1,
        description: "Missing or unclosed YAML frontmatter block (---).",
        recommendation: "Add standard YAML frontmatter with 'name' and 'description' fields."
      });
    } else {
      if (!nameVal) {
        issues.push({
          id: "fm-no-name",
          severity: "LOW",
          category: "frontmatter",
          line: 2,
          description: "Frontmatter is missing 'name' field.",
          recommendation: "Provide a lowercase kebab-case name for the skill."
        });
      } else if (/[A-Z_\s]/.test(nameVal)) {
        issues.push({
          id: "fm-invalid-name",
          severity: "LOW",
          category: "frontmatter",
          line: 2,
          description: `Skill name '${nameVal}' should be lowercase kebab-case without underscores or uppercase characters.`,
          recommendation: `Rename to '${nameVal.toLowerCase().replace(/[^a-z0-9-]/g, "-")}'.`
        });
      }

      if (!descVal) {
        issues.push({
          id: "fm-no-desc",
          severity: "LOW",
          category: "frontmatter",
          line: 3,
          description: "Frontmatter is missing 'description' field.",
          recommendation: "Add a clear description stating what the skill does and when to use it."
        });
      } else if (descVal.length < 20) {
        issues.push({
          id: "fm-short-desc",
          severity: "LOW",
          category: "frontmatter",
          line: 3,
          description: "Frontmatter description is vague or too short.",
          recommendation: "Expand description to explain both action and trigger conditions."
        });
      }
    }

    // Ambiguity & Vagueness Audit
    const vagueWords = [
      { word: "optimize", reason: "Vague verb 'optimize' without specific criteria." },
      { word: "clean", reason: "Ambiguous instruction 'clean' without concrete coding rules." },
      { word: "make sure it looks good", reason: "Subjective assertion 'looks good' cannot be parsed deterministically." },
      { word: "test the app", reason: "Unclear testing step. Specify exact command (e.g. 'run npm test')." }
    ];

    linesList.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const lower = lineText.toLowerCase();

      // Only check body lines outside frontmatter for ambiguity
      let bodyStartIdx = 0;
      if (linesList[0]?.trim() === "---") {
        for (let i = 1; i < linesList.length; i++) {
          if (linesList[i].trim() === "---") {
            bodyStartIdx = i + 1;
            break;
          }
        }
      }

      if (lineNum > bodyStartIdx) {
        vagueWords.forEach(({ word, reason }) => {
          if (lower.includes(word)) {
            issues.push({
              id: `ambig-${lineNum}-${word}`,
              severity: "CRITICAL",
              category: "ambiguity",
              line: lineNum,
              description: `Found ambiguous phrase '${word}' on line ${lineNum}: ${reason}`,
              recommendation: "Replace vague instructions with explicit, testable commands."
            });
          }
        });
      }
    });

    // Progressive Disclosure & Token Overhead Audit
    let inCodeBlock = false;
    let codeBlockStart = 0;
    let codeBlockLength = 0;

    linesList.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      if (lineText.trim().startsWith("```")) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockStart = lineNum;
          codeBlockLength = 0;
        } else {
          inCodeBlock = false;
          if (codeBlockLength > 15) {
            issues.push({
              id: `bloat-${codeBlockStart}`,
              severity: "HIGH",
              category: "progressive-disclosure",
              line: codeBlockStart,
              description: `Large inline code/data block (${codeBlockLength} lines) consumes token budget.`,
              recommendation: "Move bulky schemas or reference data into a file under '/references'."
            });
          }
        }
      } else if (inCodeBlock) {
        codeBlockLength++;
      }
    });

    // Output Protocol Audit
    const hasOutputSection = linesList.some(
      l => l.toLowerCase().includes("output") || l.toLowerCase().includes("protocol") || l.toLowerCase().includes("format")
    );
    if (!hasOutputSection) {
      issues.push({
        id: "out-format-missing",
        severity: "MEDIUM",
        category: "output-format",
        line: linesList.length,
        description: "Skill lacks an explicit Output Protocol section.",
        recommendation: "Define a clear response format (e.g., JSON schema or Markdown template)."
      });
    }

    // Health Score Calculation
    let score = 100;
    issues.forEach(issue => {
      if (issue.severity === "CRITICAL") score -= 25;
      if (issue.severity === "HIGH") score -= 15;
      if (issue.severity === "MEDIUM") score -= 10;
      if (issue.severity === "LOW") score -= 5;
    });
    score = Math.max(0, score);

    return { score, issues };
  }, [skillMarkdown]);

  // Active audit results: Show empty state until user triggers initial audit or fixes issues
  const [hasAuditRun, setHasAuditRun] = useState<boolean>(false);

  const emptyAuditResult: AuditResult = { score: 100, issues: [] };
  const auditResults = hasAuditRun ? (apiAuditResult ?? fallbackAuditResult) : emptyAuditResult;

  // Filtered Issues
  const filteredIssues = useMemo(() => {
    if (filterSeverity === "ALL") return auditResults.issues;
    return auditResults.issues.filter(i => i.severity === filterSeverity);
  }, [auditResults.issues, filterSeverity]);

  // Feature 1: Targeted Auto-Fix Engine
  const autoFixIssue = (issue: AuditIssue) => {
    let updated = skillMarkdown;
    let linesArr = updated.split("\n");

    // Fix ONLY the specific category of the clicked issue card
    if (issue.category === "frontmatter") {
      if (linesArr[0]?.trim() !== "---") {
        linesArr.unshift("---");
      }
      const nameIndices: number[] = [];
      for (let i = 0; i < linesArr.length; i++) {
        if (linesArr[i].trim().startsWith("name:")) {
          nameIndices.push(i);
        }
      }
      if (nameIndices.length > 0) {
        const firstNameIdx = nameIndices[0];
        const rawName = linesArr[firstNameIdx].replace("name:", "").trim();
        const cleanName = rawName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
        linesArr[firstNameIdx] = `name: ${cleanName || "my-skill"}`;
        for (let j = nameIndices.length - 1; j > 0; j--) {
          linesArr.splice(nameIndices[j], 1);
        }
      } else {
        linesArr.splice(1, 0, "name: my-skill");
      }

      for (let i = 0; i < linesArr.length; i++) {
        if (linesArr[i].trim().startsWith("description:")) {
          const lowerDesc = linesArr[i].toLowerCase();
          if (
            lowerDesc.includes("optimize") ||
            lowerDesc.includes("clean") ||
            lowerDesc.includes("fix") ||
            lowerDesc.includes("improve")
          ) {
            linesArr[i] = "description: Audits and reviews source code files for quality compliance and structural best practices.";
          }
        }
      }
      updated = linesArr.join("\n");
    } else if (issue.category === "ambiguity") {
      let bodyStartIdx = 0;
      if (linesArr[0]?.trim() === "---") {
        for (let i = 1; i < linesArr.length; i++) {
          if (linesArr[i].trim() === "---") {
            bodyStartIdx = i + 1;
            break;
          }
        }
      }

      for (let i = bodyStartIdx; i < linesArr.length; i++) {
        const lower = linesArr[i].toLowerCase();
        if (lower.includes("read the project")) {
          linesArr[i] = "1. Open the project directory and review source files for structural issues using the read tool.";
        } else if (lower.includes("clean up") || lower.includes("optimize")) {
          linesArr[i] = "2. Run `eslint --fix .` to remove code quality issues.";
        } else if (lower.includes("looks good")) {
          linesArr[i] = "3. Run `ajv validate --schema=output-schema.json --data=result.json` and confirm exit code is 0.";
        } else if (lower.includes("test the app")) {
          linesArr[i] = "4. Run `npm test` and confirm exit code is 0.";
        }
      }
      updated = linesArr.join("\n");
    } else if (issue.category === "progressive-disclosure") {
      let inCodeBlock = false;
      let blockStart = -1;
      let blockLinesCount = 0;
      let newLinesArr = [...linesArr];

      for (let i = 0; i < linesArr.length; i++) {
        if (linesArr[i].trim().startsWith("```")) {
          if (!inCodeBlock) {
            inCodeBlock = true;
            blockStart = i;
            blockLinesCount = 0;
          } else {
            inCodeBlock = false;
            if (blockLinesCount > 15) {
              newLinesArr.splice(blockStart, i - blockStart + 1, "For full API schema definition, refer to [User API Schema](./references/api-schema.json).");
              break;
            }
          }
        } else if (inCodeBlock) {
          blockLinesCount++;
        }
      }
      linesArr = newLinesArr;
      updated = linesArr.join("\n");
    } else if (issue.category === "output-format") {
      if (!updated.toLowerCase().includes("## output protocol")) {
        updated += `\n\n## Output Protocol\n\nOutput final evaluation as structured JSON:\n\`\`\`json\n{\n  "status": "success",\n  "data": {}\n}\n\`\`\``;
      }
    }

    setSkillMarkdown(updated);
    setApiAuditResult(null);

    setSimLogs(prev => [
      ...prev,
      {
        id: Date.now(),
        type: "success",
        text: `Auto-fixed ${issue.category} issue on Line ${issue.line}.`,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  // Feature 1b: Fix All Issues Engine
  const autoFixAllIssues = () => {
    let updated = skillMarkdown;
    let linesArr = updated.split("\n");

    // 1. Frontmatter Fix
    if (linesArr[0]?.trim() !== "---") {
      linesArr.unshift("---");
    }
    const nameIndices: number[] = [];
    for (let i = 0; i < linesArr.length; i++) {
      if (linesArr[i].trim().startsWith("name:")) {
        nameIndices.push(i);
      }
    }
    if (nameIndices.length > 0) {
      const firstNameIdx = nameIndices[0];
      const rawName = linesArr[firstNameIdx].replace("name:", "").trim();
      const cleanName = rawName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      linesArr[firstNameIdx] = `name: ${cleanName || "my-skill"}`;
      for (let j = nameIndices.length - 1; j > 0; j--) {
        linesArr.splice(nameIndices[j], 1);
      }
    } else {
      linesArr.splice(1, 0, "name: my-skill");
    }

    for (let i = 0; i < linesArr.length; i++) {
      if (linesArr[i].trim().startsWith("description:")) {
        const lowerDesc = linesArr[i].toLowerCase();
        if (
          lowerDesc.includes("optimize") ||
          lowerDesc.includes("clean") ||
          lowerDesc.includes("fix") ||
          lowerDesc.includes("improve")
        ) {
          linesArr[i] = "description: Audits and reviews source code files for quality compliance and structural best practices.";
        }
      }
    }

    // 2. Ambiguity Body Fix
    let bodyStartIdx = 0;
    if (linesArr[0]?.trim() === "---") {
      for (let i = 1; i < linesArr.length; i++) {
        if (linesArr[i].trim() === "---") {
          bodyStartIdx = i + 1;
          break;
        }
      }
    }

    for (let i = bodyStartIdx; i < linesArr.length; i++) {
      const lower = linesArr[i].toLowerCase();
      if (lower.includes("read the project")) {
        linesArr[i] = "1. Open the project directory and review source files for structural issues using the read tool.";
      } else if (lower.includes("clean up") || lower.includes("optimize")) {
        linesArr[i] = "2. Run `eslint --fix .` to remove code quality issues.";
      } else if (lower.includes("looks good")) {
        linesArr[i] = "3. Run `ajv validate --schema=output-schema.json --data=result.json` and confirm exit code is 0.";
      } else if (lower.includes("test the app")) {
        linesArr[i] = "4. Run `npm test` and confirm exit code is 0.";
      }
    }

    // 3. Progressive Disclosure Fix
    let inCodeBlock = false;
    let blockStart = -1;
    let blockLinesCount = 0;
    let newLinesArr = [...linesArr];

    for (let i = 0; i < linesArr.length; i++) {
      if (linesArr[i].trim().startsWith("```")) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          blockStart = i;
          blockLinesCount = 0;
        } else {
          inCodeBlock = false;
          if (blockLinesCount > 15) {
            newLinesArr.splice(blockStart, i - blockStart + 1, "For full API schema definition, refer to [User API Schema](./references/api-schema.json).");
            break;
          }
        }
      } else if (inCodeBlock) {
        blockLinesCount++;
      }
    }
    linesArr = newLinesArr;
    updated = linesArr.join("\n");

    // 4. Output Protocol Fix
    if (!updated.toLowerCase().includes("## output protocol")) {
      updated += `\n\n## Output Protocol\n\nOutput final evaluation as structured JSON:\n\`\`\`json\n{\n  "status": "success",\n  "data": {}\n}\n\`\`\``;
    }

    setSkillMarkdown(updated);
    setApiAuditResult(null);

    setSimLogs(prev => [
      ...prev,
      {
        id: Date.now(),
        type: "success",
        text: `Auto-fixed all skill issues in a single pass.`,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  // Feature 2: Copy & Export Handlers
  const handleCopySkill = () => {
    navigator.clipboard.writeText(skillMarkdown);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2000);

    setSimLogs(prev => [
      ...prev,
      {
        id: Date.now(),
        type: "info",
        text: "Copied SKILL.md contents to clipboard.",
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const handleExportSkill = () => {
    const blob = new Blob([skillMarkdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "SKILL.md");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSimLogs(prev => [
      ...prev,
      {
        id: Date.now(),
        type: "info",
        text: "Downloaded SKILL.md file export.",
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  // Feature 3: Editor Line Jump & Focus
  const jumpToLine = (lineNumber: number) => {
    setActiveTab("edit");
    setHighlightedLine(lineNumber);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const linesArr = skillMarkdown.split("\n");
        let charPos = 0;
        for (let i = 0; i < lineNumber - 1 && i < linesArr.length; i++) {
          charPos += linesArr[i].length + 1; // +1 for newline
        }
        const lineLen = linesArr[lineNumber - 1]?.length || 0;
        textareaRef.current.setSelectionRange(charPos, charPos + lineLen);
      }
    }, 50);

    setTimeout(() => setHighlightedLine(null), 3000);
  };

  // Call Backend API Route at /api/audit
  const runAuditApi = async (overrideContent?: string | React.MouseEvent) => {
    setIsAuditing(true);
    setHasAuditRun(true);
    const timeStr = () => new Date().toLocaleTimeString();
    const contentToAudit = typeof overrideContent === "string" ? overrideContent : skillMarkdown;

    setSimLogs(prev => [
      ...prev,
      { id: Date.now(), type: "info", text: "Starting security & quality audit scan...", timestamp: timeStr() }
    ]);

    await new Promise(r => setTimeout(r, 200));
    setSimLogs(prev => [
      ...prev,
      { id: Date.now() + 1, type: "info", text: "Analyzing YAML frontmatter, name format, and description...", timestamp: timeStr() }
    ]);

    await new Promise(r => setTimeout(r, 250));
    setSimLogs(prev => [
      ...prev,
      { id: Date.now() + 2, type: "info", text: "Scanning directives for ambiguous verbs and non-deterministic commands...", timestamp: timeStr() }
    ]);

    await new Promise(r => setTimeout(r, 300));
    setSimLogs(prev => [
      ...prev,
      { id: Date.now() + 3, type: "info", text: "Evaluating progressive disclosure and inline code bloat...", timestamp: timeStr() }
    ]);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: contentToAudit })
      });

      if (!response.ok) {
        throw new Error(`Audit API responded with status ${response.status}`);
      }

      const data: AuditResult = await response.json();
      setApiAuditResult(data);

      setSimLogs(prev => [
        ...prev,
        {
          id: Date.now() + 4,
          type: "success",
          text: `Audit scan complete. Health Score: ${data.score}/100. Found ${data.issues.length} issue(s).`,
          timestamp: timeStr()
        }
      ]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to run audit API";
      setSimLogs(prev => [
        ...prev,
        {
          id: Date.now() + 5,
          type: "error",
          text: `Audit API Error: ${errorMsg}. Applied local audit fallback. Score: ${fallbackAuditResult.score}/100.`,
          timestamp: timeStr()
        }
      ]);
    } finally {
      setIsAuditing(false);
    }
  };

  // Actions / Handlers
  const loadPreset = (presetKey: keyof typeof SAMPLE_SKILLS) => {
    setSkillMarkdown(SAMPLE_SKILLS[presetKey]);
    setApiAuditResult(null);
    setHasAuditRun(false);
    setSimLogs(prev => [
      ...prev,
      {
        id: Date.now(),
        type: "info",
        text: `Loaded preset: ${presetKey === "vague" ? "Bad/Vague Skill" : "Good/Optimized Skill"}. Click 'Run Audit' to inspect.`,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const clearConsoleLogs = () => {
    setSimLogs([
      {
        id: Date.now(),
        type: "info",
        text: "Console cleared.",
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const runSimulation = () => {
    setIsSimulating(true);
    const now = new Date().toLocaleTimeString();

    setSimLogs([
      { id: Date.now(), type: "info", text: "Parsing SKILL.md frontmatter directives...", timestamp: now }
    ]);

    setTimeout(() => {
      const hasCritical = auditResults.issues.some(i => i.severity === "CRITICAL");
      const timeStr = new Date().toLocaleTimeString();

      if (hasCritical) {
        setSimLogs(prev => [
          ...prev,
          { id: Date.now() + 1, type: "warn", text: "Frontmatter loaded. Warning: Critical ambiguities detected in skill logic.", timestamp: timeStr },
          { id: Date.now() + 2, type: "error", text: "Agent halted execution: ambiguous instruction lacks concrete tool parameters.", timestamp: timeStr },
          { id: Date.now() + 3, type: "info", text: "Simulation ended with 1 critical failure. Please resolve CRITICAL issues.", timestamp: timeStr }
        ]);
      } else {
        setSimLogs(prev => [
          ...prev,
          { id: Date.now() + 1, type: "success", text: "Frontmatter validated. Agent registered skill successfully.", timestamp: timeStr },
          { id: Date.now() + 2, type: "info", text: "Executing Step 1: Tool [read] invoked for diff target.", timestamp: timeStr },
          { id: Date.now() + 3, type: "info", text: "Executing Step 2: Tool [bash] running 'npm run lint'...", timestamp: timeStr },
          { id: Date.now() + 4, type: "success", text: "Simulation complete! Response emitted per Output Protocol.", timestamp: timeStr }
        ]);
      }
      setIsSimulating(false);
    }, 800);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-root)] text-[var(--text-primary)]">
      {/* Top Bar Header */}
      <header className="app-header">
        <div className="brand-title">
          <span>SkillDebugger</span>
          <span className="brand-badge">IDE v1.0</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-mono">Load Preset:</span>
          <button className="btn text-xs" onClick={() => loadPreset("vague")}>Bad/Vague Skill</button>
          <button className="btn text-xs" onClick={() => loadPreset("optimized")}>Good/Optimized Skill</button>
        </div>
      </header>

      {/* Main 3-Column Split Dashboard Layout */}
      <main className="dashboard-grid">
        
        {/* PANEL 1: Left Panel - Markdown Editor */}
        <section className="panel">
          <div className="panel-header">
            <div className="panel-header-title">
              <span>SKILL.md Editor</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn text-xs" onClick={handleCopySkill}>
                {copiedStatus ? "Copied!" : "Copy"}
              </button>
              <button className="btn text-xs" onClick={handleExportSkill}>
                Export
              </button>
              <button
                className={`btn text-xs ${activeTab === "edit" ? "btn-primary" : ""}`}
                onClick={() => setActiveTab("edit")}
              >
                Code
              </button>
              <button
                className={`btn text-xs ${activeTab === "preview" ? "btn-primary" : ""}`}
                onClick={() => setActiveTab("preview")}
              >
                Preview
              </button>
            </div>
          </div>

          <div className="panel-body">
            {activeTab === "edit" ? (
              <div className="editor-container">
                <div className="editor-line-numbers">
                  {lines.map((_, i) => (
                    <div
                      key={i}
                      className={highlightedLine === i + 1 ? "text-[var(--accent-primary)] font-bold bg-[var(--bg-active)] px-1" : ""}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  className="code-textarea"
                  value={skillMarkdown}
                  onChange={(e) => {
                    setSkillMarkdown(e.target.value);
                    if (apiAuditResult) setApiAuditResult(null);
                  }}
                  placeholder="Paste or write your SKILL.md here..."
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="card h-full overflow-y-auto font-mono text-sm space-y-3 whitespace-pre-wrap">
                {skillMarkdown}
              </div>
            )}
            <div className="flex justify-between text-xs text-[var(--text-muted)] font-mono px-1">
              <span>Lines: {lines.length}</span>
              <span>Bytes: {new Blob([skillMarkdown]).size} B</span>
            </div>
          </div>
        </section>

        {/* PANEL 2: Middle Panel - Audit Console */}
        <section className="panel">
          <div className="panel-header">
            <div className="panel-header-title">
              <span>Security & Quality Audit</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                className="btn btn-primary text-xs"
                onClick={runAuditApi}
                disabled={isAuditing}
              >
                {isAuditing ? "Auditing..." : "Run Audit"}
              </button>
              <span className="ml-1 text-[var(--text-muted)]">Score:</span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded ${
                  auditResults.score >= 80
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : auditResults.score >= 50
                    ? "bg-amber-950 text-amber-400 border border-amber-800"
                    : "bg-red-950 text-red-400 border border-red-800"
                }`}
              >
                {auditResults.score}/100
              </span>
            </div>
          </div>

          <div className="panel-body">
            {/* Filter Pills and Fix All Button */}
            <div className="flex items-center justify-between text-xs pb-1 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5">
                {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    className={`btn text-[0.7rem] px-2 py-0.5 ${
                      filterSeverity === sev ? "btn-primary" : ""
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
              {filteredIssues.length > 0 && (
                <button
                  className="btn btn-primary text-xs py-0.5 px-2 font-mono"
                  onClick={autoFixAllIssues}
                >
                  Fix All Issues
                </button>
              )}
            </div>

            {/* Audit Issues List */}
            <div className="flex-1 overflow-y-auto space-y-2.5">
              {!hasAuditRun ? (
                <div className="card text-center py-8">
                  <span className="text-[var(--text-secondary)] font-mono text-sm">Ready to audit. Click &apos;Run Audit&apos; to scan your SKILL.md.</span>
                </div>
              ) : filteredIssues.length === 0 ? (
                <div className="card text-center py-8">
                  <span className="text-emerald-400 font-mono text-sm">[PASS] Zero issues detected. Skill structure is valid.</span>
                </div>
              ) : (
                filteredIssues.map((issue) => (
                  <div key={issue.id} className="card">
                    <div className="card-title">
                      <span className={`badge badge-${issue.severity.toLowerCase()}`}>
                        {issue.severity}
                      </span>
                      <button
                        className="font-mono text-xs text-[var(--accent-primary)] hover:underline cursor-pointer bg-transparent border-none p-0"
                        onClick={() => jumpToLine(issue.line)}
                        title="Click to jump to line in editor"
                      >
                        Line {issue.line}
                      </button>
                    </div>
                    <p className="card-description mb-2">{issue.description}</p>
                    <div className="p-2 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-secondary)] mb-2">
                      <span className="text-[var(--accent-primary)]">Recommendation: </span>
                      {issue.recommendation}
                    </div>
                    <div className="flex justify-end">
                      <button
                        className="btn btn-primary text-xs py-0.5 px-2 font-mono"
                        onClick={() => autoFixIssue(issue)}
                      >
                        Auto-Fix
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* PANEL 3: Right Panel - Simulator & Guidelines Console */}
        <section className="panel">
          <div className="panel-header">
            <div className="panel-header-title">
              <span>Agent Simulator & Metrics</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn text-xs" onClick={clearConsoleLogs}>
                Clear
              </button>
              <button
                className="btn btn-primary text-xs"
                onClick={runSimulation}
                disabled={isSimulating}
              >
                {isSimulating ? "Running..." : "Run Test"}
              </button>
            </div>
          </div>

          <div className="panel-body">
            {/* Token Budget Meter */}
            <div className="card">
              <div className="card-title font-mono text-xs">
                <span>Token Context Overhead</span>
                <span>{tokenCount} / {maxContext} tokens</span>
              </div>
              <div className="metric-bar-container">
                <div
                  className="metric-bar-fill"
                  style={{
                    width: `${contextPercentage}%`,
                    backgroundColor: contextPercentage > 75 ? "#ef4444" : "#3b82f6"
                  }}
                />
              </div>
              <div className="flex justify-between text-[0.7rem] text-[var(--text-muted)] font-mono mt-1">
                <span>Context Window Used: {contextPercentage}%</span>
                <span>Est. cost: ${(tokenCount * 0.000003).toFixed(5)}</span>
              </div>
            </div>

            {/* Skill Guidelines Checklist */}
            <div className="card space-y-1.5 text-xs font-mono">
              <div className="card-title text-xs">Skill Checklist</div>
              <div className="flex items-center gap-2">
                <span>{auditResults.issues.some(i => i.category === "frontmatter") ? "[FAIL]" : "[PASS]"}</span>
                <span>Valid Frontmatter & Name</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{auditResults.issues.some(i => i.category === "ambiguity") ? "[FAIL]" : "[PASS]"}</span>
                <span>Deterministic Instructions</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{auditResults.issues.some(i => i.category === "progressive-disclosure") ? "[FAIL]" : "[PASS]"}</span>
                <span>Progressive Disclosure</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{auditResults.issues.some(i => i.category === "output-format") ? "[FAIL]" : "[PASS]"}</span>
                <span>Defined Output Protocol</span>
              </div>
            </div>

            {/* Simulation Logs */}
            <div className="flex-1 flex flex-col min-h-0 card">
              <div className="card-title text-xs mb-2">Simulation Output Logs</div>
              <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1">
                {simLogs.map((log) => (
                  <div key={log.id} className={`console-log ${log.type}`}>
                    {log.timestamp ? <span className="text-[var(--text-muted)] mr-2">[{log.timestamp}]</span> : null}
                    {log.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
