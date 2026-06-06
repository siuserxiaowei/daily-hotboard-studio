import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PLATFORMS } from "../src/platforms.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const endpoint = "https://uapis.cn/api/v1/misc/hotboard";
const generatedAt = new Date().toISOString();
const delayMs = Number(process.env.HOTBOARD_FETCH_DELAY_MS || 900);

const boards = [];
for (const platform of DEFAULT_PLATFORMS) {
  boards.push(await fetchBoard(platform));
  await sleep(delayMs);
}

const snapshot = {
  source: "https://uapis.cn/api/v1/misc/hotboard",
  generatedAt,
  platforms: DEFAULT_PLATFORMS,
  boards
};

await writeJson(join(root, "data", "snapshot.json"), snapshot);
await appendArchive(snapshot);

async function fetchBoard(platform) {
  const url = `${endpoint}?type=${encodeURIComponent(platform)}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (response.ok) return response.json();
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      if (response.status === 429 && attempt < 3) {
        await sleep(Math.max(retryAfter * 1000, delayMs * attempt * 2));
        continue;
      }
      return failedBoard(platform, `HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 3) return failedBoard(platform, error.message);
      await sleep(delayMs * attempt * 2);
    }
  }
  return failedBoard(platform, "Unknown fetch failure");
}

function failedBoard(platform, message) {
  return {
    type: platform,
    update_time: "",
    list: [],
    error: message,
    fetched_at: generatedAt
  };
}

async function appendArchive(snapshotData) {
  const date = generatedAt.slice(0, 10);
  const archiveFile = join(root, "data", "archive", `${date}.json`);
  const indexFile = join(root, "data", "archive", "index.json");
  const archived = await readJson(archiveFile, { date, snapshots: [] });
  archived.snapshots.push(snapshotData);
  await writeJson(archiveFile, archived);

  const index = await readJson(indexFile, { dates: [] });
  if (!index.dates.includes(date)) {
    index.dates.unshift(date);
  }
  index.dates = index.dates.slice(0, 60);
  await writeJson(indexFile, index);
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
