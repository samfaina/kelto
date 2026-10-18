#!/usr/bin/env node
// PreToolUse hook for Bash and PowerShell: runs the project's checkCommand
// before any git commit and blocks the commit when it fails.
import { spawnSync } from 'node:child_process';
import { block, checkCommand, loadConfig, projectDirFor, readHookInput } from './shared.mjs';

const HEAD = 1500;
const TAIL = 2500;

// Keeps the start and the end of a long output: the first failures and the summary.
function trimOutput(output) {
  if (output.length <= HEAD + TAIL) return output;
  return `${output.slice(0, HEAD)}\n[... ${output.length - HEAD - TAIL} characters cut ...]\n${output.slice(-TAIL)}`;
}

const input = await readHookInput();
const command = input.tool_input?.command;
if (typeof command === 'string') {
  const projectDir = projectDirFor(input);
  const config = loadConfig(projectDir);
  const result = checkCommand(command, { config, cwd: input.cwd || projectDir });
  // A blocked command is git-guard's to report; nothing to check here.
  const commits = !result.blocked && result.invocations.some((git) => git.sub === 'commit');
  if (commits && config.checkCommand.trim()) {
    const run = spawnSync(config.checkCommand, { cwd: projectDir, shell: true, encoding: 'utf8' });
    if (run.status !== 0) {
      const output = `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? String(run.error) : ''}`.trim();
      block('quality-gate', `"${config.checkCommand}" failed, so the commit was stopped. Fix the cause and commit again.\n${trimOutput(output)}`);
    }
  }
}
