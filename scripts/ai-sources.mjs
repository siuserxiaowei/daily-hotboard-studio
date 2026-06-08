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
  "x-ai-search",
  "justone-weixin-ai",
  "justone-xiaohongshu-ai",
  "justone-douyin-ai",
  "douyin-open-search",
  "openai-news",
  "deepmind-news",
  "hf-blog"
];

const SOURCE_TIMEOUT_MS = 15000;
const SOURCE_FETCH_DELAY_MS = 250;
const USER_AGENT = "daily-hotboard-studio/0.2 (+https://github.com/siuserxiaowei/daily-hotboard-studio)";
const DEFAULT_SOCIAL_QUERY = "AI~OpenAI~ChatGPT~Claude~DeepSeek~大模型~智能体~AI工具";
const DEFAULT_X_QUERY = '(AI OR OpenAI OR ChatGPT OR Claude OR DeepSeek OR "large language model" OR LLM OR agent) -is:retweet -is:reply lang:en';

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

export function createAiSourceDefinitions(now = new Date(), env = process.env) {
  const since = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const sinceEpoch = Math.floor((now.getTime() - 7 * 86400000) / 1000);
  const socialQuery = env.HOTBOARD_SOCIAL_KEYWORDS || DEFAULT_SOCIAL_QUERY;
  const xQuery = env.HOTBOARD_X_QUERY || DEFAULT_X_QUERY;
  const douyinKeyword = env.HOTBOARD_DOUYIN_KEYWORD || "AI";
  const searchStart = formatJustOneTime(new Date(now.getTime() - 2 * 86400000));
  const searchEnd = formatJustOneTime(now);
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
      id: "x-ai-search",
      label: "X / Twitter AI",
      kind: "x-recent-search",
      url: `https://api.x.com/2/tweets/search/recent?${new URLSearchParams({
        query: xQuery,
        max_results: "50",
        sort_order: "relevancy",
        "tweet.fields": "created_at,author_id,public_metrics,lang",
        expansions: "author_id",
        "user.fields": "username,name,verified,public_metrics"
      })}`,
      maxItems: 50,
      keywords: ["AI", "X", "Twitter", "社交舆论"],
      requiredEnv: "X_BEARER_TOKEN",
      auth: { env: "X_BEARER_TOKEN", header: "authorization", scheme: "Bearer" }
    },
    {
      id: "justone-weixin-ai",
      label: "公众号 AI 搜索",
      kind: "justone-search",
      url: justOneSearchUrl({ token: env.JUSTONE_API_TOKEN, source: "WEIXIN", keyword: socialQuery, start: searchStart, end: searchEnd }),
      maxItems: 40,
      keywords: ["AI", "公众号", "社媒搜索", "WeChat"],
      requiredEnv: "JUSTONE_API_TOKEN"
    },
    {
      id: "justone-xiaohongshu-ai",
      label: "小红书 AI 搜索",
      kind: "justone-search",
      url: justOneSearchUrl({ token: env.JUSTONE_API_TOKEN, source: "XIAOHONGSHU", keyword: socialQuery, start: searchStart, end: searchEnd }),
      maxItems: 40,
      keywords: ["AI", "小红书", "社媒搜索", "Xiaohongshu"],
      requiredEnv: "JUSTONE_API_TOKEN"
    },
    {
      id: "justone-douyin-ai",
      label: "抖音 AI 搜索",
      kind: "justone-search",
      url: justOneSearchUrl({ token: env.JUSTONE_API_TOKEN, source: "DOUYIN", keyword: socialQuery, start: searchStart, end: searchEnd }),
      maxItems: 40,
      keywords: ["AI", "抖音", "短视频", "社媒搜索"],
      requiredEnv: "JUSTONE_API_TOKEN"
    },
    {
      id: "douyin-open-search",
      label: "抖音开放平台 AI",
      kind: "douyin-open-search",
      url: `https://open.douyin.com/dy_open_api/v2/search/video/?${new URLSearchParams({
        keyword: douyinKeyword,
        count: "20",
        cursor: "0",
        device_id: "12345",
        publish_time: "7",
        sort_type: "1"
      })}`,
      maxItems: 20,
      keywords: ["AI", "抖音", "短视频", "开放平台"],
      requiredEnv: "DOUYIN_ACCESS_TOKEN",
      auth: { env: "DOUYIN_ACCESS_TOKEN", header: "access-token" }
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
  const env = options.env || process.env;
  const definitions = createAiSourceDefinitions(Number.isNaN(now.getTime()) ? new Date() : now, env);
  const reportMissingRequiredEnv = Boolean(options.reportMissingRequiredEnv);
  const selectedIds = new Set(options.sourceIds || DEFAULT_AI_SOURCE_IDS);
  const sources = definitions.filter((source) => selectedIds.has(source.id));
  const boards = [];
  const sleepImpl = options.sleep || sleep;
  const delayMs = normalizeNonNegativeInteger(options.delayMs, SOURCE_FETCH_DELAY_MS);

  for (const [index, source] of sources.entries()) {
    const missingEnv = missingRequiredEnv(source, env);
    if (missingEnv.length) {
      if (reportMissingRequiredEnv) {
        boards.push(failedAiSourceBoard(source, `Missing required env: ${missingEnv.join(", ")}`, generatedAt));
      }
      continue;
    }
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
  const env = options.env || process.env;
  const requestEnv = { ...env, GITHUB_TOKEN: options.githubToken || env.GITHUB_TOKEN || "" };

  try {
    const text = await requestText(source.url, {
      timeoutMs,
      fetchImpl,
      curlFallback: source.curlFallback,
      headers: requestHeaders(source, requestEnv)
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
  if (source.kind === "x-recent-search") return normalizeXRecentSearch(source, parseJson(text));
  if (source.kind === "justone-search") return normalizeSocialSearchItems(source, parseJson(text));
  if (source.kind === "douyin-open-search") return normalizeDouyinOpenSearch(source, parseJson(text));
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

function normalizeXRecentSearch(source, data) {
  const usersById = new Map(
    arrayify(data.includes?.users)
      .filter(isPlainObject)
      .map((user) => [String(user.id || ""), user])
  );
  return arrayify(data.data)
    .filter(isPlainObject)
    .map((tweet, index) => {
      const user = usersById.get(String(tweet.author_id || "")) || {};
      const username = cleanText(user.username || "");
      const author = cleanText(user.name || username || tweet.author_id);
      const statusUrl = tweet.id
        ? username
          ? `https://x.com/${username}/status/${tweet.id}`
          : `https://x.com/i/web/status/${tweet.id}`
        : source.url;
      return normalizedItem({
        source,
        index,
        title: tweet.text,
        url: statusUrl,
        hotValue: formatMetrics([
          { label: "likes", value: tweet.public_metrics?.like_count },
          { label: "reposts", value: tweet.public_metrics?.retweet_count },
          { label: "replies", value: tweet.public_metrics?.reply_count },
          { label: "quotes", value: tweet.public_metrics?.quote_count }
        ]),
        description: [author ? `${author}${username ? ` @${username}` : ""}` : "", tweet.text].filter(Boolean).join(" · "),
        publishedAt: tweet.created_at,
        keywords: source.keywords
      });
    });
}

function normalizeSocialSearchItems(source, data) {
  assertApiSuccess("JustOne", data, ["code", "message"]);
  return extractItems(data, [
    "data.list",
    "data.items",
    "data.results",
    "data.records",
    "data.data.list",
    "data.data.items",
    "data.data.results",
    "data",
    "list",
    "items",
    "results",
    "records"
  ]).map((item, index) => {
    const title =
      pickCleanText(item, [
        "title",
        "note_title",
        "display_title",
        "article_title",
        "desc",
        "description",
        "summary",
        "content",
        "text"
      ]) || source.label;
    return normalizedItem({
      source,
      index,
      title,
      url:
        pickCleanText(item, [
          "url",
          "link",
          "share_url",
          "web_url",
          "jump_url",
          "article_url",
          "source_url",
          "note_url"
        ]) || source.url,
      hotValue: formatSocialMetrics(item),
      description: socialDescription(item),
      cover: pickCleanText(item, ["cover", "cover_url", "image", "image_url", "pic", "thumbnail", "avatar"]),
      publishedAt: normalizeTimestamp(
        pickValue(item, ["publish_time", "published_at", "create_time", "created_at", "time", "timestamp"])
      ),
      keywords: source.keywords
    });
  });
}

function normalizeDouyinOpenSearch(source, data) {
  assertApiSuccess("Douyin", data, ["err_no", "err_msg"]);
  assertApiSuccess("Douyin", lookupPath(data, "data.data") || lookupPath(data, "data"), ["error_code", "description"]);
  return extractItems(data, [
    "data.data.video_list",
    "data.video_list",
    "video_list",
    "data.data.aweme_list",
    "data.aweme_list",
    "aweme_list",
    "data.data.data",
    "data.data",
    "data.list",
    "list"
  ]).map((rawItem, index) => {
    const item = unwrapSocialItem(rawItem);
    const itemId = pickCleanText(item, ["item_id", "aweme_id", "id"]);
    const title = pickCleanText(item, ["title", "desc", "description", "share_info.share_title"]) || source.label;
    return normalizedItem({
      source,
      index,
      title,
      url:
        pickCleanText(item, ["link", "share_url", "share_info.share_url", "url", "web_url"]) ||
        (itemId ? `https://www.douyin.com/video/${itemId}` : source.url),
      hotValue: formatMetrics([
        { label: "likes", value: pickValue(item, ["statistics.digg_count", "digg_count", "like_count"]) },
        { label: "comments", value: pickValue(item, ["statistics.comment_count", "comment_count"]) },
        { label: "shares", value: pickValue(item, ["statistics.share_count", "share_count"]) },
        { label: "views", value: pickValue(item, ["statistics.play_count", "play_count"]) }
      ]),
      description: socialDescription(item),
      cover: pickCleanText(item, ["cover", "cover_url", "video.cover.url_list.0", "video.dynamic_cover.url_list.0"]),
      publishedAt: normalizeTimestamp(pickValue(item, ["create_time", "publish_time", "published_at", "timestamp"])),
      keywords: source.keywords
    });
  });
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

function requestHeaders(source, env) {
  const headers = {
    accept: source.kind === "rss" || source.kind === "arxiv" ? "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" : "application/json",
    "user-agent": USER_AGENT
  };
  if (source.auth && env?.[source.auth.env]) {
    headers[source.auth.header] = source.auth.scheme
      ? `${source.auth.scheme} ${env[source.auth.env]}`
      : String(env[source.auth.env]);
  }
  if (source.authEnv === "GITHUB_TOKEN" && env?.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
    headers["x-github-api-version"] = "2022-11-28";
  }
  return headers;
}

function formatJustOneTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function justOneSearchUrl({ token, source, keyword, start, end }) {
  return `https://api.justoneapi.com/api/search/v1?${new URLSearchParams({
    token: token || "",
    keyword,
    source,
    start,
    end
  })}`;
}

function missingRequiredEnv(source, env) {
  return arrayify(source.requiredEnv).filter((name) => !String(env?.[name] || "").trim());
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

function pickCleanText(item, paths) {
  return cleanText(pickValue(item, paths));
}

function pickValue(item, paths) {
  for (const path of paths) {
    const value = lookupPath(item, path);
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      const nestedValue = firstValue(value);
      if (nestedValue !== null && nestedValue !== undefined && String(nestedValue).trim()) return nestedValue;
      continue;
    }
    if (typeof value === "object") {
      const nestedValue = value.url || value.href || value.text || value.value || value.title || value.name;
      if (nestedValue !== null && nestedValue !== undefined && String(nestedValue).trim()) return nestedValue;
      continue;
    }
    if (String(value).trim()) return value;
  }
  return "";
}

function lookupPath(item, path) {
  if (!item || typeof item !== "object") return undefined;
  return String(path)
    .split(".")
    .reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)];
      return current[key];
    }, item);
}

function extractItems(data, paths) {
  for (const path of paths) {
    const value = lookupPath(data, path);
    const items = arrayify(value).map(unwrapSocialItem).filter(isPlainObject);
    if (items.length) return items;
  }
  return [];
}

function unwrapSocialItem(item) {
  if (!isPlainObject(item)) return item;
  return item.aweme_info || item.video_info || item.video || item.item || item.article || item.note || item;
}

function socialDescription(item) {
  const author = pickCleanText(item, ["nickname", "author", "author_name", "user.name", "user.nickname", "account_name"]);
  const desc = pickCleanText(item, ["desc", "description", "summary", "content", "text"]);
  const sourceName = pickCleanText(item, ["source", "platform", "site", "media_name"]);
  return [author, sourceName, desc].filter(Boolean).join(" · ");
}

function formatSocialMetrics(item) {
  return formatMetrics([
    { label: "likes", value: pickValue(item, ["liked_count", "like_count", "likes", "digg_count", "statistics.digg_count"]) },
    { label: "comments", value: pickValue(item, ["comment_count", "comments", "statistics.comment_count"]) },
    { label: "shares", value: pickValue(item, ["share_count", "shares", "statistics.share_count"]) },
    { label: "collects", value: pickValue(item, ["collect_count", "favorite_count", "favorites", "statistics.collect_count"]) },
    { label: "reads", value: pickValue(item, ["read_count", "reads", "view_count", "views", "statistics.play_count"]) }
  ]);
}

function formatMetrics(metrics) {
  return metrics
    .map(({ label, value }) => {
      const number = Number(value);
      if (!Number.isFinite(number) || number <= 0) return "";
      return `${Math.round(number)} ${label}`;
    })
    .filter(Boolean)
    .join(" / ");
}

function normalizeTimestamp(value) {
  const raw = Array.isArray(value) ? firstValue(value) : value;
  const number = Number(raw);
  if (Number.isFinite(number) && number > 0) {
    const milliseconds = number > 1_000_000_000_000 ? number : number * 1000;
    return new Date(milliseconds).toISOString();
  }
  return String(raw || "");
}

function assertApiSuccess(label, data, [codeKey, messageKey]) {
  if (!data || typeof data !== "object" || !(codeKey in data)) return;
  const code = data[codeKey];
  if (String(code) === "0") return;
  throw new Error(`${label} API ${code}: ${cleanText(data[messageKey] || "request failed")}`);
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
