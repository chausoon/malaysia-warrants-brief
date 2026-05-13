# Malaysia Warrants Brief

Malaysia KLSE warrants screener brief.

Daily-updated static HTML brief for CIMB and Macquarie call warrants.

## Update Locally

```bash
npm run update
```

The updater fetches current MalaysiaWarrants screener data and rewrites:

- `warrants_filtered.html`
- `index.html`

## Filters

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
