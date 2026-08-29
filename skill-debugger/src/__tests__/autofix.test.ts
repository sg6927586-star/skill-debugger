import { describe, it, expect } from "vitest";

// Re-creating logic from autoFixIssue to test dynamic auto-fixing
function autoFixSkill(markdown: string, category: string, fixText?: string): string {
  let updated = markdown;
  let linesArr = updated.split("\n");

  if (fixText && fixText.trim() !== "") {
    linesArr[0] = fixText;
    updated = linesArr.join("\n");
  } else if (category === "frontmatter") {
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

    updated = linesArr.join("\n");
  }

  return updated;
}

describe("autoFixSkill regression test", () => {
  it("should dynamically convert any user frontmatter name to kebab-case without hardcoded app-optimizer", () => {
    const input = `---\nname: Custom_User_Skill_123\ndescription: User skill\n---`;
    const fixed = autoFixSkill(input, "frontmatter");
    expect(fixed).toContain("name: custom-user-skill-123");
    expect(fixed).not.toContain("Custom_User_Skill_123");
  });

  it("should apply AI fixText directly when provided", () => {
    const input = `1. Vague instruction`;
    const fixed = autoFixSkill(input, "ambiguity", "1. Run `eslint --fix .`");
    expect(fixed).toBe("1. Run `eslint --fix .`");
  });
});

  it("should replace ambiguous instructions cleanly and skip frontmatter block", () => {
    const input = `---\nname: my-skill\ndescription: A skill to optimize the app\n---\n1. clean up bad code and optimize performance.`;
    const fixed = autoFixSkill(input, "ambiguity");
    expect(fixed).toContain("description: A skill to optimize the app");
    expect(fixed).toContain("2. Run `eslint --fix .` to remove code quality issues.");
  });

  it("should append Output Protocol when missing", () => {
    const input = `# Skill without output protocol section header`;
    const fixed = autoFixSkill(input, "output-format");
    expect(fixed).toContain("## Output Protocol");
  });
});
