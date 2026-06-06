import "./styles.css";
import { PLATFORM_GROUPS, PLATFORM_META } from "./platforms.js";
import { buildDigest, buildVoiceover, normalizeBoard } from "./hotboard-core.js";

const state = {
  snapshot: null,
  boards: [],
  selectedGroup: "all",
  query: "",
  selectedPlatform: "all"
};

const app = document.querySelector("#app");
const numberFormatter = new Intl.NumberFormat("zh-CN");

init();

async function init() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/snapshot.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`snapshot ${response.status}`);
    state.snapshot = await response.json();
    state.boards = (state.snapshot.boards || []).map(normalizeBoard);
    render();
  } catch (error) {
    app.innerHTML = `
      <main class="boot error">
        <p>热榜数据暂时不可用：${escapeHtml(error.message)}</p>
      </main>
    `;
  }
}

function render() {
  const groupBoards = getGroupBoards();
  const boards = filterBoards();
  const digest = buildDigest(boards, 14);
  const voiceover = buildVoiceover(digest, state.snapshot.generatedAt);
  const filterProvenance = getFilterProvenance(state.snapshot);
  const publishingAssets = normalizePublishingAssets(voiceover.assets);
  const totalTopics = countItems(state.boards);
  const visibleTopics = countItems(boards);
  const activeDescriptionCount = boards.flatMap((board) => board.items).filter((item) => item.description).length;

  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar" aria-label="热榜筛选">
        <div class="brand">
          <span class="mark" aria-hidden="true"></span>
          <div>
            <strong>AI 每日热榜</strong>
            <small>AI Hotboard Studio</small>
          </div>
        </div>

        <label class="search">
          <span class="field-label">搜索 AI 热点</span>
          <input id="search-input" value="${escapeHtml(state.query)}" placeholder="模型 / 公司 / 产品 / 技术" autocomplete="off" />
        </label>

        <section class="sidebar-block">
          <div class="sidebar-title">
            <span>分类</span>
            <small>${groupBoards.length} / ${state.boards.length} 平台</small>
          </div>
          <nav class="group-list" aria-label="分类筛选">
            ${groupButton("all", "全部平台")}
            ${PLATFORM_GROUPS.map((group) => groupButton(group.id, group.label)).join("")}
          </nav>
        </section>

        <section class="sidebar-block side-summary" aria-label="当前数据概览">
          <div>
            <span>当前匹配</span>
            <strong>${formatNumber(visibleTopics)}</strong>
          </div>
          <div>
            <span>AI 热点</span>
            <strong>${formatNumber(totalTopics)}</strong>
          </div>
        </section>
      </aside>

      <main class="workspace">
        <section class="top-strip" aria-label="工作台概览">
          <div class="top-copy">
            <p class="eyebrow">更新于 ${formatDate(state.snapshot.generatedAt)}</p>
            <h1>AI 热榜工作台</h1>
            <div class="scope-line">
              <span class="filter-provenance">${escapeHtml(filterProvenance.mode)} · ${escapeHtml(filterProvenance.keywordLabel)}</span>
              <span>抖音/社交平台随 UAPI 可用性展示</span>
              <span>${escapeHtml(getSelectedGroupLabel())}</span>
              <span>${escapeHtml(getSelectedPlatformLabel())}</span>
              ${state.query ? `<span>搜索：${escapeHtml(state.query)}</span>` : "<span>未输入关键词</span>"}
            </div>
          </div>
          <div class="stats" aria-label="筛选统计">
            ${statCard("平台", groupBoards.length, "当前分类")}
            ${statCard("匹配", visibleTopics, "筛选后 AI 热点")}
            ${statCard("描述", activeDescriptionCount, "可展开条目")}
            ${statCard("最高信号", digest[0]?.signalScore || 0, "AI 重点")}
          </div>
        </section>

        <section class="focus-grid" aria-label="今日重点和口播">
          <article class="panel main-digest">
            <div class="panel-head">
              <div>
                <p class="eyebrow">AI 今日重点</p>
                <h2>高信号 AI 热点</h2>
              </div>
              <button class="ghost copy-action" id="copy-digest" type="button" data-default-label="复制摘要">复制摘要</button>
            </div>
            <div class="digest-list">
              ${digest.length ? digest.slice(0, 8).map(renderDigestItem).join("") : renderEmptyState("没有匹配的 AI 重点", "当前搜索或筛选没有命中 AI 热点。清除条件后可恢复 AI 今日重点。")}
            </div>
          </article>

          <article class="panel voice-card">
            <div class="panel-head">
              <div>
                <p class="eyebrow">口播</p>
                <h2>${escapeHtml(voiceover.title)}</h2>
              </div>
              <button class="ghost copy-action" id="copy-script" type="button" data-default-label="复制脚本">复制脚本</button>
            </div>
            ${
              digest.length
                ? `<p>${escapeHtml(voiceover.short)}</p><pre>${escapeHtml(voiceover.script)}</pre>`
                : renderEmptyState("暂无 AI 口播素材", "没有可用 AI 热点时不会生成有效口播，请调整分类或关键词。")
            }
          </article>
        </section>

        ${renderPublishingPanel(publishingAssets)}

        <section class="board-tools" aria-label="平台筛选">
          <div>
            <p class="eyebrow">平台卡片</p>
            <h2>分平台 AI 热榜</h2>
          </div>
          <div class="platform-tabs" role="list" aria-label="平台切换">
            ${platformTab("all", "全部", countItems(groupBoards))}
            ${groupBoards.map((board) => platformTab(board.platform, board.platformLabel, board.items.length)).join("")}
          </div>
        </section>

        <section class="boards" aria-live="polite">
          ${boards.length ? boards.map(renderBoard).join("") : renderEmptyState("没有匹配的 AI 热点", "换个 AI 公司、模型、产品或技术关键词，或切回全部平台查看当前快照。")}
        </section>
      </main>
    </div>
  `;
  bindEvents(voiceover, digest, publishingAssets);
}

function filterBoards() {
  const groupPlatforms = getGroupPlatformSet();
  const query = normalizeQuery(state.query);
  return state.boards
    .filter((board) => !groupPlatforms || groupPlatforms.has(board.platform))
    .filter((board) => state.selectedPlatform === "all" || board.platform === state.selectedPlatform)
    .map((board) => ({
      ...board,
      items: board.items.filter((item) => itemMatchesQuery(item, query))
    }))
    .filter((board) => board.items.length);
}

function getGroupBoards() {
  const groupPlatforms = getGroupPlatformSet();
  return state.boards.filter((board) => !groupPlatforms || groupPlatforms.has(board.platform));
}

function getGroupPlatformSet() {
  const group = PLATFORM_GROUPS.find((item) => item.id === state.selectedGroup);
  return group ? new Set(group.platforms) : null;
}

function bindEvents(voiceover, digest, publishingAssets) {
  document.querySelector("#search-input")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  document.querySelectorAll("[data-group]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedGroup = button.dataset.group;
      state.selectedPlatform = "all";
      render();
    });
  });

  document.querySelectorAll("[data-platform]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPlatform = button.dataset.platform;
      render();
    });
  });

  document.querySelectorAll("[data-reset-filters]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedGroup = "all";
      state.selectedPlatform = "all";
      state.query = "";
      render();
    });
  });

  document.querySelector("#copy-script")?.addEventListener("click", (event) => copyText(voiceover.script, event.currentTarget));
  document.querySelector("#copy-digest")?.addEventListener("click", (event) => copyText(buildDigestCopy(digest), event.currentTarget));
  document
    .querySelector("#copy-assets")
    ?.addEventListener("click", (event) => copyText(buildPublishingAssetsCopy(publishingAssets), event.currentTarget));

  document.querySelectorAll("img[data-fallback]").forEach((image) => {
    image.addEventListener("error", () => image.remove());
  });
}

function renderPublishingPanel(assets) {
  const hasAssets = hasPublishingAssets(assets);
  return `
    <article class="panel publishing-panel" aria-label="AI-only 发布素材">
      <div class="panel-head">
          <div>
          <p class="eyebrow">AI 发布素材</p>
          <h2>开头钩子、短视频文案、分平台角度</h2>
        </div>
        ${hasAssets ? '<button class="ghost copy-action" id="copy-assets" type="button" data-default-label="复制素材">复制素材</button>' : ""}
      </div>
      <p class="panel-note">
        ${escapeHtml(
          "Publishing material is generated only from AI-filtered topics. Douyin/social platform extraction appears when UAPI data and rate limits allow those boards."
        )}
      </p>
      ${
        hasAssets
          ? `<div class="material-grid">
              ${renderMaterialColumn("开头钩子", "短视频开场", assets.hooks, renderTextMaterial)}
              ${renderMaterialColumn("短视频文案", "可直接改写", assets.captions, renderTextMaterial)}
              ${renderMaterialColumn("分平台角度", "来源视角", assets.platformAngles, renderPlatformAngle)}
            </div>`
          : renderQuietEmptyState(
              "等待 AI 发布素材",
              "当前 buildVoiceover() 尚未提供 hooks、captions 或 platformAngles；AI-only 摘要和口播脚本仍可复制。"
            )
      }
    </article>
  `;
}

function renderMaterialColumn(title, hint, items, renderItem) {
  return `
    <section class="material-lane" aria-label="${escapeHtml(title)}">
      <header>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(hint)} · ${formatNumber(items.length)}</span>
      </header>
      ${
        items.length
          ? `<ol class="material-list">${items.map((item, index) => renderItem(item, index)).join("")}</ol>`
          : `<p class="inline-empty">暂无${escapeHtml(hint)}</p>`
      }
    </section>
  `;
}

function renderTextMaterial(text, index) {
  return `
    <li>
      <span class="material-index">${formatRank(index + 1)}</span>
      <p class="material-text">${escapeHtml(text)}</p>
    </li>
  `;
}

function renderPlatformAngle(item, index) {
  if (typeof item === "string") return renderTextMaterial(item, index);
  const platform = item?.platform || "AI platform";
  const title = item?.title || "未命名 AI 选题";
  const angle = item?.angle || "暂无平台角度。";
  const keywords = Array.isArray(item?.keywords) ? item.keywords.filter(Boolean).slice(0, 4) : [];
  return `
    <li>
      <span class="material-index">${formatRank(index + 1)}</span>
      <div class="angle-copy">
        <strong>${escapeHtml(platform)}</strong>
        <p class="angle-title">${escapeHtml(title)}</p>
        <small>${escapeHtml(angle)}${keywords.length ? ` · ${escapeHtml(keywords.join(" / "))}` : ""}</small>
      </div>
    </li>
  `;
}

function renderDigestItem(item, index) {
  const accent = PLATFORM_META[item.platform]?.accent || "#1f2933";
  const description = item.description ? `<p class="digest-description">${escapeHtml(item.description)}</p>` : "";
  return `
    <article class="digest-item" style="--accent:${escapeHtml(accent)}">
      <span class="rank">${index + 1}</span>
      <div class="digest-copy">
        ${renderExternalLink(item.url, item.title, "digest-title")}
        <small>${escapeHtml(item.platformLabel)} · 信号 ${item.signalScore}${item.hotValue ? ` · 热度 ${escapeHtml(item.hotValue)}` : " · 热度未提供"}</small>
        ${description}
      </div>
    </article>
  `;
}

function renderBoard(board) {
  const accent = PLATFORM_META[board.platform]?.accent || "#1f2933";
  const summary = formatBoardFilterSummary(board);
  return `
    <article class="board-card" style="--accent:${escapeHtml(accent)}">
      <header>
        <div>
          <p class="eyebrow">${escapeHtml(board.updateTime || "实时")}</p>
          <h3>${escapeHtml(board.platformLabel)}</h3>
        </div>
        <span>${escapeHtml(summary)}</span>
      </header>
      <ol class="topic-list">
        ${board.items.slice(0, 12).map(renderBoardItem).join("")}
      </ol>
    </article>
  `;
}

function renderBoardItem(item) {
  const description = item.description || "该 AI 条目没有提供描述，当前保留原始标题、排名、热度和来源链接。";
  const cover = item.cover ? `<img class="topic-cover" src="${escapeHtml(resolveAssetUrl(item.cover))}" alt="" loading="lazy" data-fallback />` : "";
  return `
    <li class="topic-row">
      <details>
        <summary>
          <span class="mini-rank">${formatRank(item.rank)}</span>
          <span class="topic-main">
            <span class="topic">${escapeHtml(item.title)}</span>
            <span class="topic-flags">${item.description ? "有描述" : "无描述"} · ${item.hotValue ? `热度 ${escapeHtml(item.hotValue)}` : "热度未提供"}</span>
          </span>
          <span class="heat">${item.hotValue ? escapeHtml(item.hotValue) : "无热度"}</span>
          <span class="detail-cue" aria-hidden="true">详情</span>
        </summary>
        <div class="detail-body">
          ${cover}
          <div class="detail-copy">
            <p>${escapeHtml(description)}</p>
            <dl class="detail-metrics">
              <div><dt>平台</dt><dd>${escapeHtml(item.platformLabel)}</dd></div>
              <div><dt>排名</dt><dd>${formatRank(item.rank)}</dd></div>
              <div><dt>热度</dt><dd>${item.hotValue ? escapeHtml(item.hotValue) : "未提供"}</dd></div>
              <div><dt>AI 命中</dt><dd>${item.matchedKeywords?.length ? escapeHtml(item.matchedKeywords.slice(0, 3).join(" / ")) : "AI"}</dd></div>
            </dl>
            ${renderExternalLink(item.url, "打开原链接", "detail-link")}
          </div>
        </div>
      </details>
    </li>
  `;
}

function renderEmptyState(title, message) {
  return `
    <div class="empty-state" role="status">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
      ${hasActiveFilters() ? '<button class="ghost" type="button" data-reset-filters>清除筛选</button>' : ""}
    </div>
  `;
}

function renderQuietEmptyState(title, message) {
  return `
    <div class="empty-state quiet-empty" role="status">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function groupButton(id, label) {
  const count = countItems(getBoardsForGroup(id));
  return `
    <button type="button" data-group="${escapeHtml(id)}" class="${state.selectedGroup === id ? "active" : ""}">
      <span>${escapeHtml(label)}</span>
      <small>${formatNumber(count)}</small>
    </button>
  `;
}

function platformTab(id, label, count) {
  return `
    <button type="button" data-platform="${escapeHtml(id)}" class="${state.selectedPlatform === id ? "active" : ""}" role="listitem">
      <span>${escapeHtml(label)}</span>
      <small>${formatNumber(count)}</small>
    </button>
  `;
}

function statCard(label, value, hint) {
  return `
    <div class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${formatNumber(value)}</strong>
      <small>${escapeHtml(hint)}</small>
    </div>
  `;
}

async function copyText(text, button) {
  const ok = text.trim() ? await writeClipboard(text) : false;
  showCopyFeedback(button, ok);
}

async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallbackCopy(text);
    }
  }
  return fallbackCopy(text);
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto 0";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function showCopyFeedback(button, ok) {
  if (!button) return;
  const defaultLabel = button.dataset.defaultLabel || button.textContent;
  button.textContent = ok ? "已复制" : "复制失败";
  button.classList.toggle("copied", ok);
  button.classList.toggle("copy-failed", !ok);
  window.clearTimeout(button.copyTimer);
  button.copyTimer = window.setTimeout(() => {
    button.textContent = defaultLabel;
    button.classList.remove("copied", "copy-failed");
  }, 1400);
}

function buildDigestCopy(digest) {
  return digest
    .slice(0, 10)
    .map((item, index) => {
      const heat = item.hotValue ? ` | 热度 ${item.hotValue}` : "";
      const description = item.description ? `\n   ${item.description}` : "";
      return `${index + 1}. [${item.platformLabel}] ${item.title}${heat}${description}\n   ${item.url}`;
    })
    .join("\n");
}

function buildPublishingAssetsCopy(assets) {
  const sections = [];
  if (assets.hooks.length) sections.push(formatCopySection("开头钩子", assets.hooks));
  if (assets.captions.length) sections.push(formatCopySection("短视频文案", assets.captions));
  if (assets.platformAngles.length) {
    sections.push(
      [
        "分平台角度",
        ...assets.platformAngles.map((item, index) => {
          if (typeof item === "string") return `${index + 1}. ${item}`;
          const keywords = Array.isArray(item?.keywords) && item.keywords.length ? ` | ${item.keywords.slice(0, 4).join(" / ")}` : "";
          return `${index + 1}. [${item?.platform || "AI 平台"}] ${item?.title || "未命名 AI 选题"}\n   ${item?.angle || "暂无平台角度。"}${keywords}`;
        })
      ].join("\n")
    );
  }
  return sections.join("\n\n");
}

function formatCopySection(title, items) {
  return [title, ...items.map((item, index) => `${index + 1}. ${item}`)].join("\n");
}

function renderExternalLink(url, label, className) {
  if (!url) return `<span class="${className} is-disabled">暂无链接</span>`;
  return `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
}

function itemMatchesQuery(item, query) {
  if (!query) return true;
  return [item.title, item.description, item.platformLabel, item.hotValue].some((value) => normalizeQuery(value).includes(query));
}

function normalizeQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function getBoardsForGroup(groupId) {
  const group = PLATFORM_GROUPS.find((item) => item.id === groupId);
  if (!group) return state.boards;
  const platforms = new Set(group.platforms);
  return state.boards.filter((board) => platforms.has(board.platform));
}

function getSelectedGroupLabel() {
  return state.selectedGroup === "all" ? "全部分类" : PLATFORM_GROUPS.find((group) => group.id === state.selectedGroup)?.label || "全部分类";
}

function getSelectedPlatformLabel() {
  if (state.selectedPlatform === "all") return "全部平台";
  return state.boards.find((board) => board.platform === state.selectedPlatform)?.platformLabel || "全部平台";
}

function getFilterProvenance(snapshot) {
  const filter = snapshot?.filter || {};
  const mode = filter.mode ? formatFilterMode(filter.mode) : "AI-only keyword filter";
  const keywordCount = Array.isArray(filter.keywords) ? filter.keywords.length : 0;
  return {
    mode,
    keywordLabel: keywordCount ? `${formatNumber(keywordCount)} 个关键词` : "关键词不可用"
  };
}

function formatFilterMode(mode) {
  const normalized = String(mode || "").trim();
  if (normalized === "ai-keyword-match") return "AI-only 关键词过滤";
  return normalized ? `${normalized.replace(/[-_]+/g, " ")} 过滤` : "AI-only 关键词过滤";
}

function normalizePublishingAssets(assets) {
  const source = assets && typeof assets === "object" ? assets : {};
  return {
    hooks: normalizeTextList(source.hooks).slice(0, 5),
    captions: normalizeTextList(source.captions).slice(0, 5),
    platformAngles: Array.isArray(source.platformAngles) ? source.platformAngles.filter(Boolean).slice(0, 5) : []
  };
}

function normalizeTextList(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function hasPublishingAssets(assets) {
  return assets.hooks.length || assets.captions.length || assets.platformAngles.length;
}

function formatBoardFilterSummary(board) {
  const summary = board.aiFilterSummary || {};
  const matched = Number(summary.matched);
  const total = Number(summary.total);
  if (Number.isFinite(matched) && Number.isFinite(total) && total > 0) {
    return `AI ${formatNumber(matched)} / ${formatNumber(total)}`;
  }
  return `${formatNumber(board.items.length)} 条`;
}

function countItems(boards) {
  return boards.reduce((sum, board) => sum + board.items.length, 0);
}

function hasActiveFilters() {
  return state.selectedGroup !== "all" || state.selectedPlatform !== "all" || state.query.trim();
}

function formatRank(value) {
  const rank = Number(value);
  return Number.isFinite(rank) && rank > 0 ? String(rank).padStart(2, "0") : "--";
}

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

function resolveAssetUrl(value) {
  const url = String(value || "");
  if (/^(https?:)?\/\//.test(url) || url.startsWith("data:")) return url;
  return `${import.meta.env.BASE_URL}data/${url.replace(/^\/+/, "")}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
