import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { XMLParser } from "fast-xml-parser";

const execFileAsync = promisify(execFile);

export const DEFAULT_AI_SOURCE_IDS = [
  "hf-daily-papers",
  "arxiv-ai",
  "hf-models",
  "hf-datasets",
  "hf-spaces",
  "github-ai",
  "hn-ai",
  "openai-news",
  "deepmind-news",
  "hf-blog"
];

const SOURCE_TIMEOUT_MS = 15000;
const SOURCE_FETCH_DELAY_MS = 250;
const USER_AGENT = "daily-hotboard-studio/0.2 (+https://github.com/siuserxiaowei/daily-hotboard-studio)";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  trimValues: true
});

export function parseAiSourceList(value, fallback = DEFAULT_AI_SOURCE_IDS) {
  if (typeof value === "string" && ["0", "false", "off", "none"].includes(value.trim().toLowerCase())) {
    return [];
  }
  const source = typeof value === "string" && value.trim() ? value.split(",") : fallback;
  const ids = source.map((id) => String(id).trim()).filter(Boolean);
  return ids.length ? [...new Set(ids)] : [...fallback];
}

export function createAiSourceDefinitions(now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const sinceEpoch = Math.floor((now.getTime() - 7 * 86400000) / 1000);
  return [
    {
      id: "hf-daily-papers",
      label: "HF Daily Papers",
      kind: "hf-daily-papers",
      url: "https://huggingface.co/api/daily_papers?limit=50",
      maxItems: 50,
      keywords: ["AI", "论文", "Hugging Face"],
      curlFallback: true
    },
    {
      id: "arxiv-ai",
      label: "arXiv AI",
      kind: "arxiv",
      url:
        "https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL+OR+cat:cs.CV&sortBy=submittedDate&sortOrder=descending&start=0&max_results=40",
      maxItems: 40,
      keywords: ["AI", "arXiv", "论文"]
    },
    {
      id: "hf-models",
      label: "HF Models",
      kind: "hf-repos",
      repoType: "model",
      url: "https://huggingface.co/api/models?search=llm&sort=lastModified&direction=-1&limit=40",
      maxItems: 40,
      keywords: ["AI", "大模型", "Hugging Face"],
      curlFallback: true
    },
    {
      id: "hf-datasets",
      label: "HF Datasets",
      kind: "hf-repos",
      repoType: "dataset",
      url: "https://huggingface.co/api/datasets?search=ai&sort=lastModified&direction=-1&limit=40",
      maxItems: 40,
      keywords: ["AI", "数据集", "Hugging Face"],
      curlFallback: true
    },
    {
      id: "hf-spaces",
      label: "HF Spaces",
      kind: "hf-repos",
      repoType: "space",
      url: "https://huggingface.co/api/spaces?search=agent&sort=lastModified&direction=-1&limit=40",
      maxItems: 40,
      keywords: ["AI", "Agent", "Hugging Face"],
      curlFallback: true
    },
    {
      id: "github-ai",
      label: "GitHub AI",
      kind: "github-repos",
      url: `https://api.github.com/search/repositories?q=topic:artificial-intelligence+stars:%3E50+pushed:%3E=${since}&sort=updated&order=desc&per_page=50`,
      maxItems: 50,
      keywords: ["AI", "GitHub", "开源项目"],
      authEnv: "GITHUB_TOKEN"
    },
    {
      id: "hn-ai",
      label: "Hacker News AI",
      kind: "hn",
      url: `https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&numericFilters=created_at_i>${sinceEpoch}&hitsPerPage=50`,
      maxItems: 50,
      keywords: ["AI", "Hacker News", "技术讨论"]
    },
    {
      id: "openai-news",
      label: "OpenAI News",
      kind: "rss",
      url: "https://openai.com/news/rss.xml",
      maxItems: 40,
      keywords: ["AI", "OpenAI", "官方发布"]
    },
    {
      id: "deepmind-news",
      label: "DeepMind News",
      kind: "rss",
      url: "https://deepmind.google/blog/rss.xml",
      maxItems: 40,
      keywords: ["AI", "DeepMind", "官方发布"]
    },
    {
      id: "hf-blog",
      label: "HF Blog",
      kind: "rss",
      url: "https://huggingface.co/blog/feed.xml",
      maxItems: 40,
      keywords: ["AI", "Hugging Face", "官方博客"],
      curlFallback: true
    }
  ];
}

export async function fetchAiSourceBoards(options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const now = new Date(generatedAt);
  const definitions = createAiSourceDefinitions(Number.isNaN(now.getTime()) ? new Date() : now);
  const selectedIds = new Set(options.sourceIds || DEFAULT_AI_SOURCE_IDS);
  const sources = definitions.filter((source) => selectedIds.has(source.id));
  const boards = [];
  const sleepImpl = options.sleep || sleep;
  const delayMs = normalizeNonNegativeInteger(options.delayMs, SOURCE_FETCH_DELAY_MS);

  for (const [index, source] of sources.entries()) {
    boards.push(await fetchAiSourceBoard(source, { ...options, generatedAt }));
    if (index < sources.length - 1 && delayMs > 0) {
      await sleepImpl(delayMs);
    }
  }

  return boards;
}

export async function fetchAiSourceBoard(source, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const timeoutMs = normalizePositiveInteger(options.timeoutMs, SOURCE_TIMEOUT_MS);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const githubToken = options.githubToken || process.env.GITHUB_TOKEN || "";

  try {
    const text = await requestText(source.url, {
      timeoutMs,
      fetchImpl,
      curlFallback: source.curlFallback,
      headers: requestHeaders(source, githubToken)
    });
    const list = limitSourceItems(source, normalizeSourceItems(source, text));
    return aiSourceBoard(source, list, generatedAt);
  } catch (error) {
    return failedAiSourceBoard(source, formatFetchError(error), generatedAt);
  }
}

export function normalizeSourceItems(source, text) {
  if (source.kind === "hf-daily-papers") return normalizeHfDailyPapers(source, parseJson(text));
  if (source.kind === "hf-repos") return normalizeHfRepos(source, parseJson(text));
  if (source.kind === "github-repos") return normalizeGithubRepos(source, parseJson(text));
  if (source.kind === "hn") return normalizeHnStories(source, parseJson(text));
  if (source.kind === "arxiv") return normalizeArxivEntries(source, parseXml(text));
  if (source.kind === "rss") return normalizeRssItems(source, parseXml(text));
  return [];
}

export function dedupeBoardsByIdentity(boards) {
  const seen = new Set();
  return boards.map((board) => {
    if (board.error || !Array.isArray(board.list)) return board;
    const list = board.list.filter((item) => {
      const key = itemIdentityKey(item);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return updateBoardListSummary(board, list);
  });
}

function normalizeHfDailyPapers(source, data) {
  return arrayify(data).map((item, index) => {
    const paper = item.paper && typeof item.paper === "object" ? item.paper : item;
    const paperId = paper.id || item.id || "";
    const title = cleanText(item.title || paper.title);
    const aiKeywords = arrayify(paper.ai_keywords || item.ai_keywords).slice(0, 8);
    return normalizedItem({
      source,
      index,
      title,
      url: paperId ? `https://huggingface.co/papers/${paperId}` : "https://huggingface.co/papers",
      hotValue: `${Number(item.numComments || paper.numComments || 0)} 讨论 / ${Number(paper.upvotes || item.upvotes || 0)} upvotes`,
      description: cleanText(paper.ai_summary || item.ai_summary || item.summary || paper.summary),
      cover: item.thumbnail || firstValue(item.mediaUrls) || firstValue(paper.mediaUrls),
      publishedAt: item.publishedAt || paper.publishedAt,
      keywords: [...source.keywords, ...aiKeywords]
    });
  });
}

function normalizeHfRepos(source, data) {
  return arrayify(data).map((item, index) => {
    const repoId = item.modelId || item.id || "";
    const label = source.repoType === "model" ? "模型" : source.repoType === "dataset" ? "数据集" : "Space";
    const urlPrefix = source.repoType === "dataset" ? "datasets/" : source.repoType === "space" ? "spaces/" : "";
    const tags = arrayify(item.tags).slice(0, 6);
    return normalizedItem({
      source,
      index,
      title: repoId,
      url: repoId ? `https://huggingface.co/${urlPrefix}${repoId}` : "https://huggingface.co",
      hotValue: `${Number(item.likes || 0)} likes / ${Number(item.downloads || 0)} downloads`,
      description: cleanText(
        [
          `${label}更新`,
          item.pipeline_tag ? `任务：${item.pipeline_tag}` : "",
          item.library_name ? `库：${item.library_name}` : "",
          tags.length ? `标签：${tags.join("、")}` : ""
        ]
          .filter(Boolean)
          .join("；")
      ),
      publishedAt: item.lastModified || item.createdAt,
      keywords: [...source.keywords, ...tags]
    });
  });
}

function normalizeGithubRepos(source, data) {
  return arrayify(data.items).map((item, index) =>
    normalizedItem({
      source,
      index,
      title: item.full_name || item.name,
      url: item.html_url,
      hotValue: `${Number(item.stargazers_count || 0)} stars / ${Number(item.forks_count || 0)} forks`,
      description: cleanText(item.description || `GitHub AI repository${item.language ? ` · ${item.language}` : ""}`),
      publishedAt: item.pushed_at || item.updated_at || item.created_at,
      keywords: [...source.keywords, ...arrayify(item.topics).slice(0, 6), item.language].filter(Boolean)
    })
  );
}

function normalizeHnStories(source, data) {
  return arrayify(data.hits).map((item, index) =>
    normalizedItem({
      source,
      index,
      title: item.title || item.story_title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
      hotValue: `${Number(item.points || 0)} points / ${Number(item.num_comments || 0)} 评论`,
      description: cleanText(`HN 讨论 · ${item.author || "unknown"} · ${item.created_at || ""}`),
      publishedAt: item.created_at,
      keywords: source.keywords
    })
  );
}

function normalizeArxivEntries(source, data) {
  const entries = arrayify(data.feed?.entry);
  return entries
    .filter((entry) => cleanText(entry.title) !== "Error")
    .map((entry, index) => {
      const categories = arrayify(entry.category).map((category) => category.term).filter(Boolean);
      return normalizedItem({
        source,
        index,
        title: entry.title,
        url: entry.id,
        hotValue: categories.slice(0, 3).join(" / "),
        description: entry.summary,
        publishedAt: entry.published || entry.updated,
        keywords: [...source.keywords, ...categories]
      });
    });
}

function normalizeRssItems(source, data) {
  const rssItems = arrayify(data.rss?.channel?.item);
  const atomEntries = arrayify(data.feed?.entry);
  const items = rssItems.length ? rssItems : atomEntries;
  return items.map((item, index) =>
    normalizedItem({
      source,
      index,
      title: item.title,
      url: item.link?.href || item.link || item.guid || item.id || source.url,
      hotValue: item.pubDate || item.published || item.updated || "",
      description: cleanText(item.description || item.summary || item["content:encoded"]),
      publishedAt: item.pubDate || item.published || item.updated,
      keywords: source.keywords
    })
  );
}

function normalizedItem({ source, index, title, url, hotValue, description, cover, publishedAt, keywords }) {
  const cleanTitle = cleanText(title);
  return {
    index: index + 1,
    title: cleanTitle,
    url: String(url || ""),
    hot_value: String(hotValue || ""),
    cover: String(cover || ""),
    extra: {
      desc: cleanText(description).slice(0, 360),
      aiMatchedKeywords: uniqueStrings(["AI", ...arrayify(keywords)]).slice(0, 12),
      source: source.id,
      sourceLabel: source.label,
      publishedAt: String(publishedAt || "")
    }
  };
}

function limitSourceItems(source, list) {
  const maxItems = normalizePositiveInteger(source.maxItems, list.length);
  return list.slice(0, maxItems);
}

function aiSourceBoard(source, list, fetchedAt) {
  const filteredList = list.filter((item) => item.title);
  return {
    type: source.id,
    source_kind: "ai-source",
    update_time: fetchedAt,
    list: filteredList,
    fetched_at: fetchedAt,
    total_before_filter: list.length,
    total_after_filter: filteredList.length,
    ai_filter_summary: boardSummary(filteredList, list.length)
  };
}

function failedAiSourceBoard(source, message, fetchedAt) {
  return {
    type: source.id,
    source_kind: "ai-source",
    update_time: "",
    list: [],
    error: message,
    fetched_at: fetchedAt
  };
}

function updateBoardListSummary(board, list) {
  if (!board.ai_filter_summary) return { ...board, list };
  const total = Number(board.ai_filter_summary.total ?? board.total_before_filter ?? list.length);
  return {
    ...board,
    list,
    total_after_filter: list.length,
    ai_filter_summary: boardSummary(list, Number.isFinite(total) ? total : list.length)
  };
}

function boardSummary(list, total) {
  return {
    matched: list.length,
    total,
    keywords: uniqueStrings(list.flatMap((item) => item.extra?.aiMatchedKeywords || [])).slice(0, 12)
  };
}

async function requestText(url, { timeoutMs, fetchImpl, headers = {}, curlFallback = false }) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch is not available in this Node runtime");
  }

  try {
    const response = await fetchWithTimeout(url, { timeoutMs, fetchImpl, headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`);
    return await response.text();
  } catch (error) {
    if (!curlFallback) throw error;
    return curlText(url, { timeoutMs, headers, originalError: error });
  }
}

async function fetchWithTimeout(url, { timeoutMs, fetchImpl, headers }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      headers,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function curlText(url, { timeoutMs, headers, originalError }) {
  try {
    const args = ["-L", "--max-time", String(Math.ceil(timeoutMs / 1000)), "-sS"];
    for (const [name, value] of Object.entries(headers)) {
      if (value) args.push("-H", `${name}: ${value}`);
    }
    args.push(url);
    const { stdout } = await execFileAsync("curl", args, {
      maxBuffer: 5 * 1024 * 1024
    });
    return stdout;
  } catch (curlError) {
    throw new Error(`${formatFetchError(originalError)}; curl fallback failed: ${formatFetchError(curlError)}`);
  }
}

function requestHeaders(source, githubToken) {
  const headers = {
    accept: source.kind === "rss" || source.kind === "arxiv" ? "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" : "application/json",
    "user-agent": USER_AGENT
  };
  if (source.authEnv === "GITHUB_TOKEN" && githubToken) {
    headers.authorization = `Bearer ${githubToken}`;
    headers["x-github-api-version"] = "2022-11-28";
  }
  return headers;
}

function parseJson(text) {
  return JSON.parse(text);
}

function parseXml(text) {
  return xmlParser.parse(text);
}

function itemIdentityKey(item) {
  const url = normalizeIdentity(item.url);
  if (url) return `url:${url}`;
  const title = normalizeIdentity(item.title);
  return title ? `title:${title}` : "";
}

function normalizeIdentity(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function cleanText(value) {
  const source = value && typeof value === "object" && "#text" in value ? value["#text"] : value;
  return decodeEntities(stripHtml(source)).replace(/\s+/g, " ").trim();
}

function firstValue(value) {
  return arrayify(value).find(Boolean) || "";
}

function arrayify(value) {
  if (Array.isArray(value)) return value;
  return value === null || value === undefined ? [] : [value];
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function normalizeNonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
}

function formatFetchError(error) {
  return error?.message || String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
