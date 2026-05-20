import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = path.resolve(".");
const dashboardPath = path.join(root, "Malaysia Stock Dashboard.html");
const archiveRoot = path.join(root, "outputs", "auto-archives");
const mirrorDashboardPath = "/Users/chausoon/Documents/New project/Malaysia Stock Dashboard.html";
const screenshotViewport = { width: 1440, height: 1800 };
const screenshotScaleFactor = 2;

function formatParts(timeZone = "Asia/Kuala_Lumpur") {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const lookup = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return {
    now,
    yyyy: lookup.year,
    mm: lookup.month,
    dd: lookup.day,
    hh: lookup.hour,
    min: lookup.minute,
    ss: lookup.second,
  };
}

function slotTag(hh, min) {
  if (hh === "12" && min === "35") return "lunch-1235";
  if (hh === "17" && min === "05") return "close-1705";
  return `manual-${hh}${min}`;
}

function runBuildScript() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/build_malaysia_stock_dashboard.mjs"], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (buf) => {
      stdout += buf.toString();
    });
    child.stderr.on("data", (buf) => {
      stderr += buf.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`build script exited ${code}\n${stderr || stdout}`));
      }
    });
  });
}

async function main() {
  const { yyyy, mm, dd, hh, min, ss } = formatParts();
  const stamp = `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
  const tag = slotTag(hh, min);
  const dayDir = path.join(archiveRoot, `${yyyy}-${mm}-${dd}`);
  await fs.mkdir(dayDir, { recursive: true });

  const build = await runBuildScript();
  const htmlArchivePath = path.join(dayDir, `Malaysia-Stock-Dashboard-${stamp}-${tag}.html`);
  const pngArchivePath = path.join(dayDir, `Malaysia-Stock-Dashboard-${stamp}-${tag}.png`);
  const metaPath = path.join(dayDir, `Malaysia-Stock-Dashboard-${stamp}-${tag}.json`);

  await fs.copyFile(dashboardPath, htmlArchivePath);
  await fs.copyFile(dashboardPath, mirrorDashboardPath);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: screenshotViewport,
      deviceScaleFactor: screenshotScaleFactor,
    });
    await page.goto(pathToFileURL(dashboardPath).href, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await page.screenshot({ path: pngArchivePath, fullPage: true });
  } finally {
    await browser.close();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Kuala_Lumpur",
    slot: tag,
    sourceDashboard: dashboardPath,
    mirrorDashboard: mirrorDashboardPath,
    archivedHtml: htmlArchivePath,
    archivedPng: pngArchivePath,
    pngCapture: {
      viewport: screenshotViewport,
      deviceScaleFactor: screenshotScaleFactor,
      fullPage: true,
    },
    buildStdout: build.stdout.trim(),
    buildStderr: build.stderr.trim(),
  };
  await fs.writeFile(metaPath, JSON.stringify(summary, null, 2), "utf8");

  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
