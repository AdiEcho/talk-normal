#!/usr/bin/env node
/**
 * Smoke test for the pi extension. No network, no model calls.
 *
 * Usage: node scripts/test-extension.mjs
 *
 * Loads extensions/talk-normal/index.ts against a stubbed ExtensionAPI and
 * checks section injection, toggling, the CLI flag, a missing prompt file, and
 * the /talk-normal check scanner.
 *
 * The host package is resolved from the running pi install. Override with
 * PI_CODING_AGENT_PACKAGE=/path/to/@earendil-works/pi-coding-agent.
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function hostPackageDir() {
	if (process.env.PI_CODING_AGENT_PACKAGE) return process.env.PI_CODING_AGENT_PACKAGE;
	const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
	const version = readFileSync(join(agentDir, "install", "current-version"), "utf8").trim();
	return join(agentDir, "install", "releases", version, "node_modules", "@earendil-works", "pi-coding-agent");
}

const host = hostPackageDir();
const sandbox = mkdtempSync(join(tmpdir(), "talk-normal-pi-"));
const agentDir = join(sandbox, "agent");
const extDir = join(sandbox, "extension");
process.env.PI_CODING_AGENT_DIR = agentDir;

mkdirSync(join(sandbox, "node_modules", "@earendil-works"), { recursive: true });
symlinkSync(host, join(sandbox, "node_modules", "@earendil-works", "pi-coding-agent"), "dir");
mkdirSync(extDir, { recursive: true });
cpSync(join(repoRoot, "extensions", "talk-normal", "index.ts"), join(extDir, "index.ts"));
cpSync(join(repoRoot, "prompt.md"), join(extDir, "prompt.md"));

const { default: factory } = await import(pathToFileURL(join(extDir, "index.ts")).href);

const results = [];
function check(label, ok, detail = "") {
	results.push({ label, ok, detail });
}

function harness(flags = {}) {
	const handlers = new Map();
	const commands = new Map();
	const registeredFlags = new Map();
	const notifications = [];
	const pi = {
		on(name, handler) {
			handlers.set(name, handler);
		},
		registerCommand(name, options) {
			commands.set(name, options);
		},
		registerFlag(name, options) {
			registeredFlags.set(name, options);
		},
		getFlag(name) {
			return Boolean(flags[name]);
		},
	};
	factory(pi);
	const ctx = (branch = []) => ({
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
		},
		sessionManager: { getBranch: () => branch },
	});
	const run = () => {
		const event = { systemPromptOptions: { sections: {} } };
		handlers.get("before_agent_start")(event);
		return event.systemPromptOptions.sections;
	};
	return { handlers, commands, registeredFlags, notifications, ctx, run };
}

function stateFile() {
	return join(agentDir, "talk-normal.json");
}

try {
	const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
	const promptHeader = readFileSync(join(repoRoot, "prompt.md"), "utf8").split("\n", 1)[0];

	check("package declares the extension", pkg.pi?.extensions?.includes("./extensions/talk-normal/index.ts"));
	check("package ships the extension", (pkg.files ?? []).some((entry) => entry === "extensions" || entry.startsWith("extensions/")));
	check("package version matches prompt.md", promptHeader.includes(pkg.version), promptHeader);
	check("extension is a factory function", typeof factory === "function");

	const base = harness();
	check("registers before_agent_start", base.handlers.has("before_agent_start"));
	check("registers /talk-normal", base.commands.has("talk-normal"));
	check("registers the session flag", base.registeredFlags.get("no-talk-normal")?.type === "boolean");
	check(
		"bundled prompt matches the source",
		readFileSync(join(repoRoot, "extensions", "talk-normal", "prompt.md"), "utf8") === readFileSync(join(repoRoot, "prompt.md"), "utf8"),
	);

	let sections = base.run();
	check("injects the rules by default", typeof sections.talk_normal === "string");
	check("rules are the prompt body", (sections.talk_normal ?? "").startsWith("Be direct and informative"));
	check("rules carry the core constraint", (sections.talk_normal ?? "").includes("prefer direct positive claims"));
	check("version comment is stripped", !(sections.talk_normal ?? "").includes("<!--"));

	await base.commands.get("talk-normal").handler("off", base.ctx());
	check("off persists to disk", JSON.parse(readFileSync(stateFile(), "utf8")).enabled === false);
	sections = base.run();
	check("off removes the section", sections.talk_normal === undefined);

	await base.commands.get("talk-normal").handler("on", base.ctx());
	sections = base.run();
	check("on restores the section", typeof sections.talk_normal === "string");

	const flagged = harness({ "no-talk-normal": true });
	check("flag disables injection", flagged.run().talk_normal === undefined);
	await flagged.commands.get("talk-normal").handler("on", flagged.ctx());
	check(
		"on warns when the session flag overrides",
		(flagged.notifications.at(-1)?.message ?? "").includes("overrides"),
	);

	writeFileSync(stateFile(), "{not json");
	check("corrupt state falls back to on", typeof base.run().talk_normal === "string");

	const shared = {};
	base.handlers.get("before_agent_start")({ systemPromptOptions: { sections: shared } });
	const firstInjection = shared.talk_normal;
	base.handlers.get("before_agent_start")({ systemPromptOptions: { sections: shared } });
	check(
		"repeated runs keep one copy",
		shared.talk_normal === firstInjection && (firstInjection.match(/Be direct and informative/g) ?? []).length === 1,
	);

	base.notifications.length = 0;
	await base.commands.get("talk-normal").handler("status", base.ctx());
	check("status reports version and path", /talk-normal v\d+\.\d+\.\d+ \(on\)/.test(base.notifications[0]?.message ?? ""));

	base.notifications.length = 0;
	await base.commands.get("talk-normal").handler("version", base.ctx());
	check("version subcommand prints the prompt version", base.notifications[0]?.message === `talk-normal v${pkg.version}`);

	const branch = [
		{
			type: "message",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "真正的创新者是五种特质同时拉满的人，而不是单纯聪明的人。\n综上所述，值得一试。" }],
			},
		},
	];
	base.notifications.length = 0;
	await base.commands.get("talk-normal").handler("check", base.ctx(branch));
	const report = base.notifications[0]?.message ?? "";
	check("check counts the negation frame", report.includes("negation frame: 1"), report);
	check("check counts the filler", report.includes("filler: 1"), report);
	check("check reports findings", report.includes("2 finding(s)"), report);

	base.notifications.length = 0;
	await base.commands.get("talk-normal").handler("check", base.ctx());
	check("check handles an empty session", (base.notifications[0]?.message ?? "").includes("no assistant text"));

	const stale = [
		{ type: "message", message: { role: "assistant", content: [{ type: "text", text: "而不是" }] } },
		{ type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "t", name: "read", arguments: {} }] } },
	];
	base.notifications.length = 0;
	await base.commands.get("talk-normal").handler("check", base.ctx(stale));
	check("check ignores stale replies", (base.notifications[0]?.message ?? "").includes("no assistant text"));

	const bundled = join(extDir, "prompt.md");
	renameSync(bundled, `${bundled}.off`);
	sections = base.run();
	check("missing prompt file does not throw", sections.talk_normal === undefined);
	base.notifications.length = 0;
	base.handlers.get("session_start")({}, base.ctx());
	check("missing prompt file is reported", (base.notifications[0]?.message ?? "").includes("prompt.md not found"));
	renameSync(`${bundled}.off`, bundled);
} finally {
	rmSync(sandbox, { recursive: true, force: true });
}

for (const { label, ok, detail } of results) {
	console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : `  (${detail})`}`);
}

const failures = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures === 0 ? 0 : 1);
