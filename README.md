# Smoke Finder — Telegram Mini App

A Telegram-native storefront for nicotine vaping devices and e-liquids
(Calgary/Alberta, CAD pricing, GST 5%, 18+ age gate). Built from the Claude
Design project `Smoke Finder Mini App` (5 screens, dark "Nocturne" system,
ember accent).

## Layout

- `bot/` — Node.js + TypeScript. grammY bot + Fastify API + SQLite (`better-sqlite3`).
  Serves `/api/products`, `/api/orders`, `/api/me`, and drives the bot's `/start`
  command + chat menu button.
- `webapp/` — React + Vite + TypeScript. The actual Mini App UI: age gate → catalogue
  → product → cart/checkout → account, in EN/UK/RU.
- `admin/` — the primary, local-only management tool (products/orders/users/
  addresses). No shared code with the bot beyond opening the same db file, not
  reachable from Telegram. See "Local admin tool" below.
- A **second**, narrower admin surface lives inside `bot/`+`webapp/` on purpose:
  a hidden bot command opens an orders-only Mini App for phone use. See
  "Mobile admin (hidden command)" below.

## First-time setup

```
cd bot && npm install
cd ../webapp && npm install
```

`bot/.env` already has the bot token from @BotFather. `bot/src/db/seed.ts` inserts
the 6 sample products — re-run it any time to reset the catalogue:

```
cd bot && npm run seed
```

## Running locally

Two terminals:

```
cd bot && npm run dev       # API + bot on :8787 (long polling)
cd webapp && npm run dev    # Vite dev server on :5173
```

Open `http://localhost:5173` in a regular browser to click through the screens —
everything that doesn't need a real Telegram user (browsing, cart math) works there.
Anything gated by Telegram auth (`/api/orders`, `/api/me`) will 401 outside Telegram,
since there's no `initData` to validate — that's expected.

## Testing inside real Telegram

Telegram requires an **https** URL for both the persistent chat menu button and
Mini App auth (`initData`) to work. `tools/cloudflared.exe` (downloaded into this
repo, not committed) gives quick tunnels with no signup and no click-through
interstitial page — more reliable for this than `localtunnel`:

```
tools\cloudflared.exe tunnel --url http://localhost:5173   # webapp
tools\cloudflared.exe tunnel --url http://localhost:8787   # api
```

Each prints a `https://<random-words>.trycloudflare.com` URL. Then:
1. Put the webapp tunnel URL in `bot/.env` as `WEBAPP_URL` and restart `npm run dev`
   in `bot/` — this both re-sends `setChatMenuButton` and lets `/start`'s inline
   button work.
2. Put the API tunnel URL in `webapp/.env` as `VITE_API_URL` — the webapp calls the
   API directly from the phone's browser context, so it also needs to be reachable
   over https from outside your machine. Restart `webapp`'s dev server to pick it up.
3. Vite's dev server 403s any request whose `Host` header it doesn't recognize by
   default — `vite.config.ts` already sets `server.allowedHosts: true` to allow the
   tunnel hostname through; without that every tunnelled request 403s.
4. Open the bot in Telegram — the persistent menu button next to the attachment
   icon opens the real Mini App, with native MainButton/BackButton, theme sync, and
   `initData` auth all live. Verify the button actually got set with:
   `curl https://api.telegram.org/bot<TOKEN>/getChatMenuButton`.

These tunnel URLs are ephemeral — they change every time `cloudflared` restarts, so
`WEBAPP_URL`/`VITE_API_URL` and the menu button need updating each session until
there's a real deployment with a stable domain.

## Local admin tool

`admin/` is a standalone site that manages products, orders (incl. changing
order status — nothing else in the system does that; it's how you'd mark an
order packed/on the way/delivered), users, and saved addresses. It runs its own
Fastify server that opens the **same** `bot/smoke-finder.db` file directly —
no API calls to the bot, no shared code, no Telegram auth, because it isn't
reachable through Telegram at all.

```
cd admin && npm install
npm run dev
```

Opens at `http://127.0.0.1:4848` — reachable **only from this machine**:

- The server binds to `127.0.0.1` specifically, not `0.0.0.0` — nothing on the
  network (not even your LAN) can reach it, only processes on this same PC.
- It has no login screen. That's intentional and only safe *because* of the bind
  above — never change it to `0.0.0.0`, and never point a tunnel
  (`cloudflared`/`localtunnel`/ngrok/etc.) at port 4848. Doing either would put
  the entire live database on the open internet with zero auth.
- The bot process (`bot/`) and this tool can run at the same time — SQLite's
  WAL mode (already on) handles that — but the bot must have been started at
  least once so `bot/smoke-finder.db` exists before this tool's first run.

Product editing: click any product's name/row to open an edit panel (name,
category, price, flavour, nicotine, exact stock quantity in units — the
in_stock/low/preorder state is derived from that count automatically, not
picked manually — brand, best-seller, a photo upload, and EN/UK/RU description
fields). "Delete" is a soft-delete (`active=0`, hidden from the shop but still
listed here so you can Restore it) — nothing is ever hard-deleted through the UI.

The Products tab also holds ~700+ **reference-only** entries imported from a
distributor SKU sheet, all inactive with no retail price set (`$0.00`) — browse
them with the search box / brand filter to decide what to actually stock, then
edit one (set a real price + quantity) and Restore it to put it on sale.

Users tab shows the referral program: every 15 *new* Telegram users someone
brings in earns them one free-product reward (`rewardsAvailable` + a "Выдать
награду" button to mark one as given). This is intentionally invisible to
customers for now — there's no "share your link" UI in the shop yet, only
backend tracking + this admin view.

## Mobile admin (hidden command)

Message the bot `/qz9panel7k` from your own Telegram account (the one matching
`ADMIN_TELEGRAM_ID` in `bot/.env`) — it replies with a button opening a second
Mini App (`?admin=1`, routed in `webapp/src/App.tsx` to `AdminOrders.tsx`)
showing all orders with a status dropdown, for checking/updating things from
your phone without the PC tool. The command is never registered with Telegram
(no `setMyCommands` call), so it doesn't appear in the "/" suggestion list —
and for anyone whose Telegram id isn't the admin's, the bot sends back nothing
at all. Every API call this mini app makes independently re-validates the
Telegram `initData` signature and the admin id server-side, too.

**E-Transfer payments are confirmed here too, mobile-first:** when a customer
replies to the bot with a screenshot after an e-Transfer order, the bot forwards
it straight to the admin's own chat with an inline "✅ Confirm payment" button —
tapping it (only works for the real admin) marks the order paid and messages the
customer. Both this mini app and the PC admin tool show each e-Transfer order's
proof status (none yet / awaiting review / confirmed).

## Deployment

Not yet configured. Plan: same server RaccoonHouse Studio's Cloudflare Worker runs
on, under a separate account so it doesn't share quota/limits with that project.
When ready: build `webapp` (`npm run build` → static `dist/`), run `bot` as a
long-lived Node process (or swap grammY's long polling for a webhook) serving both
the API and the built webapp's static files. **`admin/` is not part of this
deployment** — it stays on your own PC, run manually whenever you need it; the
production server should never run it or expose its port.

## Scope notes

- Payment is manual: cash on delivery, or Interac e-Transfer confirmed via a
  screenshot the customer sends the bot (see "Mobile admin" above) — no payment
  gateway integration.
- Checkout phone is Canada-only for now: fixed `+1` + 10 digits, validated both
  client- and server-side, saved to the user's profile (not just the order).
- The referral program (15 new users → 1 free-product reward) is tracked but has
  no customer-facing UI yet — admin-only visibility, per explicit request.
- Loyalty points exist in the schema (`users.points`) but nothing awards them yet —
  the Account screen shows real (currently 0) points, not the design mock's fixed
  240.
- Search and category chips are wired to the API. The Type/Volume filter pills from
  the design are rendered but visual-only for now (no filtering logic behind them).
- Light theme and French (fr-CA) are out of scope for this pass — the design doc
  itself deferred them ("Next: …").
- Checkout: phone is required regardless of delivery method; the street-address
  field only appears (and is only required) when delivery is "courier" — pickup
  orders skip it entirely, on both the webapp and the API's own validation.
