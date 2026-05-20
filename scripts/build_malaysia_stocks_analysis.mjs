import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const endpoint = "https://scanner.tradingview.com/malaysia/scan";
const outputDir = path.resolve("outputs/malaysia_stock_analysis");
const outputPath = path.join(outputDir, "malaysia_stocks_sector_top_last_2026-05-10.xlsx");

const columns = [
  "name",
  "description",
  "sector",
  "industry",
  "close",
  "change",
  "volume",
  "market_cap_basic",
  "price_earnings_ttm",
  "earnings_per_share_diluted_ttm",
  "dividends_yield_current",
  "Perf.W",
  "Perf.1M",
  "Perf.3M",
  "Perf.6M",
  "Perf.YTD",
  "Perf.Y",
];

const header = [
  "Ticker",
  "Company",
  "Sector",
  "Industry",
  "Close (MYR)",
  "Change %",
  "Volume",
  "Market Cap (MYR)",
  "P/E TTM",
  "EPS Diluted TTM",
  "Dividend Yield %",
  "1W %",
  "1M %",
  "3M %",
  "6M %",
  "YTD %",
  "1Y %",
  "1Y Rank Overall",
  "1Y Rank In Sector",
];

const chineseSector = new Map([
  ["Finance", "金融"],
  ["Process Industries", "加工/原材料"],
  ["Utilities", "公用事业"],
  ["Producer Manufacturing", "制造"],
  ["Industrial Services", "工业服务"],
  ["Health Services", "医疗服务"],
  ["Communications", "通讯"],
  ["Technology Services", "科技服务"],
  ["Electronic Technology", "电子科技"],
  ["Consumer Non-Durables", "必需消费"],
  ["Consumer Durables", "耐用消费"],
  ["Retail Trade", "零售"],
  ["Transportation", "交通运输"],
  ["Distribution Services", "分销服务"],
  ["Commercial Services", "商业服务"],
  ["Non-Energy Minerals", "非能源矿产"],
  ["Miscellaneous", "其他/综合"],
  ["Consumer Services", "消费服务"],
  ["Energy Minerals", "能源矿产"],
]);

function clean(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  return value;
}

function pct(value) {
  return typeof value === "number" ? Math.round(value * 100) / 100 : null;
}

function ratioPct(value) {
  return typeof value === "number" ? Math.round(value * 10000) / 100 : null;
}

function bn(value) {
  return typeof value === "number" ? Math.round((value / 1_000_000_000) * 100) / 100 : null;
}

function round(value, digits = 2) {
  if (typeof value !== "number") return value;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function fmtNumber(value, digits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function fmtPct(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
}

function median(values) {
  const sorted = values.filter((v) => typeof v === "number" && !Number.isNaN(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function fetchStocks() {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      symbols: { query: { types: ["stock"] }, tickers: [] },
      columns,
      sort: { sortBy: "name", sortOrder: "asc" },
      range: [0, 1300],
    }),
  });

  if (!response.ok) {
    throw new Error(`TradingView request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return payload.data.map((row) => {
    const d = row.d;
    return {
      symbol: row.s,
      ticker: clean(d[0]),
      company: clean(d[1]),
      sector: clean(d[2]) ?? "Unclassified",
      industry: clean(d[3]) ?? "Unclassified",
      close: clean(d[4]),
      change: clean(d[5]),
      volume: clean(d[6]),
      marketCap: clean(d[7]),
      pe: clean(d[8]),
      eps: clean(d[9]),
      dividendYield: clean(d[10]),
      perfW: clean(d[11]),
      perf1M: clean(d[12]),
      perf3M: clean(d[13]),
      perf6M: clean(d[14]),
      perfYTD: clean(d[15]),
      perfY: clean(d[16]),
      tradingView: `https://www.tradingview.com/symbols/MYX-${d[0]}/`,
    };
  });
}

function rankStocks(stocks) {
  const ranked = stocks
    .filter((stock) => typeof stock.perfY === "number")
    .sort((a, b) => b.perfY - a.perfY);

  ranked.forEach((stock, index) => {
    stock.rankOverall = index + 1;
  });

  const bySector = new Map();
  for (const stock of ranked) {
    if (!bySector.has(stock.sector)) bySector.set(stock.sector, []);
    bySector.get(stock.sector).push(stock);
  }
  for (const sectorStocks of bySector.values()) {
    sectorStocks.forEach((stock, index) => {
      stock.rankSector = index + 1;
    });
  }

  return ranked;
}

function sectorSummary(stocks) {
  const grouped = new Map();
  for (const stock of stocks) {
    if (!grouped.has(stock.sector)) grouped.set(stock.sector, []);
    grouped.get(stock.sector).push(stock);
  }

  return [...grouped.entries()]
    .map(([sector, list]) => {
      const withPerf = list.filter((stock) => typeof stock.perfY === "number");
      const sorted = [...withPerf].sort((a, b) => b.perfY - a.perfY);
      const marketCap = list.reduce((sum, stock) => sum + (typeof stock.marketCap === "number" ? stock.marketCap : 0), 0);
      const positive = withPerf.filter((stock) => stock.perfY > 0).length;
      return {
        sector,
        sectorZh: chineseSector.get(sector) ?? sector,
        count: list.length,
        withPerf: withPerf.length,
        marketCap,
        avgPerfY: withPerf.length ? withPerf.reduce((sum, stock) => sum + stock.perfY, 0) / withPerf.length : null,
        medianPerfY: median(withPerf.map((stock) => stock.perfY)),
        positiveRatio: withPerf.length ? positive / withPerf.length : null,
        top: sorted[0] ?? null,
        last: sorted.at(-1) ?? null,
      };
    })
    .sort((a, b) => b.count - a.count);
}

function stockRows(stocks) {
  return stocks.map((stock) => [
    stock.ticker,
    stock.company,
    stock.sector,
    stock.industry,
    round(stock.close, 3),
    pct(stock.change),
    stock.volume,
    round(stock.marketCap, 0),
    round(stock.pe, 2),
    round(stock.eps, 4),
    pct(stock.dividendYield),
    pct(stock.perfW),
    pct(stock.perf1M),
    pct(stock.perf3M),
    pct(stock.perf6M),
    pct(stock.perfYTD),
    pct(stock.perfY),
    stock.rankOverall ?? null,
    stock.rankSector ?? null,
  ]);
}

function addSheet(workbook, name, rows) {
  const sheet = workbook.worksheets.add(name);
  const width = rows[0].length;
  const height = rows.length;
  sheet.getRangeByIndexes(0, 0, height, width).values = rows;
  sheet.freezePanes.freezeRows(1);
  sheet.getRangeByIndexes(0, 0, 1, width).format.fill.color = "#1f4e78";
  sheet.getRangeByIndexes(0, 0, 1, width).format.font.color = "#ffffff";
  sheet.getRangeByIndexes(0, 0, 1, width).format.font.bold = true;
  sheet.getRangeByIndexes(0, 0, height, width).format.autofitColumns();
  return sheet;
}

function applyStockFormats(sheet, rowCount) {
  if (rowCount <= 1) return;
  sheet.getRange(`E2:E${rowCount}`).numberFormat = [["0.000"]];
  for (const col of ["F", "K", "L", "M", "N", "O", "P", "Q"]) {
    sheet.getRange(`${col}2:${col}${rowCount}`).numberFormat = [["0.00"]];
  }
  sheet.getRange(`G2:H${rowCount}`).numberFormat = [["#,##0"]];
  sheet.getRange(`I2:J${rowCount}`).numberFormat = [["0.00"]];
  sheet.getRange(`R2:S${rowCount}`).numberFormat = [["0"]];
}

function addSummary(workbook, stocks, sectors, top20, last20) {
  const totalMarketCap = stocks.reduce((sum, stock) => sum + (typeof stock.marketCap === "number" ? stock.marketCap : 0), 0);
  const withPerf = stocks.filter((stock) => typeof stock.perfY === "number");
  const rows = [
    ["Malaysia Stocks Analysis", ""],
    ["Data Source", "TradingView Malaysia Stock Screener"],
    ["Fetch Date", "2026-05-10"],
    ["Total Stocks", stocks.length],
    ["Stocks With 1Y Performance", withPerf.length],
    ["Sectors", sectors.length],
    ["Total Market Cap (MYR bn)", bn(totalMarketCap)],
    ["Average 1Y Performance %", pct(withPerf.reduce((sum, stock) => sum + stock.perfY, 0) / withPerf.length)],
    ["Median 1Y Performance %", pct(median(withPerf.map((stock) => stock.perfY)))],
    ["Top 1Y Stock", `${top20[0].ticker} ${top20[0].company} (${fmtPct(top20[0].perfY)})`],
    ["Worst 1Y Stock", `${last20[0].ticker} ${last20[0].company} (${fmtPct(last20[0].perfY)})`],
    ["Ranking Definition", "Top20 / Last20 sorted by 1Y price performance among stocks with available Perf.Y data."],
  ];
  const sheet = addSheet(workbook, "Summary", rows);
  sheet.getRange("A1:B1").format.font.size = 16;
  sheet.getRange("A1:B1").format.font.bold = true;
  sheet.getRange("B7:B9").numberFormat = [["#,##0"]];
  sheet.getRange("B8:B9").numberFormat = [["0.00"]];
}

function addSectorSummary(workbook, sectors) {
  const rows = [
    [
      "Sector",
      "中文分类",
      "Stock Count",
      "With 1Y Data",
      "Total Market Cap (MYR bn)",
      "Avg 1Y %",
      "Median 1Y %",
      "Positive 1Y %",
      "Top Stock 1Y",
      "Top 1Y %",
      "Last Stock 1Y",
      "Last 1Y %",
    ],
    ...sectors.map((sector) => [
      sector.sector,
      sector.sectorZh,
      sector.count,
      sector.withPerf,
      bn(sector.marketCap),
      pct(sector.avgPerfY),
      pct(sector.medianPerfY),
      ratioPct(sector.positiveRatio),
      sector.top ? `${sector.top.ticker} ${sector.top.company}` : null,
      sector.top ? pct(sector.top.perfY) : null,
      sector.last ? `${sector.last.ticker} ${sector.last.company}` : null,
      sector.last ? pct(sector.last.perfY) : null,
    ]),
  ];
  const sheet = addSheet(workbook, "Sector Summary", rows);
  const rowCount = rows.length;
  sheet.getRange(`E2:E${rowCount}`).numberFormat = [["#,##0"]];
  for (const col of ["F", "G", "H", "J", "L"]) {
    sheet.getRange(`${col}2:${col}${rowCount}`).numberFormat = [["0.00"]];
  }
}

async function main() {
  const stocks = await fetchStocks();
  const ranked = rankStocks(stocks);
  const sectors = sectorSummary(stocks);
  const top20 = ranked.slice(0, 20);
  const last20 = [...ranked].reverse().slice(0, 20);

  const workbook = Workbook.create();

  addSummary(workbook, stocks, sectors, top20, last20);
  addSectorSummary(workbook, sectors);

  const topSheet = addSheet(workbook, "Top20 1Y", [header, ...stockRows(top20)]);
  applyStockFormats(topSheet, 21);

  const lastSheet = addSheet(workbook, "Last20 1Y", [header, ...stockRows(last20)]);
  applyStockFormats(lastSheet, 21);

  const allSorted = [...stocks].sort((a, b) => {
    const sectorCompare = a.sector.localeCompare(b.sector);
    if (sectorCompare !== 0) return sectorCompare;
    return (a.rankSector ?? 99999) - (b.rankSector ?? 99999);
  });
  const allSheet = addSheet(workbook, "All Stocks", [header, ...stockRows(allSorted)]);
  applyStockFormats(allSheet, stocks.length + 1);

  const summary = {
    outputPath,
    totalStocks: stocks.length,
    withPerfY: ranked.length,
    sectorCount: sectors.length,
    top20: top20.map((stock) => ({
      ticker: stock.ticker,
      company: stock.company,
      sector: stock.sector,
      perfY: stock.perfY,
      marketCap: stock.marketCap,
    })),
    last20: last20.map((stock) => ({
      ticker: stock.ticker,
      company: stock.company,
      sector: stock.sector,
      perfY: stock.perfY,
      marketCap: stock.marketCap,
    })),
    sectors: sectors.map((sector) => ({
      sector: sector.sector,
      sectorZh: sector.sectorZh,
      count: sector.count,
      avgPerfY: sector.avgPerfY,
      medianPerfY: sector.medianPerfY,
      positiveRatio: sector.positiveRatio,
      top: sector.top ? `${sector.top.ticker} ${sector.top.company} ${fmtPct(sector.top.perfY)}` : null,
      last: sector.last ? `${sector.last.ticker} ${sector.last.company} ${fmtPct(sector.last.perfY)}` : null,
    })),
  };

  await fs.mkdir(outputDir, { recursive: true });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
  await fs.writeFile(path.join(outputDir, "malaysia_stocks_summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
