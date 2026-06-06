import { PLATFORM_META } from "./platforms.js";

export function parseHeat(value) {
  if (value === null || value === undefined) return 0;
  const text = String(value).replace(/,/g, "").trim();
  const firstNumber = text.match(/[\d.]+/);
  if (!firstNumber) return 0;
  const base = Number(firstNumber[0]);
  if (!Number.isFinite(base)) return 0;
  if (text.includes("亿")) return Math.round(base * 100000000);
  if (text.includes("万")) return Math.round(base * 10000);
  return Math.round(base);
}

export function normalizeItem(item, platform, updateTime) {
  const meta = PLATFORM_META[platform] || { label: platform, accent: "#111827" };
  const extra = item && typeof item.extra === "object" ? item.extra || {} : {};
  const cover = item.cover || extra.image || extra.pic || extra?.owner?.face || "";
  return {
    id: `${platform}-${item.index || 0}-${slugify(item.title || "")}`,
    platform,
    platformLabel: meta.label,
    accent: meta.accent,
    rank: Number(item.index || 0),
    title: String(item.title || "").trim(),
    url: String(item.url || ""),
    hotValue: String(item.hot_value || ""),
    hotScore: parseHeat(item.hot_value),
    description: String(extra.desc || extra.description || "").trim(),
    cover,
    updateTime
  };
}

export function normalizeBoard(board) {
  const platform = board.type;
  const updateTime = board.update_time || board.generatedAt || "";
  const list = Array.isArray(board.list) ? board.list : [];
  return {
    platform,
    platformLabel: PLATFORM_META[platform]?.label || platform,
    updateTime,
    items: list.map((item) => normalizeItem(item, platform, updateTime)).filter((item) => item.title)
  };
}

export function buildDigest(boards, limit = 12) {
  const allItems = boards.flatMap((board) => board.items || []);
  return allItems
    .map((item) => ({
      ...item,
      signalScore: scoreItem(item)
    }))
    .sort((left, right) => right.signalScore - left.signalScore)
    .slice(0, limit);
}

export function scoreItem(item) {
  const heatScore = Math.log10(Math.max(item.hotScore, 1)) * 18;
  const rankScore = Math.max(0, 45 - item.rank * 2);
  const mediaScore = item.cover ? 8 : 0;
  const descriptionScore = item.description ? 6 : 0;
  return Math.round(heatScore + rankScore + mediaScore + descriptionScore);
}

export function buildVoiceover(digestItems, generatedAt = new Date().toISOString()) {
  const date = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(generatedAt));
  const top = digestItems.slice(0, 5);
  const body = top
    .map((item, index) => `${index + 1}. ${item.platformLabel}：${item.title}${item.hotValue ? `，热度 ${item.hotValue}` : ""}。`)
    .join("\n");
  return {
    title: `${date} 每日热榜口播`,
    short: `今天最值得看的 ${top.length} 条热点：${top.map((item) => item.title).join("、")}。`,
    script: `大家好，这里是今日热榜速览。\n\n${body}\n\n如果你只看一条，我建议先看「${top[0]?.title || "暂无热点"}」。它同时具备高讨论度和强传播性，适合继续做选题拆解。\n\n以上就是今天的热点更新。`,
    bullets: top.map((item) => ({
      title: item.title,
      platform: item.platformLabel,
      angle: makeAngle(item)
    }))
  };
}

export function makeAngle(item) {
  if (item.description) return item.description.slice(0, 80);
  if (item.hotScore > 1000000 || item.hotValue.includes("万")) return "高热度话题，适合做快速解读、观点对撞或评论区互动。";
  return "平台排名靠前，适合做轻量资讯播报或选题观察。";
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

