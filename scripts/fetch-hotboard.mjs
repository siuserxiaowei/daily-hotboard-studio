import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULT_PLATFORMS } from "../src/platforms.js";
import { DEFAULT_AI_SOURCE_IDS, dedupeBoardsByIdentity, fetchAiSourceBoards, parseAiSourceList } from "./ai-sources.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export const HOTBOARD_SOURCE = "https://uapis.cn/api/v1/misc/hotboard";
export const DEFAULT_FETCH_DELAY_MS = 900;
export const DEFAULT_FETCH_TIMEOUT_MS = 12000;
export const MAX_FETCH_RETRIES = 3;
export const ARCHIVE_RETENTION_DAYS = 60;
export const DEFAULT_TOPIC = "ai";
export const AI_KEYWORDS = [
  "AI",
  "AIGC",
  "AGI",
  "ChatGPT",
  "OpenAI",
  "GPT",
  "Claude",
  "Gemini",
  "DeepSeek",
  "Kimi",
  "豆包",
  "通义",
  "千问",
  "文心",
  "讯飞星火",
  "混元",
  "月之暗面",
  "大模型",
  "人工智能",
  "生成式",
  "智能体",
  "Agent",
  "MCP",
  "多模态",
  "Sora",
  "Runway",
  "Midjourney",
  "可灵",
  "即梦",
  "Cursor",
  "Copilot",
  "Manus",
  "机器人",
  "自动驾驶",
  "英伟达",
  "NVIDIA",
  "黄仁勋",
  "GPU",
  "算力",
  "AI芯片",
  "模型训练",
  "推理成本",
  "端侧AI",
  "AI应用",
  "AI产品",
  "AI工具",
  "AI绘画",
  "AI音乐",
  "AI办公",
  "AI教育",
  "AI手机",
  "AI眼镜",
  "AI玩具",
  "语音模型",
  "视频模型",
  "世界模型",
  "AI视频",
  "AI短视频",
  "AI剪辑",
  "文生图",
  "文生视频",
  "数字人",
  "AI搜索",
  "AI编程",
  "开源模型",
  "模型微调",
  "模型部署",
  "上下文窗口",
  "RAG",
  "向量数据库",
  "Token",
  "Dify",
  "Coze",
  "LangChain",
  "LlamaIndex",
  "Perplexity",
  "具身智能",
  "人形机器人",
  "机器狗"
];

if (isDirectExecution(import.meta.url, process.argv[1])) {
  await runFetchHotboard();
}

export async function runFetchHotboard(options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const source = options.source || HOTBOARD_SOURCE;
  const platforms = options.platforms || parsePlatformList(process.env.HOTBOARD_PLATFORMS, DEFAULT_PLATFORMS);
  const delayMs = normalizeNonNegativeInteger(
    options.delayMs ?? process.env.HOTBOARD_FETCH_DELAY_MS,
    DEFAULT_FETCH_DELAY_MS
  );
  const timeoutMs = normalizePositiveInteger(
    options.timeoutMs ?? process.env.HOTBOARD_FETCH_TIMEOUT_MS,
    DEFAULT_FETCH_TIMEOUT_MS
  );
  const dataDir = options.dataDir || process.env.HOTBOARD_DATA_DIR || join(root, "data");
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleepImpl = options.sleep || sleep;
  const apiKey = options.apiKey ?? process.env.UAPI_API_KEY ?? "";
  const topic = options.topic || process.env.HOTBOARD_TOPIC || DEFAULT_TOPIC;
  const keywords = parseKeywordList(process.env.HOTBOARD_AI_KEYWORDS, options.keywords || AI_KEYWORDS);
  const includeAiSources = options.includeAiSources ?? parseBooleanEnv(process.env.HOTBOARD_INCLUDE_AI_SOURCES, true);
  const aiSourceOverride = typeof process.env.HOTBOARD_AI_SOURCES === "string" && process.env.HOTBOARD_AI_SOURCES.trim();
  const aiSourceIds = options.aiSourceIds || parseAiSourceList(process.env.HOTBOARD_AI_SOURCES, DEFAULT_AI_SOURCE_IDS);

  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch is not available in this Node runtime");
  }

  const boards = [];
  for (const [index, platform] of platforms.entries()) {
    boards.push(
      await fetchBoard(platform, {
        source,
        generatedAt,
        delayMs,
        timeoutMs,
        apiKey,
        fetchImpl,
        sleep: sleepImpl
      })
    );
    if (index < platforms.length - 1 && delayMs > 0) {
      await sleepImpl(delayMs);
    }
  }

  const filteredBoards = topic === "ai" ? filterBoardsForAi(boards, keywords) : boards;
  const aiSourceBoards =
    topic === "ai" && includeAiSources && aiSourceIds.length
      ? await fetchAiSourceBoards({
          generatedAt,
          sourceIds: aiSourceIds,
          timeoutMs,
          fetchImpl,
          githubToken: options.githubToken ?? process.env.GITHUB_TOKEN ?? "",
          reportMissingRequiredEnv: options.reportMissingRequiredEnv ?? Boolean(options.aiSourceIds || aiSourceOverride),
          sleep: sleepImpl
        })
      : [];
  const combinedBoards = dedupeBoardsByIdentity([...filteredBoards, ...aiSourceBoards]);
  const snapshot = buildSnapshot({
    source,
    generatedAt,
    platforms: combinedBoards.map((board) => board.type),
    boards: combinedBoards,
    topic,
    keywords,
    aiSources: aiSourceBoards.map((board) => board.type)
  });
  await writeJson(join(dataDir, "snapshot.json"), snapshot);
  await writeArchive(snapshot, { dataDir });
  return snapshot;
}

export async function fetchBoard(platform, options = {}) {
  const source = options.source || HOTBOARD_SOURCE;
  const generatedAt = options.generatedAt || new Date().toISOString();
  const delayMs = normalizeNonNegativeInteger(options.delayMs, DEFAULT_FETCH_DELAY_MS);
  const timeoutMs = normalizePositiveInteger(options.timeoutMs, DEFAULT_FETCH_TIMEOUT_MS);
  const apiKey = String(options.apiKey || "");
  const maxRetries = Math.min(
    MAX_FETCH_RETRIES,
    normalizeNonNegativeInteger(options.maxRetries, MAX_FETCH_RETRIES)
  );
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleepImpl = options.sleep || sleep;
  const url = `${source}?type=${encodeURIComponent(platform)}`;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, { fetchImpl, timeoutMs, apiKey });
      if (response.ok) {
        const payload = await response.json();
        return normalizeSuccessBoard(payload, platform, generatedAt);
      }
      const message = httpErrorMessage(response);
      if (attempt <= maxRetries && shouldRetryStatus(response.status)) {
        await sleepImpl(
          retryDelayMs({
            status: response.status,
            retryAfter: response.headers?.get?.("retry-after"),
            attempt,
            delayMs
          })
        );
        continue;
      }
      return failedBoard(platform, message, generatedAt);
    } catch (error) {
      if (attempt <= maxRetries) {
        await sleepImpl(backoffDelayMs(attempt, delayMs));
        continue;
      }
      return failedBoard(platform, formatFetchError(error), generatedAt);
    }
  }

  return failedBoard(platform, "Unknown fetch failure", generatedAt);
}

export function parsePlatformList(value, fallback = DEFAULT_PLATFORMS) {
  const source = typeof value === "string" && value.trim() ? value.split(",") : fallback;
  const platforms = source.map((platform) => String(platform).trim()).filter(Boolean);
  return platforms.length ? [...new Set(platforms)] : [...fallback];
}

export function parseKeywordList(value, fallback = AI_KEYWORDS) {
  const source = typeof value === "string" && value.trim() ? value.split(",") : fallback;
  const keywords = source.map((keyword) => String(keyword).trim()).filter(Boolean);
  return keywords.length ? [...new Set(keywords)] : [...fallback];
}

export function buildSnapshot({
  source = HOTBOARD_SOURCE,
  generatedAt,
  platforms,
  boards,
  topic = DEFAULT_TOPIC,
  keywords = AI_KEYWORDS,
  aiSources = []
}) {
  const okCount = boards.filter((board) => !board.error).length;
  const itemCount = boards.reduce((sum, board) => sum + (Array.isArray(board.list) ? board.list.length : 0), 0);
  return {
    source,
    generatedAt,
    topic,
    filter: {
      mode: topic === "ai" ? "ai-keyword-match" : "none",
      keywords
    },
    sourceStats: summarizeSources(boards),
    aiSources: [...aiSources],
    platforms: [...platforms],
    okCount,
    errorCount: boards.length - okCount,
    itemCount,
    boards
  };
}

function summarizeSources(boards) {
  const byKind = {};
  let totalItems = 0;
  for (const board of boards) {
    const kind = board.source_kind || "unknown";
    const itemCount = Array.isArray(board.list) ? board.list.length : 0;
    const existing = byKind[kind] || { boards: 0, ok: 0, errors: 0, items: 0 };
    existing.boards += 1;
    existing.ok += board.error ? 0 : 1;
    existing.errors += board.error ? 1 : 0;
    existing.items += itemCount;
    totalItems += itemCount;
    byKind[kind] = existing;
  }
  return {
    totalBoards: boards.length,
    totalItems,
    byKind
  };
}

export function normalizeSuccessBoard(payload, platform, fetchedAt) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return failedBoard(platform, "Invalid JSON payload", fetchedAt);
  }
  return {
    ...payload,
    type: String(payload.type || platform),
    source_kind: "uapi-hotboard",
    update_time: String(payload.update_time || ""),
    list: Array.isArray(payload.list) ? payload.list : [],
    fetched_at: fetchedAt
  };
}

export function failedBoard(platform, message, fetchedAt) {
  return {
    type: platform,
    source_kind: "uapi-hotboard",
    update_time: "",
    list: [],
    error: message,
    fetched_at: fetchedAt
  };
}

export function filterBoardsForAi(boards, keywords = AI_KEYWORDS) {
  return boards.map((board) => {
    if (board.error || !Array.isArray(board.list)) return board;
    const list = board.list
      .map((item) => annotateAiItem(item, keywords))
      .filter((item) => item.extra.aiMatchedKeywords.length > 0);
    return {
      ...board,
      list,
      total_before_filter: board.list.length,
      total_after_filter: list.length,
      ai_filter_summary: {
        matched: list.length,
        total: board.list.length,
        keywords: [...new Set(list.flatMap((item) => item.extra.aiMatchedKeywords))].slice(0, 12)
      }
    };
  });
}

export function annotateAiItem(item, keywords = AI_KEYWORDS) {
  const extra = item && typeof item.extra === "object" ? item.extra || {} : {};
  const text = collectSearchText(item, extra);
  const matchedKeywords = keywords.filter((keyword) => keywordMatches(keyword, text));
  return {
    ...item,
    extra: {
      ...extra,
      aiMatchedKeywords: matchedKeywords
    }
  };
}

export function keywordMatches(keyword, text) {
  const normalizedKeyword = String(keyword || "").trim();
  const normalizedText = String(text || "");
  if (!normalizedKeyword || !normalizedText) return false;
  if (/^[a-z0-9.+#-]+$/i.test(normalizedKeyword)) {
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(normalizedText);
  }
  const lowercaseText = normalizedText.toLowerCase();
  const lowercaseKeyword = normalizedKeyword.toLowerCase();
  return (
    lowercaseText.includes(lowercaseKeyword) ||
    lowercaseText.replace(/\s+/g, "").includes(lowercaseKeyword.replace(/\s+/g, ""))
  );
}

function collectSearchText(item, extra) {
  const parts = [
    item?.title,
    item?.hot_value,
    extra?.desc,
    extra?.description,
    extra?.tname,
    extra?.rcmd_reason,
    extra?.tag,
    extra?.label
  ];
  return parts.filter(Boolean).join(" ");
}

export function minuteKey(value) {
  return String(value || "").slice(0, 16);
}

export function upsertArchiveSnapshot(archive, snapshotData) {
  const date = snapshotData.generatedAt.slice(0, 10);
  const snapshots = Array.isArray(archive?.snapshots) ? [...archive.snapshots] : [];
  const targetMinuteKey = minuteKey(snapshotData.generatedAt);
  const existingIndex = snapshots.findIndex((snapshot) => minuteKey(snapshot?.generatedAt) === targetMinuteKey);

  if (existingIndex >= 0) {
    snapshots[existingIndex] = snapshotData;
  } else {
    snapshots.push(snapshotData);
  }

  snapshots.sort((left, right) => String(left.generatedAt).localeCompare(String(right.generatedAt)));
  return { date, snapshots };
}

export function updateArchiveIndex(index, date, retentionDays = ARCHIVE_RETENTION_DAYS) {
  const dates = Array.isArray(index?.dates) ? index.dates : [];
  return {
    dates: [date, ...dates.filter((item) => item !== date)]
      .filter(Boolean)
      .sort((left, right) => String(right).localeCompare(String(left)))
      .slice(0, retentionDays)
  };
}

export function parseRetryAfterMs(value, nowMs = Date.now()) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - nowMs);
  }
  return null;
}

export function retryDelayMs({ status, retryAfter, attempt, delayMs, nowMs = Date.now() }) {
  if (status === 429) {
    const retryAfterMs = parseRetryAfterMs(retryAfter, nowMs);
    if (retryAfterMs !== null) return retryAfterMs;
  }
  return backoffDelayMs(attempt, delayMs);
}

async function writeArchive(snapshotData, { dataDir }) {
  const date = snapshotData.generatedAt.slice(0, 10);
  const archiveFile = join(dataDir, "archive", `${date}.json`);
  const indexFile = join(dataDir, "archive", "index.json");
  const archived = upsertArchiveSnapshot(await readJson(archiveFile, { date, snapshots: [] }), snapshotData);
  await writeJson(archiveFile, archived);

  const index = updateArchiveIndex(await readJson(indexFile, { dates: [] }), date);
  await writeJson(indexFile, index);
}

async function fetchWithTimeout(url, { fetchImpl, timeoutMs, apiKey }) {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const headers = { accept: "application/json" };
    if (apiKey) headers["X-API-Key"] = apiKey;
    return await fetchImpl(url, {
      headers,
      signal: controller.signal
    });
  } catch (error) {
    if (timedOut) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function shouldRetryStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function httpErrorMessage(response) {
  return `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
}

function formatFetchError(error) {
  return error?.message || String(error);
}

function backoffDelayMs(attempt, delayMs) {
  return delayMs * attempt * 2;
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function normalizeNonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
}

function parseBooleanEnv(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDirectExecution(moduleUrl, argvPath) {
  return Boolean(argvPath) && moduleUrl === pathToFileURL(argvPath).href;
}
