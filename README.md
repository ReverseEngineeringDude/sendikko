# Sendikko 🔐

> **Private Zero-Knowledge File Sharing Web App**
> Sliced into 19 MB chunks • AES-256-GCM encrypted client-side • Encrypted blob store in Telegram • 8-character unique codes • No account required to download

---

## 🚀 Features

- **Zero-Knowledge Encryption**: All files are sliced into 19 MB chunks in the browser and encrypted with **AES-256-GCM** in Web Workers. Unique 96-bit random IV per chunk and chunk index bound as Additional Authenticated Data (`AAD`).
- **Telegram Encrypted Blob Store**: Encrypted chunks stream to a private Telegram channel via the Bot API. Telegram acts as a blob store and only receives ciphertext.
- **Account-Free Downloading**: Receivers navigate to `https://<app>/d/<code>` or enter an 8-character unambiguous code on the homepage.
- **Dual Key Model**:
  - **No Password**: 256-bit AES key is placed in the URL fragment (`#k=<key>`), never sent to the server.
  - **Password Protected**: Derived using PBKDF2 (600,000 iterations). Server-side verifier uses a separated domain context and cannot decrypt files.
- **High Performance Upload Engine**: 3 parallel chunk worker pool, Telegram 429 `retry_after` awareness, exponential backoff with jitter, pause/resume/cancel, real-time speed & ETA.
- **Streaming Decryption**: Chunk-by-chunk streaming download with direct disk save via the **File System Access API** (fallback to Blob download).
- **Hardened Security**: Strict CSP, HSTS, brute-force locks, salted IP hashing, atomic download counters (burn after 1 download), soft-delete with 7-day trash and Telegram `deleteMessage` purge.

---

## 🛠 Tech Stack

- **Client**: React 18, Vite, TypeScript, Tailwind CSS, Zustand, React Router 7, TanStack Query, Web Crypto API, Web Workers, QR Code generator, PWA.
- **Server**: Node.js, Express, TypeScript, Prisma ORM (PostgreSQL / SQLite), Google Auth Library, Helmet, Rate Limiter, Pino logging, Node-Cron.

---

## 📁 Repository Structure

```
sendikko/
├── client/           # React 18 + Vite + TypeScript frontend
├── server/           # Express + Prisma + Telegram service backend
├── docs/             # Comprehensive documentation:
│   ├── ARCHITECTURE.md
│   ├── THREAT_MODEL.md
│   ├── FOLDER_TREE.md
│   ├── SETUP_GUIDE.md
│   ├── DATABASE.md
│   ├── API_SPEC.md
│   ├── DEPLOYMENT.md
│   └── SECURITY_CHECKLIST.md
├── tests/            # Crypto, chunking, and API integration test suite
├── docker-compose.yml
└── package.json
```

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js >= 18
- Docker & Docker Compose (for local PostgreSQL)

### 2. Configure Environment
```bash
cp .env.example server/.env
cp client/.env.example client/.env
```
Follow [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) to set your Telegram Bot token and Google Client ID.

### 3. Start Database (Docker)
```bash
docker-compose up -d postgres
```

### 4. Install Dependencies & Migrate
```bash
# In /server
cd server
npm install
npx prisma db push

# In /client
cd ../client
npm install
```

### 5. Run Development Servers
```bash
# Terminal 1: Backend (Port 4000)
cd server && npm run dev

# Terminal 2: Frontend (Port 5173)
cd client && npm run dev
```

### 6. Run Test Suite
```bash
npm test
```
All 8 cryptographic, chunking, and API tests will run and verify zero-knowledge assertions.
