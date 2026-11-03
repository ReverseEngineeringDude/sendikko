# Sendikko Database Specification & Schema

## 1. Relational Schema Architecture (PostgreSQL)

```sql
-- Create ENUM for File Status
CREATE TYPE file_status AS ENUM ('uploading', 'active', 'expired', 'disabled', 'trashed');

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_sub VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    quota_bytes BIGINT NOT NULL DEFAULT 10737418240, -- 10 GB default
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Files Table
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(16) NOT NULL UNIQUE,
    name_enc TEXT NOT NULL,
    mime_enc VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
    size BIGINT NOT NULL,
    chunk_count INTEGER NOT NULL,
    chunk_size INTEGER NOT NULL DEFAULT 19922944, -- 19 MB in bytes
    pw_verifier TEXT,                             -- Argon2id or PBKDF2 hash of client password
    pw_salt VARCHAR(64),                         -- Salt used for verifier derivation
    kdf_params JSONB,                            -- { "algorithm": "PBKDF2", "iterations": 600000, "hash": "SHA-256" }
    expires_at TIMESTAMP WITH TIME ZONE,
    max_downloads INTEGER,                       -- Null for unlimited, or e.g. 1 for "burn after reading"
    download_count INTEGER NOT NULL DEFAULT 0,
    status file_status NOT NULL DEFAULT 'uploading',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE          -- Soft delete / Trash timestamp
);

-- Chunks Table
CREATE TABLE chunks (
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    tg_message_id BIGINT NOT NULL,
    tg_file_id_enc TEXT NOT NULL,                -- Encrypted with server CHUNK_ENC_KEY
    size INTEGER NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    iv VARCHAR(64) NOT NULL,                     -- 96-bit AES-GCM IV in hex
    PRIMARY KEY(file_id, idx)
);

-- Upload Sessions Table
CREATE TABLE upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    state VARCHAR(50) NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'aborted'
    last_chunk INTEGER NOT NULL DEFAULT -1,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Download Logs (Salted Hash IPs for Privacy)
CREATE TABLE download_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_hash VARCHAR(64) NOT NULL,
    ua_hash VARCHAR(64) NOT NULL
);

-- Reports (Abuse & Malware Flags)
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
);

-- Telegram Cleanup Retry Queue
CREATE TABLE telegram_cleanup_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tg_message_id BIGINT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- High Performance Indexes
CREATE INDEX idx_files_code ON files(code);
CREATE INDEX idx_files_owner_status ON files(owner_id, status);
CREATE INDEX idx_files_expires_at ON files(expires_at) WHERE status = 'active';
CREATE INDEX idx_chunks_file_id ON chunks(file_id);
CREATE INDEX idx_upload_sessions_file_id ON upload_sessions(file_id);
CREATE INDEX idx_download_logs_file_id ON download_logs(file_id);
```

---

## 2. Text Sequence Diagrams

### 2.1 Chunked Upload Sequence

```
User (Browser)               Sendikko Server               Telegram Channel & DB
     |                              |                                |
     |-- 1. Slice file into 19MB -->|                                |
     |-- 2. POST /uploads --------->|                                |
     |   (size, chunkCount, encMeta)|-- Create File & Session ------>|
     |<-- Return {uploadId} --------|                                |
     |                              |                                |
     |-- 3. In Web Worker:          |                                |
     |      Encrypt Chunk #i        |                                |
     |      (AES-256-GCM, IV, AAD)  |                                |
     |-- 4. PUT /uploads/:id/chunks/:i                               |
     |   (Encrypted blob + headers)-|                                |
     |                              |-- sendDocument(chunk_blob) --->| (Telegram)
     |                              |<-- {message_id, file_id} ------|
     |                              |-- INSERT INTO chunks --------->| (Database)
     |<-- 200 OK {idx, received} ---|                                |
     |                              |                                |
     |   [Repeat for Chunks 0..N-1 with 3 in parallel pool]          |
     |                              |                                |
     |-- 5. POST /uploads/:id/complete                              |
     |                              |-- Mark file 'active' --------->| (Database)
     |<-- 200 OK {code, shareUrl} --|                                |
     |                              |                                |
```

### 2.2 Chunked Download & Decrypt Sequence

```
Recipient Browser            Sendikko Server               Telegram Channel & DB
     |                              |                                |
     |-- 1. GET /files/:code ------>|                                |
     |<-- 200 Safe Metadata --------| (name, size, chunks, pwRequired)
     |                              |                                |
     | (If password protected):     |                                |
     |-- 2. POST /files/:code/unlock|                                |
     |      {password} ------------>|-- Verify password verifier ----|
     |<-- 200 {downloadToken} ------|                                |
     |                              |                                |
     |-- 3. Open FileSystem Stream  |                                |
     |   For chunk i = 0 to N-1:    |                                |
     |-- 4. GET /files/:code/chunks/:i                               |
     |      (Token / auth) -------->|-- Query chunks table --------->|
     |                              |-- Decrypt tg_file_id --------->|
     |                              |-- getFile / download stream -->| (Telegram)
     |<-- Stream chunk bytes -------|                                |
     |                              |                                |
     |-- 5. Web Worker:             |                                |
     |      Decrypt chunk (AES-GCM) |                                |
     |      Verify SHA-256 & Tag    |                                |
     |-- 6. Write chunk to stream ->| Disk (File System Access)      |
     |                              |                                |
     |<-- Complete file saved on recipient device -------------------|
```
