#!/usr/bin/env node
// PreToolUse hook for Bash and PowerShell: blocks destructive git commands,
// pushes, and commits on protected branches.
import { block, checkCommand, loadConfig, projectDirFor, readHookInput } from './shared.mjs';

const input = await readHookInput();
const command = input.tool_input?.command;
if (typeof command === 'string') {
  const projectDir = projectDirFor(input);
  const result = checkCommand(command, { config: loadConfig(projectDir), cwd: input.cwd || projectDir });
  if (result.blocked) block('git-guard', result.reason);
}
