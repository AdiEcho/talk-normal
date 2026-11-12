# Contributing

talk-normal rules are added when a real slop pattern shows up in a real pi reply. Every rule needs a receipt.

Open an issue using the **New rule suggestion** template and include:

1. **The LLM reply that triggered it** — verbatim, at least the annoying portion.
2. **The model** — GPT-5.4, Claude 4.6, Gemini 2.5, etc., and roughly when.
3. **The pattern name** — one line describing what is annoying. "Conditional follow-up offer", "restates the question", etc.
4. **Proposed rule text** for `extensions/talk-normal/prompt.md`.
5. **Why it is widespread, not personal taste.** This is the filter. If the pattern shows up in one model once, it is not a rule. If it shows up across multiple models or multiple conversations, it probably is.

Extension changes: keep the rules in `extensions/talk-normal/prompt.md`, keep `extensions/talk-normal/index.ts` thin, and run `node scripts/test-extension.mjs` before opening a pull request.

I accept or reject based on whether the pattern is a real widespread slop pattern, not whether I personally find it annoying.
