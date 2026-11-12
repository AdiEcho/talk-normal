# talk-normal

English | [中文](README_CN.md)

Make pi talk like a normal person. Direct answers, no filler, no fluff.

## Install

```bash
pi install git:github.com/hexiecs/talk-normal
```

From a local clone:

```bash
pi install ./talk-normal
```

Restart pi or run `/reload` once if it is already running. Rules apply from the next turn.

## What it changes

- Leads with the answer, then adds context only when it helps
- Bans negation-based contrast ("not X, but Y" / 不是X，而是Y)
- Kills filler openers, summary-stamp closings, and conditional follow-up menus
- Keeps structure for content that really has steps or parallel points

## How it works

`extensions/talk-normal/index.ts` injects `extensions/talk-normal/prompt.md` into every run as a `talk_normal` system-prompt section. Pi diffs sections against what the model already has, so the first turn costs one prompt-cache miss and later turns cost nothing. No `AGENTS.md` edit, no new session, no prompt rewriting.

## Commands

```text
/talk-normal            version, state, and prompt path
/talk-normal off        stop injecting rules (persists across sessions)
/talk-normal on         resume
/talk-normal check      scan the last reply for banned patterns
```

`--no-talk-normal=1` disables it for one session. Keep the `=1` when you also pass a prompt, otherwise the bare flag consumes the prompt text.

State lives in `~/.pi/agent/talk-normal.json`; missing or unreadable means on.

## Customize

Edit `extensions/talk-normal/prompt.md`, run `/reload`, and the next turn uses the new text.

## Uninstall

```bash
pi remove git:github.com/hexiecs/talk-normal
```

## Contributing

Rule proposals welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). After changing the extension, run `node scripts/test-extension.mjs`.

## License

MIT
