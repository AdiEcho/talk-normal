/**
 * talk-normal for pi
 *
 * Injects the talk-normal rules from prompt.md into every run as a replaceable
 * `talk_normal` system-prompt section. Pi diffs sections against what the model
 * already has, so the rules cost one prompt-cache miss when they first appear
 * and nothing after that.
 *
 * Commands:
 *   /talk-normal             status: version, on/off, loaded prompt path
 *   /talk-normal on|off      toggle injection (persists across sessions)
 *   /talk-normal check       scan the last assistant reply for banned patterns
 *   /talk-normal version     print the loaded prompt version
 *
 * Flag:
 *   --no-talk-normal         disable injection for this session
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	getAgentDir,
	type ExtensionAPI,
	type ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Rules live next to the extension; this is the only copy. */
const PROMPT_PATH = join(HERE, "prompt.md");
/** Version source. Two levels up is the package root. */
const PACKAGE_PATH = join(HERE, "..", "..", "package.json");

const SECTION_NAME = "talk_normal";
const FLAG_NAME = "no-talk-normal";
const STATE_PATH = join(getAgentDir(), "talk-normal.json");

interface State {
	enabled: boolean;
}

interface Pattern {
	label: string;
	pattern: RegExp;
}

/** Slop shapes named in prompt.md. `check` counts them in the last reply. */
const PATTERNS: Pattern[] = [
	{
		label: "negation frame",
		pattern: /不是[^。！？\n]{0,40}?而是|而不是|并非[^。！？\n]{0,40}?而是|(?:it'?s|this is|that'?s) not (?:about|just)[^.\n]{0,40}?(?:it'?s|it is)|\brather than\b/gi,
	},
	{
		label: "summary stamp",
		pattern:
			/(?:^|\n)\s*(?:总结一下|简而言之|概括来说|总而言之|一句话(?:总结|落地|讲|概括|说|收尾)|In (?:conclusion|summary)|Hope this helps|Feel free to ask)/gi,
	},
	{
		label: "filler",
		pattern:
			/(?:^|\n)\s*(?:Great question|Certainly[!,.，]|Of course[!,.，]|I'?d be happy to|Let me break this down|It'?s worth noting|值得注意的是|综上所述|首先我们需要|让我们一起来看看)/gi,
	},
];

function readState(): State {
	try {
		const parsed: unknown = JSON.parse(readFileSync(STATE_PATH, "utf8"));
		if (parsed && typeof parsed === "object" && (parsed as State).enabled === false) {
			return { enabled: false };
		}
	} catch {
		// Missing or unreadable state means the default: on.
	}
	return { enabled: true };
}

function writeState(state: State): void {
	mkdirSync(dirname(STATE_PATH), { recursive: true });
	const temp = `${STATE_PATH}.${process.pid}.tmp`;
	writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
	renameSync(temp, STATE_PATH);
}

function findPromptPath(): string | undefined {
	return existsSync(PROMPT_PATH) ? PROMPT_PATH : undefined;
}

/** Prompt text, or undefined when the file is missing or empty. */
function readRules(): string | undefined {
	try {
		const text = readFileSync(PROMPT_PATH, "utf8").trim();
		return text.length > 0 ? text : undefined;
	} catch {
		return undefined;
	}
}

function readVersion(): string {
	try {
		const parsed: unknown = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
		if (parsed && typeof parsed === "object" && typeof (parsed as { version?: unknown }).version === "string") {
			return (parsed as { version: string }).version;
		}
	} catch {
		// Missing or unreadable package.json.
	}
	return "unknown";
}

function isEnabled(pi: ExtensionAPI): boolean {
	return !pi.getFlag(FLAG_NAME) && readState().enabled;
}

function countMatches(text: string, pattern: RegExp): number {
	return text.match(pattern)?.length ?? 0;
}

function lastAssistantText(ctx: ExtensionCommandContext): string | undefined {
	const branch = ctx.sessionManager.getBranch();
	for (let index = branch.length - 1; index >= 0; index--) {
		const entry = branch[index];
		if (entry.type !== "message" || entry.message.role !== "assistant") continue;
		const text = entry.message.content
			.filter((block) => block.type === "text")
			.map((block) => block.text)
			.join("\n")
			.trim();
		return text.length > 0 ? text : undefined;
	}
	return undefined;
}

function statusLine(pi: ExtensionAPI): string {
	const state = readState();
	const status = pi.getFlag(FLAG_NAME) ? "off (--no-talk-normal)" : state.enabled ? "on" : "off";
	return `talk-normal v${readVersion()} (${status}) - ${findPromptPath() ?? "prompt.md not found"}`;
}

export default function talkNormal(pi: ExtensionAPI) {
	pi.registerFlag(FLAG_NAME, {
		description: "Disable the talk-normal rules for this session",
		type: "boolean",
		default: false,
	});

	pi.on("session_start", (_event, ctx) => {
		if (isEnabled(pi) && !findPromptPath()) {
			ctx.ui.notify(`talk-normal: ${PROMPT_PATH} not found`, "error");
		}
	});

	pi.on("before_agent_start", (event) => {
		if (!isEnabled(pi)) return;
		const rules = readRules();
		if (!rules) return;
		event.systemPromptOptions.sections[SECTION_NAME] = rules;
	});

	pi.registerCommand("talk-normal", {
		description: "Show, toggle, or check the talk-normal prompt rules",
		getArgumentCompletions: (prefix) => {
			const items = ["status", "on", "off", "check", "version"]
				.filter((value) => value.startsWith(prefix))
				.map((value) => ({ value, label: value }));
			return items.length > 0 ? items : null;
		},
		handler: async (args, ctx) => {
			const subcommand = args.trim().toLowerCase();

			if (subcommand === "" || subcommand === "status") {
				ctx.ui.notify(statusLine(pi), isEnabled(pi) ? "info" : "warning");
				return;
			}

			if (subcommand === "on") {
				writeState({ enabled: true });
				if (pi.getFlag(FLAG_NAME)) {
					ctx.ui.notify(`talk-normal on: saved, but --${FLAG_NAME} overrides it for this session`, "warning");
					return;
				}
				ctx.ui.notify("talk-normal on: rules apply from the next turn", "info");
				return;
			}

			if (subcommand === "off") {
				writeState({ enabled: false });
				ctx.ui.notify("talk-normal off: rules stop from the next turn", "info");
				return;
			}

			if (subcommand === "version") {
				ctx.ui.notify(`talk-normal v${readVersion()}`, "info");
				return;
			}

			if (subcommand === "check") {
				const text = lastAssistantText(ctx);
				if (!text) {
					ctx.ui.notify("talk-normal check: no assistant text to scan", "warning");
					return;
				}
				const counts = PATTERNS.map(({ label, pattern }) => `${label}: ${countMatches(text, pattern)}`);
				const total = PATTERNS.reduce((sum, { pattern }) => sum + countMatches(text, pattern), 0);
				const verdict = total === 0 ? "clean" : `${total} finding(s)`;
				ctx.ui.notify(`talk-normal check (${verdict}) - ${counts.join(", ")}`, total === 0 ? "info" : "warning");
				return;
			}

			ctx.ui.notify("Usage: /talk-normal [status|on|off|check|version]", "warning");
		},
	});
}
