import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildBriefRss, buildChangeBrief } from "../src/change-brief.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export async function rebuildChangeBrief(options = {}) {
  const dataDir = options.dataDir || join(root, "data");
  const snapshotPath = join(dataDir, "snapshot.json");
  const current = options.current || JSON.parse(await readFile(snapshotPath, "utf8"));
  const previous = options.previous === undefined ? await findPreviousSnapshot(current, dataDir) : options.previous;
  const brief = buildChangeBrief(current, previous);
  const enrichedSnapshot = { ...current, changeBrief: brief };

  await mkdir(dataDir, { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify(enrichedSnapshot, null, 2)}\n`, "utf8");
  await writeFile(join(dataDir, "change-brief.json"), `${JSON.stringify(brief, null, 2)}\n`, "utf8");
  await writeFile(
    join(dataDir, "change-brief.xml"),
    buildBriefRss(brief, {
      siteUrl: options.siteUrl || process.env.HOTBOARD_SITE_URL,
      feedUrl: options.feedUrl || process.env.HOTBOARD_FEED_URL
    }),
    "utf8"
  );
  return { brief, previousGeneratedAt: previous?.generatedAt || null };
}

async function findPreviousSnapshot(current, dataDir) {
  const index = await readJson(join(dataDir, "archive", "index.json"), { dates: [] });
  const candidates = [];
  for (const date of index.dates || []) {
    const archive = await readJson(join(dataDir, "archive", `${date}.json`), { snapshots: [] });
    candidates.push(...(archive.snapshots || []));
  }
  return (
    candidates
      .filter((snapshot) => snapshot?.generatedAt && snapshot.generatedAt < current.generatedAt)
      .sort((left, right) => String(right.generatedAt).localeCompare(String(left.generatedAt)))[0] || null
  );
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  const result = await rebuildChangeBrief();
  process.stdout.write(
    `${result.brief.decision} · ${result.brief.receipts.length} receipts · previous ${result.previousGeneratedAt || "none"}\n`
  );
}

function isDirectExecution(moduleUrl, argvPath) {
  return Boolean(argvPath) && moduleUrl === pathToFileURL(argvPath).href;
}
