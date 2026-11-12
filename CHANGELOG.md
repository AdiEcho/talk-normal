# Changelog

All notable changes to talk-normal will be recorded here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.8.0] - 2026-11-12

- Reduce the project to the pi plugin. Remove the OpenClaw and Hermes skill bundles (`skill/`, `skill-hermes/`), the `AGENTS.md` installer (`install.sh`), the ChatGPT custom-instructions variant (`prompt-chatgpt.md`), the OpenAI benchmark harness (`scripts/run-tests.sh`, `TEST_RESULTS.md`), the rule-regression archive (`regressions/`), and `scripts/sync-skill.sh`. Pi installs extensions directly, so the extra install paths and their sync step are dead weight.
- Move the rules to `extensions/talk-normal/prompt.md`. One copy, no sync step, no version comment to strip; the extension reads it from its own directory.
- Read the version from `package.json` instead of a prompt header. `package.json` is now the only place a version is written.
- Rewrite README, README_CN, and CONTRIBUTING for the pi-only scope. Drop the long example transcript and the model benchmark tables.

## [0.7.0] - 2026-11-12

- Ship as a pi package. `package.json` declares `pi.extensions` and the `pi-package` keyword, so `pi install git:github.com/hexiecs/talk-normal` (or `pi install ./talk-normal`) registers the extension. The repo still works as a plain prompt and as the OpenClaw / Hermes skill.
- Add `extensions/talk-normal/index.ts`. It injects `prompt.md` into every run as a `talk_normal` system-prompt section instead of editing `AGENTS.md`, so rules apply from the next turn with no new session. Pi diffs sections, so the injection stays prompt-cache warm after its first turn.
- Add `/talk-normal` command: status (version, on/off, loaded prompt path), `on` / `off` (persisted in `~/.pi/agent/talk-normal.json`), `version`, and `check`, which scans the last assistant reply for negation frames, summary stamps, and filler. `--no-talk-normal` disables injection for one session.
- Add `scripts/test-extension.mjs`: a no-network smoke test that loads the extension against a stubbed host API and covers injection, toggling, the flag, a missing prompt file, and the `check` scanner.
- `sync-skill.sh` now also copies `prompt.md` into `extensions/talk-normal/`, keeping the packaged copy in step with the single source of truth.
- Reword two README lines that still described the installer as the only path. Pi is documented first under Usage.

## Week of 2026-04-11

- Add `prompt-chatgpt.md`: a compressed variant of `prompt.md` built to fit ChatGPT's 1500-character custom-instructions field limit. Preserves all load-bearing rules (negation-frame ban, closing-stamp ban, conditional-menu ban, filler list, BAD/GOOD few-shot examples). Compressed version clocks in at 1400 chars (100-char margin). Use `prompt.md` for OpenClaw / API / Cursor / Continue where there is no length cap; use `prompt-chatgpt.md` only for the ChatGPT custom-instructions field. Motivated by a real bug report on Twitter from @ppdng: `prompt.md` v0.6.1 is 3527 chars and does not fit in a 1500-char field.
- Publish talk-normal to the ClawHub skill registry. `clawhub install talk-normal` is now a one-line install path for OpenClaw users, alongside the existing paste-link-to-chat and manual `git clone` paths. ([c02afd1](https://github.com/hexiecs/talk-normal/commit/c02afd1))
- Make `install.sh` idempotent. Re-running it now performs an in-place update of the `talk-normal` block in your `AGENTS.md` instead of refusing and asking for `--uninstall` first. First run prints `Installed`, every subsequent run prints `Updated`. ([24fd1be](https://github.com/hexiecs/talk-normal/commit/24fd1be))
- Add version tracking to the install flow. `prompt.md` now has `<!-- talk-normal X.Y.Z -->` as its first line so you can `grep "talk-normal 0" AGENTS.md` to see which version is currently active. `install.sh` prints the version and absolute target path on every install/update. `sync-skill.sh` auto-reads the version from `prompt.md` and bumps `skill/SKILL.md` to match. Single source of truth is `prompt.md`. ([c576bd2](https://github.com/hexiecs/talk-normal/commit/c576bd2))
- Restructure the README OpenClaw install section into three labeled options: paste-link-to-chat (easiest), ClawHub, manual git clone. Order reflects real UX effort from fewest steps to most. Applies to both `README.md` and `README_CN.md`. ([23566d9](https://github.com/hexiecs/talk-normal/commit/23566d9))
- Iterate the "不是X，而是Y" ban across four rounds and converge it. Final version uses few-shot BAD/GOOD example pairs instead of pure prohibition, covers all variants (standard `不是X，而是Y`, reverse-order `X，而不是Y`, chained `不是A，不是B，而是C`, symmetric `适合X，不适合Y`), and moves the rule to position 2 of the rule list. Measured on a same-prompt stress test across versions: 6 → 4 → 3 → 0 → 0 → 0 violations per response. ([c455eb4](https://github.com/hexiecs/talk-normal/commit/c455eb4))
- Ban summary-stamp closings structurally, in any variant, in any language. Adds English ("In conclusion", "In summary", "Hope this helps", "Feel free to ask") and Chinese ("一句话总结", "一句话落地", "一句话讲", "一句话概括", "总结一下", "简而言之", "概括来说", "总而言之") named stamps, plus structural patterns ("一句话X：", "X一下：") that catch future variants the author has not thought of yet. Rule intent is now position-aware rather than a word list. ([0169c73](https://github.com/hexiecs/talk-normal/commit/0169c73))
- Add `regressions/` directory tracking iterative rule improvements with measured leak counts across prompt versions. First file is `rule-17-negation-frame.md`, documenting the full iteration arc from v0.3.0 to v0.6.1 with real GPT-5.4 excerpts from each failed version. Future rule iterations should follow the same format. ([9afd23b](https://github.com/hexiecs/talk-normal/commit/9afd23b))
- Ban conditional next-step menus ("如果你X，我就Y" / "if you want X, I can Y"). ([ed81683](https://github.com/hexiecs/talk-normal/commit/ed81683))
- Ban the "not X, but Y" corrective frame pattern ("不是X，而是Y"). ([87a297c](https://github.com/hexiecs/talk-normal/commit/87a297c))
- Kill redundant plain-language restatements ("翻成人话" / "in plain English"). ([d19acf1](https://github.com/hexiecs/talk-normal/commit/d19acf1))

## Week of 2026-04-04

- Broaden messaging: works with any LLM, not just GPT. ([dd4b8ef](https://github.com/hexiecs/talk-normal/commit/dd4b8ef))
- Rename project from `normal-gpt` → `talk-normal` to match multi-LLM positioning. ([fde64c5](https://github.com/hexiecs/talk-normal/commit/fde64c5))
- Add direct link to ChatGPT custom instructions settings. ([845207e](https://github.com/hexiecs/talk-normal/commit/845207e))
- Add paste-link-to-chat install method for OpenClaw. ([e3c928b](https://github.com/hexiecs/talk-normal/commit/e3c928b))
- Add Chinese README with language switcher. ([9e1f714](https://github.com/hexiecs/talk-normal/commit/9e1f714))
