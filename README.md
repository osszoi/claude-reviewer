# claude-reviewer

CLI tool that lists GitHub PRs waiting for your review, lets you pick one or more, and opens each in a dedicated tmux window with Claude ready to review it.

## Requirements

- [gh](https://cli.github.com/) — authenticated with your GitHub account
- [tmux](https://github.com/tmux/tmux)
- [Claude Code](https://claude.ai/code)

## Install

```sh
npm install -g .
```

## Usage

```sh
pr-review
```

Pick one or more PRs with `space`, confirm with `enter`. For each one it will:

1. Clone the repo into a fresh temp directory under `/tmp`
2. Checkout the PR branch
3. Open a tmux window running `claude` pointed at that repo

Each PR gets its own isolated clone, so you can review multiple PRs from the same repo simultaneously.

Once all sessions are ready, it drops you straight into the tmux session picker (`Prefix + s`) so you can jump in.
