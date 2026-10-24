// Structural verification for dsh-penpot: package shape, patch row, skill
// assets, locale pairing, built lib entries, and exports self-resolution.
// Runs with plain Node — no dependencies.
import { existsSync, readFileSync, readdirSync, readdirSync as readDir, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const fail = message => { throw new Error(`verify: ${message}`) }
const read = path => readFileSync(join(root, path), 'utf8')
const ok = []

const pkg = JSON.parse(read('package.json'))
if (pkg.name !== 'dsh-penpot') fail(`package name must be dsh-penpot, got ${pkg.name}`)
ok.push(`name ${pkg.name}@${pkg.version}`)

if (!pkg.engines?.dsh) fail('engines.dsh missing')
if (!pkg.dsh?.bundle?.patch) fail('dsh.bundle.patch missing')
ok.push(`engines.dsh ${pkg.engines.dsh}`)

const requiredExports = ['.', './cordis.patch.yml', './package.json', './locale/en.json', './locale/zh.json']
for (const key of requiredExports) if (!(key in (pkg.exports ?? {}))) fail(`exports missing ${key}`)
ok.push(`exports ${requiredExports.length} keys`)

for (const dep of ['@deepseek-ai/cordis', '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-skill', '@deepseek-ai/schemastery']) {
  if (!(dep in (pkg.peerDependencies ?? {}))) fail(`peerDependencies missing ${dep}`)
}
ok.push('peers 4')

// Patch: exactly one insert row naming this package.
const patch = read('cordis.patch.yml')
const rows = [...patch.matchAll(/- id:\s*(\S+)/g)].map(match => match[1])
if (rows.length !== 1 || rows[0] !== 'penpot') fail(`patch must insert exactly one row 'penpot', got ${rows.join(',')}`)
if (!patch.includes("name: 'dsh-penpot'")) fail('patch row must name dsh-penpot')
ok.push('patch 1 row')

// Skills: every assets/<name>/SKILL.md parses with a frontmatter description,
// and the index registers skills from the same directory layout.
const assetsDir = join(root, 'assets')
const skills = readdirSync(assetsDir).sort().filter(name => {
  const directory = join(assetsDir, name)
  return statSync(directory).isDirectory() && existsSync(join(directory, 'SKILL.md'))
})
if (skills.length < 2) fail(`expected >= 2 skills under assets/, got ${skills.length}`)
for (const skill of skills) {
  const raw = read(join('assets', skill, 'SKILL.md'))
  if (!/^---\r?\n[\s\S]*?\r?\n---/u.test(raw)) fail(`assets/${skill}/SKILL.md has no frontmatter`)
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(raw)[1]
  if (!/^name:\s*\S+/mu.test(frontmatter)) fail(`assets/${skill}/SKILL.md frontmatter missing name`)
  if (!/^description:\s*\S+/mu.test(frontmatter)) fail(`assets/${skill}/SKILL.md frontmatter missing description`)
}
if (!read('src/skills.ts').includes("../assets/")) fail('src/skills.ts must default to ../assets/')
ok.push(`skills ${skills.length}: ${skills.join(', ')}`)

// Built lib: every src entry produced a .js, and index keeps the plugin contract.
const srcEntries = readdirSync(join(root, 'src')).filter(name => name.endsWith('.ts'))
const libDir = join(root, 'lib')
for (const entry of srcEntries) {
  const built = join(libDir, entry.replace(/\.ts$/u, '.js'))
  if (!existsSync(built)) fail(`lib/${entry.replace(/\.ts$/u, '.js')} missing — run pnpm run build`)
}
const libIndex = read('lib/index.js')
for (const token of ['dsh-penpot', 'registerTools', 'registerSkills']) {
  if (!libIndex.includes(token)) fail(`lib/index.js missing ${token}`)
}
ok.push(`lib ${srcEntries.length} entries`)

// Locale pairing and icon: harness readPluginMeta expects { meta: { title, description } }.
for (const lang of ['en', 'zh']) {
  const locale = JSON.parse(read(join('locale', `${lang}.json`)))
  if (typeof locale.meta?.title !== 'string' || typeof locale.meta?.description !== 'string') {
    fail(`locale/${lang}.json needs meta.title+meta.description (readPluginMeta shape)`)
  }
}
ok.push('locale en+zh (meta shape)')

// Exports self-resolution (package must resolve its own subpaths).
for (const subpath of ['dsh-penpot', 'dsh-penpot/locale/en.json', 'dsh-penpot/cordis.patch.yml', 'dsh-penpot/package.json']) {
  const resolved = import.meta.resolve(subpath)
  if (!resolved.startsWith('file:///')) fail(`import.meta.resolve(${subpath}) -> ${resolved}`)
}
ok.push('self-resolution')

console.log(`verify: ok — ${ok.join(' | ')}`)
