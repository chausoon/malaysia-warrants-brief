import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");
const outputPath = path.join(root, "index.html");
const middaySnapshotPath = path.join(root, "data/malaysia_midday_snapshot.json");

const screenerUrl = "https://scanner.tradingview.com/malaysia/scan";
const yahooKlciUrls = [
  "https://query1.finance.yahoo.com/v8/finance/chart/%5EKLSE?range=2mo&interval=1d&includePrePost=false",
  "https://query2.finance.yahoo.com/v8/finance/chart/%5EKLSE?range=2mo&interval=1d&includePrePost=false",
];
const newsRssUrls = [
  {
    name: "Bursa Malaysia official via Google News",
    url: "https://news.google.com/rss/search?q=site%3Abursamalaysia.com%20%28Bursa%20Malaysia%20OR%20FBM%20KLCI%20OR%20KLCI%29%20when%3A14d&hl=en-MY&gl=MY&ceid=MY%3Aen",
  },
  {
    name: "Bursa / FBM KLCI market news",
    url: "https://news.google.com/rss/search?q=%28Bursa%20Malaysia%20OR%20FBM%20KLCI%20OR%20KLCI%20Futures%29%20when%3A7d&hl=en-MY&gl=MY&ceid=MY%3Aen",
  },
  {
    name: "Moomoo / Sin Chew auxiliary news",
    url: "https://news.google.com/rss/search?q=%28Moomoo%20OR%20Sin%20Chew%20OR%20%E6%98%9F%E6%B4%B2%29%20%28Bursa%20Malaysia%20OR%20FBM%20KLCI%20OR%20%E9%A9%AC%E8%82%A1%29%20when%3A14d&hl=en-MY&gl=MY&ceid=MY%3Aen",
  },
];

const tvColumns = [
  "name",
  "description",
  "sector",
  "industry",
  "close",
  "change",
  "volume",
  "Value.Traded",
  "market_cap_basic",
  "price_earnings_ttm",
  "earnings_per_share_diluted_ttm",
  "dividends_yield_current",
  "Recommend.All",
  "RSI",
  "Perf.W",
  "Perf.1M",
  "Perf.3M",
  "Perf.6M",
  "Perf.YTD",
  "Perf.Y",
];

const sectorZh = new Map([
  ["Finance", "金融"],
  ["Process Industries", "原材料/加工"],
  ["Utilities", "公用事业"],
  ["Producer Manufacturing", "制造"],
  ["Industrial Services", "工业服务"],
  ["Health Services", "医疗服务"],
  ["Health Technology", "医疗科技"],
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
  ["Miscellaneous", "综合"],
  ["Consumer Services", "消费服务"],
  ["Energy Minerals", "能源"],
]);

const bursaSectorMeta = [
  ["CONSTRUCTION", "Construction", "建筑"],
  ["CONSUMER PRODUCTS & SERVICES", "Consumer Products & Services", "消费产品与服务"],
  ["ENERGY", "Energy", "能源"],
  ["FINANCIAL SERVICES", "Financial Services", "金融服务"],
  ["HEALTH CARE", "Health Care", "医疗保健"],
  ["INDUSTRIAL PRODUCTS & SERVICES", "Industrial Products & Services", "工业产品与服务"],
  ["PLANTATION", "Plantation", "种植"],
  ["PROPERTY", "Property", "产业/房地产"],
  ["REAL ESTATE INVESTMENT TRUSTS", "Real Estate Investment Trusts", "REITs"],
  ["TECHNOLOGY", "Technology", "科技"],
  ["TELECOMMUNICATIONS & MEDIA", "Telecommunications & Media", "电讯与媒体"],
  ["TRANSPORTATION & LOGISTICS", "Transportation & Logistics", "交通与物流"],
  ["UTILITIES", "Utilities", "公用事业"],
  ["CLOSED-END FUND", "Closed-End Fund", "封闭式基金"],
  ["EXCHANGE TRADED FUND", "Exchange Traded Fund", "ETF"],
  ["SPAC", "SPAC", "SPAC"],
];

const bursaSectorByKey = new Map(bursaSectorMeta.map(([key, label, zh], order) => [key, { key, label, zh, order }]));

const manualBursaSector = new Map(
  Object.entries({
    // Bursa KLCI / large-cap names where exchange classification is more specific than generic feed sectors.
    MAYBANK: "FINANCIAL SERVICES",
    PBBANK: "FINANCIAL SERVICES",
    CIMB: "FINANCIAL SERVICES",
    HLBANK: "FINANCIAL SERVICES",
    RHBBANK: "FINANCIAL SERVICES",
    AMBANK: "FINANCIAL SERVICES",
    BURSA: "FINANCIAL SERVICES",
    IHH: "HEALTH CARE",
    KPJ: "HEALTH CARE",
    SUNMED: "HEALTH CARE",
    TOPGLOV: "HEALTH CARE",
    HARTA: "HEALTH CARE",
    KOSSAN: "HEALTH CARE",
    SUPERMX: "HEALTH CARE",
    TM: "TELECOMMUNICATIONS & MEDIA",
    MAXIS: "TELECOMMUNICATIONS & MEDIA",
    AXIATA: "TELECOMMUNICATIONS & MEDIA",
    CDB: "TELECOMMUNICATIONS & MEDIA",
    TIMECOM: "TELECOMMUNICATIONS & MEDIA",
    ASTRO: "TELECOMMUNICATIONS & MEDIA",
    MEDIA: "TELECOMMUNICATIONS & MEDIA",
    TENAGA: "UTILITIES",
    YTLPOWR: "UTILITIES",
    PETGAS: "UTILITIES",
    GASMSIA: "UTILITIES",
    YTL: "UTILITIES",
    MISC: "TRANSPORTATION & LOGISTICS",
    WPRTS: "TRANSPORTATION & LOGISTICS",
    AIRPORT: "TRANSPORTATION & LOGISTICS",
    CAPITALA: "TRANSPORTATION & LOGISTICS",
    AAX: "TRANSPORTATION & LOGISTICS",
    POS: "TRANSPORTATION & LOGISTICS",
    GDEX: "TRANSPORTATION & LOGISTICS",
    SWIFT: "TRANSPORTATION & LOGISTICS",
    GAMUDA: "CONSTRUCTION",
    IJM: "CONSTRUCTION",
    SUNCON: "CONSTRUCTION",
    KERJAYA: "CONSTRUCTION",
    ECONBHD: "CONSTRUCTION",
    HSS: "CONSTRUCTION",
    HSL: "CONSTRUCTION",
    DIALOG: "ENERGY",
    YINSON: "ENERGY",
    ARMADA: "ENERGY",
    DAYANG: "ENERGY",
    VELESTO: "ENERGY",
    HIBISCS: "ENERGY",
    HENGYUAN: "ENERGY",
    PETRONM: "ENERGY",
    PCHEM: "INDUSTRIAL PRODUCTS & SERVICES",
    PMETAL: "INDUSTRIAL PRODUCTS & SERVICES",
    PRESS: "INDUSTRIAL PRODUCTS & SERVICES",
    MCEMENT: "INDUSTRIAL PRODUCTS & SERVICES",
    CMSB: "INDUSTRIAL PRODUCTS & SERVICES",
    HUMEIND: "INDUSTRIAL PRODUCTS & SERVICES",
    SDG: "PLANTATION",
    IOICORP: "PLANTATION",
    KLK: "PLANTATION",
    UTDPLT: "PLANTATION",
    JPG: "PLANTATION",
    TSH: "PLANTATION",
    TAANN: "PLANTATION",
    SIMEPROP: "PROPERTY",
    IOIPG: "PROPERTY",
    UEMS: "PROPERTY",
    SPSETIA: "PROPERTY",
    MAHSING: "PROPERTY",
    SUNWAY: "PROPERTY",
    PAVREIT: "REAL ESTATE INVESTMENT TRUSTS",
    SUNREIT: "REAL ESTATE INVESTMENT TRUSTS",
    IGBREIT: "REAL ESTATE INVESTMENT TRUSTS",
    KLCC: "REAL ESTATE INVESTMENT TRUSTS",
    KIPREIT: "REAL ESTATE INVESTMENT TRUSTS",
    AXREIT: "REAL ESTATE INVESTMENT TRUSTS",
    INARI: "TECHNOLOGY",
    MPI: "TECHNOLOGY",
    UNISEM: "TECHNOLOGY",
    OPPSTAR: "TECHNOLOGY",
    DNEX: "TECHNOLOGY",
    ZETRIX: "TECHNOLOGY",
    SNS: "TECHNOLOGY",
    AGMO: "TECHNOLOGY",
    GREATEC: "TECHNOLOGY",
    PENTA: "TECHNOLOGY",
    MI: "TECHNOLOGY",
    GENETEC: "TECHNOLOGY",
    NATGATE: "TECHNOLOGY",
  }),
);

const fallbackNewsItems = [
  {
    source: "The Star",
    title: "Late selling drags Bursa Malaysia lower as regional markets hit fresh highs",
    date: "2026-05-11",
    url: "https://www.thestar.com.my/business/business-news/2026/05/11/late-selling-drags-bursa-malaysia-lower-as-regional-markets-hit-fresh-highs",
    summary:
      "收盘前卖压令 FBM KLCI 转跌 2.75 点至 1,745.31；区域市场偏强，但本地银行、运输等权重股出现获利回吐。手套股与部分 AI/芯片题材仍维持活跃。",
    tags: ["收盘卖压", "手套股", "AI/芯片", "油价"],
  },
  {
    source: "Bernama",
    title: "Late Selling Pushes Bursa Malaysia Into Negative Territory At Close",
    date: "2026-05-11",
    url: "https://bernama.com/en/news.php?id=2555646",
    summary:
      "Bernama 报道指出，FBM KLCI 从上周五的 1,748.06 回落至 1,745.31，整体市场宽度仍小幅偏正面，涨股略多于跌股。",
    tags: ["市场宽度", "获利回吐", "权重股"],
  },
  {
    source: "BusinessToday",
    title: "Positive Start For Bursa As Investors Track Oil And Geopolitics",
    date: "2026-05-11",
    url: "https://www.businesstoday.com.my/2026/05/11/positive-start-for-bursa-as-investors-track-oil-and-geopolitics/",
    summary:
      "早盘曾因区域情绪、马币走稳和油价走势受到关注而开高；能源价格与地缘政治仍是盘中风险偏好变化的主轴。",
    tags: ["早盘开高", "马币", "地缘政治"],
  },
  {
    source: "BusinessToday",
    title: "Market Recap: Bursa Malaysia Extends Weekly Gains On Blue-Chip Rally",
    date: "2026-05-10",
    url: "https://www.businesstoday.com.my/2026/05/10/market-recap-bursa-malaysia-extends-weekly-gains-on-blue-chip-rally/",
    summary:
      "上周 FBM KLCI 连续第二周上涨，蓝筹买盘、区域风险偏好改善与 BNM 维持 OPR 不变为大市提供支撑。",
    tags: ["蓝筹", "BNM OPR", "周线反弹"],
  },
];

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pct(value, digits = 2) {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  const places = Math.abs(value) >= 100 ? 0 : digits;
  return `${sign}${value.toFixed(places)}%`;
}

function fmt(value, digits = 2) {
  if (!Number.isFinite(value)) return "n/a";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function compact(value) {
  if (!Number.isFinite(value)) return "n/a";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(value < 10 ? 3 : 2);
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return decodeHtml(String(value ?? "").replace(/<[^>]+>/g, " "));
}

function bursaSectorFor(stock) {
  const ticker = String(stock.ticker || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
  const manual = manualBursaSector.get(ticker);
  if (manual) return bursaSectorByKey.get(manual);

  const sector = String(stock.sector || "").toLowerCase();
  const industry = String(stock.industry || "").toLowerCase();
  const company = String(stock.company || "").toLowerCase();
  const text = `${ticker} ${sector} ${industry} ${company}`;

  if (industry.includes("real estate investment trusts") || /\breit\b/.test(text)) {
    return bursaSectorByKey.get("REAL ESTATE INVESTMENT TRUSTS");
  }
  if (industry.includes("real estate development") || industry.includes("homebuilding") || text.includes("property")) {
    return bursaSectorByKey.get("PROPERTY");
  }
  if (sector === "finance" || industry.includes("bank") || industry.includes("insurance") || industry.includes("finance")) {
    return bursaSectorByKey.get("FINANCIAL SERVICES");
  }
  if (sector.includes("health") || industry.includes("medical") || industry.includes("pharmaceutical") || industry.includes("hospital")) {
    return bursaSectorByKey.get("HEALTH CARE");
  }
  if (sector.includes("communications") || industry.includes("telecommunications") || industry.includes("data processing")) {
    return bursaSectorByKey.get("TELECOMMUNICATIONS & MEDIA");
  }
  if (sector.includes("utilities") || industry.includes("electric utilities") || industry.includes("gas distributors") || industry.includes("alternative power")) {
    return bursaSectorByKey.get("UTILITIES");
  }
  if (sector.includes("transportation") || industry.includes("shipping") || industry.includes("airlines") || industry.includes("couriers")) {
    return bursaSectorByKey.get("TRANSPORTATION & LOGISTICS");
  }
  if (sector.includes("energy") || industry.includes("oil") || industry.includes("gas") || industry.includes("drilling")) {
    return bursaSectorByKey.get("ENERGY");
  }
  if (industry.includes("engineering & construction")) {
    return bursaSectorByKey.get("CONSTRUCTION");
  }
  if (industry.includes("agricultural commodities") || industry.includes("forest products") || text.includes("plantation")) {
    return bursaSectorByKey.get("PLANTATION");
  }
  if (
    sector.includes("electronic technology") ||
    sector.includes("technology services") ||
    industry.includes("semiconductor") ||
    industry.includes("information technology") ||
    industry.includes("software") ||
    industry.includes("computer")
  ) {
    return bursaSectorByKey.get("TECHNOLOGY");
  }
  if (
    sector.includes("consumer") ||
    sector.includes("retail") ||
    industry.includes("food") ||
    industry.includes("restaurant") ||
    industry.includes("hotel") ||
    industry.includes("tobacco") ||
    industry.includes("beverage") ||
    industry.includes("apparel") ||
    industry.includes("automotive") ||
    industry.includes("motor vehicles")
  ) {
    return bursaSectorByKey.get("CONSUMER PRODUCTS & SERVICES");
  }

  return bursaSectorByKey.get("INDUSTRIAL PRODUCTS & SERVICES");
}

async function fetchJson(url, init, { retries = 0, timeoutMs = 12000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`${url} failed: ${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

async function fetchText(url, init, { retries = 0, timeoutMs = 12000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`${url} failed: ${response.status} ${response.statusText}`);
      }
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

function newsSummaryFromTitle(title, source) {
  const text = title.toLowerCase();
  if (/midday|morning session/.test(text)) {
    return "盘中新闻更新 FBM KLCI 与市场宽度，可用来判断当天资金是否继续追价或转向观望。";
  }
  if (/open|opens|opened/.test(text) && /higher|gains|up|advances/.test(text)) {
    return "早盘报道显示马股开盘偏强，通常与区域市场、权重股买盘或科技/公用事业题材有关。";
  }
  if (/open|opens|opened/.test(text) && /lower|mixed|slips|weaker/.test(text)) {
    return "早盘报道显示马股开盘偏谨慎，需留意权重股卖压和盘中成交是否改善。";
  }
  if (/close|ends|snaps|negative|lower|profit-taking|weigh/.test(text)) {
    return "收盘报道显示市场面对获利回吐或权重股压力，适合配合上方涨跌家数与成交额观察情绪。";
  }
  if (/higher|rebounds|bargain|rally|gains/.test(text)) {
    return "新闻显示逢低买盘或区域风险偏好改善，对当天市场情绪形成支撑。";
  }
  if (/futures|range-bound|consolidate|cautious/.test(text)) {
    return "期货或展望新闻显示短线走势仍偏区间/谨慎，可作为隔日开盘风险参考。";
  }
  return `${source} 最新 Bursa / FBM KLCI 相关新闻，作为当天大市情绪参考。`;
}

function newsTagsFromTitle(title) {
  const text = title.toLowerCase();
  const tags = [];
  if (/open|opens|opened/.test(text)) tags.push("开盘");
  if (/midday|morning session/.test(text)) tags.push("午盘");
  if (/close|ends|snaps/.test(text)) tags.push("收盘");
  if (/higher|rebounds|gains|up|rally/.test(text)) tags.push("偏强");
  if (/lower|negative|slips|weaker|profit-taking|weigh/.test(text)) tags.push("偏弱");
  if (/futures/.test(text)) tags.push("期货");
  if (/klci/.test(text)) tags.push("KLCI");
  if (/bursa/.test(text)) tags.push("Bursa");
  return tags.slice(0, 4).length ? tags.slice(0, 4) : ["大市"];
}

function rssDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? malaysiaDate(new Date()) : malaysiaDate(date);
}

function parseGoogleNewsRss(xml, feedName = "Google News") {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  const seen = new Set();
  return items
    .map((match) => {
      const item = match[1];
      const title = decodeHtml((item.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
      const link = decodeHtml((item.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
      const pubDate = decodeHtml((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]);
      const source = stripHtml((item.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1]) || "Google News";
      const key = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!title || !link || seen.has(key)) return null;
      if (/^(index|home|newsroom|media releases?)\s*(?:-|$)/i.test(title)) return null;
      if (!/\b(bursa|fbm|klci)\b/i.test(title)) return null;
      seen.add(key);
      return {
        source,
        title,
        date: rssDate(pubDate),
        url: link,
        summary: newsSummaryFromTitle(title, source),
        tags: newsTagsFromTitle(title),
        feedName,
        _timestamp: new Date(pubDate).getTime() || 0,
      };
    })
    .filter(Boolean);
}

async function fetchLatestNews() {
  const merged = [];
  try {
    for (const feed of newsRssUrls) {
      try {
        const xml = await fetchText(
          feed.url,
          {
            headers: {
              "user-agent": "Mozilla/5.0",
              accept: "application/rss+xml,text/xml,*/*",
            },
          },
          { retries: 1, timeoutMs: 12000 },
        );
        merged.push(...parseGoogleNewsRss(xml, feed.name));
      } catch (error) {
        console.warn(`News RSS fetch failed (${feed.name}): ${error.message}`);
      }
    }
    const seen = new Set();
    const items = merged
      .filter((item) => {
        const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b._timestamp - a._timestamp)
      .slice(0, 4)
      .map(({ _timestamp, feedName, ...item }) => item);
    return items.length ? items : fallbackNewsItems;
  } catch (error) {
    console.warn(`News RSS fetch failed: ${error.message}`);
    return fallbackNewsItems;
  }
}

async function fetchStocks() {
  const payload = await fetchJson(screenerUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      symbols: { query: { types: ["stock"] }, tickers: [] },
      columns: tvColumns,
      sort: { sortBy: "Value.Traded", sortOrder: "desc" },
      range: [0, 1500],
    }),
  });

  return payload.data
    .map((row) => {
      const d = row.d;
      const close = num(d[4]);
      const changePct = num(d[5]);
      const prevClose = close !== null && changePct !== null ? close / (1 + changePct / 100) : null;
      const absChange = close !== null && prevClose !== null ? close - prevClose : null;
      const stock = {
        symbol: row.s,
        ticker: d[0],
        company: d[1],
        sector: d[2] || "Unclassified",
        sectorZh: sectorZh.get(d[2]) || d[2] || "未分类",
        industry: d[3] || "Unclassified",
        close,
        changePct,
        prevClose,
        absChange,
        volume: num(d[6]) ?? 0,
        turnover: num(d[7]) ?? ((num(d[6]) ?? 0) * (close ?? 0)),
        marketCap: num(d[8]) ?? 0,
        pe: num(d[9]),
        eps: num(d[10]),
        divYield: num(d[11]) ?? 0,
        recommend: num(d[12]) ?? 0,
        rsi: num(d[13]),
        perfW: num(d[14]) ?? 0,
        perf1M: num(d[15]) ?? 0,
        perf3M: num(d[16]) ?? 0,
        perf6M: num(d[17]) ?? 0,
        perfYTD: num(d[18]) ?? 0,
        perfY: num(d[19]) ?? 0,
      };
      const bursaSector = bursaSectorFor(stock);
      return {
        ...stock,
        bursaSector: bursaSector.label,
        bursaSectorKey: bursaSector.key,
        bursaSectorZh: bursaSector.zh,
        bursaSectorOrder: bursaSector.order,
      };
    })
    .filter((stock) => stock.ticker && stock.close !== null && stock.volume > 0);
}

async function fetchKlciHistory() {
  const headers = {
    "user-agent": "Mozilla/5.0",
    accept: "application/json,text/plain,*/*",
  };
  let lastError;

  for (const url of yahooKlciUrls) {
    try {
      const payload = await fetchJson(
        url,
        { headers },
        { retries: 1, timeoutMs: 12000 },
      );
      const result = payload?.chart?.result?.[0];
      if (!result) {
        throw new Error(`Yahoo KLCI chart payload missing result`);
      }
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Yahoo KLCI fetch failed across all hosts: ${lastError?.message ?? "unknown error"}`);
}

function malaysiaDate(date) {
  return date.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

async function loadMiddaySnapshot(now) {
  try {
    const snapshot = JSON.parse(await fs.readFile(middaySnapshotPath, "utf8"));
    return snapshot.date === malaysiaDate(now) ? snapshot : null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function seededNoise(seed, i) {
  const x = Math.sin(seed * 997 + i * 37.17) * 10000;
  return x - Math.floor(x);
}

function makeSpark(finalChange, breadth, seed) {
  const points = [];
  const steps = 18;
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const wave = Math.sin(t * Math.PI * 1.6 + seed) * Math.min(1.8, Math.max(0.35, Math.abs(finalChange) * 0.38));
    const noise = (seededNoise(seed, i) - 0.5) * Math.min(1.2, Math.max(0.25, breadth * 0.12));
    points.push(finalChange * t + wave + noise);
  }
  points[0] = 0;
  points[points.length - 1] = finalChange;
  return points.map((point) => Math.round(point * 100) / 100);
}

function groupSectors(stocks) {
  const groups = new Map();
  for (const stock of stocks) {
    if (!groups.has(stock.bursaSectorKey)) groups.set(stock.bursaSectorKey, []);
    groups.get(stock.bursaSectorKey).push(stock);
  }

  return [...groups.entries()]
    .map(([sectorKey, list], index) => {
      const meta = bursaSectorByKey.get(sectorKey) || bursaSectorByKey.get("INDUSTRIAL PRODUCTS & SERVICES");
      const turnover = list.reduce((sum, stock) => sum + stock.turnover, 0);
      const volume = list.reduce((sum, stock) => sum + stock.volume, 0);
      const marketCap = list.reduce((sum, stock) => sum + stock.marketCap, 0);
      const weightBase = marketCap > 0 ? marketCap : list.length;
      const weightedChange =
        marketCap > 0
          ? list.reduce((sum, stock) => sum + stock.changePct * stock.marketCap, 0) / weightBase
          : list.reduce((sum, stock) => sum + stock.changePct, 0) / Math.max(1, list.length);
      const avgChange = list.reduce((sum, stock) => sum + stock.changePct, 0) / Math.max(1, list.length);
      const advancers = list.filter((stock) => stock.changePct > 0).length;
      const decliners = list.filter((stock) => stock.changePct < 0).length;
      const breadth = list.length ? ((advancers - decliners) / list.length) * 100 : 0;
      const volatility =
        list.reduce((sum, stock) => sum + Math.abs(stock.changePct - avgChange), 0) / Math.max(1, list.length);
      const ranked = [...list].sort((a, b) => stockScore(b) - stockScore(a));
      return {
        sector: meta.label,
        sectorKey: meta.key,
        sectorZh: meta.zh,
        order: meta.order,
        count: list.length,
        turnover,
        volume,
        marketCap,
        weightedChange,
        avgChange,
        advancers,
        decliners,
        breadth,
        spark: makeSpark(weightedChange, volatility, index + meta.label.length),
        topStocks: ranked.slice(0, 5),
        activeStocks: [...list].sort((a, b) => b.turnover - a.turnover).slice(0, 8),
      };
    })
    .sort(sectorStrengthSort);
}

function stockScore(stock) {
  const liquidity = Math.log10(Math.max(1, stock.turnover)) * 2.3;
  const cap = Math.log10(Math.max(1, stock.marketCap)) * 1.2;
  const rsiPenalty = stock.rsi && (stock.rsi > 76 || stock.rsi < 28) ? -6 : 0;
  const pePenalty = stock.pe && stock.pe > 0 && stock.pe < 45 ? 2 : -1;
  return (
    stock.recommend * 18 +
    stock.changePct * 0.6 +
    stock.perfW * 0.18 +
    stock.perf1M * 0.12 +
    stock.perfYTD * 0.05 +
    Math.min(8, stock.divYield * 0.7) +
    liquidity +
    cap +
    pePenalty +
    rsiPenalty
  );
}

function sectorStrengthSort(a, b) {
  return b.weightedChange - a.weightedChange || b.turnover - a.turnover || a.order - b.order;
}

function buildTables(stocks) {
  const withAbs = stocks.filter((stock) => Number.isFinite(stock.absChange));
  return {
    topVolume: [...stocks].sort((a, b) => b.volume - a.volume).slice(0, 10),
    topTurnover: [...stocks].sort((a, b) => b.turnover - a.turnover).slice(0, 10),
    topGainers: withAbs.filter((stock) => stock.absChange > 0).sort((a, b) => b.absChange - a.absChange).slice(0, 10),
    topLosers: withAbs.filter((stock) => stock.absChange < 0).sort((a, b) => a.absChange - b.absChange).slice(0, 10),
  };
}

function movingAverage(values, size) {
  if (values.length < size) return null;
  return values.slice(-size).reduce((sum, value) => sum + value, 0) / size;
}

function klciAnalysis(prices, latestSummary, sectors) {
  const ordered = [...prices].sort((a, b) => new Date(a.date) - new Date(b.date));
  const closes = ordered.map((p) => p.close);
  const latest = ordered.at(-1);
  const first = ordered[0];
  const high = Math.max(...ordered.map((p) => p.high));
  const low = Math.min(...ordered.map((p) => p.low));
  const ma5 = movingAverage(closes, 5);
  const ma20 = movingAverage(closes, 20);
  const monthChange = first ? ((latest.close - first.close) / first.close) * 100 : 0;
  const aboveMa20 = ma20 !== null && latest.close > ma20;
  const topSector = sectors[0];
  const breadthText =
    latestSummary.gainers > latestSummary.losers
      ? `市场宽度偏正面，涨股 ${latestSummary.gainers} 多于跌股 ${latestSummary.losers}`
      : `市场宽度偏谨慎，跌股 ${latestSummary.losers} 多于涨股 ${latestSummary.gainers}`;

  return [
    `FBM KLCI 最新收在 ${fmt(latest.close, 2)}，日变动 ${fmt(latest.change, 2)} 点（${pct(latest.pctChange * 100)}），近 30 个交易日累计 ${pct(monthChange)}。`,
    `区间高低为 ${fmt(high, 2)} / ${fmt(low, 2)}；当前${aboveMa20 ? "站上" : "低于"} 20 日均线 ${ma20 ? fmt(ma20, 2) : "n/a"}，短线趋势仍需观察量能能否配合。`,
    `${breadthText}；成交活跃集中在 ${topSector?.sectorZh || "高成交额板块"}，显示资金在主题股与权重股之间轮动。`,
    "新闻面显示：区域 AI 风险偏好提供支撑，但油价、地缘政治与权重股获利回吐压抑尾盘，整体情绪属于“指数偏弱、题材仍活跃”。",
  ];
}

function normalizeYahooKlci(raw) {
  const timestamps = raw.timestamp ?? [];
  const quote = raw.indicators?.quote?.[0] ?? {};
  let prices = timestamps
    .map((ts, index) => {
      const open = num(quote.open?.[index]);
      const high = num(quote.high?.[index]);
      const low = num(quote.low?.[index]);
      const close = num(quote.close?.[index]);
      if ([open, high, low, close].some((value) => value === null)) return null;
      const prevClose = index > 0 ? num(quote.close?.[index - 1]) : null;
      const change = prevClose !== null ? close - prevClose : 0;
      const pctChange = prevClose ? change / prevClose : 0;
      return {
        date: malaysiaDate(new Date(ts * 1000)),
        open,
        high,
        low,
        close,
        change,
        pctChange,
        volume: Math.max(0, num(quote.volume?.[index]) ?? 0),
      };
    })
    .filter(Boolean)
    .slice(-30)
    .reverse();

  if (!prices.length) {
    throw new Error("Yahoo KLCI chart returned no valid daily candles");
  }

  const meta = raw.meta ?? {};
  const metaPrice = num(meta.regularMarketPrice);
  const metaTime = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : null;
  const metaDate = metaTime ? malaysiaDate(metaTime) : null;
  if (metaDate && metaPrice !== null) {
    const latest = prices[0];
    const dayHigh = num(meta.regularMarketDayHigh) ?? metaPrice;
    const dayLow = num(meta.regularMarketDayLow) ?? metaPrice;
    if (metaDate > latest.date) {
      const change = metaPrice - latest.close;
      prices = [
        {
          date: metaDate,
          open: latest.close,
          high: Math.max(dayHigh, metaPrice, latest.close),
          low: Math.min(dayLow, metaPrice, latest.close),
          close: metaPrice,
          change,
          pctChange: latest.close ? change / latest.close : 0,
          volume: 0,
        },
        ...prices,
      ].slice(0, 30);
    } else if (metaDate === latest.date && Math.abs(metaPrice - latest.close) > 0.001) {
      const previous = prices[1] ?? latest;
      const change = metaPrice - previous.close;
      prices[0] = {
        ...latest,
        high: Math.max(latest.high, dayHigh, metaPrice),
        low: Math.min(latest.low, dayLow, metaPrice),
        close: metaPrice,
        change,
        pctChange: previous.close ? change / previous.close : 0,
      };
    }
  }

  return {
    klciPrices: prices,
    latestMeta: {
      regularMarketTime: meta.regularMarketTime ?? null,
      regularMarketPrice: num(meta.regularMarketPrice),
      regularMarketDayHigh: num(meta.regularMarketDayHigh),
      regularMarketDayLow: num(meta.regularMarketDayLow),
      dataGranularity: meta.dataGranularity ?? "1d",
      exchangeTimezoneName: meta.exchangeTimezoneName ?? "Asia/Kuala_Lumpur",
    },
  };
}

function buildMarketSummary(stocks, klciPrices) {
  const latestPrice = klciPrices[0];
  const gainers = stocks.filter((stock) => stock.changePct > 0).length;
  const losers = stocks.filter((stock) => stock.changePct < 0).length;
  const unchanged = stocks.filter((stock) => stock.changePct === 0).length;
  const total = stocks.length;
  const bullRatio = gainers + losers > 0 ? gainers / (gainers + losers) : 0.5;

  return klciPrices.map((price, index) => ({
    date: price.date,
    gainers: index === 0 ? gainers : 0,
    losers: index === 0 ? losers : 0,
    unchanged: index === 0 ? unchanged : 0,
    untraded: 0,
    total: index === 0 ? total : 0,
    bullRatio: index === 0 ? bullRatio : 0.5,
    indexClose: price.close,
    indexChange: price.change,
    indexPctChange: price.pctChange,
    source: index === 0 ? "TradingView breadth" : "placeholder",
    breadthAvailable: index === 0,
    volumeAvailable: price.volume > 0,
    isDelayed:
      index === 0 && latestPrice
        ? price.date !== latestPrice.date
        : false,
  }));
}

function buildIntradayCandles(day) {
  const times = ["8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm"];
  const range = Math.max(0.01, day.high - day.low);
  const anchors = [
    day.open,
    day.open - range * 0.18,
    day.open - range * 0.34,
    day.open - range * 0.28,
    day.open - range * 0.48,
    day.open - range * 0.42,
    day.open - range * 0.62,
    day.low,
    day.low + range * 0.12,
    day.close,
  ].map((value) => Math.min(day.high, Math.max(day.low, value)));

  anchors[0] = day.open;
  anchors[7] = day.low;
  anchors[9] = day.close;

  return times.map((time, index) => {
    const open = index === 0 ? day.open : anchors[index - 1];
    const close = anchors[index];
    const wiggle = range * (0.03 + (index % 3) * 0.015);
    const high = index === 0 ? day.high : Math.min(day.high, Math.max(open, close) + wiggle);
    const low = index === 7 ? day.low : Math.max(day.low, Math.min(open, close) - wiggle);
    return { time, open, high, low, close };
  });
}

function tableRows(rows, mode = "default") {
  return rows
    .map((stock) => {
      const changeClass = stock.changePct > 0 ? "up" : stock.changePct < 0 ? "down" : "flat";
      const fourth =
        mode === "turnover"
          ? `RM${compact(stock.turnover)}`
          : mode === "change"
            ? fmt(stock.absChange, 3)
            : compact(stock.volume);
      return `<tr>
        <td><b>${esc(stock.ticker)}</b><span>${esc(stock.company)}</span></td>
        <td>${fmt(stock.close, stock.close < 1 ? 3 : 2)}</td>
        <td class="${changeClass}">${pct(stock.changePct)}</td>
        <td>${fourth}</td>
      </tr>`;
    })
    .join("");
}

function recommendationRows(sectors) {
  return [...sectors]
    .filter((sector) => sector.topStocks.length)
    .sort(sectorStrengthSort)
    .map(
      (sector) => `<div class="recommend-block">
        <div class="recommend-head">
          <div>
            <b>${esc(sector.sectorKey)}</b>
            <span>${esc(sector.sectorZh)} · ${sector.count} counters</span>
          </div>
          <em class="${sector.weightedChange >= 0 ? "up" : "down"}">${pct(sector.weightedChange)}</em>
        </div>
        <table>
          <thead><tr><th>股票</th><th>股价</th><th>涨跌</th><th>评分</th></tr></thead>
          <tbody>
          ${sector.topStocks
            .map((stock) => {
              const score = stockScore(stock);
              return `<tr>
                <td><b>${esc(stock.ticker)}</b><span>${esc(stock.company)}</span></td>
                <td>${fmt(stock.close, stock.close < 1 ? 3 : 2)}</td>
                <td class="${stock.changePct >= 0 ? "up" : "down"}">${pct(stock.changePct)}</td>
                <td>${fmt(score, 1)}</td>
              </tr>`;
            })
            .join("")}
          </tbody>
        </table>
      </div>`,
    )
    .join("");
}

function heatColor(changePct) {
  if (!Number.isFinite(changePct) || Math.abs(changePct) < 0.05) return "#3f4959";
  const intensity = Math.min(1, Math.abs(changePct) / 8);
  const lightness = 28 + intensity * 18;
  return changePct > 0 ? `hsl(145 72% ${lightness}%)` : `hsl(356 68% ${lightness}%)`;
}

function makeHeatmap(sectors) {
  return [...sectors]
    .filter((sector) => sector.activeStocks.length)
    .sort(sectorStrengthSort)
    .map((sector) => {
      const active = sector.activeStocks.slice(0, 10);
      const sectorTone = sector.weightedChange >= 0 ? "up" : "down";
      const tiles = active
        .map((stock) => {
          const size = Math.max(30, Math.min(68, 22 + Math.log10(Math.max(stock.turnover, 1)) * 3.2));
          const tone = heatColor(stock.changePct);
          return `<div class="heat-tile" style="flex-basis:${size}%;background:${tone};" title="${esc(stock.company)} · ${esc(sector.sector)}">
            <b>${esc(stock.ticker)}</b><span>${pct(stock.changePct)}</span>
          </div>`;
        })
        .join("");
      return `<section class="heat-sector">
        <header><b>${esc(sector.sectorKey)}</b><span class="${sectorTone}">${pct(sector.weightedChange)}</span></header>
        <div class="heat-sub">${esc(sector.sectorZh)} · ${sector.count} counters · RM ${compact(sector.turnover)}</div>
        <div class="heat-sector-body">${tiles}</div>
      </section>`;
    })
    .join("");
}

function sectorCards(sectors) {
  return [...sectors]
    .sort(sectorStrengthSort)
    .slice(0, 5)
    .map(
      (sector, index) => `<article class="sector-card">
        <div class="sector-title">
          <div><b>${index + 1}. ${esc(sector.sectorKey)}</b><span>${esc(sector.sectorZh)} · ${sector.count} counters</span></div>
          <strong class="${sector.weightedChange >= 0 ? "up" : "down"}"><small>加权涨跌</small>${pct(sector.weightedChange)}</strong>
        </div>
        <canvas class="spark" data-series="${esc(JSON.stringify(sector.spark))}"></canvas>
        <div class="sector-meta">
          <span>Turnover RM ${compact(sector.turnover)}</span>
          <span>${sector.advancers} Adv / ${sector.decliners} Dec</span>
        </div>
      </article>`,
    )
    .join("");
}

function volumeAnomalyNote(prices) {
  const volumes = prices.map((price) => price.volume).filter((value) => Number.isFinite(value) && value > 0);
  const sorted = [...volumes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const missingDays = prices
    .filter((price) => !Number.isFinite(price.volume) || price.volume <= 0)
    .slice(0, 3)
    .map((price) => {
      const weekday = new Date(`${price.date}T00:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      });
      return `${price.date} ${weekday} source missing`;
    });
  const lowDays = prices
    .filter((price) => median > 0 && Number.isFinite(price.volume) && price.volume > 0 && price.volume < median * 0.25)
    .slice(0, 3)
    .map((price) => {
      const weekday = new Date(`${price.date}T00:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      });
      return `${price.date} ${weekday} ${compact(price.volume)}`;
    });

  if (!lowDays.length && !missingDays.length) {
    return "Volume 图为 Yahoo Finance `^KLSE` 最近 30 个交易日量能；周六、周日不包含在图内。若最新一日显示 0，通常表示指数成交量字段未更新或该源未提供。";
  }

  const noteParts = ["Volume 图为 Yahoo Finance `^KLSE` 最近 30 个交易日量能，周六、周日不包含在图内。"];
  if (lowDays.length && !missingDays.length) noteParts.push(`低量日期：${lowDays.join("；")}。`);
  if (missingDays.length) noteParts.push(`缺失日期：${missingDays.join("；")}。`);
  noteParts.push("若最新一日显示缺失或 0，通常表示指数成交量字段未更新或该源未提供。");
  return noteParts.join(" ");
}

function newsCards(items = fallbackNewsItems) {
  return items
    .map(
      (item) => `<article class="news-card">
        <div><span>${esc(item.source)}</span><time>${esc(item.date)}</time></div>
        <h3><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a></h3>
        <p>${esc(item.summary)}</p>
        <footer>${item.tags.map((tag) => `<b>${esc(tag)}</b>`).join("")}</footer>
      </article>`,
    )
    .join("");
}

function compactNewsList(items = fallbackNewsItems) {
  return newsListMarkup(items);
}

function newsListMarkup(items) {
  return items
    .map((item) => newsLineMarkup(item))
    .join("");
}

function newsLineMarkup(item) {
  return `<article class="news-line">
        <div><b>${esc(item.source)}</b><time>${esc(item.date)}</time></div>
        <h3><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a></h3>
        <p>${esc(item.summary)}</p>
      </article>`;
}

function compactNewsListWithMidday(middaySnapshot, items = fallbackNewsItems) {
  const middayNews = middaySnapshot
    ? [
        {
          source: middaySnapshot.source,
          title: middaySnapshot.title,
          date: `${middaySnapshot.date} ${middaySnapshot.time}`,
          url: middaySnapshot.sourceUrl,
          summary: middaySnapshot.summary,
        },
      ]
    : [];
  return [...middayNews, ...items]
    .map((item) => newsLineMarkup(item))
    .join("");
}

function serializeData(data) {
  return JSON.stringify(data).replaceAll("</script", "<\\/script");
}

function malaysiaDateTimeLabel(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${parts.timeZoneName || "GMT+8"}`;
}

function buildHtml(model) {
  const latest = model.klciPrices[0];
  const latestSummary = model.marketSummary[0];
  const prev30 = model.klciPrices.at(-1);
  const klci30 = prev30 ? ((latest.close - prev30.close) / prev30.close) * 100 : 0;
  const advPct = latestSummary.total ? (latestSummary.gainers / latestSummary.total) * 100 : 0;
  const decPct = latestSummary.total ? (latestSummary.losers / latestSummary.total) * 100 : 0;
  const breadthPct = latestSummary.bullRatio * 100;
  const breadthHistory = [...model.marketSummary].reverse().filter((s) => s.total > 0).map((s) => s.bullRatio * 100);
  const breadthSubtitle =
    breadthHistory.length > 1 ? "TradingView G/(G+L) breadth" : "TradingView latest breadth";
  const latestVolumeLabel = latestSummary.volumeAvailable ? compact(latest.volume) : "n/a";
  const volumeSubtitle = latestSummary.volumeAvailable ? "30 trading days" : "30 trading days · latest missing";
  const breadthState =
    latestSummary.gainers > latestSummary.losers ? "偏多" : latestSummary.gainers < latestSummary.losers ? "偏空" : "中性";
  const sentimentBody =
    breadthHistory.length > 1
      ? `<canvas class="klci-chart" id="breadthChart"></canvas>`
      : `<div class="sentiment-fallback">
          <div class="sentiment-meter">
            <div class="sentiment-meter-fill" style="width:${breadthPct.toFixed(1)}%"></div>
          </div>
          <div class="sentiment-facts">
            <div><small>上涨</small><b class="up">${latestSummary.gainers}</b></div>
            <div><small>下跌</small><b class="down">${latestSummary.losers}</b></div>
            <div><small>状态</small><b class="${latestSummary.gainers >= latestSummary.losers ? "up" : "down"}">${breadthState}</b></div>
          </div>
          <p>目前只有最新 breadth 快照，没有足够历史点可画趋势。</p>
        </div>`;
  const midday = model.middaySnapshot;
  const headlineChange = midday ? midday.change : latest.change;
  const headlineClose = midday ? midday.close : latest.close;
  const headlinePct = midday ? midday.pctChange : latest.pctChange * 100;
  const headlineTime = midday ? `${midday.time} 午盘` : "Today";
  const headlineDirection = headlineChange >= 0 ? "走高" : "回落";
  const middayNote = midday
    ? `<div class="data-note"><b>午盘快照：</b>${esc(midday.summary)} 数据源：${esc(midday.source)}。</div>`
    : "";
  const updateTitle = `页面生成：${model.generatedLabel}；主要行情日：${latest.date}`;
  const updateBadge = `<small class="section-time" title="${esc(updateTitle)}">更新：${esc(model.generatedShortLabel)}</small>`;
  const updateInline = `<span class="inline-update" title="${esc(updateTitle)}">更新：${esc(model.generatedShortLabel)}</span>`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Malaysia Stock Dashboard</title>
  <style>
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
    }
    .nav { display: flex; gap: 19px; align-items: center; font-weight: 700; white-space: nowrap; }
    .nav a, .nav b { color: #fff; text-decoration: none; }
    .nav a:hover { color: var(--blue); text-decoration: none; }
    .nav .active { color: var(--blue); }
    .toolbar { display: flex; gap: 14px; align-items: center; font-size: 12px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 999px; padding: 4px 9px; color: var(--muted); background: var(--panel2); }
    main { padding: 16px 32px 28px; max-width: 1500px; margin: 0 auto; }
    .headline {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      min-height: 38px; padding: 0 10px;
      background: var(--panel2); border: 1px solid var(--line); border-radius: 5px;
      font-size: 14px;
    }
    .headline b { color: #fff; }
    .export-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      padding: 8px 10px;
      background: var(--panel2);
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    .export-toolbar button {
      appearance: none;
      border: 1px solid #536176;
      background: #2a3343;
      color: #fff;
      border-radius: 5px;
      padding: 7px 10px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .export-toolbar button:hover { border-color: var(--blue); color: var(--blue); }
    .export-toolbar button:disabled { cursor: wait; opacity: .68; }
    .export-status { color: var(--muted); font-size: 11px; margin-left: 4px; }
    .grid4 { display: grid; grid-template-columns: repeat(4, minmax(250px, 1fr)); gap: 16px; margin-top: 16px; }
    .market-card, .panel, .ticker-table, .sector-card, .news-card, .recommend-block {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 6px;
      box-shadow: 0 10px 22px rgba(0,0,0,.16);
    }
    .market-card { height: 185px; padding: 9px 10px 7px; position: relative; }
    .market-title { display: flex; align-items: baseline; justify-content: space-between; padding: 0 2px 4px; }
    .market-title h2 { margin: 0; color: #abb5c8; font-size: 18px; }
    .market-title span { color: var(--muted); font-size: 11px; }
    .market-title strong { font-size: 13px; }
    .section-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin: 0 0 9px; }
    .section-title h2 { margin: 0; }
    .section-time { display: block; color: var(--muted); font-size: 10px; font-weight: 600; line-height: 1.25; margin-top: 2px; white-space: nowrap; }
    .inline-update { color: var(--muted); font-size: 9px; font-weight: 600; white-space: nowrap; }
    canvas { width: 100%; display: block; }
    .klci-chart { height: 138px; }
    .sentiment-fallback {
      height: 138px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 12px;
      padding: 10px 6px 4px;
    }
    .sentiment-meter {
      height: 10px;
      border-radius: 999px;
      background: #111722;
      overflow: hidden;
      border: 1px solid #323b4c;
    }
    .sentiment-meter-fill {
      height: 100%;
      background: linear-gradient(90deg, #ff4d5d 0%, #ffd33d 50%, #00c76f 100%);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
    }
    .sentiment-facts {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .sentiment-facts div {
      border: 1px solid #384457;
      border-radius: 6px;
      background: #202734;
      padding: 8px;
    }
    .sentiment-facts small {
      display: block;
      color: var(--muted);
      font-size: 10px;
      margin-bottom: 4px;
    }
    .sentiment-facts b {
      display: block;
      color: #fff;
      font-size: 14px;
    }
    .sentiment-fallback p {
      margin: 0;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.35;
    }
    .breadth-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 54px; align-items: center; margin: 28px 26px 12px; }
    .breadth-card { border: 1px solid var(--line); background: var(--panel2); border-radius: 6px; padding: 10px 8px; min-height: 50px; }
    .bar { height: 6px; display: flex; overflow: hidden; border-radius: 99px; margin-top: 7px; background: #111722; }
    .bar i:first-child { background: var(--green); }
    .bar i:last-child { background: var(--red); }
    .breadth-card small { color: var(--muted); display: block; }
    .breadth-card b { display: flex; justify-content: space-between; gap: 10px; }
    .content-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(340px, .8fr); gap: 14px; margin-top: 10px; align-items: start; }
    .tables-grid { display: grid; grid-template-columns: repeat(2, minmax(235px, 1fr)); gap: 8px; min-width: 0; }
    .ticker-table { overflow: hidden; min-width: 0; }
    .table-head { display: flex; justify-content: space-between; gap: 10px; padding: 9px 10px 3px; color: var(--blue); font-weight: 700; }
    .table-head > span:last-child { text-align: right; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { color: #c4ccd9; text-align: right; font-weight: 600; padding: 4px 8px; border-bottom: 1px solid #323b4c; }
    th:first-child, td:first-child { text-align: left; }
    th, td { overflow: hidden; text-overflow: ellipsis; }
    th:first-child, td:first-child { width: 38%; }
    th:nth-child(2), td:nth-child(2) { width: 17%; }
    th:nth-child(3), td:nth-child(3) { width: 19%; }
    th:nth-child(4), td:nth-child(4) { width: 26%; }
    td { padding: 3px 7px; border-bottom: 1px solid rgba(68,80,99,.38); text-align: right; font-weight: 700; white-space: nowrap; font-size: 12px; }
    td span { display: block; color: var(--muted); font-size: 10px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; font-weight: 400; }
    .right-stack { display: grid; gap: 10px; }
    .panel { padding: 10px; }
    .panel h2, .panel h3 { margin: 0 0 9px; color: #c7d1e2; font-size: 14px; }
    .heatmap { display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 4px; min-height: 265px; align-content: start; }
    .heat-sector { min-height: 116px; display: flex; flex-direction: column; border: 1px solid rgba(0,0,0,.45); background: #19212d; overflow: hidden; }
    .heat-sector header { display: flex; justify-content: space-between; gap: 8px; padding: 4px 6px 2px; background: rgba(255,255,255,.08); color: #fff; font-size: 10px; line-height: 1.1; text-transform: uppercase; }
    .heat-sector header b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .heat-sub { color: var(--muted); font-size: 9px; padding: 2px 6px 4px; white-space: normal; line-height: 1.2; }
    .heat-sector-body { display: flex; flex: 1; flex-wrap: wrap; gap: 2px; padding: 2px; align-content: stretch; }
    .heat-tile { min-height: 34px; flex-grow: 1; border: 1px solid rgba(0,0,0,.35); padding: 4px; display: flex; flex-direction: column; justify-content: center; text-align: center; color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,.25); }
    .heat-tile b { font-size: 12px; }
    .heat-tile span { font-size: 10px; }
    .heat-legend { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 9px; color: var(--muted); font-size: 10px; align-items: center; }
    .heat-legend span { display: inline-flex; align-items: center; gap: 5px; }
    .heat-legend i { width: 16px; height: 10px; border: 1px solid rgba(255,255,255,.18); border-radius: 2px; display: inline-block; }
    .market-context { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr); gap: 12px; margin-top: 12px; }
    .market-context ul { margin: 0; padding-left: 18px; color: #d8dfeb; line-height: 1.62; }
    .news-lines { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .news-line { border: 1px solid #384457; border-radius: 6px; padding: 9px; background: #202734; min-width: 0; }
    .news-line div { display: flex; justify-content: space-between; gap: 8px; color: var(--muted); font-size: 10px; }
    .news-line h3 { margin: 6px 0; font-size: 12px; line-height: 1.28; }
    .news-line p { margin: 0; color: #d2d9e6; line-height: 1.45; font-size: 11px; }
    .sector-grid { display: grid; grid-template-columns: repeat(5, minmax(155px, 1fr)); gap: 9px; margin-top: 10px; }
    .sector-card { padding: 9px; }
    .sector-title { display: flex; justify-content: space-between; gap: 8px; }
    .sector-title b { color: #fff; }
    .sector-title span { display: block; color: var(--muted); font-size: 10px; margin-top: 2px; }
    .sector-title strong { text-align: right; white-space: nowrap; }
    .sector-title strong small { display: block; color: var(--muted); font-size: 9px; font-weight: 600; margin-bottom: 2px; }
    .spark { height: 62px; margin: 5px 0; }
    .sector-meta { display: flex; justify-content: space-between; color: var(--muted); font-size: 10px; gap: 8px; }
    .recommendations { display: grid; grid-template-columns: repeat(5, minmax(230px, 1fr)); gap: 9px; margin-top: 10px; }
    .recommend-block { overflow: hidden; }
    .recommend-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px; border-bottom: 1px solid #323b4c; }
    .recommend-head b { color: #fff; }
    .recommend-head span { display: block; color: var(--muted); font-size: 10px; margin-top: 2px; }
    .recommend-block th, .recommend-block td { font-size: 10px; padding: 4px 5px; }
    .news-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
    .news-card { padding: 11px; min-height: 190px; }
    .news-card div { display: flex; justify-content: space-between; color: var(--muted); font-size: 11px; }
    .news-card h3 { margin: 8px 0; font-size: 14px; line-height: 1.25; }
    .news-card p { color: #d2d9e6; line-height: 1.55; margin: 0; }
    .news-card footer { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
    .news-card footer b { color: #061016; background: var(--yellow); padding: 2px 6px; border-radius: 3px; font-size: 10px; }
    .source-line { margin-top: 12px; color: var(--muted); font-size: 11px; line-height: 1.5; }
    .data-notes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
    .data-note { border: 1px solid #384457; border-radius: 6px; background: #202734; padding: 9px 10px; color: #cbd4e2; font-size: 11px; line-height: 1.45; }
    .data-note b { color: #fff; }
    .up { color: var(--green) !important; }
    .down { color: var(--red) !important; }
    .flat { color: var(--muted) !important; }
    .yellow { color: var(--yellow); }
    @media print {
      .export-toolbar { display: none; }
      body { background: #1f2430; }
    }
    @media (max-width: 1180px) {
      .grid4, .sector-grid, .recommendations, .news-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .breadth-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 14px 0; }
      .content-grid, .market-context, .news-lines, .data-notes { grid-template-columns: 1fr; }
    }
    @media (max-width: 680px) {
      main { padding: 10px; }
      .topbar { padding: 0 10px; overflow: auto; }
      .grid4, .sector-grid, .recommendations, .news-grid, .tables-grid { grid-template-columns: 1fr; }
      .nav { gap: 12px; }
      .toolbar { display: none; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="nav"><b class="active">Dashboard</b><a href="warrants_filtered.html">Warrants</a><b>News</b><b>Screener</b><b>Charts</b><b>Maps</b></div>
    <div class="toolbar"><span>${esc(model.generatedLabel)}</span><span class="pill">Theme</span><b>Malaysia</b></div>
  </div>
  <main>
    <section class="headline">
      <div><span class="yellow">✦</span> ${esc(headlineTime)}, ${esc(model.generatedTime)} <b>FBM KLCI ${headlineDirection} ${fmt(headlineChange, 2)} 点至 ${fmt(headlineClose, 2)}</b>，市场焦点：手套股、AI/芯片、油价与权重股获利回吐。</div>
      <span><b class="${headlineChange >= 0 ? "up" : "down"}">${pct(headlinePct)}</b></span>
    </section>

    <section class="export-toolbar" aria-label="Export tools">
      <button type="button" id="refreshPageBtn">更新页面</button>
      <button type="button" id="exportPngBtn">导出截图 PNG</button>
      <button type="button" id="exportReportBtn">导出报告 HTML</button>
      <span class="export-status" id="exportStatus">资料生成：${esc(model.generatedLabel)}。若当前是 file:/// 本地页面，按钮只会重载本机 HTML，不会触发 15 分钟自动抓数。</span>
    </section>

    <section class="grid4">
      <article class="market-card">
        <div class="market-title"><h2>FBM KLCI</h2><span>30D daily OHLC · ${esc(latest.date)} · 更新 ${esc(model.generatedShortLabel)}</span><strong class="${latest.change >= 0 ? "up" : "down"}">${fmt(latest.close, 2)} ${pct(latest.pctChange * 100)}</strong></div>
        <canvas class="klci-chart" id="klciChart"></canvas>
      </article>
      <article class="market-card">
        <div class="market-title"><h2>Daily Candle</h2><span>8am-5pm · 更新 ${esc(model.generatedShortLabel)}</span><strong>${fmt(latest.open, 2)} / ${fmt(latest.close, 2)}</strong></div>
        <canvas class="klci-chart" id="dailyCandleChart"></canvas>
      </article>
      <article class="market-card">
        <div class="market-title"><h2>Volume</h2><span>${volumeSubtitle} · 更新 ${esc(model.generatedShortLabel)}</span><strong>${latestVolumeLabel}</strong></div>
        <canvas class="klci-chart" id="volumeChart"></canvas>
      </article>
      <article class="market-card">
        <div class="market-title"><h2>Sentiment</h2><span>${breadthSubtitle} · 更新 ${esc(model.generatedShortLabel)}</span><strong class="${latestSummary.gainers >= latestSummary.losers ? "up" : "down"}">${breadthPct.toFixed(1)}% Bull</strong></div>
        ${sentimentBody}
      </article>
    </section>

    <section class="data-notes">
      ${middayNote}
      <div class="data-note"><b>自动更新说明：</b>线上 GitHub Pages 由 GitHub Actions 在交易时段约每 15 分钟重新生成一次；若当前地址是 file:/// 本地页面，浏览器只会读取本机这份 index.html，不会自动同步线上更新。页面各区块旁的“更新”时间就是这份 HTML 的生成时间。</div>
      <div class="data-note"><b>Volume 数据说明：</b>${esc(model.volumeNote)}</div>
      <div class="data-note"><b>Sector 1D 数据说明：</b>Sector 分组使用 Bursa Malaysia sector classification 大类名称；右上角数字是该板块成分股按市值加权后的当天涨跌幅。小线图是用成分股涨跌、成交额与市场宽度生成的 1D 快速走势视图，不是逐笔/逐分钟行情。</div>
    </section>

    <section class="market-context">
      <div class="panel">
        <div class="section-title"><h2>FBM KLCI 大市走势与交易解读</h2>${updateBadge}</div>
        <ul>${model.analysis.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
      </div>
      <div class="panel">
        <div class="section-title"><h2>大市新闻与情绪</h2>${updateBadge}</div>
        <div class="news-lines">${compactNewsListWithMidday(model.middaySnapshot, model.newsItems)}</div>
      </div>
    </section>

    <section class="breadth-row">
      <div class="breadth-card"><small>Advancing / Declining ${updateInline}</small><b><span class="up">${latestSummary.gainers}</span><span class="down">${latestSummary.losers}</span></b><div class="bar"><i style="width:${advPct}%"></i><i style="width:${decPct}%"></i></div></div>
      <div class="breadth-card"><small>30D KLCI ${updateInline}</small><b><span class="${klci30 >= 0 ? "up" : "down"}">${pct(klci30)}</span><span>${fmt(prev30?.close ?? latest.close, 2)}</span></b><div class="bar"><i style="width:${Math.max(0, 50 + klci30 * 4)}%"></i><i style="width:${Math.max(0, 50 - klci30 * 4)}%"></i></div></div>
      <div class="breadth-card"><small>Top Sector Turnover ${updateInline}</small><b><span>${esc(model.sectors[0]?.sectorZh)}</span><span>RM ${compact(model.sectors[0]?.turnover)}</span></b><div class="bar"><i style="width:64%"></i><i style="width:36%"></i></div></div>
      <div class="breadth-card"><small>Active Counters ${updateInline}</small><b><span>${model.stocks.length}</span><span>stocks</span></b><div class="bar"><i style="width:58%"></i><i style="width:42%"></i></div></div>
      <div class="breadth-card"><small>News Tone ${updateInline}</small><b><span class="yellow">Mixed</span><span>rotation</span></b><div class="bar"><i style="width:52%"></i><i style="width:48%"></i></div></div>
    </section>

    <section class="content-grid">
      <div class="tables-grid">
        <div class="ticker-table"><div class="table-head"><span>Top Volume ${updateBadge}</span><span>Daily</span></div><table><thead><tr><th>Ticker</th><th>Last</th><th>Change</th><th>Volume</th></tr></thead><tbody>${tableRows(model.tables.topVolume)}</tbody></table></div>
        <div class="ticker-table"><div class="table-head"><span>Top Turnover ${updateBadge}</span><span>Daily</span></div><table><thead><tr><th>Ticker</th><th>Last</th><th>Change</th><th>Value</th></tr></thead><tbody>${tableRows(model.tables.topTurnover, "turnover")}</tbody></table></div>
        <div class="ticker-table"><div class="table-head"><span>Top Gainers ${updateBadge}</span><span>Value</span></div><table><thead><tr><th>Ticker</th><th>Last</th><th>Change</th><th>RM</th></tr></thead><tbody>${tableRows(model.tables.topGainers, "change")}</tbody></table></div>
        <div class="ticker-table"><div class="table-head"><span>Top Losers ${updateBadge}</span><span>Value</span></div><table><thead><tr><th>Ticker</th><th>Last</th><th>Change</th><th>RM</th></tr></thead><tbody>${tableRows(model.tables.topLosers, "change")}</tbody></table></div>
      </div>
      <div class="right-stack">
        <div class="panel">
        <div class="section-title"><h2>Sector Heat Map</h2>${updateBadge}</div>
          <div class="heatmap">${makeHeatmap(model.sectors)}</div>
          <div class="heat-legend">
            <span><i style="background:hsl(145 72% 44%)"></i>上涨较强</span>
            <span><i style="background:hsl(145 72% 32%)"></i>小涨</span>
            <span><i style="background:#3f4959"></i>接近平盘</span>
            <span><i style="background:hsl(356 68% 32%)"></i>小跌</span>
            <span><i style="background:hsl(356 68% 44%)"></i>下跌较强</span>
          </div>
          <p class="source-line">Heat Map 按 Bursa Malaysia sector classification 分组，并按 sector 市值加权涨跌幅由强到弱排列；方块大小按成交额近似缩放，颜色显示个股当天涨跌。</p>
        </div>
      </div>
    </section>

    <section>
      <div class="panel">
        <div class="section-title"><h2>Top 5 Bursa Sector · 1D 走势</h2>${updateBadge}</div>
        <div class="sector-grid">${sectorCards(model.sectors)}</div>
        <p class="source-line">此处 Top 5 sector 按 Bursa Malaysia sector classification 大类归并后，以市值加权涨跌幅由强到弱排序；右上角百分比 = 市值加权 sector 当天涨跌幅；底部 Adv / Dec = 该板块上涨/下跌家数；Turnover = 板块成分股成交额合计。</p>
      </div>
    </section>

    <section>
      <div class="panel">
        <div class="section-title"><h2>各 Bursa Sector 量化候选股与股价</h2>${updateBadge}</div>
        <div class="recommendations">${recommendationRows(model.sectors)}</div>
        <p class="source-line">Sector 按市值加权涨跌幅由强到弱排列；每个 Bursa Malaysia sector classification 大类列出 5 个量化候选股。候选股按技术评分、流动性、成交额、近期表现、估值与股息等字段综合排序。这不是投资建议，买卖前仍需核对公司公告、财报和个人风险承受能力。</p>
      </div>
    </section>

    <p class="source-line">数据来源：Yahoo Finance ^KLSE chart API（FBM KLCI 日线/收盘）、TradingView Malaysia Screener（个股快照与市场宽度）、Bursa Malaysia sector classification / sectorial index categories。新闻优先参考 Bursa Malaysia 官方相关内容；若官方网页在自动环境触发 Cloudflare 验证，则通过 Google News RSS 聚合 Bursa / FBM KLCI，并纳入 Moomoo、星洲财经等辅助来源。</p>
  </main>

  <script>
    const DATA = ${serializeData({
      klciPrices: model.klciPrices,
      intradayCandles: model.intradayCandles,
      marketSummary: model.marketSummary,
      sectors: model.sectors.slice(0, 5).map((sector) => ({
        sector: sector.sector,
        sectorZh: sector.sectorZh,
        spark: sector.spark,
        weightedChange: sector.weightedChange,
      })),
      generatedLabel: model.generatedLabel,
      generatedShortLabel: model.generatedShortLabel,
    })};

    function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
    function drawLine(canvas, values, opts = {}) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      const w = rect.width, h = rect.height;
      ctx.clearRect(0, 0, w, h);
      const pad = { l: 24, r: 18, t: 10, b: 18 };
      const min = Math.min(...values), max = Math.max(...values);
      const span = max - min || 1;
      ctx.strokeStyle = "rgba(159,170,189,.16)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = pad.t + ((h - pad.t - pad.b) * i) / 4;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      }
      const lineColor = opts.color || (values.at(-1) >= values[0] ? css("--green") : css("--red"));
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      if (values.length === 1) {
        const x = pad.l + (w - pad.l - pad.r) / 2;
        const y = pad.t + (1 - (values[0] - min) / span) * (h - pad.t - pad.b);
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(w - pad.r, y);
        ctx.stroke();
        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        values.forEach((value, i) => {
          const x = pad.l + ((w - pad.l - pad.r) * i) / Math.max(1, values.length - 1);
          const y = pad.t + (1 - (value - min) / span) * (h - pad.t - pad.b);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.fillStyle = lineColor;
        const lastX = w - pad.r;
        const lastY = pad.t + (1 - (values.at(-1) - min) / span) * (h - pad.t - pad.b);
        ctx.beginPath();
        ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = css("--muted");
      ctx.font = "10px Arial";
      ctx.fillText(max.toFixed(opts.digits ?? 2), 2, pad.t + 5);
      ctx.fillText(min.toFixed(opts.digits ?? 2), 2, h - pad.b);
    }
    function drawBars(canvas, values) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      const w = rect.width, h = rect.height;
      const max = Math.max(...values) || 1;
      const barW = w / values.length;
      values.forEach((value, i) => {
        const bh = (value / max) * (h - 18);
        ctx.fillStyle = i % 2 ? "rgba(77,178,255,.55)" : "rgba(0,199,111,.62)";
        ctx.fillRect(i * barW + 1, h - bh - 8, Math.max(1, barW - 2), bh);
      });
    }
    function drawCandles(canvas, prices) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      const w = rect.width, h = rect.height;
      const pad = { l: 24, r: 18, t: 8, b: 18 };
      const min = Math.min(...prices.map(p => p.low));
      const max = Math.max(...prices.map(p => p.high));
      const span = max - min || 1;
      const xStep = (w - pad.l - pad.r) / prices.length;
      ctx.strokeStyle = "rgba(159,170,189,.14)";
      for (let i = 0; i < 5; i++) {
        const y = pad.t + ((h - pad.t - pad.b) * i) / 4;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      }
      prices.forEach((p, i) => {
        const x = pad.l + i * xStep + xStep / 2;
        const yHigh = pad.t + (1 - (p.high - min) / span) * (h - pad.t - pad.b);
        const yLow = pad.t + (1 - (p.low - min) / span) * (h - pad.t - pad.b);
        const yOpen = pad.t + (1 - (p.open - min) / span) * (h - pad.t - pad.b);
        const yClose = pad.t + (1 - (p.close - min) / span) * (h - pad.t - pad.b);
        ctx.strokeStyle = p.close >= p.open ? css("--green") : css("--red");
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(x, yHigh); ctx.lineTo(x, yLow); ctx.stroke();
        ctx.fillRect(x - Math.max(2, xStep * .28), Math.min(yOpen, yClose), Math.max(4, xStep * .56), Math.max(2, Math.abs(yClose - yOpen)));
      });
      ctx.fillStyle = css("--muted");
      ctx.font = "10px Arial";
      ctx.fillText(max.toFixed(0), 2, pad.t + 5);
      ctx.fillText(min.toFixed(0), 2, h - pad.b);
    }
    function timestampSlug() {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      return [
        d.getFullYear(),
        pad(d.getMonth() + 1),
        pad(d.getDate()),
        pad(d.getHours()),
        pad(d.getMinutes()),
      ].join("");
    }
    function setExportStatus(text) {
      const status = document.getElementById("exportStatus");
      if (status) status.textContent = text;
    }
    function refreshPage() {
      const button = document.getElementById("refreshPageBtn");
      if (button) {
        button.disabled = true;
        button.textContent = "更新中...";
      }
      if (window.location.protocol === "file:") {
        setExportStatus("当前打开的是本地 file:/// 页面；这个按钮只能重载本机 index.html，不能触发 GitHub Action 抓新资料。要看 15 分钟自动更新，请打开线上 GitHub Pages 页面，或先在本机运行 npm run update。");
      } else {
        setExportStatus("正在绕过浏览器缓存，重新载入最新已发布页面...");
      }
      const url = new URL(window.location.href);
      url.searchParams.set("refresh", Date.now().toString());
      window.location.replace(url.toString());
    }
    function markReportExported(type) {
      const payload = { type, exportedAt: new Date().toISOString(), page: location.href };
      try {
        window.localStorage?.setItem("malaysiaStockDashboardLastExport", JSON.stringify(payload));
      } catch (error) {
        // Some file:// or embedded browser contexts deny Web Storage access.
        console.warn("Export metadata persistence skipped:", error);
      }
    }
    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
    }
    function clonePageForExport() {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll(".export-toolbar, script").forEach((node) => node.remove());
      const originalCanvases = document.querySelectorAll("canvas");
      clone.querySelectorAll("canvas").forEach((canvas, index) => {
        const original = originalCanvases[index];
        const image = document.createElement("img");
        image.src = original.toDataURL("image/png");
        image.alt = original.id || "chart";
        image.className = canvas.className;
        image.style.width = original.clientWidth + "px";
        image.style.height = original.clientHeight + "px";
        image.style.display = "block";
        canvas.replaceWith(image);
      });
      return clone;
    }
    function standaloneReportHtml() {
      const cssText = Array.from(document.querySelectorAll("style")).map((style) => style.textContent).join("\\n");
      const clone = clonePageForExport();
      return "<!doctype html><html lang=\\"zh-CN\\"><head><meta charset=\\"utf-8\\"><meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1\\"><title>Malaysia Stock Dashboard Report</title><style>" +
        cssText +
        "</style></head><body>" +
        clone.innerHTML +
        "</body></html>";
    }
    function canvasToPngBlob(canvas) {
      return new Promise((resolve, reject) => {
        try {
          canvas.toBlob((blob) => {
            blob ? resolve(blob) : reject(new Error("Canvas did not produce a PNG blob."));
          }, "image/png", 0.95);
        } catch (error) {
          reject(error);
        }
      });
    }
    async function captureVisibleScreenPng() {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error("Screen capture is not available in this browser context.");
      }
      setExportStatus("请选择当前浏览器页面或窗口来生成 PNG 截图...");
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      try {
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        await new Promise((resolve) => {
          if (video.videoWidth) resolve();
          else video.onloadedmetadata = resolve;
        });
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        const blob = await canvasToPngBlob(canvas);
        downloadBlob(blob, "Malaysia-Stock-Dashboard-Screen-" + timestampSlug() + ".png");
        markReportExported("png-screen");
        setExportStatus("当前画面 PNG 已导出。");
      } finally {
        stream.getTracks().forEach((track) => track.stop());
      }
    }
    function screenshotSvgText() {
      const cssText = Array.from(document.querySelectorAll("style")).map((style) => style.textContent).join("\\n");
      const clone = clonePageForExport();
      const width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const wrapper = document.createElement("div");
      wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      wrapper.setAttribute("style", "margin:0;background:#1f2430;color:#dce3ef;font-family:Arial, sans-serif;font-size:13px;width:" + width + "px;");
      const style = document.createElement("style");
      style.textContent = cssText;
      wrapper.appendChild(style);
      Array.from(clone.childNodes).forEach((node) => wrapper.appendChild(node.cloneNode(true)));
      const xhtml = new XMLSerializer().serializeToString(wrapper);
      return {
        width,
        height,
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '"><foreignObject width="100%" height="100%">' + xhtml + '</foreignObject></svg>',
      };
    }
    async function exportReportHtml() {
      try {
        setExportStatus("正在生成报告 HTML...");
        const html = standaloneReportHtml();
        downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), "Malaysia-Stock-Dashboard-Report-" + timestampSlug() + ".html");
        markReportExported("html");
        setExportStatus("报告 HTML 已导出。");
      } catch (error) {
        console.error(error);
        setExportStatus("报告导出失败：" + error.message);
      }
    }
    async function exportScreenshotPng() {
      let svgText = "";
      try {
        setExportStatus("正在生成截图 PNG...");
        const { width, height, svg } = screenshotSvgText();
        svgText = svg;
        const image = new Image();
        const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = svgUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#1f2430";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0);
        URL.revokeObjectURL(svgUrl);
        const blob = await canvasToPngBlob(canvas);
        downloadBlob(blob, "Malaysia-Stock-Dashboard-" + timestampSlug() + ".png");
        markReportExported("png");
        setExportStatus("截图 PNG 已导出。");
      } catch (error) {
        console.warn("Full-page PNG export fell back:", error);
        try {
          await captureVisibleScreenPng();
        } catch (captureError) {
          console.warn("Screen capture fallback failed:", captureError);
          if (svgText) {
            downloadBlob(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }), "Malaysia-Stock-Dashboard-" + timestampSlug() + ".svg");
            markReportExported("svg");
            setExportStatus("浏览器限制 PNG 截图，已改为导出 SVG 截图；报告 HTML 仍可用。");
          } else {
            setExportStatus("截图导出失败，可改用报告 HTML：" + captureError.message);
          }
        }
      }
    }
    function render() {
      const prices = [...DATA.klciPrices].reverse();
      drawCandles(document.getElementById("klciChart"), prices);
      drawCandles(document.getElementById("dailyCandleChart"), DATA.intradayCandles);
      drawBars(document.getElementById("volumeChart"), prices.map(p => p.volume));
      const breadthChart = document.getElementById("breadthChart");
      if (breadthChart) {
        drawLine(breadthChart, [...DATA.marketSummary].reverse().filter(s => s.total > 0).map(s => s.bullRatio * 100), { color: css("--yellow"), digits: 1 });
      }
      document.querySelectorAll(".spark").forEach((canvas) => {
        drawLine(canvas, JSON.parse(canvas.dataset.series), { digits: 1 });
      });
    }
    document.getElementById("refreshPageBtn")?.addEventListener("click", refreshPage);
    document.getElementById("exportPngBtn")?.addEventListener("click", exportScreenshotPng);
    document.getElementById("exportReportBtn")?.addEventListener("click", exportReportHtml);
    window.addEventListener("resize", render);
    render();
  </script>
</body>
</html>`;
}

async function main() {
  const [klciRaw, stocks, newsItems] = await Promise.all([fetchKlciHistory(), fetchStocks(), fetchLatestNews()]);
  const yahoo = normalizeYahooKlci(klciRaw);
  const market = {
    klciPrices: yahoo.klciPrices,
    marketSummary: buildMarketSummary(stocks, yahoo.klciPrices),
    latestMeta: yahoo.latestMeta,
  };
  const sectors = groupSectors(stocks);
  const tables = buildTables(stocks);
  const latestSummary = market.marketSummary[0];
  const analysis = klciAnalysis(market.klciPrices, latestSummary, sectors);
  const now = new Date();
  const middaySnapshot = await loadMiddaySnapshot(now);

  if (middaySnapshot) {
    analysis.unshift(
      `${middaySnapshot.date} ${middaySnapshot.time} 午盘快照：FBM KLCI 报 ${fmt(middaySnapshot.close, 2)}，变动 ${fmt(middaySnapshot.change, 2)} 点（${pct(middaySnapshot.pctChange)}），上午区间 ${fmt(middaySnapshot.sessionLow, 2)} - ${fmt(middaySnapshot.sessionHigh, 2)}；大市宽度 ${middaySnapshot.gainers} 涨 / ${middaySnapshot.losers} 跌，成交 ${middaySnapshot.turnoverUnits}、总值 ${middaySnapshot.turnoverValue}。`,
    );
  }

  const model = {
    generatedAt: now.toISOString(),
    generatedLabel: now.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kuala_Lumpur",
      timeZoneName: "short",
    }),
    generatedShortLabel: malaysiaDateTimeLabel(now),
    generatedTime: now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kuala_Lumpur",
    }),
    marketSummary: market.marketSummary,
    klciPrices: market.klciPrices,
    intradayCandles: buildIntradayCandles(market.klciPrices[0]),
    middaySnapshot,
    volumeNote: volumeAnomalyNote(market.klciPrices),
    stocks,
    sectors,
    tables,
    analysis,
    newsItems,
  };

  await fs.writeFile(outputPath, buildHtml(model), "utf8");
  console.log(
    JSON.stringify(
      {
        outputPath,
        stocks: stocks.length,
        sectors: sectors.length,
        latestKlci: market.klciPrices[0],
        yahooMeta: market.latestMeta,
        middaySnapshot,
        latestSummary,
        news: newsItems.map((item) => `${item.date} ${item.source}: ${item.title}`),
        topVolume: tables.topVolume.slice(0, 3).map((s) => `${s.ticker} ${compact(s.volume)}`),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
