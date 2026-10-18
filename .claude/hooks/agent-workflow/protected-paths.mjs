#!/usr/bin/env node
// PreToolUse hook for file-editing tools and for Bash and PowerShell: blocks
// edits and shell writes (redirections, cp, mv, rm, Set-Content...) to protected paths.
import { block, loadConfig, projectDirFor, protectedPattern, readHookInput, shellWriteTargets } from './shared.mjs';

const input = await readHookInput();
const projectDir = projectDirFor(input);
const config = loadConfig(projectDir);
const command = input.tool_input?.command;
const targets = typeof command === 'string'
  ? shellWriteTargets(command)
  : [input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? input.tool_input?.path].filter((t) => typeof t === 'string');

for (const target of targets) {
  const pattern = protectedPattern(target, { projectDir, cwd: input.cwd, config });
  if (pattern) {
    const how = typeof command === 'string' ? ' This command writes to it.' : '';
    block('protected-paths', `${target} is protected (matches "${pattern}" in .claude/agent-workflow.json).${how} Ask the user to change it.`);
  }
}
