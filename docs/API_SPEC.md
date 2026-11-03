# Sendikko REST API Specification (v1)

Base URL: `/api/v1`
Standard Error Format:
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Human readable error description",
    "details": {}
  }
}
```

---

## Route Summary Table

| Method | Path | Auth | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/google` | Public | 20 / 15m | Exchange Google ID token for access JWT & refresh cookie |
| `POST` | `/auth/refresh` | Cookie | 60 / 15m | Refresh expired access JWT via rotating refresh token |
| `POST` | `/auth/logout` | Auth | None | Invalidate refresh token and clear cookies |
| `GET` | `/me` | Auth | None | Fetch authenticated user profile & quota |
| `GET` | `/me/files` | Auth | None | List uploaded files (search, sort, filter, pagination) |
| `GET` | `/me/stats` | Auth | None | Aggregated storage usage, file count, and download count |
| `POST` | `/uploads` | Auth | 60 / 15m | Initialize chunked upload session |
| `PUT` | `/uploads/:id/chunks/:n` | Auth | 1200 / 15m| Upload encrypted chunk `n` (supports `Idempotency-Key`) |
| `POST` | `/uploads/:id/complete` | Auth | 60 / 15m | Finalize upload session, activate file, return 8-char code |
| `GET` | `/files/:code` | Public | 120 / 15m | Get safe public file metadata |
| `POST` | `/files/:code/unlock` | Public | 10 / 15m | Verify password and issue short-lived download token |
| `GET` | `/files/:code/chunks/:n` | Token / Public | 1200 / 15m| Stream chunk `n` from Telegram (supports HTTP `Range`) |
| `PATCH` | `/files/:id` | Auth (Owner) | 60 / 15m | Rename, update password, expiry, download limit |
| `POST` | `/files/:id/regenerate-code`| Auth (Owner) | 30 / 15m | Invalidate old code and generate new 8-char code |
| `DELETE`| `/files/:id` | Auth (Owner) | 60 / 15m | Soft delete file to trash (7-day retention) |
| `POST` | `/files/:id/restore` | Auth (Owner) | 60 / 15m | Restore file from trash |
| `DELETE`| `/files/:id/permanent` | Auth (Owner) | 60 / 15m | Permanently delete file and purge Telegram blobs |
| `POST` | `/files/:code/report` | Public | 5 / 1h | Submit abuse/malware flag for review |
| `GET` | `/health` | Public | None | Server health check and Telegram Bot connectivity status |

---

## Detailed Endpoint Contracts

### 1. `POST /api/v1/auth/google`
**Request Body**:
```json
{
  "idToken": "eyJhbGciOiJSUzI1Ni..."
}
```
**Response (200 OK)**:
```json
{
  "user": {
    "id": "e0b96901-77b3-4682-824f-ef7cf03db745",
    "email": "user@example.com",
    "name": "Jane Doe",
    "avatarUrl": "https://lh3.googleusercontent.com/...",
    "quotaBytes": 10737418240,
    "usedBytes": 52428800
  },
  "accessToken": "eyJhbGciOi..."
}
```

### 2. `POST /api/v1/uploads`
**Request Body**:
```json
{
  "nameEnc": "U2FsdGVkX19...",
  "mimeEnc": "application/pdf",
  "size": 52428800,
  "chunkCount": 3,
  "chunkSize": 19922944,
  "pwVerifier": "optional_pbkdf2_verifier_hex",
  "pwSalt": "optional_salt_hex",
  "kdfParams": { "algorithm": "PBKDF2", "iterations": 600000 },
  "expiresInSeconds": 86400,
  "maxDownloads": 5
}
```
**Response (201 Created)**:
```json
{
  "uploadId": "c92d5258-757e-4ee0-8806-a83151eb0d72",
  "expiresAt": "2026-11-04T16:40:00.000Z"
}
```

### 3. `PUT /api/v1/uploads/:id/chunks/:n`
**Headers**:
- `Content-Type: multipart/form-data` or `application/octet-stream`
- `Idempotency-Key: <unique-uuid-or-sha256>`
- `X-Chunk-IV: <hex_iv>`
- `X-Chunk-SHA256: <hex_sha256>`
- `X-Chunk-Size: <bytes>`

**Response (200 OK)**:
```json
{
  "idx": 0,
  "size": 19922944,
  "received": true
}
```

### 4. `POST /api/v1/uploads/:id/complete`
**Response (200 OK)**:
```json
{
  "code": "7K9N3W2X",
  "shareUrl": "https://sendikko.app/d/7K9N3W2X",
  "fileId": "6c4b9d03-e18e-4a81-bdf4-f58c7042a498"
}
```

### 5. `GET /api/v1/files/:code`
**Response (200 OK)**:
```json
{
  "code": "7K9N3W2X",
  "nameEnc": "U2FsdGVk...",
  "size": 52428800,
  "chunkCount": 3,
  "chunkSize": 19922944,
  "passwordRequired": true,
  "expiresAt": "2026-11-04T16:40:00.000Z",
  "uploaderName": "Jane D."
}
```

### 6. `POST /api/v1/files/:code/unlock`
**Request Body**:
```json
{
  "password": "user_entered_password"
}
```
**Response (200 OK)**:
```json
{
  "downloadToken": "eyJhbGciOi...",
  "expiresIn": 900
}
```
