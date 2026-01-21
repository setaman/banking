# Finance Dashboard

A **local-only**, **secure** web-based dashboard for tracking bank accounts and gaining financial insights from DKB (Deutsche Kredit Bank) transactions.

## Key Features

✅ **Local-Only**: No server, no database, no cloud - everything runs in your browser  
✅ **Secure**: Credentials never stored, all data stays in your browser's IndexedDB  
✅ **DKB Integration**: Sync transactions via DKB API (cookie-based authentication)  
✅ **Multi-Account Support**: Track multiple bank accounts  
✅ **Transaction Management**: View, filter, and categorize transactions  
✅ **Persistent Storage**: Data saved locally using IndexedDB  

## Security Model

- **NO credentials stored**: Authentication credentials are ONLY kept in memory during sync
- **NO data transmission**: After initial API sync, all data stays local
- **NO analytics**: Zero tracking, zero telemetry
- **Browser-based encryption**: IndexedDB is isolated per-origin

## Tech Stack

- **Framework**: Vite + React 19 + TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **State**: Zustand (coming in Sprint 2)
- **Database**: Dexie.js (IndexedDB)
- **Charts**: ECharts (coming in Sprint 2)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Modern browser with IndexedDB support
- Active DKB account

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## How to Sync DKB Transactions

### Step 1: Get Your Authentication Credentials

1. Open [DKB Banking](https://banking.dkb.de) in your browser
2. Log in with your credentials
3. Open **DevTools** (F12 or Right-click → Inspect)
4. Go to the **Network** tab
5. Click on any API request to `banking.dkb.de/api/`
6. Find the **Request Headers** section
7. Copy these two values:
   - **Cookie**: The full cookie header value
   - **x-xsrf-token**: The XSRF token value (usually a UUID)

### Step 2: Sync in Dashboard

1. Click the **"Sync from DKB"** button in the app
2. Paste the **Cookie** header (from Step 1)
3. Paste the **x-xsrf-token** value (from Step 1)
4. Enter your DKB Account ID (from the URL or API response)
5. Select date range (defaults to last 90 days)
6. Click **"Sync Transactions"**

**Security Note:** Credentials are cleared from memory immediately after sync completes.

### Step 3: View Your Transactions

- Transactions appear in the table sorted by date (newest first)
- Color-coded amounts: 🔴 Red = Expenses, 🟢 Green = Income
- Transaction count displayed below table

## Project Structure

```
src/
├── components/
│   ├── layout/              # Header, Layout
│   ├── transactions/        # TransactionTable
│   ├── sync/                # SyncDialog
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── api/                 # DKB API client
│   ├── db/                  # Dexie.js IndexedDB
│   └── parsers/             # DKB transaction parser
├── types/                   # TypeScript types
├── App.tsx                  # Main app
└── main.tsx                 # Entry point
```

## Sprint 1 Status (Current)

✅ **Completed:**
- Vite + React 19 + TypeScript setup
- Tailwind CSS + shadcn/ui components
- DKB API client with pagination
- DKB transaction parser
- IndexedDB schema (Accounts & Transactions)
- SyncDialog with secure token handling
- TransactionTable with formatting
- Layout components

⏳ **Pending:**
- Unit tests for parser
- Security review
- Sprint 2: Charts & Analytics
- Sprint 3: Categorization
- Sprint 4: Deutsche Bank CSV support

## Roadmap

### Sprint 2: Multi-Account & Analytics
- Account selector
- Balance charts
- Income vs Expense analysis
- Transaction deduplication

### Sprint 3: Categorization & Filtering
- Auto-categorization
- Category pie chart
- Date range filtering
- Category management

### Sprint 4: Polish & Deutsche Bank
- Deutsche Bank CSV import
- Dark/light theme toggle
- Mobile responsive design
- Data export to JSON
- User documentation

## Development

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Build for Production

```bash
npm run build
```

The build artifacts will be in the `dist/` directory.

## Security

### What We Do

- ✅ Credentials used ONLY as function parameters (never stored)
- ✅ Credentials cleared from state immediately after sync
- ✅ Password input type for credential fields
- ✅ No console logging of sensitive data
- ✅ All data stays in browser IndexedDB
- ✅ No external analytics or tracking

### What You Should Do

- 🔒 Only run this app on your personal computer
- 🔒 Use a private browser session if on shared device
- 🔒 Clear IndexedDB data before selling/disposing computer
- 🔒 Never share your DKB credentials with anyone
- 🔒 Session expires after a few hours (re-sync as needed)

## FAQ

### Where is my data stored?

All data is stored in your browser's **IndexedDB**, which is local to your device. It never leaves your computer.

### Can I export my data?

Yes! Sprint 4 will include a JSON export feature to back up your data locally.

### What happens if I clear my browser data?

All transactions and accounts will be deleted. You'll need to sync again from DKB.

### Does this work with Deutsche Bank?

Not yet. Sprint 4 will add Deutsche Bank CSV import support.

### Why do I need to paste credentials?

DKB doesn't offer a public API for personal accounts. The cookie-based authentication method allows us to sync data without storing your credentials, while keeping everything local-only.

### How long do the credentials last?

DKB session cookies typically expire after a few hours. If sync fails, simply copy fresh credentials from DevTools.

## License

This project is for personal use only. DKB API usage must comply with their Terms of Service.

## Contributing

This is a personal project built by an AI agent swarm. Contributions welcome!

---

**Built with ❤️ by the AI Agent Swarm** 
- Project Manager
- Software Architect
- CoderAgent
- Frontend Specialist
- (Security review & tests coming soon...)
