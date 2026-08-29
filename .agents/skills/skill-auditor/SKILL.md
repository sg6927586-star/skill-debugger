---
name: skill-auditor
description: Audit and optimize AI agent skill files (SKILL.md) for structure, clarity, progressive disclosure, and token efficiency.
tags: [skills, devtools, debugging, agentops]
---

# Skill Auditor & Optimizer

Use this skill to inspect a `SKILL.md` instruction file, analyze its quality, find potential bugs/ambiguities, and suggest optimizations.

When auditing a skill:
1. Review the frontmatter and description.
2. Analyze the main instruction steps for ambiguity or logical gaps.
3. Evaluate progressive disclosure (are bulky manuals separated into `/references`?).
4. Output a structured audit report.

---

## Audit Rubric

Check the skill against the following guidelines:

### 1. Frontmatter & Name (Low Risk)
*   Must contain `name` and `description`.
*   The `name` should be lowercase, kebab-case, and ≤64 characters.
*   The `description` must clearly state *what* the skill does and *when* the agent should load it.

### 2. Ambiguity & Vagueness (Critical Risk)
*   Look for vague verbs like "optimize", "fix", "clean", or "improve" without concrete instructions.
*   Ensure steps are explicit. (e.g., instead of "test the app", it should say "run `npm test` and verify that the exit code is 0").

### 3. Progressive Disclosure (High Risk)
*   Check if the skill contains massive blocks of logs, documentation, or code reference templates.
*   *Rule:* Bulky documentation must be moved to the `/references` directory, and scripts to `/scripts`. The main `SKILL.md` should link to them and remain short.

### 4. Output Formatting (Medium Risk)
*   The skill must define a clear format (e.g. JSON, markdown table) for how the agent should output its results.

---

## Output Protocol

Output your audit results as a JSON code block in the following format:

```json
{
  "score": 85,
  "summary": "Overall good structure, but contains vague testing steps and lacks progressive disclosure for API docs.",
  "issues": [
    {
      "severity": "HIGH",
      "category": "progressive-disclosure",
      "line": 42,
      "description": "Exposing 150 lines of API schema directly in the SKILL.md. This wastes token context.",
      "recommendation": "Move the API schema to 'references/api-schema.json' and link it: [API Schema](./references/api-schema.json)."
    },
    {
      "severity": "CRITICAL",
      "category": "ambiguity",
      "line": 15,
      "description": "Vague instruction 'make sure it looks good'. The agent will not know what criteria to check.",
      "recommendation": "Replace with: 'Verify that the page title matches the document title and check for any console log errors.'"
    }
  ]
}
```
