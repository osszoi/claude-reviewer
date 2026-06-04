#!/usr/bin/env node

import checkbox, { Separator } from '@inquirer/checkbox';
import { emitKeypressEvents } from 'readline';
import { execSync, execFileSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import chalk from 'chalk';

const isExitError = (e) => e?.constructor?.name === 'ExitPromptError';

const p = async (fn) => {
  try { return await fn(); }
  catch (e) {
    if (isExitError(e)) process.exit(0);
    throw e;
  }
};

emitKeypressEvents(process.stdin);
process.stdin.on('keypress', (_str, key) => {
  if (key?.name === 'q') {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdout.write('\n');
    process.exit(0);
  }
});


let prs;
try {
  const raw = execSync('gh search prs --review-requested=@me --state=open --json number,title,repository,author').toString();
  prs = JSON.parse(raw);
} catch {
  console.error('Failed to fetch PRs. Make sure you are authenticated with gh.');
  process.exit(1);
}

if (prs.length === 0) {
  console.log('No PRs waiting for your review.');
  process.exit(0);
}

const grouped = prs.reduce((acc, p) => {
  const repo = p.repository.name;
  (acc[repo] ??= []).push(p);
  return acc;
}, {});

const orange = chalk.bold.hex('#FF8C00');

const choices = Object.entries(grouped).flatMap(([repo, repoPrs], i) => [
  ...(i > 0 ? [new Separator('')] : []),
  new Separator(orange(`  ${repo}`)),
  ...repoPrs.map(pr => ({
    name: `  ${chalk.white(pr.title)} ${chalk.dim(`(${pr.author.login})`)}`,
    value: pr,
  })),
]);

const selected = await p(() => checkbox({
  message: 'Select PRs to review:',
  pageSize: 40,
  theme: {
    style: {
      highlight: text => chalk.bold(text),
      keysHelpTip: (keys) => [...keys, ['q', 'quit']]
        .map(([key, action]) => `${chalk.bold(key)} ${chalk.dim(action)}`)
        .join(chalk.dim(' • ')),
    },
  },
  choices,
}));

if (!selected.length) process.exit(0);

const sessions = [];

for (const pr of selected) {
  console.log(`\n${orange(pr.repository.name)} ${chalk.white(`#${pr.number}`)}`);

  const { headRefName } = JSON.parse(
    execSync(`gh pr view ${pr.number} --repo ${pr.repository.nameWithOwner} --json headRefName`).toString()
  );

  const repoDir = mkdtempSync(`${tmpdir()}/pr-review-`);

  console.log(chalk.dim(`Cloning ${pr.repository.nameWithOwner}...`));
  execSync(`gh repo clone ${pr.repository.nameWithOwner} ${repoDir}`, { stdio: 'inherit' });

  console.log(chalk.dim(`Checking out ${headRefName}...`));
  execSync(`git checkout ${headRefName}`, { cwd: repoDir, stdio: 'inherit' });

  const sessionName = `Review ${pr.repository.name} ${pr.number}`;
  const claudeCmd = `cd ${repoDir} && claude --permission-mode auto -n '${sessionName}' /pr-review`;

  if (process.env.TMUX) {
    execFileSync('tmux', ['new-window', '-n', sessionName, claudeCmd]);
  } else {
    execFileSync('tmux', ['new-session', '-d', '-s', sessionName, claudeCmd]);
  }

  sessions.push({ sessionName, pr });
}

if (!sessions.length) process.exit(0);

console.log(`\n${chalk.bold('Sessions ready:')}`);
for (const { pr } of sessions) {
  console.log(`  ${orange(pr.repository.name)} ${chalk.dim(`#${pr.number}`)}`);
}
console.log();

if (process.env.TMUX) {
  execFileSync('tmux', ['choose-tree', '-Zs'], { stdio: 'inherit' });
} else {
  execFileSync('tmux', ['attach-session', ';', 'choose-tree', '-Zs'], { stdio: 'inherit' });
}
