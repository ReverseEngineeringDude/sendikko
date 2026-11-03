# Sendikko Setup & Infrastructure Guide

This guide details the step-by-step setup required to connect Sendikko with Telegram's Bot API, Google OAuth 2.0, and Supabase / PostgreSQL.

---

## 1. Telegram Bot & Private Channel Setup

Sendikko uses a private Telegram channel as an encrypted chunk blob store. Your bot uploads encrypted chunks to the channel via `sendDocument` and downloads them via `getFile`.

### Step 1.1: Create a Bot with @BotFather
1. Open Telegram and search for [`@BotFather`](https://t.me/BotFather).
2. Start the conversation and send `/newbot`.
3. Choose a name for your bot (e.g. `Sendikko File Store`).
4. Choose a unique username ending in `bot` (e.g. `sendikko_storage_bot`).
5. **Save the HTTP API Token** returned by @BotFather. This is your `TELEGRAM_BOT_TOKEN`:
   ```
   123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
   ```

### Step 1.2: Create a Private Telegram Channel
1. In Telegram, create a **New Channel**.
2. Name it (e.g., `Sendikko Storage Vault`).
3. Set channel type to **Private**.
4. Do not add subscribers yet; click Create.

### Step 1.3: Add Bot as Administrator
1. Open the Channel info -> **Administrators** -> **Add Admin**.
2. Search for your bot username (`@sendikko_storage_bot`).
3. Grant administrator permissions:
   - **Post Messages**: Enabled
   - **Delete Messages**: Enabled
   - **Edit Messages**: Enabled (optional)
4. Confirm and save.

### Step 1.4: Obtain the Channel ID
Telegram channel IDs are negative integers, often starting with `-100`.
1. Send any test message in the channel (e.g. `test`).
2. Make a GET request to the Telegram Bot API in your browser or terminal:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/getUpdates"
   ```
3. Look for the `"channel_post"` object:
   ```json
   {
     "ok": true,
     "result": [
       {
         "update_id": 987654321,
         "channel_post": {
           "message_id": 1,
           "chat": {
             "id": -1001928374650,
             "title": "Sendikko Storage Vault",
             "type": "channel"
           }
         }
       }
     ]
   }
   ```
4. Copy the `id` field (including the `-100` prefix): `-1001928374650`. This is your `TELEGRAM_CHANNEL_ID`.
5. (Optional) Delete the test message.

---

## 2. Google OAuth 2.0 Setup

Sendikko uses Google ID tokens to sign in uploaders safely.

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one: `sendikko-auth`.
3. Go to **APIs & Services** -> **OAuth consent screen**:
   - User Type: **External**
   - App name: `Sendikko`
   - User support email & Developer contact info: your email
   - Scopes: `openid`, `email`, `profile`
4. Go to **Credentials** -> **Create Credentials** -> **OAuth Client ID**:
   - Application type: **Web application**
   - Name: `Sendikko Web Client`
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (Local frontend)
     - `https://your-domain.com` (Production)
   - **Authorized redirect URIs**:
     - `http://localhost:5173` (or popup flow origin)
5. Copy the generated **Client ID** (e.g. `1234567890-abc.apps.googleusercontent.com`).
   - Store as `GOOGLE_CLIENT_ID` in both `/server/.env` and `/client/.env`.

---

## 3. Database Setup: Supabase or Local PostgreSQL

### Option A: Supabase (Recommended Free Cloud Tier)
1. Sign up at [supabase.com](https://supabase.com/) and create a new project.
2. Under **Project Settings** -> **Database**, locate your **Connection String**.
3. Select **URI** (Node.js / Prisma mode) and copy the connection URL:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=1
   ```
4. Put this in `/server/.env` as `DATABASE_URL`.

### Option B: Local PostgreSQL via Docker Compose
Run the bundled `docker-compose.yml`:
```bash
docker-compose up -d postgres
```
Connection URL:
```
DATABASE_URL="postgresql://sendikko:sendikkosecret@localhost:5432/sendikkodb?schema=public"
```

---

## 4. Environment Variables Checklist

Generate secure random secrets:
```bash
# Generate 32-byte hex key for CHUNK_ENC_KEY (64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Populate `/server/.env`:
```env
NODE_ENV=development
PORT=4000
DATABASE_URL="postgresql://sendikko:sendikkosecret@localhost:5432/sendikkodb?schema=public"
JWT_ACCESS_SECRET="<random_secret_at_least_32_chars>"
JWT_REFRESH_SECRET="<random_secret_at_least_32_chars>"
COOKIE_SECRET="<random_secret_at_least_32_chars>"
CHUNK_ENC_KEY="<64_hex_chars_32_bytes>"
IP_SALT="<random_salt_16_chars>"

TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
TELEGRAM_CHANNEL_ID="-1001928374650"
TELEGRAM_API_ROOT="https://api.telegram.org"

GOOGLE_CLIENT_ID="1234567890-abc.apps.googleusercontent.com"
CLIENT_URL="http://localhost:5173"
CHUNK_SIZE_MB=19
```
