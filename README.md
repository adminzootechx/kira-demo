# LUSTRE — Sales Analytics, Intelligence & AI Decision Support

A sales intelligence dashboard for a diamond trading business: customer health
and reorder timing, stock and price movement, team tiers, targets and approvals.

Everything in `data/` is generated and fictional — customers, salespeople,
brokers and figures alike.

## Run it

```bash
pnpm install
cp .env.example .env.local   # then set AUTH_SECRET to any random string
pnpm build && pnpm start     # or: pnpm dev
```

Sign in with either demo account, password `changeme123`:

| Account | View |
| --- | --- |
| `arjun.malhotra@lustre.example` | Management — everything, including Administration |
| `priya.mehta@lustre.example` | Sales rep — only Priya Mehta's customers |

## Two modes

**Demo mode** (no `DATABASE_URL`). Every dashboard page runs on `data/demo-*`
and the two accounts above are built in (`lib/demo.ts`). Features that store
what people do — targets, approvals, tasks, notes, admin — need a database and
say so.

**Database mode.** Point `DATABASE_URL` at an empty Postgres (a free Neon
project is enough), then:

```bash
pnpm db:migrate   # create the tables
pnpm db:seed      # roles, groups, markets and the same two accounts
```

Every feature then works. Until real sales are imported on `/data`, the
dashboards keep reading the demo dataset.

## Demo data

`scripts/generate-demo-data.mjs` simulates two years of sales and writes three
files that agree with each other:

| File | Read by |
| --- | --- |
| `data/demo-customers.csv` | the customer book (`lib/data/snapshot.ts`) |
| `data/demo-dimensions.json` | stock, prices, team and location rollups (`/api/dimensions`) |
| `data/demo-orders.json` | each customer's order history and stones |

It is seeded, so `pnpm demo:data` regenerates identical files. Change the cast
(names, countries, shapes) or the size of the book at the top of the script.

## Layout

```
app/(app)/         dashboard pages, one folder per screen
app/api/           route handlers: book, rollups, IAM, targets, approvals, tasks
components/        UI, by feature; components/ui holds the shared primitives
lib/analytics/     the scoring and portfolio models
lib/db/            schema, client, repository, rollup queries, migrations
lib/data/          CSV parsing, client-side stores, demo dataset reader
lib/tradeapi/      the optional live sales-API sync
```
