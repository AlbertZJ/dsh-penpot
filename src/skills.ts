/**
 * Bundled skill provider: serves the SKILL.md workflow files packaged under
 * `assets/`, following the same registration pattern as the harness's bundled
 * skill plugins (per-provider name, BUNDLED_SKILL_RANK, directory resources).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { BUNDLED_SKILL_RANK, type SkillCandidate, type SkillProvider } from '@deepseek-ai/dsh-skill'
import { parse as parseYaml } from 'yaml'

/** One discovered skill folder. */
interface DiscoveredSkill {
  readonly name: string
  readonly directory: string
  readonly path: string
}

function parseSkill(raw: string, path: string): { description: string; content: string } {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw)
  if (frontmatter?.[1] === undefined) throw new Error(`dsh-penpot: ${path} has no YAML frontmatter`)
  const metadata: unknown = parseYaml(frontmatter[1])
  const description = typeof metadata === 'object' && metadata !== null && 'description' in metadata
    ? metadata.description : undefined
  if (typeof description !== 'string' || description.length === 0) throw new Error(`dsh-penpot: ${path} has no description`)
  return { description, content: raw.slice(frontmatter[0].length).trim() }
}

/** Discover `<skill>/SKILL.md` folders one level under the asset root. */
function discoverSkills(assetRoot: string): DiscoveredSkill[] {
  const discovered: DiscoveredSkill[] = []
  for (const name of readdirSync(assetRoot).sort()) {
    const directory = join(assetRoot, name)
    const path = join(directory, 'SKILL.md')
    if (!statSync(directory).isDirectory() || !existsSync(path)) continue
    discovered.push({ name, directory, path })
  }
  if (discovered.length === 0) throw new Error(`dsh-penpot: no skills under ${assetRoot}`)
  return discovered
}

/** Resolve the packaged assets directory (config override or `../assets/` beside lib/). */
export function assetRootOf(assetRoot?: string): string {
  const root = assetRoot ?? fileURLToPath(new URL('../assets/', import.meta.url))
  if (!isAbsolute(root)) throw new Error('dsh-penpot: assetRoot must be an absolute directory')
  return root
}

/** Build the candidates for the bundled provider. */
function candidatesOf(assetRoot: string, providerName: string): SkillCandidate[] {
  return discoverSkills(assetRoot).map(({ name, directory, path }) => {
    const { description } = parseSkill(readFileSync(path, 'utf8'), path)
    return {
      name, description,
      invocation: { modelInvocable: true, userInvocable: true },
      provider: providerName, source: 'bundled', rank: BUNDLED_SKILL_RANK,
      resourceBase: { kind: 'directory', path: directory.split(sep).join('/') }, locator: path,
    }
  })
}

/** Register the bundled Penpot skills under one provider. */
export function registerSkills(ctx: Context, providerName: string, assetRoot?: string): void {
  const candidates = candidatesOf(assetRootOf(assetRoot), providerName)
  const provider: SkillProvider = {
    name: providerName,
    list: () => Promise.resolve([...candidates]),
    async get(candidate, options) {
      const { rank: _rank, locator, ...summary } = candidate
      const raw = await readFile(locator as string, { encoding: 'utf8', signal: options.signal })
      const content = parseSkill(raw, locator as string).content
      return { ...summary, content }
    },
  }
  ctx.skills.registerProvider(() => provider)
}
