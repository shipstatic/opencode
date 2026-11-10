import { readFileSync } from 'node:fs';

export interface SkillFile {
  readonly name: string;
  readonly description: string;
  readonly content: string;
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;

/**
 * Reads a `SKILL.md` the way OpenCode reads one it finds in a skills folder:
 * the frontmatter's `name:` and `description:` lines, and as content every
 * byte after the closing `---` line. The plugin registers what OpenCode would
 * have produced for the same file, so the skill reads the same either way.
 */
export function read(path: string): SkillFile {
  const text = readFileSync(path, 'utf8');
  const match = FRONTMATTER.exec(text);
  if (!match) throw new Error(`${path} has no frontmatter`);
  const lines = match[1].split('\n');
  const field = (key: string): string => {
    const line = lines.find((l) => l.startsWith(`${key}: `));
    if (!line) throw new Error(`${path} has no ${key} in its frontmatter`);
    return line.slice(key.length + 2);
  };
  return {
    name: field('name'),
    description: field('description'),
    content: text.slice(match[0].length),
  };
}
