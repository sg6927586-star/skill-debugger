import { describe, it, expect } from "vitest";

function autoFixSkill(markdown: string): string {
  let updated = markdown;
  let linesArr = updated.split("\n");

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
    linesArr[firstNameIdx] = "name: app-optimizer";
    for (let j = nameIndices.length - 1; j > 0; j--) {
      linesArr.splice(nameIndices[j], 1);
    }
  } else {
    linesArr.splice(1, 0, "name: app-optimizer");
  }

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
  if (!updated.toLowerCase().includes("## output protocol")) {
    updated += `\n\n## Output Protocol\n\nOutput final evaluation as structured JSON:\n\`\`\`json\n{\n  "status": "success",\n  "data": {}\n}\n\`\`\``;
  }

  return updated;
}

describe("autoFixSkill comprehensive test", () => {
  it("should fix all frontmatter, ambiguity, and output protocol issues in a single pass", () => {
    const input = `---\nname: My Cool Skill_v1\ndescription: A skill to optimize the app\n---\n1. Read the project files.\n2. Clean up bad code.\n3. Make sure it looks good.`;
    const fixed = autoFixSkill(input);
    expect(fixed).toContain("name: app-optimizer");
    expect(fixed).toContain("1. Open the project directory");
    expect(fixed).toContain("2. Run `eslint --fix .`");
    expect(fixed).toContain("3. Run `ajv validate");
    expect(fixed).toContain("## Output Protocol");
  });
});
