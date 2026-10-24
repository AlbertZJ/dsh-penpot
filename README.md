# dsh-penpot

Penpot inside DeepSeek Harness as a **native plugin** — no MCP. The plugin
registers model-facing tools that call Penpot's backend command API directly,
plus two bundled skills (design review and design handoff) written against
those tools.

Works with [penpot.app](https://penpot.app) SaaS or any self-hosted Penpot.

English | [中文](README.zh.md)

## What it does

- **9 `penpot_*` tools** over Penpot's REST/RPC command API:
  connectivity/profile check, teams → projects → files walk, file search,
  file overview (pages + design-token sets), page board tree, open comment
  threads, and binary `.penpot` archive export. Authentication uses a
  personal access token via the `Authorization: Token` scheme — the same
  backend API Penpot's own web app uses.
- **2 bundled skills**: `penpot-design-review` (structured design review from
  live data) and `penpot-design-handoff` (inventory + tokens + comments +
  portable archive for developers).

## Requirements

- DeepSeek Harness `>= 0.2.1-rc.2 < 0.3.0`
- Node.js `>= 22.19.0`
- A Penpot personal access token: Penpot → Settings → Access tokens →
  generate one.

## Install

```sh
export PENPOT_TOKEN=<your-token>            # Windows PowerShell: $env:PENPOT_TOKEN="..."
dsh plugin --profile web add github:AlbertZJ/dsh-penpot
```

Optional configuration (defaults shown) — edit the bundle row's config on the
Plugins page, or in `cordis.patch.yml` for linked installs:

```yaml
config:
  baseUrl: https://design.penpot.dev   # or your self-hosted origin
  tokenRef: PENPOT_TOKEN               # env var holding the token
  timeoutMs: 30000
```

No build permission is needed on install: `lib/` is committed and the package
has no `prepare` script.

## Verify

In a session, ask the model to run `penpot_whoami` — it should return your
Penpot profile. Then try "review the design draft named X" and the
`penpot-design-review` skill takes over.

## Development

```sh
pnpm install
pnpm run build     # tsc + tsdown -> lib/
pnpm run verify    # structural checks (no dependencies)
```

`lib/` is committed: git installs fetch sources and do not build them, so
rebuild and commit `lib/` together with any `src/` change.

## How it compares

- Unlike [qunanchang/dsh-penpot](https://github.com/qunanchang/dsh-penpot),
  this plugin does **not** embed the Penpot editor UI into the sidebar and
  does **not** use Penpot's MCP. It is a data/tool integration: the model
  reads and exports design data through dsh-native tools.
- The two approaches compose well: use `dsh-penpot` for agent workflows, and
  the other one if you want the visual editor inside dsh.

## License

[MIT](LICENSE)
