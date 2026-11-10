import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MCP_URL, SERVER, SKILL_ID } from '../src/facts.ts';
import plugin from '../src/server.ts';
import { read } from '../src/skill.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKILL_FILE = join(ROOT, 'skills', SKILL_ID, 'SKILL.md');
const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// Every expected value is a literal written here, never read from the code
// under test.
describe('the facts', () => {
  it('names the hosted server and the key', () => {
    expect(MCP_URL).toBe('https://mcp.shipstatic.com');
    expect(SERVER).toBe('ship');
    expect(SKILL_ID).toBe('publish-online');
    expect(plugin.id).toBe('ship');
  });

  it('ships the skill under its own name', () => {
    expect(readFileSync(SKILL_FILE, 'utf8').startsWith('---\nname: publish-online\n')).toBe(true);
  });

  it('runs with nothing installed beside it', () => {
    expect(manifest.dependencies).toEqual({});
    expect(manifest.peerDependenciesMeta).toEqual({ '@opencode/plugin': { optional: true } });
    expect(manifest.exports).toEqual({ '.': './src/server.ts' });
    expect(manifest.files).toEqual(['src', 'skills']);
  });

  it('imports only node, the SDK and its own modules', () => {
    for (const file of ['server.ts', 'skill.ts', 'facts.ts']) {
      const source = readFileSync(join(ROOT, 'src', file), 'utf8');
      const specifiers = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
      for (const s of specifiers) {
        expect(
          ['@opencode/plugin', './facts.ts', './skill.ts'].includes(s) || s.startsWith('node:'),
        ).toBe(true);
      }
    }
  });
});

// The shape OpenCode gives a skill it finds in a folder, read from OpenCode
// 2.2.7: `name` is the frontmatter's line, and `content` is every byte after
// the closing `---` line, starting with the blank line before the heading.
describe('read()', () => {
  it('reads a skill the way OpenCode does', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skill-'));
    const file = join(dir, 'SKILL.md');
    writeFileSync(
      file,
      '---\nname: hello\ndescription: Say hello. Not for goodbyes.\n---\n\n# Hello\n\nSay hello.\n',
    );
    expect(read(file)).toEqual({
      name: 'hello',
      description: 'Say hello. Not for goodbyes.',
      content: '\n# Hello\n\nSay hello.\n',
    });
  });

  it('refuses a file with no frontmatter or no description', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skill-'));
    const bare = join(dir, 'bare.md');
    writeFileSync(bare, '# Hello\n');
    expect(() => read(bare)).toThrow('has no frontmatter');
    const partial = join(dir, 'partial.md');
    writeFileSync(partial, '---\nname: hello\n---\nbody\n');
    expect(() => read(partial)).toThrow('has no description');
  });

  it('reads the shipped skill whole', () => {
    const skill = read(SKILL_FILE);
    expect(skill.name).toBe('publish-online');
    expect(skill.content.startsWith('\n# Publish online\n')).toBe(true);
    expect(skill.description.length).toBeGreaterThan(0);
  });
});

// setup() against a stand-in for OpenCode's two editors.
type Server = { type: string; url?: string };
async function run(servers: [string, Server][]) {
  const added: Record<string, unknown>[] = [];
  const set: [string, Server][] = [];
  const ctx = {
    mcp: {
      transform: async (fn: (e: unknown) => void) =>
        fn({
          list: () => servers,
          set: (name: string, config: Server) => set.push([name, config]),
        }),
    },
    skill: {
      transform: async (fn: (e: unknown) => void) =>
        fn({ add: (s: Record<string, unknown>) => added.push(s) }),
    },
  };
  await plugin.setup(ctx as never);
  return { set, added };
}

describe('setup()', () => {
  it('adds the server and the skill', async () => {
    const { set, added } = await run([]);
    expect(set).toEqual([['ship', { type: 'remote', url: 'https://mcp.shipstatic.com' }]]);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      id: 'publish-online',
      name: 'publish-online',
      path: SKILL_FILE,
    });
  });

  it('leaves a server the user already has alone, under any name and with a trailing slash', async () => {
    const { set } = await run([['mine', { type: 'remote', url: 'https://mcp.shipstatic.com/' }]]);
    expect(set).toEqual([]);
  });

  it('adds its own beside another server, or a local one', async () => {
    const { set } = await run([
      ['other', { type: 'remote', url: 'https://example.com/mcp' }],
      ['local', { type: 'local' }],
    ]);
    expect(set).toEqual([['ship', { type: 'remote', url: 'https://mcp.shipstatic.com' }]]);
  });
});
