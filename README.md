# Bequest

> A crypto inheritance agent — for what happens after.

Bequest is a wallet inheritance / dead-man's switch agent built on top of a forked [Zerion CLI](https://github.com/zeriontech/zerion-ai). You designate a beneficiary, an asset, a chain, and a check-in cadence. As long as you check in (web button, Telegram, or one-tap email link), nothing happens. If you stop checking in, an autonomous onchain agent — scoped to a single recipient on a single chain — delivers the transfer.

Submitted to the **Build an Autonomous Onchain Agent using Zerion CLI** track on Superteam Earn.

## Why this design

The hackathon penalizes "god-mode" agents. Bequest answers that head-on: **each bequest is its own dedicated wallet, and the agent token bound to it can do exactly one thing.**

- **Chain-locked** to the chain you chose
- **Recipient-locked** by an allowlist of one (the beneficiary)
- **ERC-20 approvals denied**, blocking the most common token-drain pattern
- **Time-bounded** with a 30-day policy expiry as a backstop
- **Single-purpose wallet** holding only the bequest amount + a small gas budget

If the agent token leaked, it could send the configured asset to the configured beneficiary on the configured chain. Nothing else. The blast radius is the bequest, by construction.

## Repository layout

```
/cli/                  Forked Zerion CLI (preserved verbatim for attribution).
                       Source of truth for transfer ABI shape, policy schema,
                       agent-token semantics, and Zerion API auth.
/web/                  Next.js 14 app — the product. Vercel root directory.
  /app/                App Router pages + API routes.
  /lib/zerion/         TypeScript ports of the CLI's transfer + policy primitives.
                       Each file cites its upstream lineage in /cli/.
  /lib/bequest/        Bequest state machine: create, arm, ping, tick, cancel, nudge.
  /lib/{db,auth,crypto,notify,telegram}.ts
                       Supporting glue (Drizzle, magic-link, AES-GCM, Resend, Telegram).
  /drizzle/            Drizzle ORM schema + migrations.
  /vercel.json         Cron job definitions (tick every minute, nudge every hour).
```

## How `/web` builds on `/cli`

| Bequest piece | What it does | Upstream in `/cli/` |
|---|---|---|
| `web/lib/zerion/send.ts` | EVM transfer: ERC-20 `transfer(address,uint256)` ABI encoding, EIP-1559 fees, gas estimate with 20% buffer, balance precheck | `cli/commands/trading/send.js`, `cli/utils/trading/transaction.js` |
| `web/lib/zerion/policy.ts` | Scoped policy gate run before signing: chain lock, allowlist, deny-approvals, expiry | `cli/policies/run-policies.mjs`, `cli/policies/allowlist.mjs`, `cli/policies/deny-approvals.mjs` |
| `web/lib/zerion/api.ts` | Zerion API client — Basic Auth, 429 retry with `Retry-After`/`ratelimit-reset` parsing, JSON:API error surfacing | `cli/utils/api/{auth.js,client.js}` |
| `web/lib/bequest/arm.ts` | Mints the policy + agent-token-id once funds arrive, mirroring `zerion agent create-policy && zerion agent create-token` | `cli/commands/agent/{create-policy.js,create-token.js}` |

The CLI's filesystem-bound modules (`~/.zerion/` keystore, agent-token store, config) aren't a fit for serverless — instead we keep ENV-variable-driven pieces (the API client honors `process.env.ZERION_API_KEY` upstream) and replace the filesystem layer with Postgres + envelope-encrypted ciphertext.

## Architecture (Vercel-native)

- **Per-bequest hot wallet.** Privkey generated server-side, encrypted at rest with AES-256-GCM derived via HKDF from a master key. User funds the wallet by sending the bequest amount + small gas to the displayed deposit address. Funds custody is bounded to the bequest amount.
- **Watcher = Vercel Cron.** `/api/cron/tick` runs every minute. Atomic `UPDATE … WHERE status='armed'` flips status to `triggered` BEFORE broadcasting — idempotent across cron retries. `/api/cron/nudge` runs hourly to send 50%/75%/90% reminders.
- **Notifications.** Resend for email (magic-link + nudges + delivery confirmation). Telegram bot webhook for in-chat ping (`/ping`, `/ping bq_xxxx`, `/list`).
- **Auth.** Magic-link only — no passwords. Single-use HMAC tokens, 15-minute TTL.

## State machine

```
draft (wallet minted, awaiting funds)
  └─ funds detected ──→ armed
                          ├─ ping ──→ armed (last_ping_at reset)
                          ├─ cancel ──→ cancelled (sweep funds back to owner)
                          └─ now > last_ping + window ──→ (atomic) triggered
                                                            ├ tx success → txn_hash recorded
                                                            └ tx fail → failed (no auto-retry)
```

## Local development

Prereqs: Node 20+, a Postgres connection string, a [Zerion API key](https://developers.zerion.io), a Base wallet with a tiny ETH balance for gas.

```bash
cd web
npm install
cp .env.example .env.local
# fill in .env.local — minimally DATABASE_URL, MASTER_KEY, ZERION_API_KEY
npx drizzle-kit push                  # apply schema
npm run dev                           # http://localhost:3000
```

Set `STUB_EMAIL=1` to log emails to the console instead of sending.

To poke the cron locally:

```bash
curl -X POST http://localhost:3000/api/cron/tick
curl -X POST http://localhost:3000/api/cron/nudge
```

## Deploying to Vercel

1. Fork or push this repo to your own GitHub.
2. Create a new project on Vercel, set **Root Directory** to `web`.
3. Add a Postgres integration (Vercel Postgres or Neon) — they auto-populate `DATABASE_URL`.
4. Set the rest of the env vars from `.env.example`. Generate `MASTER_KEY` with `openssl rand -base64 32`.
5. Deploy. Vercel will pick up `web/vercel.json` and provision the cron jobs.
6. Apply the schema:
   ```bash
   DATABASE_URL=... npx drizzle-kit push
   ```
7. Set the Telegram webhook (optional):
   ```bash
   curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-app>.vercel.app/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

## Demo flow

1. Sign in with email (magic link).
2. **New bequest**: beneficiary, USDC, 0.01, Base, 60-second check-in.
3. Land on the **fund page** — QR + deposit address. Send 0.01 USDC + a small ETH gas allowance from your phone wallet.
4. Page polls and flips to **ARMED** automatically.
5. Tap **Connect Telegram** → bot says "Linked." `/ping` from the chat resets the countdown.
6. Walk away. Nudges arrive at 50/75/90%.
7. At 0:00 the watcher fires. Status flips to **TRIGGERED**, txn hash links to basescan.

## Scoped-policy reading list

- `web/lib/zerion/policy.ts` — the gate. Same checks as the CLI's executable policies, expressed in 80 lines of TypeScript.
- `web/lib/zerion/send.ts` — `enforceExecutablePolicies` lives at the top of the broadcast path, line-for-line equivalent to the CLI's `send.js`.
- `web/lib/bequest/arm.ts` — where the policy and the agent token are minted, when the funds arrive.

## License

MIT — see [LICENSE](LICENSE). Forked from [zeriontech/zerion-ai](https://github.com/zeriontech/zerion-ai).
