# Malaysia Stock Dashboard + Warrants Brief

Daily-updated static website for the Malaysia Stock Dashboard and CIMB/Macquarie warrants brief.

- `index.html`: full Malaysia Stock Dashboard
- `warrants_filtered.html`: Daily Malaysia Warrants HTML update

## Update Locally

```bash
npm run update
```

The updater fetches current dashboard and warrants data, then rewrites:

- `index.html`
- `warrants_filtered.html`

## Data Sources

- Dashboard index: Yahoo Finance `^KLSE` chart data.
- Stock breadth, top volume, top turnover, sector heatmap and recommendations: TradingView Malaysia Screener.
- News priority: Bursa Malaysia official-related content first. If Bursa official pages trigger Cloudflare verification in an automated environment, the updater uses Google News RSS to index Bursa / FBM KLCI items, with Moomoo and Sin Chew / 星洲财经 as auxiliary references.
- Warrants: MalaysiaWarrants warrant search data.

## Warrants Filters

- Issuers: CIMB, Macquarie
- Type: Call warrants
- Underlying: stocks only
- Moneyness: in the money
- Expiry: more than 30 days from run date
- Warrant bid price: RM0.10 to RM0.15

Premium formula:

```text
((exercise price + ask price * exercise ratio) / underlying price - 1) * 100
```
