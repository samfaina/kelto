// Shared logic for the agent-workflow hooks. Pure functions where possible so
// test/hooks.test.mjs can cover them without spawning Claude Code.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const DEFAULT_CONFIG = {
  protectedBranches: ['main', 'master'],
  allowPush: false,
  checkCommand: '',
  protectedPaths: [
    '.env',
    '.env.*',
    '.claude/settings.json',
    '.claude/settings.local.json',
    '.claude/agent-workflow.json',
    '.claude/hooks/**',
    '.claude/skills/**',
    '.claude/references/**',
    'openspec/specs/**',
  ],
};

export const CONFIG_FILE = path.join('.claude', 'agent-workflow.json');

// Missing or unreadable config falls back to the defaults, so the guards stay on.
export function loadConfig(projectDir) {
  try {
    const raw = JSON.parse(readFileSync(path.join(projectDir, CONFIG_FILE), 'utf8'));
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function readHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text ? JSON.parse(text) : {};
}

export function projectDirFor(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

// Exit code 2 blocks the tool call; stderr is the reason Claude reads.
export function block(hook, reason) {
  process.stderr.write(`agent-workflow ${hook}: ${reason}\n`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Command parsing

const SEPARATORS = ['&&', '||', ';', '|', '&', '\n', '\r', '(', ')', '{', '}'];

// Splits a Bash or PowerShell command line into segments of tokens, honouring
// single and double quotes. Each segment is one simple command.
export function splitCommands(command) {
  const segments = [];
  let tokens = [];
  let current = '';
  let inToken = false;
  let quote = null;

  const endToken = () => {
    if (inToken) tokens.push(current);
    current = '';
    inToken = false;
  };
  const endSegment = () => {
    endToken();
    if (tokens.length) segments.push(tokens);
    tokens = [];
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && command[i + 1] === '"') current += command[++i];
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      inToken = true;
      continue;
    }
    const sep = SEPARATORS.find((s) => command.startsWith(s, i));
    if (sep) {
      endSegment();
      i += sep.length - 1;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      endToken();
      continue;
    }
    current += ch;
    inToken = true;
  }
  endSegment();
  return segments;
}

const WRAPPERS = new Set(['sudo', 'command', 'env', 'nohup', 'time', 'exec', 'call']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'pwsh', 'powershell', 'cmd']);
const SHELL_COMMAND_FLAGS = new Set(['-c', '-command', '/c', '/k']);
const EVALUATORS = new Set(['invoke-expression', 'iex']);

function programName(token) {
  return path.basename(token.replace(/\\/g, '/')).toLowerCase().replace(/\.exe$/, '');
}

// Yields every git invocation in a command line, including those nested in
// `bash -c "..."`, `pwsh -Command "..."` or `Invoke-Expression "..."`.
export function findGitInvocations(command) {
  const found = [];
  for (const tokens of splitCommands(command)) {
    let i = 0;
    while (i < tokens.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]) || WRAPPERS.has(programName(tokens[i])))) i++;
    if (i >= tokens.length) continue;
    const program = programName(tokens[i]);
    if (program === 'git') {
      found.push(parseGit(tokens.slice(i + 1)));
    } else if (SHELLS.has(program)) {
      const flagAt = tokens.findIndex((t, j) => j > i && SHELL_COMMAND_FLAGS.has(t.toLowerCase()));
      if (flagAt !== -1) found.push(...findGitInvocations(tokens.slice(flagAt + 1).join(' ')));
    } else if (EVALUATORS.has(program)) {
      found.push(...findGitInvocations(tokens.slice(i + 1).join(' ')));
    }
  }
  return found;
}

const GLOBAL_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);

function parseGit(rest) {
  let dir = null;
  let i = 0;
  while (i < rest.length && rest[i].startsWith('-')) {
    const opt = rest[i];
    if (GLOBAL_OPTIONS_WITH_VALUE.has(opt)) {
      if (opt === '-C') dir = rest[i + 1] ?? null;
      i += 2;
    } else {
      i += 1;
    }
  }
  return { dir, sub: rest[i] ?? '', args: rest.slice(i + 1) };
}

// ---------------------------------------------------------------------------
// Git rules

function hasShortFlag(args, letter) {
  return args.some((a) => /^-[A-Za-z]+$/.test(a) && a.includes(letter));
}

function has(args, ...names) {
  return args.some((a) => names.some((n) => a === n || a.startsWith(`${n}=`)));
}

const COMMIT_MAKERS = new Set(['commit', 'merge', 'rebase', 'cherry-pick', 'revert', 'am']);

// Returns the reason a git invocation must be blocked, or null to allow it.
// `branch` is the branch checked out when the invocation runs (null if unknown).
export function gitViolation({ sub, args }, branch, config) {
  const protectedBranch = branch && config.protectedBranches.includes(branch);
  const positional = args.filter((a) => !a.startsWith('-'));

  if (has(args, '--no-verify') || (sub === 'commit' && hasShortFlag(args, 'n'))) {
    return '--no-verify skips the project\'s checks. Make the checks pass instead.';
  }

  switch (sub) {
    case 'push': {
      if (!config.allowPush) return 'git push is disabled. The user pushes.';
      if (has(args, '--force', '--force-with-lease', '--force-if-includes', '--mirror') || hasShortFlag(args, 'f') || positional.some((p) => p.startsWith('+'))) {
        return 'force-pushing rewrites shared history.';
      }
      const targets = positional.slice(1).map((ref) => ref.split(':').pop());
      if (targets.some((t) => config.protectedBranches.includes(t)) || (targets.length === 0 && protectedBranch)) {
        return `pushing to a protected branch (${config.protectedBranches.join(', ')}) is not allowed.`;
      }
      return null;
    }
    case 'reset':
      return has(args, '--hard', '--merge', '--keep') ? 'git reset --hard discards work. Use git stash or a new commit instead.' : null;
    case 'clean':
      return has(args, '--force') || hasShortFlag(args, 'f') ? 'git clean -f deletes untracked files for good.' : null;
    case 'branch':
      if (args.includes('-D') || args.includes('-M') || has(args, '--force') || hasShortFlag(args, 'f') ||
          (has(args, '--delete', '-d') && has(args, '--force')) || args.some((a) => /^-[a-zA-Z]*d[a-zA-Z]*f|^-[a-zA-Z]*f[a-zA-Z]*d/.test(a))) {
        return 'force-deleting or overwriting a branch can lose commits. Use git branch -d.';
      }
      return null;
    case 'checkout':
      if (args.includes('--') || positional.includes('.') || has(args, '--force') || args.includes('-f')) {
        return 'git checkout with paths or --force discards uncommitted changes.';
      }
      return null;
    case 'restore':
      return has(args, '--staged', '-S') && !has(args, '--worktree', '-W') ? null : 'git restore discards uncommitted changes. Only git restore --staged is allowed.';
    case 'switch':
      return has(args, '--discard-changes', '--force', '--force-create') || args.includes('-f') || args.includes('-C')
        ? 'git switch --force or --discard-changes discards uncommitted changes.'
        : null;
    case 'stash':
      return ['drop', 'clear'].includes(positional[0]) ? 'dropping stashes loses work for good.' : null;
    case 'reflog':
      return ['expire', 'delete'].includes(positional[0]) ? 'rewriting the reflog removes the way back to lost commits.' : null;
    case 'filter-branch':
    case 'filter-repo':
      return 'rewriting history is not allowed.';
    case 'update-ref':
      return args.includes('-d') ? 'deleting refs directly can lose commits.' : null;
  }

  if (COMMIT_MAKERS.has(sub) && protectedBranch) {
    return `${branch} is a protected branch. Create the change branch first: git switch -c change/<change>.`;
  }
  return null;
}

// The branch a later invocation in the same command line will run on.
function branchAfter({ sub, args }, branch) {
  const positional = args.filter((a) => !a.startsWith('-'));
  if (sub === 'switch') {
    const create = args.findIndex((a) => a === '-c' || a === '--create');
    if (create !== -1) return args[create + 1] ?? branch;
    return positional[0] ?? branch;
  }
  if (sub === 'checkout' && !args.includes('--')) {
    const create = args.findIndex((a) => a === '-b' || a === '-B');
    if (create !== -1) return args[create + 1] ?? branch;
    if (positional.length === 1) return positional[0];
  }
  return branch;
}

export function currentBranch(dir) {
  try {
    return execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

// Checks a whole command line. `getBranch(dir)` returns the branch in a
// directory; it is injected so tests can run without a repository.
export function checkCommand(command, { config, cwd, getBranch = currentBranch }) {
  const branches = new Map();
  const branchIn = (dir) => {
    if (!branches.has(dir)) branches.set(dir, getBranch(dir));
    return branches.get(dir);
  };
  const invocations = [];
  for (const git of findGitInvocations(command)) {
    const dir = git.dir ? path.resolve(cwd, git.dir) : cwd;
    const branch = branchIn(dir);
    const reason = gitViolation(git, branch, config);
    if (reason) return { blocked: true, reason, invocations };
    invocations.push(git);
    branches.set(dir, branchAfter(git, branch));
  }
  return { blocked: false, reason: null, invocations };
}

// ---------------------------------------------------------------------------
// Shell writes

const REDIRECT = /^(?:\d|\*)?>>?\|?(.*)$/;
const PS_PATH_PARAMS = new Set(['-path', '-literalpath', '-filepath', '-destination']);
// Which positional arguments each program writes, moves or deletes.
const WRITERS = {
  tee: 'all', touch: 'all', rm: 'all', rmdir: 'all', del: 'all', erase: 'all', rd: 'all',
  cp: 'last', copy: 'last', mv: 'all', move: 'all', ren: 'all',
  'set-content': 'first', sc: 'first', 'add-content': 'first', ac: 'first', 'clear-content': 'all', clc: 'all',
  'out-file': 'first', 'new-item': 'first', ni: 'first', 'remove-item': 'all', ri: 'all',
  'copy-item': 'last', cpi: 'last', 'move-item': 'all', mi: 'all', 'rename-item': 'first', rni: 'first',
};

function writtenByProgram(program, args) {
  const targets = [];
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const lower = arg.toLowerCase();
    if (PS_PATH_PARAMS.has(lower)) {
      if (args[i + 1] !== undefined) targets.push(args[++i]);
    } else if (/^-(value|itemtype|encoding|newname)$/i.test(arg)) {
      i++;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }
  if (program === 'sed') return args.some((a) => a === '-i' || a.startsWith('--in-place') || /^-[a-z]*i/.test(a)) ? positional.slice(1) : [];
  const which = WRITERS[program];
  if (which === 'all') targets.push(...positional);
  if (which === 'first' && positional.length) targets.push(positional[0]);
  if (which === 'last' && positional.length > 1) targets.push(positional.at(-1));
  return targets;
}

// Paths a command line writes, moves or deletes, as far as a static read can
// tell: redirections, tee, cp/mv/rm/touch, sed -i and PowerShell's file cmdlets.
export function shellWriteTargets(command) {
  const targets = [];
  for (const tokens of splitCommands(command)) {
    let start = 0;
    while (start < tokens.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[start]) || WRAPPERS.has(programName(tokens[start])))) start++;
    if (start >= tokens.length) continue;
    // A nested command line (`bash -c "..."`, `Invoke-Expression "..."`) is read on its own.
    const program = programName(tokens[start]);
    let nestedAt = -1;
    if (SHELLS.has(program)) {
      const flagAt = tokens.findIndex((t, j) => j > start && SHELL_COMMAND_FLAGS.has(t.toLowerCase()));
      if (flagAt !== -1 && flagAt + 1 < tokens.length) nestedAt = flagAt + 1;
    } else if (EVALUATORS.has(program) && start + 1 < tokens.length) {
      nestedAt = start + 1;
    }
    if (nestedAt !== -1) targets.push(...shellWriteTargets(tokens[nestedAt]));

    const rest = [];
    for (let i = start; i < tokens.length; i++) {
      if (i === nestedAt) continue;
      const at = tokens[i].search(/(?:\d|\*)?>/);
      if (at === -1) {
        rest.push(tokens[i]);
        continue;
      }
      if (at > 0) rest.push(tokens[i].slice(0, at));
      const target = tokens[i].slice(at).match(REDIRECT)?.[1].trim() || tokens[++i];
      if (target) targets.push(target);
    }
    if (nestedAt === -1 && rest.length) targets.push(...writtenByProgram(program, rest.slice(1)));
  }
  return targets.filter((t) => t && !t.startsWith('$') && !t.startsWith('&') && t !== '/dev/null' && t.toLowerCase() !== 'nul');
}

// ---------------------------------------------------------------------------
// Protected paths

// Gitignore-like globs: `**` crosses folders, `*` and `?` stay within one, and
// a pattern without a slash matches a file name at any depth.
export function globToRegExp(pattern) {
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      source += '.*';
      i++;
      if (pattern[i + 1] === '/') i++;
    } else if (ch === '*') source += '[^/]*';
    else if (ch === '?') source += '[^/]';
    else source += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  const anchored = pattern.includes('/') ? `^${source}$` : `(^|/)${source}$`;
  return new RegExp(anchored, process.platform === 'win32' ? 'i' : '');
}

// Returns the matching pattern when `filePath` is protected, or null.
export function protectedPattern(filePath, { projectDir, cwd, config }) {
  const absolute = path.resolve(cwd || projectDir, filePath);
  const relative = path.relative(projectDir, absolute).replace(/\\/g, '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) return null;
  return config.protectedPaths.find((pattern) => globToRegExp(pattern).test(relative)) ?? null;
}
