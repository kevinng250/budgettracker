# Budget Tracker

A personal/household budget tracker that ingests bank CSVs, scans grocery receipts via phone camera + Claude vision, and lets you slice spending across multiple household members. Built as a single-instance, self-hosted app — no cloud, no auth, all data stays on your machine.

## What it does

- **Imports bank CSVs** for Capital One (360 Checking, Performance Savings, VentureX), Chase, Discover, and SoFi (Checking, Savings).
- **Auto-tags** transactions by description matching against your taxonomy.
- **Splits transactions** across categories (one Costco charge → groceries + electronics + household).
- **Scans receipts via your phone camera** — sends the image to Claude Haiku 4.5, extracts merchant/date/total/line items, and creates a split transaction with each item.
- **Tracks item-level data** (per-unit prices, grocery tags) for trend analysis ("how have banana prices changed over time?").
- **Labels** transactions across episodic groupings (trips, projects). Labels are M:N — a transaction can carry many.
- **Profiles** segregate household members' data. Switch profiles to see one person's spending; switch to **Combined** to see household totals.
- **Dashboard** with income vs. spending, by-tag/by-category breakdowns, account balance trends, and daily-average panels.

## Stack

- **Backend**: Python 3.9+ / Flask, raw `sqlite3` (no ORM)
- **Frontend**: React + TypeScript + Vite + Mantine v7 + Recharts
- **AI**: Anthropic SDK (Claude Haiku 4.5 vision) for receipt OCR
- **Networking**: optional Tailscale for phone → laptop reachability

---

## Quick start

### Prerequisites

- Python 3.9 or newer (3.10+ recommended)
- Node.js 18 or newer
- An [Anthropic API key](https://console.anthropic.com/settings/keys) if you want receipt scanning. Without it, everything else works fine — only the receipt-upload endpoint will return an error.

### 1. Clone

```sh
git clone <your-repo-url> budget-tracker
cd budget-tracker
```

### 2. Backend

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Set the Anthropic API key (only needed for receipt scanning):

```sh
export ANTHROPIC_API_KEY=sk-ant-...
```

Add it to `~/.zshrc` or a `.env` file for persistence. The `.env` patterns are gitignored.

Run the server:

```sh
python app.py
```

Flask binds on `0.0.0.0:5001` (so a phone on the same network or Tailscale can reach it). On first boot it creates `backend/data/budget.db`, runs all migrations, seeds default tags/categories, and creates a default profile named **Me**.

### 3. Frontend

In a separate terminal:

```sh
cd frontend
npm install
npm run dev
```

Vite serves on `0.0.0.0:5173`. Open `http://localhost:5173` in your browser.

### 4. (Optional) Tailscale for phone access

If you want to scan receipts from your phone:

1. Install Tailscale on your Mac (`brew install --cask tailscale`) and on your phone (App Store / Play Store).
2. Sign in to both with the same account.
3. From the phone's browser, visit `http://<your-mac>.tail-xxxx.ts.net:5173/receipts` (your hostname is in the Tailscale app under "My Devices").
4. Tap **Add to Home Screen** for an app-like icon.

The Vite config already whitelists `*.ts.net` hosts.

---

## First-time setup

After the servers are running:

1. **Open the app** at `http://localhost:5173`. You'll land on the Dashboard in **Combined** view.
2. **Optional: create more profiles.** Open **Profiles** in the sidebar, tap **+** to add household members (e.g., "Partner"). Pick colors if you want.
3. **Switch to your profile** via the header dropdown before uploading anything.
4. **Upload bank CSVs.** Open **Uploads** → drop your CSV onto "Upload Transactions." The Uploads page shows which profile the rows will land in (must not be Combined).
5. **Review tags.** Visit **Tags** to see the household taxonomy. The default tags (food, drinks, gas, …) and categories (Food & Drinks, Lifestyle, …) are pre-seeded. Create custom ones as needed.

---

## Day-to-day usage

### Uploading transactions

- Drop a CSV on the **Uploads** page. Supported formats are auto-detected by header signature:
  - Capital One 360 Checking / Performance Savings
  - Capital One VentureX (credit card)
  - Chase (credit card)
  - Discover (credit card)
  - SoFi Checking / Savings
- The Upload History table on the same page lets you delete a batch (trash icon). That removes the imported rows AND the upload log entry AND the archived CSV file.
- The **Account Coverage** panel above the history shows the latest transaction date per account with a freshness badge (green ≤7 days, yellow ≤30, red beyond) — useful for noticing when an account needs a fresh import.

### Tagging and categorizing

- Each transaction has one **tag** (food, gas, etc.). Tags belong to **categories** (Food & Drinks, Transportation, etc.).
- In the Transactions table, click the tag dropdown on a row to change it. The dropdown groups Categories above Tags — picking a category directly assigns the category's system tag.
- The Tags & Categories page (`/tags`) shows the household taxonomy as a 3-column card grid. Click a tag chip to edit. Click the pencil on a category to rename, the trash to delete (custom categories only). A "+" FAB opens menus for creating new categories or tags.

### Splitting transactions

- The scissors icon on a transaction opens the Split modal. Enter line amounts that sum to the original, pick a tag for each. Children appear as expandable rows below the parent (blue background) in the Transactions table.
- Splits keep the parent's **bank**, **account**, **date**, **transaction date**, **profile**, and **labels** — you only specify per-line description, amount, and tag.

### Scanning a receipt

The capture/review flow is intentionally split across devices so you can snap on your phone and review on your Mac later.

**Capture (typically on phone):**
1. Switch the header dropdown to your profile.
2. Open **Receipts** in the sidebar.
3. Tap **Open Camera**, snap the receipt, wait ~2 seconds for the parse.
4. "Queued for review" appears. Snap another or stop.

The image is archived to `backend/data/uploads/receipts/` with a timestamped filename and parsed by Claude into structured JSON.

**Review (typically on Mac):**
1. Open **Review Queue** in the sidebar. Each queued receipt is a card with merchant, date, total, and a warning count.
2. Click a card → the review form opens with Claude's extraction pre-populated:
   - Editable merchant/date/subtotal/tax/total
   - Line-item table with description, amount, transaction tag
   - Δ badge in the top right shows `total - sum(line_items)`. **Save is disabled until Δ is $0.00.**
   - If the model returned tax/tip separately, a synthetic "Tax" row is auto-added. If a gap remains, an "Unaccounted" row appears (Claude probably missed some items — fix it manually).
3. **Link** to an existing card charge that matches by amount + date (suggested automatically when there's a clean match), or **Create** a new transaction.
4. Tap **Save**. You're redirected to `/items?transaction_id=<id>` for the next step.

### Enriching items for price tracking

The Items page is where you add the data needed for trend analysis: per-unit price, unit, grocery tag.

1. Click any item to open the edit modal.
2. Set:
   - **Quantity** + **Unit** — pick a base unit (egg, lb, oz, fl oz, …) that lets you compare across purchases. The Unit field is an autocomplete with common values.
   - **Price per unit** — auto-fills as `line_total ÷ quantity` if you don't override.
   - **Grocery tag** — type a product name like `bananas`, `eggs`, `chicken thighs` and press Enter. These are separate from budgeting tags. The next time you tag an item with the same name, the Unit field will default to whatever you used last time.
3. Save. Filter the Items page by grocery tag to see price history.

### Labels (episodic groupings)

- Use labels for trips, projects, or any cross-cutting context. Each label is just a name.
- Per-transaction: click the labels icon on a row, check the relevant labels (auto-saves), or create a new one inline.
- Bulk: check rows in the Transactions table → an action bar appears with **Assign label** → pick one to apply to all selected.
- The Labels page lists them as cards (count + total). Click a card to see the per-tag/per-category breakdown and the transaction list for that label.

### Profiles

- The header dropdown shows the active scope: a profile name, or **Combined**.
- **Combined** is the default and shows household-wide aggregations.
- Switch to a specific profile to drill into one person's spending. KPIs, charts, and lists all reduce to that profile's data. Tags and labels themselves are unchanged (household-shared), but their stats reflect only the active profile.
- Uploads, manual accounts, and receipt scans **require** a specific profile (Combined will refuse with a clear message). Splits and receipt children inherit profile from the parent transaction.

---

## Where things live

```
budget-tracker/
├── backend/
│   ├── app.py                  # Flask app, all migrations, blueprint registration
│   ├── config.py               # paths (DB, upload archive)
│   ├── requirements.txt
│   ├── parsers/                # one parser per bank CSV format
│   ├── routes/                 # transactions, tags, categories, labels,
│   │                           # profiles, receipts, items, item_tags,
│   │                           # accounts, summary
│   ├── services/
│   │   ├── upload_service.py   # CSV parsing + insert
│   │   ├── receipt_parser.py   # Claude vision call
│   │   └── tag_inference.py    # auto-tag by description match
│   └── data/
│       ├── budget.db           # SQLite DB (gitignored)
│       └── uploads/            # archived CSV/image originals (gitignored)
└── frontend/
    └── src/
        ├── pages/              # one per route
        ├── components/         # reusable UI
        ├── hooks/              # data fetching
        ├── context/            # ActiveProfile context
        ├── types/index.ts      # shared TS types
        └── api/client.ts       # axios; relative /api baseURL
```

---

## Operational notes

- **Database**: a single SQLite file at `backend/data/budget.db`. Back it up with `cp` — that's the whole state. Already gitignored.
- **Archived uploads**: every CSV and receipt image is preserved at `backend/data/uploads/`. Useful if you ever want to re-parse with a fixed parser. Also gitignored.
- **Secrets**: `ANTHROPIC_API_KEY` is the only secret. Use a shell export, `.env`, or a Mac Keychain entry — never check it in. The gitignore covers `.env*` patterns.
- **Spend cap**: set a monthly cap on your Anthropic key (Settings → Limits). $5/month is more than enough for personal receipt scanning at Haiku prices.
- **CORS**: backend allows `*` for `/api/*`. Fine for a personal app; lock down to specific origins if you ever expose this publicly.
- **No auth**: this is a single-trust-boundary app. Don't put it on the open internet without adding a login wall.

---

## Adding a new bank parser

If your bank isn't in the list above:

1. Look at the CSV header line of an exported statement.
2. Create `backend/parsers/<bankname>.py` modeled on the existing parsers in that directory.
3. Register the parser in `backend/parsers/detector.py` — match on the unique header columns.
4. The parser's `parse()` method should return a list of dicts with these keys: `date`, `description`, `amount`, `bank`, `account`, `balance` (nullable), `transaction_date` (nullable; credit cards have this, checking accounts don't).
5. Sign convention: **positive amount = money out (spending)**, negative = money in. Flip signs in the parser as needed for your bank's CSV format.

---

## Roadmap / known gaps

- No transaction deduplication on upload — re-uploading a CSV creates duplicates. Use the "delete batch" action on the Uploads page first.
- No auth. Add a login wall before exposing this beyond your trust boundary.
- Receipt image isn't rendered inline on the review page (only the parsed JSON). The path is stored — a static-file route would surface it.
- No bulk profile reassignment in the UI. Possible via SQL.
- Multi-profile receipt splitting ("we shared the bill") not supported — a receipt belongs to one profile.

---

## Verifying your install

A quick smoke test:

```sh
# Backend reachable
curl http://localhost:5001/api/profiles

# Should return [{"id":1,"name":"Me","is_default":1,...}]
```

If you see that JSON, the migrations ran and the default profile is in place. Hit `http://localhost:5173` in your browser and start uploading CSVs.
