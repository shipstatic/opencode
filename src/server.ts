import { fileURLToPath } from 'node:url';
import { Plugin, Skill } from '@opencode/plugin';
import { MCP_URL, SERVER, SKILL_ID } from './facts.ts';
import { read } from './skill.ts';

const SKILL_PATH = fileURLToPath(new URL(`../skills/${SKILL_ID}/SKILL.md`, import.meta.url));

const isOurs = (url: string): boolean => {
  try {
    return new URL(url).href === new URL(MCP_URL).href;
  } catch {
    return false;
  }
};

export default Plugin.define({
  id: SERVER,
  async setup(ctx) {
    // Read before the transforms, which are synchronous. Here and not at
    // import, so a broken file fails this plugin's setup and nothing else.
    const skill = read(SKILL_PATH);

    // A user who already has our server, under any name, keeps their entry:
    // their headers or OAuth settings stay, and the tools never appear twice.
    // `oauth` stays unset: OpenCode connects with no sign-in, and
    // `opencode mcp auth ship` signs in when the user wants their account.
    await ctx.mcp.transform((editor) => {
      if (editor.list().some(([, config]) => config.type === 'remote' && isOurs(config.url)))
        return;
      editor.set(SERVER, { type: 'remote', url: MCP_URL });
    });

    // A copy the user already has in a skills folder wins over this one:
    // OpenCode keeps one skill per id, and the folder's.
    await ctx.skill.transform((editor) => {
      editor.add({
        id: Skill.ID.make(SKILL_ID),
        name: Skill.Name.make(skill.name),
        description: skill.description,
        path: Skill.Info.fields.path.make(SKILL_PATH),
        content: skill.content,
      });
    });
  },
});
