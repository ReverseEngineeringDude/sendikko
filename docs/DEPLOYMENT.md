# Sendikko Deployment Guide: Firebase + Supabase + Render

This deployment guide configures Sendikko with:
- **Authentication**: Firebase Authentication (Google Sign-In)
- **Metadata Database**: Supabase (PostgreSQL with PgBouncer connection pooling)
- **Backend Host**: Render (Node.js Web Service)
- **Blob Store**: Telegram Bot API (Private Channel)
- **Frontend Host**: Vercel / Netlify

---

## 1. Firebase Authentication Setup

Sendikko uses Firebase Auth on the client to initiate Google Sign-In and verifies the Firebase ID token securely on the backend.

### Step 1.1: Create Project & Enable Google Sign-In
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project (e.g. `sendikko-app`).
2. Navigate to **Build** -> **Authentication** -> **Get Started**.
3. Under the **Sign-in method** tab, click **Google**, toggle **Enable**, and set your project support email. Click **Save**.
4. In the **Authorized domains** list, ensure:
   - `localhost` is listed for local development.
   - Your production frontend domain (e.g. `your-sendikko.vercel.app`) is added.

### Step 1.2: Register Web App
1. Go to **Project Settings** -> **General** -> Under *Your apps*, click the **Web (</>)** icon.
2. Register app name: `Sendikko Web`.
3. Copy the `firebaseConfig` keys and place them in `client/.env`:
   ```env
   VITE_FIREBASE_API_KEY="AIzaSy..."
   VITE_FIREBASE_AUTH_DOMAIN="sendikko-app.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="sendikko-app"
   VITE_FIREBASE_STORAGE_BUCKET="sendikko-app.appspot.com"
   VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
   VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef..."
   ```

---

## 2. Supabase PostgreSQL Metadata Store Setup

Sendikko uses Supabase to persist user profiles, 8-character codes, chunk indexes, and Telegram message IDs.

### Step 2.1: Get Connection Strings
1. In [Supabase](https://supabase.com/), open your project and go to **Project Settings** -> **Database**.
2. Under **Connection string**, select **URI**:
   - **Mode: Transaction (Port 6543)** -> This is your `DATABASE_URL`:
     ```
     postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
   - **Mode: Session / Direct (Port 5432)** -> This is your `DIRECT_URL` (used by Prisma migrations):
     ```
     postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
     ```

### Step 2.2: Apply Migrations to Supabase
From your local terminal, run Prisma push pointing to Supabase:
```bash
cd server
DATABASE_URL="<your_transaction_url>" DIRECT_URL="<your_direct_url>" npx prisma db push
```
All tables (`users`, `files`, `chunks`, `upload_sessions`, `download_logs`, `reports`) will be created instantly.

---

## 3. Deploying the Backend on Render

The repository includes a ready-to-use [`render.yaml`](file:///home/red/Documents/Projects/sendikko/render.yaml) blueprint.

### Option A: Deploy via Blueprint (Fastest)
1. Push your code to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New** -> **Blueprint**.
3. Select your repository. Render will automatically read `render.yaml`.
4. Fill in the prompted secret variables:
   - `DATABASE_URL`: Your Supabase Transaction pooler URL (port 6543).
   - `DIRECT_URL`: Your Supabase direct connection URL (port 5432).
   - `CHUNK_ENC_KEY`: 64-character hex key (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - `TELEGRAM_BOT_TOKEN`: Token from `@BotFather`.
   - `TELEGRAM_CHANNEL_ID`: Channel ID (e.g. `-1001928374650`).
   - `FIREBASE_PROJECT_ID`: Your Firebase project ID (e.g. `sendikko-app`).
   - `CLIENT_URL`: Your frontend URL (e.g. `https://sendikko.vercel.app`).
5. Click **Apply**. Render will build and deploy the Node.js API with health checks active at `/health`.

### Option B: Deploy Manually as a Web Service
1. Click **New** -> **Web Service** -> Connect your repo.
2. Configure settings:
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
3. Add the environment variables from `server/.env.example`.

---

## 4. Frontend Deployment (Vercel)

1. In [Vercel](https://vercel.com), import the repository with Root Directory set to `client`.
2. Add the environment variables:
   ```env
   VITE_API_URL="https://sendikko-api.onrender.com/api/v1"
   VITE_FIREBASE_API_KEY="..."
   VITE_FIREBASE_AUTH_DOMAIN="..."
   VITE_FIREBASE_PROJECT_ID="..."
   VITE_FIREBASE_STORAGE_BUCKET="..."
   VITE_FIREBASE_MESSAGING_SENDER_ID="..."
   VITE_FIREBASE_APP_ID="..."
   ```
3. Deploy! Vercel will bundle the React client and PWA service workers.
