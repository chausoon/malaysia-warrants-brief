import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const htmlPath = resolve(rootDir, "warrants_filtered.html");

const API_URL = "https://www.malaysiawarrants.com.my/apimqmy/ScreenerJSONServlet";
const MARKET_URL = "https://www.klsescreener.com/v2/markets";
const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";
const MONTHS = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11
};
const INDEX_SYMBOLS = new Set([
  "HSI",
  "HSTECH",
  "N225",
  "SP500",
  "NDX",
  "DJI",
  "FBMKLCI",
  "KLSE",
  "CHINA A50"
]);

function parseWarrantDate(value) {
  const [day, month, year] = String(value).trim().split(/\s+/);
  return new Date(2000 + Number(year), MONTHS[month], Number(day));
}

function formatDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MALAYSIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatTime(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MALAYSIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)} GMT+8`;
}

function dateFromIso(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(start, end) {
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function isStockWarrant(warrant) {
  const name = warrant.underlying_name || "";
  return (
    !INDEX_SYMBOLS.has(warrant.underlyingSymbol) &&
    !/INDEX|INDICES|FUTURES|BURSA KLCI/i.test(name)
  );
}

function numberValue(value) {
  return Number(String(value ?? "").replace(/,/g, ""));
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function priceChangeClass(value) {
  const text = String(value ?? "");
  if (text.startsWith("+")) return "up";
  if (text.startsWith("-")) return "down";
  return "flat";
}

function impliedVolatility(warrant) {
  const delta = String(warrant.delta ?? "");
  if (warrant.impliedVolalitiy === "0.0" || delta.startsWith("<") || delta.startsWith(">")) {
    return "N/A";
  }
  return warrant.impliedVolalitiy;
}

function premiumPercent(warrant) {
  const exercisePrice = numberValue(warrant.exercisePrice);
  const askPrice = numberValue(warrant.askPrice);
  const ratio = numberValue(warrant.conv_ratio);
  const underlyingPrice = numberValue(warrant.underlying_price);
  if (!underlyingPrice) return "N/A";
  return (((exercisePrice + askPrice * ratio) / underlyingPrice - 1) * 100).toFixed(1);
}

function extractCss(existingHtml) {
  const match = existingHtml.match(/<style>([\s\S]*?)<\/style>/);
  return match ? match[1] : "";
}

function ensureCss(css) {
  return `
    :root {
      --bg: #1f2430;
      --panel: #242b38;
      --panel2: #1b202b;
      --line: #445063;
      --text: #dce3ef;
      --muted: #9faabd;
      --blue: #4db2ff;
      --green: #00c76f;
      --red: #ff4d5d;
      --yellow: #ffd33d;
      --orange: #ff9f1c;
      --purple: #9b7cff;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 13px;
      letter-spacing: 0;
    }

    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .topbar {
      height: 39px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 26px 0 32px;
      background: #4a5264;
      border-top: 8px solid #202634;
      color: #fff;
      overflow: auto;
    }

    .nav { display: flex; gap: 19px; align-items: center; font-weight: 700; white-space: nowrap; }
    .nav a, .nav b { color: #fff; text-decoration: none; }
    .nav a:hover { color: var(--blue); text-decoration: none; }
    .nav .active { color: var(--blue); }
    .toolbar { display: flex; gap: 14px; align-items: center; color: var(--muted); font-size: 12px; white-space: nowrap; }

    main { max-width: 1500px; margin: 0 auto; padding: 16px 32px 28px; }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: center;
      min-height: 118px;
      padding: 18px 20px;
      background: var(--panel2);
      border: 1px solid var(--line);
      border-radius: 6px;
      box-shadow: 0 10px 22px rgba(0,0,0,.16);
    }

    .eyebrow {
      display: inline-flex;
      margin-bottom: 10px;
      padding: 4px 9px;
      border: 1px solid #536176;
      border-radius: 999px;
      background: #2a3343;
      color: var(--yellow);
      font-size: 12px;
      font-weight: 800;
    }

    h1 { margin: 0 0 7px; color: #fff; font-size: 30px; line-height: 1.12; }
    h2 { margin: 24px 0 12px; color: #c7d1e2; font-size: 17px; }
    .subtitle, .source, .fineprint { color: var(--muted); }
    .subtitle { max-width: 820px; margin: 0; font-size: 13px; line-height: 1.5; }

    .hero-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
    .nav-button, .date-pill, .chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 7px 11px;
      border: 1px solid #536176;
      border-radius: 999px;
      background: #2a3343;
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }

    .nav-button:hover { border-color: var(--blue); color: var(--blue); text-decoration: none; }
    .date-pill { color: var(--muted); }

    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin: 16px 0;
    }

    .stat, .brief-card, .notice, .table-tools, .table-wrap {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 6px;
      box-shadow: 0 10px 22px rgba(0,0,0,.16);
    }

    .stat { padding: 13px 14px; border-left: 4px solid var(--blue); }
    .stat:nth-child(1) { border-left-color: var(--green); }
    .stat:nth-child(3) { border-left-color: var(--purple); }
    .stat:nth-child(4) { border-left-color: var(--orange); }
    .stat span { display: block; color: var(--muted); font-size: 12px; font-weight: 700; }
    .stat strong { display: block; margin-top: 6px; color: #fff; font-size: 24px; }

    .brief-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin: 14px 0;
    }

    .brief-card { min-height: 96px; padding: 13px; background: #202734; }
    .brief-card strong { display: block; margin-bottom: 8px; color: #fff; font-size: 14px; }
    .brief-card p { margin: 0; color: #cbd4e2; line-height: 1.5; }
    .brief-card.green { border-color: rgba(0,199,111,.45); }
    .brief-card.blue { border-color: rgba(77,178,255,.45); }
    .brief-card.orange { border-color: rgba(255,159,28,.45); }

    .filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0; }
    .chip { color: var(--text); }

    .notice {
      margin: 16px 0;
      padding: 12px 14px;
      border-left: 4px solid var(--red);
      background: #251f2a;
      color: #d8dfeb;
      line-height: 1.5;
    }
    .notice strong { color: #fff; }

    .table-tools {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      margin-top: 18px;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      background: var(--panel2);
    }

    .table-tools h2 { margin: 0; color: #fff; font-size: 16px; }
    .table-count {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 5px 10px;
      border-radius: 999px;
      background: #2a3343;
      color: var(--blue);
      font-weight: 800;
      white-space: nowrap;
    }

    .table-wrap {
      overflow: visible;
      border-top: 0;
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }

    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 8px 6px; border-bottom: 1px solid rgba(68,80,99,.55); overflow: hidden; text-overflow: ellipsis; }
    th { color: #c4ccd9; font-size: 11px; font-weight: 800; text-align: center; }
    td { color: #dce3ef; font-size: 12px; white-space: nowrap; text-align: center; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }

    .group-row th { padding: 9px 6px; color: #fff; border-bottom-color: #323b4c; }
    .group-general { background: #167466; }
    .group-market { background: #255bb8; }
    .group-warrant { background: #6547d9; }
    .column-row th { background: #202734; border-bottom-color: #323b4c; line-height: 1.2; }
    .sort-row th { padding: 6px 5px; background: #1b202b; cursor: pointer; user-select: none; }
    .sort-row th:hover, .sort-row th.active { background: #273244; }

    tbody tr:nth-child(even) { background: #202734; }
    tbody tr:hover { background: #2a3343; }
    tr:last-child td { border-bottom: 0; }

    .warrant { color: var(--blue); font-weight: 800; text-align: left; }
    td.warrant { white-space: nowrap; font-size: 11px; }
    .issuer {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 58px;
      padding: 3px 7px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      background: #2a3343;
    }
    .issuer.cimb { color: var(--yellow); }
    .issuer.macq { color: var(--blue); }
    .bid, .change.up { color: var(--green); font-weight: 800; }
    .ask, .change.down { color: var(--red); font-weight: 800; }
    .change.flat { color: var(--muted); font-weight: 800; }
    .premium { color: var(--purple); font-weight: 800; }

    .sort-icons { display: inline-flex; gap: 10px; align-items: center; justify-content: center; }
    .tri { width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; cursor: pointer; }
    .tri.down { border-top: 6px solid var(--red); }
    .tri.up { border-bottom: 6px solid var(--green); }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 16px;
      justify-content: center;
      margin: 0 0 14px;
      padding: 10px;
      background: var(--panel2);
      border: 1px solid var(--line);
      border-top: 0;
      color: var(--muted);
      font-size: 12px;
    }

    .source, .fineprint { margin: 10px 0 0; font-size: 11px; line-height: 1.5; }

    @media (max-width: 1180px) {
      .stats, .brief-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 680px) {
      main { padding: 10px; }
      .topbar { padding: 0 10px; }
      .toolbar { display: none; }
      .nav { gap: 12px; }
      .hero, .stats, .brief-grid { grid-template-columns: 1fr; }
      .hero-actions { align-items: flex-start; }
      h1 { font-size: 25px; }
      .table-tools { align-items: flex-start; flex-direction: column; }
      th, td { padding: 7px 4px; font-size: 10px; }
      td.warrant { font-size: 10px; }
    }
`;
  let nextCss = css;
  if (!nextCss.includes(".market-overview")) {
    nextCss = `${nextCss}

    .market-overview,
    .leaderboard {
      margin: 18px 0;
    }

    .section-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 14px;
      margin: 24px 0 12px;
    }

    .section-head h2 {
      margin: 0;
    }

    .section-head p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 13px;
    }

    .market-cards {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .market-card {
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }

    .market-card .label {
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .market-card .price {
      display: block;
      margin-top: 8px;
      font-size: 24px;
      font-weight: 850;
      letter-spacing: 0;
    }

    .market-card .move {
      display: inline-flex;
      margin-top: 6px;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
    }

    .move.up,
    .market-card.up .move {
      background: var(--green-soft);
      color: var(--green);
    }

    .move.down,
    .market-card.down .move {
      background: var(--rose-soft);
      color: var(--rose);
    }

    .move.flat,
    .market-card.flat .move {
      background: #eef2f7;
      color: var(--muted);
    }

    .leaderboard-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .board {
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }

    .board h3 {
      margin: 0;
      padding: 12px 14px;
      color: #fff;
      font-size: 14px;
      letter-spacing: 0;
    }

    .board.active h3 {
      background: var(--blue);
    }

    .board.gainers h3 {
      background: var(--green);
    }

    .board.losers h3 {
      background: var(--rose);
    }

    .leader-row {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      padding: 10px 12px;
      border-top: 1px solid var(--line);
      font-size: 13px;
    }

    .leader-row .rank {
      color: var(--muted);
      font-weight: 800;
    }

    .leader-row .name {
      min-width: 0;
      font-weight: 850;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .leader-row .meta {
      margin-top: 2px;
      color: var(--muted);
      font-size: 12px;
    }

    .leader-row .right {
      text-align: right;
      font-weight: 800;
      white-space: nowrap;
    }

    .leader-row .volume {
      margin-top: 2px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }

    @media (max-width: 980px) {
      .market-cards,
      .leaderboard-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 720px) {
      .section-head {
        display: block;
      }

      .market-cards,
      .leaderboard-grid {
        grid-template-columns: 1fr;
      }
    }
`;
  }
  if (!nextCss.includes(".hero-actions")) {
    nextCss = `${nextCss}

    .hero-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: flex-end;
      position: relative;
      z-index: 1;
    }

    .nav-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 8px 13px;
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      text-decoration: none;
      white-space: nowrap;
    }

    .nav-button:hover {
      background: rgba(255, 255, 255, 0.3);
      text-decoration: none;
    }

    @media (max-width: 720px) {
      .hero-actions {
        align-items: flex-start;
      }
    }
`;
  }
  return nextCss;
}

async function fetchWarrants() {
  const params = new URLSearchParams({
    underlying: "all",
    type: "call",
    issuer: "Macquarie,CIMB",
    maturity: "all",
    moneyness: "itm",
    moneynessPercent: "all",
    effectiveGearing: "all",
    expiry: "all",
    indicator: "all",
    sortBy: "",
    qid: String(Date.now()),
    sortOrder: "asc"
  });

  const response = await fetch(`${API_URL}?${params}`, {
    headers: {
      "user-agent": "Mozilla/5.0",
      referer: "https://www.malaysiawarrants.com.my/tools/warrantsearch/"
    }
  });

  if (!response.ok) {
    throw new Error(`MalaysiaWarrants API failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return payload.data || [];
}

async function fetchMarketHtml() {
  const response = await fetch(MARKET_URL, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept": "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`KLSE Screener markets page failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function stripTags(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sectionAfter(html, marker, endMarkers = []) {
  const start = html.indexOf(marker);
  if (start === -1) return "";
  const nextIndexes = endMarkers
    .map(end => html.indexOf(end, start + marker.length))
    .filter(index => index !== -1);
  const end = nextIndexes.length ? Math.min(...nextIndexes) : html.length;
  return html.slice(start, end);
}

function moveClass(change) {
  const text = String(change ?? "").trim();
  if (text.startsWith("+")) return "up";
  if (text.startsWith("-")) return "down";
  if (/\s\+/.test(text)) return "up";
  if (/\s-/.test(text)) return "down";
  return "flat";
}

function parseMarketItems(section, limit = 10) {
  const cards = [...section.matchAll(/<div class="col-md-4[^"]*"[^>]*data-code="([^"]+)"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g)];
  return cards.slice(0, limit).map((match, index) => {
    const card = match[0];
    const link = card.match(/href="\/v2\/(?:stocks\/view|markets\/intraday)\/([^"]+)">([\s\S]*?)<\/a>/);
    const name = stripTags((link || [])[2]);
    const last = stripTags((card.match(/<span class="last">([\s\S]*?)<\/span>/) || [])[1]);
    const change = stripTags((card.match(/data-value="price_change">([\s\S]*?)<\/span>/) || card.match(/data-value="price_change">([\s\S]*?)<\/div>/) || [])[1]);
    const volume = stripTags((card.match(/<div class="volume[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1]);
    return {
      rank: index + 1,
      code: link ? link[1] : match[1],
      name,
      last,
      change,
      volume,
      direction: moveClass(change)
    };
  }).filter(item => item.name);
}

async function fetchMarketData() {
  const html = await fetchMarketHtml();
  const indicesSection = sectionAfter(html, '<div class="row equal indices-section">', ["<hr />"]);
  const activeSection = sectionAfter(html, "Top Active</h2>", ["<h2>Top Gainers</h2>"]);
  const gainersSection = sectionAfter(html, "<h2>Top Gainers</h2>", ["<h2>Top Gainers %</h2>"]);
  const losersSection = sectionAfter(html, "<h2>Top Losers</h2>", ["<h2>Top Losers %</h2>"]);
  const primaryIndex = parseMarketItems(indicesSection, 1);
  const preferredIndexCodes = new Set(["0863I", "0864I", "0865I", "0868I", "0005I", "0010I", "0003I"]);
  const seenIndexCodes = new Set(primaryIndex.map(item => item.code));
  const bursaIndices = parseMarketItems(html, 800)
    .filter(item => preferredIndexCodes.has(item.code) && !seenIndexCodes.has(item.code))
    .filter(item => {
      seenIndexCodes.add(item.code);
      return true;
    });

  return {
    indices: [...primaryIndex, ...bursaIndices].slice(0, 8),
    active: parseMarketItems(activeSection, 8),
    gainers: parseMarketItems(gainersSection, 8),
    losers: parseMarketItems(losersSection, 8)
  };
}

function rowHtml(warrant) {
  const issuer = warrant.issuer === "Macquarie" ? "MACQ" : warrant.issuer;
  const issuerClass = warrant.issuer === "Macquarie" ? "macq" : "cimb";
  const changeClass = priceChangeClass(warrant.priceChange_f);

  return `          <tr><td class="warrant">${htmlEscape(warrant.dwSymbol)}</td><td class="num">${htmlEscape(warrant.exercisePrice)}</td><td class="num">${htmlEscape(warrant.conv_ratio)}</td><td>${htmlEscape(warrant.maturity)}</td><td><span class="issuer ${issuerClass}">${htmlEscape(issuer)}</span></td><td class="num bid">${htmlEscape(warrant.bidPrice_f)}</td><td class="num ask">${htmlEscape(warrant.askPrice_f)}</td><td class="num">${htmlEscape(warrant.tradeVolume_f)}</td><td class="num"><span class="change ${changeClass}">${htmlEscape(warrant.priceChange_f)}</span></td><td class="num">${htmlEscape(warrant.effectiveGearing)}</td><td class="num">${htmlEscape(impliedVolatility(warrant))}</td><td class="num premium">${htmlEscape(premiumPercent(warrant))}</td></tr>`;
}

function sortIconCells(count) {
  return Array.from(
    { length: count },
    () => '            <th><span class="sort-icons"><span class="tri down"></span><span class="tri up"></span></span></th>'
  ).join("\n");
}

function marketCardHtml(item) {
  return `        <article class="market-card ${item.direction}"><span class="label">${htmlEscape(item.name)}</span><strong class="price">${htmlEscape(item.last)}</strong><span class="move ${item.direction}">${htmlEscape(item.change || "0.000 0.0%")}</span></article>`;
}

function boardRowHtml(item) {
  return `          <div class="leader-row"><span class="rank">${item.rank}</span><div><div class="name">${htmlEscape(item.name)}</div><div class="meta">${htmlEscape(item.code)}</div></div><div class="right"><div class="move ${item.direction}">${htmlEscape(item.change || "0.000 0.0%")}</div><div class="volume">${htmlEscape(item.volume || item.last)}</div></div></div>`;
}

function boardHtml(title, type, rows) {
  return `      <section class="board ${type}">
        <h3>${title}</h3>
${rows.map(boardRowHtml).join("\n")}
      </section>`;
}

function generateHtml({ css, rows, today, cutoff, updatedAt }) {
  const rowCount = rows.length;
  const issuerCounts = rows.reduce((counts, warrant) => {
    const issuer = warrant.issuer === "Macquarie" ? "Macquarie" : warrant.issuer;
    counts[issuer] = (counts[issuer] || 0) + 1;
    return counts;
  }, {});
  const minDays = rows.length
    ? Math.min(...rows.map(warrant => daysBetween(today, parseWarrantDate(warrant.maturity))))
    : 0;

  return `<!doctype html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>马来西亚认股权证筛选简报</title>
  <style>${css}</style>
</head>
<body>
  <div class="topbar">
    <div class="nav"><a href="index.html">Dashboard</a><b class="active">Warrants</b><b>筛选</b><b>Premium</b><b>Sorting</b></div>
    <div class="toolbar">资料更新时间：${formatDateTime(updatedAt)}</div>
  </div>
  <main>
    <section class="hero">
      <div>
        <span class="eyebrow">结构性认股权证简报</span>
        <h1>CIMB / Macquarie 认股权证筛选</h1>
        <p class="subtitle">只看 Call Warrants、相关资产为股票、价内、距离到期超过 30 天。数据取自 MalaysiaWarrants 当前筛选器。</p>
      </div>
      <div class="hero-actions">
        <div class="date-pill">筛选日期：${formatDate(today)}</div>
      </div>
    </section>

    <section class="stats" aria-label="Summary">
      <div class="stat"><span>行使价符合</span><strong>0</strong></div>
      <div class="stat"><span>买入价符合</span><strong>${rowCount}</strong></div>
      <div class="stat"><span>发行商</span><strong>${Object.keys(issuerCounts).length}</strong></div>
      <div class="stat"><span>最短剩余天数</span><strong>${minDays}</strong></div>
    </section>

    <section class="brief-grid" aria-label="简报重点">
      <div class="brief-card green">
        <strong>短名单更容易看</strong>
        <p>若把 RM0.10-RM0.15 解读为买入价，筛选后剩下 ${rowCount} 个权证，全部目前处于价内。</p>
      </div>
      <div class="brief-card blue">
        <strong>发行商分布</strong>
        <p>符合条件的名单中 CIMB 有 ${issuerCounts.CIMB || 0} 个，Macquarie 有 ${issuerCounts.Macquarie || 0} 个。</p>
      </div>
      <div class="brief-card orange">
        <strong>到期日安全垫</strong>
        <p>此列表中最接近到期的权证仍有 ${minDays} 天，高于要求的 30 天门槛。</p>
      </div>
    </section>

    <section class="filters" aria-label="Applied filters">
      <span class="chip">CIMB + Macquarie</span>
      <span class="chip">Call Warrants</span>
      <span class="chip">相关资产：股票</span>
      <span class="chip">价内</span>
      <span class="chip">到期 &gt; 30 天</span>
      <span class="chip">买入价 RM0.10-RM0.15</span>
    </section>

    <section class="notice">
      <strong>行使价 RM0.10-RM0.15：</strong>
      没有找到符合条件的 CIMB 或 Macquarie Call Warrants。条件为相关资产是股票、价内、到期日在 ${formatDate(cutoff)} 之后。
    </section>

    <div class="table-tools">
      <h2>若 RM0.10-RM0.15 指的是权证买入价，符合以下名单</h2>
      <div class="table-count">${rowCount} 个权证</div>
    </div>

    <div class="table-wrap" role="region" aria-label="筛选后的权证表格" tabindex="0">
      <table>
        <colgroup>
          <col style="width: 13%">
          <col style="width: 7%">
          <col style="width: 7%">
          <col style="width: 8%">
          <col style="width: 8%">
          <col style="width: 8%">
          <col style="width: 8%">
          <col style="width: 8%">
          <col style="width: 8%">
          <col style="width: 8%">
          <col style="width: 8%">
          <col style="width: 9%">
        </colgroup>
        <thead>
          <tr class="group-row">
            <th class="group-general" colspan="5">GENERAL 基本条款</th>
            <th class="group-market" colspan="4">MARKET 市场报价</th>
            <th class="group-warrant" colspan="3">WARRANT 权证指标</th>
          </tr>
          <tr class="column-row">
            <th>权证名称</th>
            <th class="num">行使价</th>
            <th class="num">换股比率</th>
            <th>到期日</th>
            <th>发行商</th>
            <th class="num">买入价<br>(MYR)</th>
            <th class="num">卖出价<br>(MYR)</th>
            <th class="num">成交量<br>('000)</th>
            <th class="num">价格变化<br>(%)</th>
            <th class="num">有效杠杆<br>(x)</th>
            <th class="num">隐含波动率<br>(%)</th>
            <th class="num">Premium<br>(%)</th>
          </tr>
          <tr class="sort-row" aria-label="排序指标">
${sortIconCells(12)}
          </tr>
        </thead>
        <tbody>
${rows.map(rowHtml).join("\n")}
        </tbody>
      </table>
    </div>

    <div class="legend" aria-label="图例">
      <span>🔥 热门权证</span>
      <span>💧 最高流通量</span>
      <span>📅 接近到期</span>
      <span>✖ 库存售罄</span>
      <span>🌿 新权证</span>
      <span>⚡ 更敏感</span>
      <span>⚙ 高有效杠杆</span>
      <span>⏱ 低时间价值损耗</span>
    </div>

    <p class="source">资料来源：<a href="https://www.malaysiawarrants.com.my/tools/warrantsearch/">Malaysia Warrants - Warrant Search</a></p>
    <p class="fineprint">Premium 公式：((行使价 + 卖出价 × 换股比率) / 相关股价 - 1) × 100。数字来自当前筛选器回应，本页面是静态快照，不是实时市场数据。</p>
  </main>

  <script>
    (() => {
      const table = document.querySelector("table");
      const tbody = table.querySelector("tbody");
      const sortCells = Array.from(table.querySelectorAll(".sort-row th"));
      const sortTypes = ["text", "number", "number", "date", "text", "number", "number", "number", "number", "number", "number", "number"];
      const monthIndex = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

      function numberValue(value) {
        const parsed = Number(String(value).replace(/[,+]/g, ""));
        return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
      }

      function dateValue(value) {
        const parts = String(value).trim().split(/\\s+/);
        if (parts.length !== 3) return 0;
        return new Date(2000 + Number(parts[2]), monthIndex[parts[1]], Number(parts[0])).getTime();
      }

      function cellValue(row, column, type) {
        const value = row.children[column].textContent.trim();
        if (type === "number") return numberValue(value);
        if (type === "date") return dateValue(value);
        return value.toLowerCase();
      }

      function sortTable(column, direction) {
        const type = sortTypes[column] || "text";
        const modifier = direction === "asc" ? 1 : -1;
        const rows = Array.from(tbody.querySelectorAll("tr"));
        rows.sort((a, b) => {
          const aValue = cellValue(a, column, type);
          const bValue = cellValue(b, column, type);
          if (type === "text") return aValue.localeCompare(bValue) * modifier;
          return (aValue - bValue) * modifier;
        });
        tbody.append(...rows);
        sortCells.forEach(cell => cell.classList.remove("active"));
        sortCells[column].classList.add("active");
      }

      sortCells.forEach((cell, column) => {
        cell.setAttribute("title", "点击绿色箭头升序，红色箭头降序");
        cell.setAttribute("tabindex", "0");
        cell.insertAdjacentHTML("beforeend", "<span class=\\"sr-only\\">排序</span>");
        cell.addEventListener("click", event => {
          const target = event.target;
          const direction = target.classList.contains("down") ? "desc" : "asc";
          sortTable(column, direction);
        });
        cell.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            sortTable(column, "asc");
          }
        });
      });
    })();
  </script>
</body>
</html>
`;
}

async function main() {
  const existingHtml = await readFile(htmlPath, "utf8").catch(() => "");
  const css = ensureCss(extractCss(existingHtml));
  const updatedAt = new Date();
  const today = dateFromIso(formatDate(updatedAt));
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 30);

  const warrants = await fetchWarrants();
  const rows = warrants
    .filter(warrant => {
      const bidPrice = numberValue(warrant.bidPrice);
      return (
        bidPrice >= 0.1 &&
        bidPrice <= 0.15 &&
        parseWarrantDate(warrant.maturity) > cutoff &&
        isStockWarrant(warrant)
      );
    })
    .sort((a, b) => {
      const issuerOrder = a.issuer.localeCompare(b.issuer);
      return issuerOrder || a.underlyingSymbol.localeCompare(b.underlyingSymbol);
    });

  const html = generateHtml({ css, rows, today, cutoff, updatedAt });
  await writeFile(htmlPath, html);
  console.log(`Updated ${rows.length} warrants. Data time: ${formatDateTime(updatedAt)}. Cutoff: ${formatDate(cutoff)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
