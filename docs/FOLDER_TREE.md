# Sendikko Project Folder Structure

```
sendikko/
├── client/                                # React 18 + Vite + TypeScript Frontend
│   ├── public/
│   │   ├── favicon.ico
│   │   ├── logo.svg
│   │   ├── manifest.json                  # PWA Web App Manifest
│   │   └── robots.txt
│   ├── src/
│   │   ├── assets/                        # SVG icons and illustrations
│   │   ├── components/                    # Reusable UI & Business components
│   │   │   ├── ui/                        # Radix UI primitives styled with Tailwind
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Dialog.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Progress.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── DropdownMenu.tsx
│   │   │   │   └── Toast.tsx
│   │   │   ├── Navbar.tsx                 # Top navigation with user profile / sign-in
│   │   │   ├── Footer.tsx                 # Responsive footer
│   │   │   ├── Dropzone.tsx               # Drag-and-drop multi-file upload box
│   │   │   ├── UploadModal.tsx            # Active upload queue & progress modal
│   │   │   ├── ShareResultModal.tsx       # Share link, 8-char code, copy, Web Share
│   │   │   ├── QRCodeModal.tsx            # Dynamic QR code modal for scanning
│   │   │   ├── StatsModal.tsx             # Storage usage and analytics modal
│   │   │   └── TrashModal.tsx             # Trash list & restore dialog
│   │   ├── hooks/                         # Custom React hooks
│   │   │   ├── useAuth.ts                 # Auth state & Google login hook
│   │   │   ├── useFileUpload.ts           # Upload orchestration hook
│   │   │   └── useFileDownload.ts         # Download & streaming decryption hook
│   │   ├── pages/                         # Application pages / views
│   │   │   ├── HomePage.tsx               # Landing page, quick dropzone & code entry
│   │   │   ├── DownloadPage.tsx           # /d/:code download & decrypt screen
│   │   │   ├── DashboardPage.tsx          # /dashboard My Files manager
│   │   │   └── RequestFilesPage.tsx       # /request/:userId public inbox drop
│   │   ├── services/                      # Client network and engine services
│   │   │   ├── api.ts                     # Axios client with interceptors
│   │   │   ├── crypto.client.ts           # Client-side Web Worker crypto adapter
│   │   │   ├── upload.engine.ts           # Chunk slicer, parallel pool & retry
│   │   │   └── download.engine.ts         # Chunk fetcher, worker decrypt & stream save
│   │   ├── stores/                        # Zustand global state stores
│   │   │   ├── auth.store.ts              # Authentication & user profile state
│   │   │   ├── upload.store.ts            # Active upload queue, progress, pause/resume
│   │   │   └── theme.store.ts             # Dark / Light / System theme state
│   │   ├── types/                         # Shared frontend TypeScript interfaces
│   │   │   └── index.ts
│   │   ├── workers/                       # Dedicated Web Workers
│   │   │   └── crypto.worker.ts           # AES-256-GCM chunk enc/dec & PBKDF2/Argon2
│   │   ├── App.tsx                        # Main router and layout wrapper
│   │   ├── index.css                      # Tailwind base & custom utility classes
│   │   └── main.tsx                       # React DOM entry point
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                                # Node.js + Express + TypeScript Backend
│   ├── prisma/
│   │   └── schema.prisma                  # Prisma ORM schema (Postgres & SQLite ready)
│   ├── src/
│   │   ├── config/                        # Environment configuration and validation
│   │   │   └── index.ts                   # Zod validated configuration schema
│   │   ├── middleware/                    # Express middleware
│   │   │   ├── auth.ts                    # JWT verification & owner assertion
│   │   │   ├── errorHandler.ts            # Global formatted error handler
│   │   │   ├── rateLimiter.ts             # express-rate-limit & brute force guards
│   │   │   └── validate.ts                # Zod request schema validation middleware
│   │   ├── routes/                        # REST API endpoint handlers
│   │   │   ├── auth.routes.ts             # /api/v1/auth
│   │   │   ├── upload.routes.ts           # /api/v1/uploads
│   │   │   ├── file.routes.ts             # /api/v1/files
│   │   │   └── user.routes.ts             # /api/v1/me
│   │   ├── services/                      # Core business logic services
│   │   │   ├── telegram.service.ts        # Telegram Bot API chunk streaming & retry
│   │   │   ├── auth.service.ts            # Google token verify & JWT issuance
│   │   │   ├── crypto.service.ts          # Server secrets & IP hash utilities
│   │   │   └── cron.service.ts            # node-cron scheduled cleanup jobs
│   │   ├── types/                         # Server TypeScript definitions
│   │   │   └── index.ts
│   │   ├── utils/                         # Helper utilities
│   │   │   ├── codeGenerator.ts           # Unambiguous 8-char crypto code generator
│   │   │   └── logger.ts                  # Pino structured JSON logger
│   │   ├── app.ts                         # Express app builder and middleware stack
│   │   └── server.ts                      # Server bootstrap and graceful shutdown
│   ├── package.json
│   └── tsconfig.json
│
├── docs/                                  # Documentation & Architecture Specifications
│   ├── ARCHITECTURE.md
│   ├── THREAT_MODEL.md
│   ├── FOLDER_TREE.md
│   ├── SETUP_GUIDE.md
│   ├── DATABASE.md
│   ├── API_SPEC.md
│   └── DEPLOYMENT.md
│
├── tests/                                 # Unit & Integration Tests
│   ├── crypto.test.ts                     # AES-256-GCM chunk integrity tests
│   ├── chunking.test.ts                   # Blob slicing and boundary verification
│   └── api.test.ts                        # Express API route integration tests
│
├── docker-compose.yml                     # Local development stack (App + Postgres)
├── .env.example                           # Root / Server environment configuration
└── README.md                              # Master overview and quickstart
```
