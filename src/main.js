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

init();

async function init() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/snapshot.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`snapshot ${response.status}`);
    state.snapshot = await response.json();
    state.boards = (state.snapshot.boards || []).map(normalizeBoard);
    render();
  } catch (error) {
    app.innerHTML = `<main class="boot error"><p>热榜数据暂时不可用：${escapeHtml(error.message)}</p></main>`;
  }
}

function render() {
  const boards = filterBoards();
  const digest = buildDigest(boards, 14);
  const voiceover = buildVoiceover(digest, state.snapshot.generatedAt);
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="mark"></span>
          <div>
            <strong>每日热榜</strong>
            <small>Hotboard Studio</small>
          </div>
        </div>
        <label class="search">
          <span>搜索</span>
          <input id="search-input" value="${escapeHtml(state.query)}" placeholder="关键词 / 平台 / 话题" />
        </label>
        <nav class="group-list">
          ${groupButton("all", "全部平台")}
          ${PLATFORM_GROUPS.map((group) => groupButton(group.id, group.label)).join("")}
        </nav>
      </aside>
      <main class="workspace">
        <section class="hero-panel">
          <div>
            <p class="eyebrow">更新于 ${formatDate(state.snapshot.generatedAt)}</p>
            <h1>今天的注意力流向</h1>
            <p class="lede">把微博、知乎、B站、新闻和科技社区的热榜合并成一个可播报、可复制、可跟踪的工作台。</p>
          </div>
          <div class="stats">
            <div><strong>${state.boards.length}</strong><span>平台</span></div>
            <div><strong>${state.boards.reduce((sum, board) => sum + board.items.length, 0)}</strong><span>条热点</span></div>
            <div><strong>${digest[0]?.signalScore || 0}</strong><span>最高信号</span></div>
          </div>
        </section>
        <section class="digest-grid">
          <article class="panel main-digest">
            <div class="panel-head">
              <div>
                <p class="eyebrow">精选</p>
                <h2>今日重点</h2>
              </div>
              <button class="ghost" id="copy-digest">复制摘要</button>
            </div>
            <div class="digest-list">
              ${digest.slice(0, 8).map(renderDigestItem).join("")}
            </div>
          </article>
          <article class="panel voice-card">
            <div class="panel-head">
              <div>
                <p class="eyebrow">口播</p>
                <h2>${escapeHtml(voiceover.title)}</h2>
              </div>
              <button class="ghost" id="copy-script">复制脚本</button>
            </div>
            <p>${escapeHtml(voiceover.short)}</p>
            <pre>${escapeHtml(voiceover.script)}</pre>
          </article>
        </section>
        <section class="board-tools">
          <div class="platform-tabs">
            ${platformTab("all", "全部")}
            ${state.boards.map((board) => platformTab(board.platform, board.platformLabel)).join("")}
          </div>
        </section>
        <section class="boards">
          ${boards.map(renderBoard).join("")}
        </section>
      </main>
    </div>
  `;
  bindEvents(voiceover, digest);
}

function filterBoards() {
  const group = PLATFORM_GROUPS.find((item) => item.id === state.selectedGroup);
  const groupPlatforms = group ? new Set(group.platforms) : null;
  const query = state.query.trim().toLowerCase();
  return state.boards
    .filter((board) => !groupPlatforms || groupPlatforms.has(board.platform))
    .filter((board) => state.selectedPlatform === "all" || board.platform === state.selectedPlatform)
    .map((board) => ({
      ...board,
      items: board.items.filter((item) => {
        if (!query) return true;
        return [item.title, item.description, item.platformLabel].some((value) => value.toLowerCase().includes(query));
      })
    }))
    .filter((board) => board.items.length);
}

function bindEvents(voiceover, digest) {
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
  document.querySelector("#copy-script")?.addEventListener("click", () => copyText(voiceover.script));
  document.querySelector("#copy-digest")?.addEventListener("click", () => {
    copyText(digest.slice(0, 10).map((item, index) => `${index + 1}. [${item.platformLabel}] ${item.title} ${item.url}`).join("\n"));
  });
}

function renderDigestItem(item, index) {
  return `
    <a class="digest-item" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
      <span class="rank">${index + 1}</span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.platformLabel)} · 信号 ${item.signalScore}${item.hotValue ? ` · ${escapeHtml(item.hotValue)}` : ""}</small>
      </div>
    </a>
  `;
}

function renderBoard(board) {
  return `
    <article class="board-card">
      <header>
        <div>
          <p class="eyebrow">${escapeHtml(board.updateTime || "实时")}</p>
          <h3>${escapeHtml(board.platformLabel)}</h3>
        </div>
        <span>${board.items.length} 条</span>
      </header>
      <ol>
        ${board.items.slice(0, 12).map(renderBoardItem).join("")}
      </ol>
    </article>
  `;
}

function renderBoardItem(item) {
  const accent = PLATFORM_META[item.platform]?.accent || "#111827";
  return `
    <li style="--accent:${accent}">
      <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
        <span class="mini-rank">${item.rank}</span>
        <span class="topic">${escapeHtml(item.title)}</span>
        <span class="heat">${escapeHtml(item.hotValue)}</span>
      </a>
    </li>
  `;
}

function groupButton(id, label) {
  return `<button data-group="${id}" class="${state.selectedGroup === id ? "active" : ""}">${label}</button>`;
}

function platformTab(id, label) {
  return `<button data-platform="${id}" class="${state.selectedPlatform === id ? "active" : ""}">${escapeHtml(label)}</button>`;
}

function copyText(text) {
  navigator.clipboard?.writeText(text);
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

