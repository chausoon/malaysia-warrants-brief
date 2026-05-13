import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const htmlPath = resolve(rootDir, "warrants_filtered.html");
const indexPath = resolve(rootDir, "index.html");

const API_URL = "https://www.malaysiawarrants.com.my/apimqmy/ScreenerJSONServlet";
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
  return date.toISOString().slice(0, 10);
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

function generateHtml({ css, rows, today, cutoff }) {
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
  <main>
    <section class="hero">
      <div>
        <span class="eyebrow">结构性认股权证简报</span>
        <h1>CIMB / Macquarie 认股权证筛选</h1>
        <p class="subtitle">只看 Call Warrants、相关资产为股票、价内、距离到期超过 30 天。数据取自 MalaysiaWarrants 当前筛选器。</p>
      </div>
      <div class="date-pill">筛选日期：${formatDate(today)}</div>
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
  const css = extractCss(existingHtml);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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

  const html = generateHtml({ css, rows, today, cutoff });
  await writeFile(htmlPath, html);
  await writeFile(indexPath, html);
  console.log(`Updated ${rows.length} warrants. Cutoff: ${formatDate(cutoff)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
