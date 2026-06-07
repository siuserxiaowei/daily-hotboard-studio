# AI Source Expansion Design

## Goal

Increase the AI-only hotboard data volume without weakening topic quality. UAPI broad hotboards remain useful for Chinese social/news signals, but AI content is sparse after keyword filtering, so the fetch layer now adds AI-specialized public sources.

## Source Strategy

Use sources that are public, stable enough for scheduled fetching, and naturally AI-heavy:

- `hf-daily-papers`: Hugging Face Daily Papers for research summaries and discussion.
- `arxiv-ai`: arXiv Atom API for recent AI/ML/NLP/CV papers.
- `hf-models`, `hf-datasets`, `hf-spaces`: Hugging Face Hub APIs for open-source model, dataset, and demo activity.
- `github-ai`: GitHub Search API for recently updated AI repositories.
- `hn-ai`: Hacker News Algolia API for English technical discussion.
- `openai-news`, `deepmind-news`, `hf-blog`: RSS feeds from official AI publishers.

## Data Contract

All AI sources normalize into the existing hotboard board shape:

```js
{
  type: "hf-daily-papers",
  source_kind: "ai-source",
  update_time: "2026-06-07T00:00:00.000Z",
  fetched_at: "2026-06-07T00:00:00.000Z",
  ai_filter_summary: { matched: 50, total: 50, keywords: ["AI"] },
  list: []
}
```

Each list item keeps the existing fields used by the UI and voiceover pipeline, plus `extra.sourceLabel`, `extra.aiMatchedKeywords`, and source-specific metadata where useful.

## Failure Model

Source failure is isolated to one board with an `error` field. The fetch job should still write a valid snapshot if a single API, RSS feed, or network path fails.

Hugging Face endpoints can time out through Node `fetch` in some local network conditions, so those sources enable a `curl` fallback. GitHub Search uses `GITHUB_TOKEN` when available to improve rate limits.

## UI Contract

The dashboard should make the added data visible without becoming a generic news page:

- Show total data source count.
- Show AI-specialized source board and item counts.
- Preserve AI-only language in top copy and publishing material.
- Surface source labels per item so users can distinguish research, open-source, official, and broad hotboard signals.

## Deferred Sources

The first phase intentionally does not enable sources that require unstable scraping, login cookies, or brittle undocumented page parsing. Candidate additions should first pass a small endpoint probe and normalization test before being enabled by default.
