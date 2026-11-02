import { SKILLS } from "./skills";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

// Word-boundary-like check that still works for "c#", "node.js", "ci/cd".
// "java" will NOT match inside "javascript" because of the lookahead.
const PATTERNS = Object.entries(SKILLS).map(([name, aliases]) => ({
  name,
  regex: new RegExp(
    `(?<![a-z0-9+#.])(?:${aliases.map(escape).join("|")})(?![a-z0-9+#])`,
    "i"
  ),
}));

export function extractSkills(text: string): Set<string> {
  const found = new Set<string>();
  for (const { name, regex } of PATTERNS) {
    if (regex.test(text)) found.add(name);
  }
  return found;
}

export type MatchResult = {
  score: number | null; // null when the job lists no recognisable skills
  matched: string[];
  missing: string[];
};

export function matchJob(resumeSkills: Set<string>, jobText: string): MatchResult {
  const jobSkills = extractSkills(jobText);
  if (jobSkills.size === 0) return { score: null, matched: [], missing: [] };
  const matched = [...jobSkills].filter((s) => resumeSkills.has(s));
  const missing = [...jobSkills].filter((s) => !resumeSkills.has(s));
  return { score: Math.round((matched.length / jobSkills.size) * 100), matched, missing };
}
