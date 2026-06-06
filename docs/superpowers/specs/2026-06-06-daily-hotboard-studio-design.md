# Daily Hotboard Studio Design

## Goal

Build a GitHub-hosted daily hotboard product inspired by UAPI Hotboard and AI HOT: aggregate multiple Chinese hot lists, rank cross-platform signals, and generate reusable voiceover material for short videos or daily briefings.

## References

- UAPI Hotboard: 40+ platform aggregation, 5-minute update positioning, platform filters, search, time-machine and API documentation entry.
- UAPI REST API: `GET https://uapis.cn/api/v1/misc/hotboard?type=<platform>` with current, time-machine, and historical keyword search modes.
- AI HOT: editorial layer with selected score, concise summaries, tags, source link, and a recommendation reason.
- WeChat article URL: direct fetch returned Tencent verification page, so it is treated as unavailable rather than as confirmed source content.

## Product Shape

The first screen is the actual workbench: sidebar search and categories, hero signal summary, cross-platform "今日重点", a voiceover panel, and per-platform boards. No marketing landing page.

The product uses a static frontend with generated JSON data, so it can run on GitHub Pages. GitHub Actions refreshes hotboard data on a schedule, commits snapshots for lightweight archives, then deploys the built site.

## Data Flow

1. `scripts/fetch-hotboard.mjs` fetches selected platforms from UAPI.
2. It writes `data/snapshot.json` and appends `data/archive/YYYY-MM-DD.json`.
3. The frontend loads `data/snapshot.json`.
4. `src/hotboard-core.js` normalizes heat values, ranks items, and generates voiceover scripts.
5. The UI renders digest, filters, search results, platform boards, and copy buttons.

## Scope

Included:

- Static app suitable for GitHub Pages.
- Scheduled data refresh through GitHub Actions.
- Cross-platform digest ranking.
- Search and category filtering.
- Voiceover script and digest copy actions.
- Basic tests for heat parsing, normalization, digest, and voiceover generation.

Not included in v0:

- User accounts.
- Paid API key management UI.
- Server database.
- LLM-generated summaries. The deterministic voiceover generator is used by default; an LLM pipeline can be added later with repository secrets.

## Error Handling

If data fetch fails in GitHub Actions, the workflow fails instead of deploying stale unverified data silently. If the browser cannot load `snapshot.json`, the UI shows a clear error panel.

## Testing

Use Node's built-in test runner for data logic and Vite build for frontend bundling. Use Playwright after implementation to inspect desktop and mobile rendering.

