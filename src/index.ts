/**
 * dsh-penpot: Penpot design-platform integration for DeepSeek Harness.
 *
 * One cordis plugin doing two things:
 * 1. registers model-facing tools that call Penpot's backend command API
 *    directly (REST/RPC, no MCP);
 * 2. registers a bundled skill provider with design-review and handoff
 *    workflows written against those tools.
 *
 * Configuration (all optional, everything has a working default):
 * - baseUrl:   Penpot origin; defaults to the official SaaS.
 * - tokenRef:  name of the environment variable holding the personal access
 *              token; defaults to PENPOT_TOKEN.
 * - timeoutMs: per-request timeout; default 30000.
 * - assetRoot: override the packaged skills directory (development).
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { registerSkills } from './skills.js'
import { registerTools } from './tools.js'

/** Cordis plugin identity. */
export const name = 'dsh-penpot'
/** Registries this plugin needs. */
export const inject = ['tools', 'skills']

/** Plugin configuration; every field is optional in the patch. */
export interface Config {
  /** Penpot origin, e.g. https://design.penpot.dev or https://penpot.example.com. */
  baseUrl?: string
  /** Environment variable name holding the Penpot personal access token. */
  tokenRef?: string
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
  /** Absolute directory of bundled skills; defaults to the packaged assets. */
  assetRoot?: string
}

/** Schemastery configuration schema (fields optional unless marked required). */
export const Config: z<Config> = z.object({
  baseUrl: z.string().min(1),
  tokenRef: z.string().min(1),
  timeoutMs: z.number().min(1000),
  assetRoot: z.string().min(1),
})

/** Resolve configuration with defaults. */
export function resolveConfig(config: Config): { baseUrl: string; tokenRef: string; timeoutMs: number; assetRoot?: string } {
  const baseUrl = (config.baseUrl ?? 'https://design.penpot.dev').trim()
  const tokenRef = (config.tokenRef ?? 'PENPOT_TOKEN').trim()
  const timeoutMs = config.timeoutMs ?? 30000
  if (!/^https?:\/\//u.test(baseUrl)) throw new Error(`dsh-penpot: baseUrl must start with http(s)://, got "${baseUrl}"`)
  return { baseUrl: baseUrl.replace(/\/+$/u, ''), tokenRef, timeoutMs, assetRoot: config.assetRoot }
}

/** Activate the plugin: tools plus the bundled skill provider. */
export function apply(ctx: Context, config: Config = {}): void {
  const resolved = resolveConfig(config)
  registerTools(ctx, resolved)
  registerSkills(ctx, 'dsh-penpot', resolved.assetRoot)
}
