---
name: penpot-design-generate
description: Generate design drafts in Penpot — create a project/file, then produce boards as SVG assets the model writes itself and upload them. Use when asked to create, draft, or generate a design, UI mockup, icon set, or landing page inside Penpot.
---

# Penpot Design Generate

Create real artifacts inside Penpot: a project, a design file, and
model-authored SVG boards uploaded as assets. This is the plugin's write path
— no MCP, no canvas automation; the model writes SVG (which it is good at) and
the plugin delivers it into Penpot's asset library.

## What this can and cannot do

- ✅ Create projects and files; upload SVG/PNG/JPEG/WebP assets into a file;
  import whole `.penpot` archives.
- ❌ Draw shapes directly onto a Penpot canvas (that needs Penpot's
  `update-file` operation log — deliberately out of scope). For pixel-level
  canvas editing, open the file in Penpot's editor after uploading assets.

## Steps

1. **Decide the target.** If a project already exists, reuse it
   (`penpot_list_projects`); otherwise `penpot_create_project` with a clear
   name (e.g. `AI drafts 2026-10`).
2. **Create the file.** `penpot_create_file` with a descriptive name
   (`landing-v1`, `icon-set-outline`). Record the returned file id.
3. **Author the boards as SVG.** Write one full SVG document per board:
   - `<svg xmlns="http://www.w3.org/2000/svg" width="..." viewBox="...">`
   - Use real text elements, groups, and consistent naming via `id` /
     `data-name` attributes.
   - Keep each SVG under ~200 KB; a board at 1440×1024 or 393×852 is a good
     frame size (desktop / mobile).
4. **Upload each board.** `penpot_upload_asset` with the file id,
   `name: "boards/landing-hero.svg"`, and the full SVG source as `content`.
   Batch: one call per board, report each returned media id.
5. **Report.** Return: `{project, file, assets: [{name, mediaId}], nextSteps}`.
   Tell the user to open the file in Penpot: the SVG boards live in the file's
   assets and can be dragged onto any page, then ungrouped and edited as
   native shapes where Penpot supports it.

## Quality bar

- SVG must be valid XML: declare `xmlns`, close every tag, escape `&`.
- Design tokens first: define a tiny palette in the skill's head (e.g. primary
  `#00D1B2`, text `#1C1C2E`) and reuse it across boards — reviewers can then
  swap colors file-wide.
- Name boards after their intent (`hero`, `pricing`, `nav-mobile`), not
  `svg1`, `svg2`.
- After uploading ≥ 3 boards, run `penpot_get_file_overview` to confirm the
  file's `modified-at` moved — proof the writes landed.

## Guardrails

- Never upload binary content as a string: this tool path is text SVG only
  (PNG/JPEG/WebP come from real render outputs, not hand-written text).
- If `penpot_upload_asset` fails with a media-type error, fix the extension
  instead of retrying blindly.
- Do not create duplicate projects/files when the user names an existing one —
  search first (`penpot_search_files`).
