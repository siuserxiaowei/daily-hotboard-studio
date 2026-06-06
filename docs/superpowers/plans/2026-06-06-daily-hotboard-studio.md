# Daily Hotboard Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a GitHub Pages daily hotboard workbench with scheduled UAPI data refresh and voiceover material generation.

**Architecture:** A Vite static app reads generated JSON from `data/snapshot.json`. A Node script fetches UAPI hotboard data, normalizes archive files, and GitHub Actions commits refreshed data before deploying Pages.

**Tech Stack:** HTML, CSS, JavaScript modules, Vite, Node built-in test runner, GitHub Actions, GitHub Pages.

---

### Task 1: Data Pipeline

**Files:**
- Modify: `scripts/fetch-hotboard.mjs`
- Modify: `src/platforms.js`
- Modify: `src/hotboard-core.js`
- Modify: `test/hotboard-core.test.mjs`
- Modify: `data/snapshot.json`
- Modify: `data/archive/index.json`

- [x] Expand supported platform metadata and default fetch list.
- [x] Harden UAPI fetch with retry, timeout, partial failure capture, and provenance fields.
- [x] Add archive retention and de-duplication so repeated runs do not balloon the same timestamp.
- [x] Add tests for retry-independent pure functions and snapshot shape.
- [x] Run `npm test`.

### Task 2: Frontend Workbench

**Files:**
- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `src/styles.css`

- [x] Refine desktop and mobile layout as an information-dense workbench.
- [x] Add empty states for no matching search results.
- [x] Add per-topic detail affordances using existing data fields only.
- [x] Ensure buttons, tabs, cards, and long text do not resize or overlap.
- [x] Run `npm run build`.

### Task 3: Voiceover And Publishing

**Files:**
- Modify: `src/hotboard-core.js`
- Create: `README.md`
- Create: `.github/workflows/pages.yml`
- Create: `.github/workflows/update-hotboard.yml`

- [ ] Improve deterministic voiceover output with 30-second, 60-second, and bullet-outline variants.
- [ ] Document local development, data refresh, GitHub Pages setup, and optional UAPI API key.
- [ ] Add GitHub Actions for scheduled data refresh and Pages deployment.
- [ ] Run `npm test` and `npm run build`.

### Task 4: Integration And Verification

**Files:**
- Modify as needed after review.

- [ ] Merge task branches or worktrees into the main implementation branch.
- [ ] Run `npm install`, `npm test`, `npm run fetch`, and `npm run build`.
- [ ] Use Playwright to verify desktop and mobile views.
- [ ] Initialize GitHub repository, push code, and enable Pages workflow.
- [ ] Confirm repository URL and local preview URL.
