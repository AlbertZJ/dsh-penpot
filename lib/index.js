import { registerSkills } from "./skills.js";
import { registerTools } from "./tools.js";
import z from "@deepseek-ai/schemastery";
// src/index.ts
/** Cordis plugin identity. */
const name = "dsh-penpot";
/** Registries this plugin needs. */
const inject = ["tools", "skills"];
/** Schemastery configuration schema (fields optional unless marked required). */
const Config = z.object({
	baseUrl: z.string().min(1),
	tokenRef: z.string().min(1),
	timeoutMs: z.number().min(1e3),
	assetRoot: z.string().min(1)
});
/** Resolve configuration with defaults. */
function resolveConfig(config) {
	const baseUrl = (config.baseUrl ?? "https://design.penpot.dev").trim();
	const tokenRef = (config.tokenRef ?? "PENPOT_TOKEN").trim();
	const timeoutMs = config.timeoutMs ?? 3e4;
	if (!/^https?:\/\//u.test(baseUrl)) throw new Error(`dsh-penpot: baseUrl must start with http(s)://, got "${baseUrl}"`);
	return {
		baseUrl: baseUrl.replace(/\/+$/u, ""),
		tokenRef,
		timeoutMs,
		assetRoot: config.assetRoot
	};
}
/** Activate the plugin: tools plus the bundled skill provider. */
function apply(ctx, config = {}) {
	const resolved = resolveConfig(config);
	registerTools(ctx, resolved);
	registerSkills(ctx, "dsh-penpot", resolved.assetRoot);
}
export { Config, apply, inject, name, resolveConfig };
