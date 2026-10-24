---
name: penpot-design-review
description: Review a Penpot design file with structured checks — information hierarchy, spacing consistency, component/library usage, and open comments. Use when asked to review, audit, or give feedback on a Penpot file, UI draft, or design draft.
---

# Penpot Design Review

Run a structured review of a Penpot file and return findings grouped by
severity. This workflow is agent-driven: every step reads live data through the
`penpot_*` tools — no exports, no screenshots, no MCP.

## Preconditions

- The `dsh-penpot` plugin is installed and the `PENPOT_TOKEN` environment
  variable holds a personal access token (Penpot → Settings → Access tokens).
- You know the file's name or UUID. If you only have a name, find it first.

## Steps

1. **Locate the file.** If you have a name fragment, call
   `penpot_search_files` with the fragment; otherwise walk
   `penpot_list_teams` → `penpot_list_projects` → `penpot_list_files`.
2. **Confirm scope.** Call `penpot_get_file_overview` with the file id. Record
   the page list and whether design-token sets are attached
   (`tokenSets`). If the team agreed tokens are mandatory and `tokenSets` is 0
   or "unavailable", flag it immediately.
3. **Read the structure.** For each page (or the pages in scope), call
   `penpot_get_board_tree`. You now have every frame/board with names, types,
   and sizes.
4. **Read open feedback.** Call `penpot_read_comments` and attach unresolved
   threads to the boards they belong to.
5. **Check.** Evaluate, at minimum:
   - *Naming*: frames follow the team's convention (e.g. `screen/state`)?
   - **Hierarchy**: are board sizes plausible for their stated purpose (mobile
     375/393, desktop 1440, …)?
   - **Consistency**: sibling boards with the same role have the same size?
   - **Depth**: component-like repeats suggest extracting a component; count
     near-identical subtrees by name and size.
   - **Comments**: unresolved threads older than the last file modification
     are stale-review debt.
6. **Report.** Return: `{summary, findings: [{board, severity: high|medium|low, issue, suggestion}], openComments}`. Severity guide: `high` = blocks handoff (missing tokens, wrong frame sizes, stale blocking comments); `medium` = consistency issues the team will trip over; `low` = naming nits.

## Guardrails

- Never invent boards that are not in the tree returned by
  `penpot_get_board_tree`.
- If a tool errors with authentication or connection problems, stop and report
  the setup problem — do not continue with a partial review as if it were
  complete.
- Keep the review on the files asked about; do not sweep the whole team.
