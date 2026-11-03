# Sendikko Architecture & Technical Specification

## 1. Executive Summary & Concept
**Sendikko** is a production-grade, zero-knowledge private file sharing web application.
- **Uploaders**: Authenticate via Google OAuth 2.0 (Google ID Token verified server-side). They upload any file type, optionally setting a password, expiry duration (1h, 1d, 7d, 30d, never), and download limits (e.g. burn after 1 download).
- **Receivers**: Require zero authentication or account. They navigate to `https://<app>/d/<code>` or enter an 8-character unique alphanumeric code on the homepage.
- **Zero-Knowledge Encryption**: The browser splits files into chunks (~19 MB by default), encrypts each chunk locally with **AES-256-GCM** using a unique 96-bit IV per chunk and binds the chunk index as Additional Authenticated Data (AAD). The encryption key is derived either from a password (via PBKDF2 / Argon2id) or generated randomly and appended to the URL fragment (`#k=<hex_key>`). URL fragments are *never* transmitted to any server over HTTP.
- **Blob Storage Architecture**: Telegram channels act as an encrypted chunk blob store. Standard Telegram Bot API caps uploads at 50 MB and `getFile` downloads at 20 MB. Sendikko bypasses standard file limits by streaming encrypted 19 MB chunks into a private Telegram channel via `sendDocument` and retrieving them via `getFile`. A metadata database maps file codes to chunk metadata and Telegram message IDs. Telegram receives only AES-256-GCM ciphertext.

---

## 2. Key Assumptions & Constraints
1. **Zero-Knowledge Guarantee**: Neither the backend server nor Telegram can inspect the file contents, file names, or MIME types when encrypted.
2. **Standard vs. Self-Hosted Telegram Bot API**:
   - Standard Bot API: 20 MB download limit per `getFile`. Default chunk size is **19 MB** (`19 * 1024 * 1024` bytes) to guarantee safety under the 20 MB ceiling.
   - Self-hosted Bot API: Enables up to 2 GB chunks if `TELEGRAM_API_ROOT` is configured.
3. **Database Role**: PostgreSQL (Supabase or self-hosted) / SQLite stores only structural metadata (UUIDs, 8-character codes, encrypted chunk references, hashes, verifiers, expiry timestamps).
4. **Download Streaming**: Files are streamed chunk-by-chunk directly to the user's browser without ever buffering the complete file in backend RAM or on disk. Decryption is performed in streaming chunks using Web Workers and saved using the **File System Access API** (with fallback to memory streaming / StreamSaver).

---

## 3. System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT BROWSER                                    |
|                                                                                   |
|  [React 18 + Vite + TS]   <-->   [Web Worker Pool]                                 |
|   - Zustand Store                 - AES-256-GCM Encrypt / Decrypt                 |
|   - File Slicer (19MB chunks)     - SHA-256 Checksumming                          |
|   - File System Access Stream     - PBKDF2 / Argon2id Key Derivation              |
+--------------------------+--------------------------------+-----------------------+
                           |                                |
             HTTPS REST    | Upload Chunks                  | Stream Chunks
             /api/v1       | (3 in parallel)                | (HTTP Range supported)
                           v                                v
+-----------------------------------------------------------------------------------+
|                              EXPRESS BACKEND (Node.js)                            |
|                                                                                   |
|   - Google ID Token Auth & Rotating JWT Sessions                                  |
|   - Rate Limiting (IP + Code, Exponential Backoff)                               |
|   - Input Validation (Zod) & Security Headers (Helmet, CSP)                       |
|   - Telegram Bot Service (429 Retry-After, Idempotency)                           |
|   - Node-Cron (Purge trash, expire files, Telegram deleteMessage queue)          |
+--------------------------+--------------------------------+-----------------------+
                           |                                |
       Prisma ORM Queries  |                                | Telegram Bot API
                           v                                v
       +-----------------------+                +-------------------------+
       |   POSTGRESQL / SQLITE |                |     TELEGRAM SERVERS    |
       |  - users              |                |   (Private Channel)     |
       |  - files              |                |  - Encrypted Chunk #0   |
       |  - chunks             |                |  - Encrypted Chunk #1   |
       |  - upload_sessions    |                |  - Encrypted Chunk #n   |
       |  - download_logs      |                |                         |
       |  - reports            |                +-------------------------+
       +-----------------------+
```
