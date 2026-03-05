# SheetsBase

> **A query client for Google Sheets — with a Supabase-like API**

[![npm version](https://img.shields.io/npm/v/@sheetsbase/client)](https://www.npmjs.com/package/@sheetsbase/client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](https://nodejs.org/)
[![Status: Beta](https://img.shields.io/badge/status-beta-blue)](https://github.com/JonaVicesar/sheetsbase)

🔗 **[Live Demo — Coffee Shop Dashboard](https://sheetsbase-example.onrender.com)**  
> *First load may take ~30s (Render free tier cold start)*

---

## What is SheetsBase?

SheetsBase is a query client that connects to the Google Sheets API and lets you use a spreadsheet as a database. Instead of dealing with the raw Google Sheets API — A1 notation, row indexes, credential boilerplate — you get a clean, chainable query interface similar to Supabase.

```javascript
// Instead of this (raw Google Sheets API):
const response = await sheets.spreadsheets.values.get({
  spreadsheetId: '...',
  range: 'Orders!A2:Z1000'
})
const rows = response.data.values
const orders = rows.filter(row => row[3] === 'pending')

// You write this (SheetsBase):
const orders = await db.from('orders')
  .eq('status', 'pending')
  .execute()
```

It includes chainable query methods (`.select()`, `.eq()`, `.gt()`, `.like()`, etc.), full CRUD support, built-in cache with automatic invalidation, and a flexible ID generator that supports UUID, short IDs, timestamp IDs, and readable formats.

---

## Getting Started

### Prerequisites

- Node.js 16+
- A Google Cloud project with the Sheets API enabled
- A Google Spreadsheet

### Clone the repo

```bash
git clone https://github.com/JonaVicesar/sheetsbase.git
cd sheetsbase
npm install
```

### Run the coffee-shop example

The `examples/coffee-shop` folder contains a working dashboard that uses SheetsBase against a real spreadsheet.

```bash
cd examples/coffee-shop
cp .env.example .env
# Fill in your credentials in .env
npm run dev
```

---

## Features

✅ **Supabase-like query API** — `.select()`, `.eq()`, `.gt()`, `.order()`, `.limit()`  
✅ **Full CRUD operations** — Insert, update, delete with automatic ID generation  
✅ **Built-in caching** — 5-minute TTL cache with automatic invalidation on writes  
✅ **No separate server needed** — connects directly to Google Sheets from your Node.js app  
✅ **Flexible ID generation** — UUID, short IDs, timestamp IDs, or custom readable formats  

---

## Installation

```bash
npm install @sheetsbase/client
```

> **Requires Node.js 16+.** SheetsBase runs in Node.js only — credentials must stay on your server, never exposed to the browser.

---

## Setup

### Step 1: Google Cloud Setup

SheetsBase uses a **Service Account** to authenticate with Google Sheets.

#### 1.1 Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the **Google Sheets API** → "APIs & Services" → "Library" → search "Google Sheets API"
4. Create a Service Account → "APIs & Services" → "Credentials" → "Create Credentials" → "Service Account"
5. Generate a key → click the service account → "Keys" tab → "Add Key" → "Create new key" → JSON
6. Save the file as `service-account.json` in your project

#### 1.2 Share Your Spreadsheet

1. Open your Google Spreadsheet
2. Click **Share**
3. Paste the service account email (found in `service-account.json` as `client_email`)  
   It looks like: `your-service@your-project.iam.gserviceaccount.com`
4. Give it **Editor** permissions

#### 1.3 Prepare Your Spreadsheet

Each sheet (tab) acts as a table. Structure it like this:

```
Sheet: products
┌──────────┬──────────┬────────┬────────┐
│ id       │ name     │ price  │ stock  │  ← Headers (row 1)
├──────────┼──────────┼────────┼────────┤
│ uuid-123 │ Laptop   │ 999    │ 10     │  ← Data (row 2+)
│ uuid-456 │ Mouse    │ 25     │ 50     │
└──────────┴──────────┴────────┴────────┘
```

- Row 1 **must** contain headers
- Use lowercase column names with `_` instead of spaces
- An `id` column is recommended but not required

**Where to find your Spreadsheet ID:**

```
https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0/edit
                                      ^^^^^^^^^^^^^^^^^
                                      This is your ID
```

### Step 2: Initialize the client

```javascript
import { createClient } from '@sheetsbase/client'

const db = createClient({
  serviceAccount: './service-account.json',
  spreadsheetId: process.env.SPREADSHEET_ID
})
```

---

## API Reference

### Querying

```javascript
// Select all or specific columns
await db.from('products').select('*').execute()
await db.from('products').select('name, price, stock').execute()

// Filters
await db.from('products').eq('category', 'electronics').execute()
await db.from('products').neq('stock', 0).execute()
await db.from('products').gt('price', 100).execute()
await db.from('products').gte('rating', 4).execute()
await db.from('products').lt('price', 50).execute()
await db.from('products').lte('discount', 20).execute()
await db.from('products').like('name', 'iPhone').execute()

// Ordering and limiting
await db.from('products').order('price', 'desc').execute()
await db.from('products').limit(5).execute()

// Chaining — the real power
const results = await db.from('products')
  .select('name, price')
  .eq('category', 'electronics')
  .gt('price', 100)
  .order('price', 'desc')
  .limit(10)
  .execute()

// You can also use await directly without .execute()
const products = await db.from('products').eq('status', 'active')
```

### CRUD Operations

```javascript
// Insert one record (ID is auto-generated)
await db.insert('products', { name: 'Laptop', price: 999 })

// Insert multiple records
await db.insert('products', [
  { name: 'Mouse', price: 25 },
  { name: 'Keyboard', price: 75 }
])

// Update by ID
await db.update('products', 'product-id', { price: 899 })

// Delete by ID
await db.delete('products', 'product-id')
```

### Cache Management

```javascript
// Get cache stats
const stats = db.getCacheStats()
console.log(stats.hitRate) // '85.00%'

// Clear cache for a specific table
db.clearCache('products')

// Clear all cache
db.clearCache()
```

---

## ID Generation

By default SheetsBase generates a UUID for each inserted record. You can configure this:

```javascript
// UUID (default)
await db.insert('orders', data)
// → xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx

// Short ID
await db.insert('orders', data, { idConfig: { type: 'short' } })
// → a3f9k2m5n8p1q4r7

// Sortable timestamp
await db.insert('orders', data, { idConfig: { type: 'timestamp' } })
// → 1703001234567_a3f9k2m5

// Readable with prefix
await db.insert('orders', data, { idConfig: { type: 'readable', prefix: 'order' } })
// → order-2024-02-20-a3f9
```

---

## Architecture

```
┌─────────────────────────────┐
│  Your Node.js App           │
│                             │
│  const db = createClient()  │
│  db.from('orders')...       │
└──────────────┬──────────────┘
               │ googleapis
┌──────────────▼──────────────┐
│  Google Sheets API          │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  Your Spreadsheet           │
└─────────────────────────────┘
```

Everything runs inside your app — no separate server needed. The cache, query logic, and Google Sheets communication are all handled by the client.

---

## Performance

| | Without cache | With cache |
|---|---|---|
| Simple query | ~800ms | ~5ms |
| Filtered query | ~900ms | ~8ms |

**~160x faster** on cache hits. Cache TTL is 5 minutes by default and is automatically invalidated on any write operation.

---

## Limitations

SheetsBase is **not** a replacement for a real database. It's designed for:

✅ Small businesses (< 10k rows per sheet)  
✅ Internal tools and dashboards  
✅ Prototypes and MVPs  
✅ Projects already living in Google Sheets  

**Avoid it for:**

❌ High-traffic production apps  
❌ Complex transactions  
❌ Real-time collaborative editing  
❌ Queries requiring OR logic or nested conditions  

**Known limitations:**
- No OR logic in WHERE clauses (requires multiple queries)
- Google Sheets API rate limit: 100 requests / 100 seconds per user
- Rows with empty cells return `null` for those fields

## License

MIT © [Jonathan Vicesar](https://github.com/JonaVicesar)

---

## Contributing

This is a personal project, but PRs are welcome. Please open an issue first to discuss major changes.