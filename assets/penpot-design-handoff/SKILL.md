---
name: penpot-design-handoff
description: Prepare a Penpot file for developer handoff or archive — inventory pages and boards, extract the design-token summary, collect open comments, and export a portable .penpot archive. Use when asked to hand off, archive, package, or export a Penpot design.
---

# Penpot Design Handoff

Turn a Penpot file into a handoff package a developer (or another Penpot
deployment) can consume: structure inventory, design-token summary, open
comment list, and a portable `.penpot` archive. Everything runs through the
`penpot_*` tools.

## Preconditions

Same as `penpot-design-review`: plugin installed, `PENPOT_TOKEN` set, file
name or UUID known.

## Steps

1. **Locate the file** with `penpot_search_files` or the
   teams → projects → files walk.
2. **Overview.** `penpot_get_file_overview` — capture pages, permissions, and
   the token-set count.
3. **Inventory.** For each page, `penpot_get_board_tree`. Build the inventory:
   every board with name, type, and size, grouped by page.
4. **Tokens.** If `tokenSets > 0`, say which sets exist and remind the
   developer they are available in the Penpot UI (Design tokens panel); the
   tool-level summary deliberately does not dump raw token values.
5. **Open comments.** `penpot_read_comments`; group by board; mark threads
   that must resolve before handoff.
6. **Export the archive.** Call `penpot_export_file` with the file id. It
   returns `{path, bytes, url}`: a binary `.penpot` archive in a local temp
   directory. Verify `bytes` is non-trivial (> 10 KiB for any real file).
7. **Deliver.** Report:
   - `archive`: local path and size of the `.penpot` file (importable into any
     Penpot deployment, including self-hosted);
   - `inventory`: pages → boards → sizes;
   - `tokens`: sets attached to the file;
   - `openComments`: unresolved threads with their boards;
   - `nextSteps`: what the developer should do first.

## Guardrails

- The `.penpot` archive is a backup/portability format, not the developer
  handoff itself — developers still consume tokens and CSS via the Penpot UI
  or the export pipeline. Say so explicitly.
- Do not move or rename the exported archive; report the exact path the tool
  returned.
- If export fails (permissions, storage), report the error verbatim and fall
  back to the inventory + comments only.
