# AI Source Expansion Implementation Plan

> **For agentic workers:** Execute this plan continuously. Use an isolated worktree, keep AI-only behavior mandatory, and verify with real network fetches before merging.

**Goal:** Expand the daily AI hotboard beyond sparse broad-hotboard keyword hits by adding public AI-specialized sources, preserving the static GitHub Pages deployment.

**Architecture:** `scripts/fetch-hotboard.mjs` orchestrates UAPI and AI source fetching. `scripts/ai-sources.mjs` owns public AI source definitions, fetching, parsing, normalization, and cross-source dedupe. The frontend consumes the same snapshot board shape.

## Tasks

- [x] Create `ai-source-expansion` worktree and branch.
- [x] Add public AI source definitions for Hugging Face, arXiv, GitHub, Hacker News, and official RSS feeds.
- [x] Normalize every AI source into the existing board/list contract with `source_kind: "ai-source"`.
- [x] Add source-level error isolation and optional `curl` fallback for Hugging Face endpoints.
- [x] Add cross-source item dedupe by URL/title identity.
- [x] Add snapshot `sourceStats` and `aiSources` provenance fields.
- [x] Update platform metadata and frontend labels for AI-specialized sources.
- [x] Add tests for source-list parsing, JSON/XML/RSS normalization, error isolation, dedupe, and snapshot provenance.
- [ ] Refresh real data with the expanded source set.
- [ ] Run `npm test`, `npm run build`, `npm audit --audit-level=moderate`, and `git diff --check`.
- [ ] Verify the built UI in browser at desktop and mobile widths.
- [ ] Merge to main, push, deploy GitHub Pages, and verify the live site.

## Verification Commands

```bash
npm test
HOTBOARD_FETCH_DELAY_MS=1800 npm run fetch
npm run build
npm audit --audit-level=moderate
git diff --check
```

## Acceptance Criteria

- The snapshot contains UAPI hotboard boards plus AI-specialized source boards.
- The `ai-source` item count is visible in `data/snapshot.json` under `sourceStats.byKind["ai-source"].items`.
- A single AI source failure does not stop the fetch command.
- The dashboard still renders as an AI-only editorial workbench, not a broad hotboard clone.
- The deployed GitHub Pages URL serves the refreshed data and app shell.
