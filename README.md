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
