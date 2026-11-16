# Pickfoo Accounts Portal

Read-only Next.js app for accountants. Admins create accountant accounts (mobile number) from the admin console; accountants sign in with MSG91 OTP.

## Run locally

```bash
cd accounts_pickfoo/frontend
pnpm install   # or npm install
pnpm dev       # http://localhost:3004
```

Set `NEXT_PUBLIC_API_URL` if not using the default `https://api.pickfoo.in/admin/api/v1`.

## Capabilities

- Mobile + OTP login (MSG91)
- Platform ledger (order payments, restaurant payouts, partner payouts, expenses, wallet transfers)
- Partner adjustments (bonuses, clawbacks, admin adjustments)
- Monthly PDF + GST CSV export
- **No mutations** — ledger writes stay on the admin console

## Backend

Routes live on admin-api under `/api/v1/accounts/*`.
