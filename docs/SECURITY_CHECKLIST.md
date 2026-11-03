# Sendikko Security Checklist & Known Limitations

## 1. Production Security Checklist

- [x] **Zero-Knowledge Encryption Verification**:
  - Chunks are sliced via `Blob.slice` and encrypted strictly in browser Web Workers using `AES-256-GCM`.
  - 96-bit crypto-random IV generated per chunk.
  - Chunk index bound as Additional Authenticated Data (`AAD`) preventing chunk reordering or injection attacks.
  - Decryption key resides strictly in the URL fragment (`#k=<hex_key>`) or derived from password via PBKDF2 (600,000 iterations). URL fragments are never sent in HTTP headers.
- [x] **Password Verifier Context Isolation**:
  - Server-side verifier is derived with a domain-separated salt prefix (`SENDIKKO_VERIFIER_DOMAIN_V1`).
  - The server verifier cannot be inverted or used to decrypt chunks stored on Telegram.
  - Constant-time comparison (`crypto.timingSafeEqual`) prevents timing oracle attacks.
- [x] **Token & Session Hardening**:
  - Google ID token signature and audience verified with `google-auth-library`.
  - Short-lived JWT access tokens (15 minutes).
  - Rotating refresh tokens stored in `httpOnly`, `Secure`, `SameSite=Strict` cookies.
  - Download tokens for password-protected files expire in 15 minutes.
- [x] **IDOR & Authorization**:
  - Every mutating file operation (`PATCH`, `DELETE`, `regenerate-code`) verifies `ownerId === req.user.id`.
- [x] **Rate Limiting & Abuse Prevention**:
  - Unlock rate limit: max 10 requests per 15 minutes per IP and code.
  - Brute force lockout: 5 consecutive failed password attempts trigger exponential cooldown.
  - 8-character codes use a 31-character unambiguous alphabet (excluding `0, O, 1, I, l`), yielding 852+ billion combinations.
  - Salted HMAC-SHA256 logging for client IP and User-Agent addresses. Raw IPs are never stored.
- [x] **HTTP Hardening**:
  - Strict Content Security Policy (CSP), frame-ancestors 'none', HSTS preload, X-Content-Type-Options: nosniff, Referrer-Policy: no-referrer.
  - File downloads served with `Content-Disposition: attachment; filename="..."`.

---

## 2. Known Limitations & Telegram Considerations

### 2.1 Telegram Bot API Rate Limits & Caps
- **Standard Bot API Limits**:
  - Max upload size via `sendDocument`: 50 MB.
  - Max download size via `getFile`: 20 MB.
  - **Sendikko Solution**: Slices all files into default 19 MB chunks. Files of any size (even 10+ GB) can be safely uploaded and downloaded.
  - **Rate Limits**: Telegram limits bots to ~30 messages per second across chats and 1 message per second to a single chat during bursts. Sendikko mitigates this with 3 parallel uploads per file session, automatic Telegram 429 `retry_after` detection, and exponential backoff with jitter.
- **Self-Hosted Bot API Server**:
  - To eliminate the 20 MB/50 MB chunk constraint and upload chunks up to 2 GB each, run a local Bot API server instance (`aiogram/telegram-bot-api`) and configure `TELEGRAM_API_ROOT`.

### 2.2 Telegram Terms of Service (ToS)
- Telegram provides bot storage for legitimate messaging and documents. While files uploaded to private channels remain accessible indefinitely, excessive automated multi-terabyte bulk traffic could risk bot token revocation by Telegram anti-abuse heuristics.
- Sendikko should be deployed in private channels where your bot is an administrator.

### 2.3 Database Dependency
- Because Telegram acts solely as a chunk blob store without relational awareness, the PostgreSQL database is the single source of truth for mapping file codes to Telegram message IDs and chunk IVs.
- **Mandatory Practice**: Maintain daily automated database dumps using `pg_dump`. Losing the database results in permanent loss of access to stored Telegram blobs.
