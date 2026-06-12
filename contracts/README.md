# Oryn Contract Management System

Firebase-based contract generation, electronic acceptance, and signed-contract management for [orynsolutions.io](https://orynsolutions.io).

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router) in `/contracts` |
| Backend | Firebase Cloud Functions in `/firebase/functions` |
| Database | Cloud Firestore |
| Storage | Firebase Storage |
| Auth | Firebase Authentication (admin only) |
| Email | Resend via Cloud Functions |
| PDF | pdf-lib (server-side) |

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/admin/contracts` | Admin | Dashboard — list, search, filter |
| `/admin/contracts/new` | Admin | Create contract |
| `/admin/contracts/[id]` | Admin | Contract detail + audit |
| `/admin/contracts/[id]/edit` | Admin | Edit draft only |
| `/admin/contracts/[id]/renew` | Admin | Renew signed contract |
| `/sign/[token]` | Public (token) | Customer signing page |

## Stripe Onboarding Fee Payment Link

Admins paste a **Stripe Payment Link** (e.g. `https://buy.stripe.com/...`) when creating a contract. The link is:

- Stored on the contract as `onboardingFeePaymentLink`
- Included in the signing email sent to the customer
- Shown prominently on the public `/sign/[token]` page with a **Pay Onboarding Fee** button

Create payment links in [Stripe Dashboard → Payment Links](https://dashboard.stripe.com/payment-links).

## Setup

### 1. Firebase project

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login

# Create project (or use existing)
firebase projects:create oryn-contracts

# From repo root
cd firebase
firebase use oryn-contracts
```

Enable in Firebase Console:

- **Authentication** → Email/Password
- **Firestore** → Production mode
- **Storage**
- **Functions** (Blaze plan required for external APIs / Resend)

### 2. Admin users

Set admin emails (comma-separated):

```bash
firebase functions:config:set admin.emails="you@orynsolutions.io"
```

Or use environment variables (Functions v2 — recommended):

```bash
# firebase/functions/.env (for local) or Firebase Console → Functions → Environment variables
ADMIN_EMAILS=you@orynsolutions.io
```

Create the admin user in Firebase Auth, then set custom claim:

```bash
# After first login, run from a one-off script or Cloud Function:
# auth.setCustomUserClaims(uid, { admin: true })
```

The `requireAdmin` callable also checks `ADMIN_EMAILS` as a fallback.

### 3. Environment variables

**Cloud Functions** (`firebase/functions/.env` or Firebase Console):

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Sender address (verified domain) |
| `ADMIN_NOTIFY_EMAIL` | Admin notification recipient |
| `ADMIN_EMAILS` | Comma-separated admin emails |
| `APP_BASE_URL` | e.g. `https://orynsolutions.io` |
| `SIGNING_BASE_URL` | Base URL for signing links |
| `TOKEN_EXPIRY_DAYS` | Signing link expiry (default 30) |

**Next.js** (`contracts/.env.local`):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web app config |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | `true` for local emulators |

Copy examples:

```bash
cp contracts/.env.local.example contracts/.env.local
cp firebase/functions/.env.example firebase/functions/.env
```

### 4. Install & run locally

```bash
# Frontend
cd contracts
npm install
npm run dev

# Functions (separate terminal)
cd firebase/functions
npm install
npm run build

# Emulators (from firebase/)
cd firebase
firebase emulators:start
```

Frontend: http://localhost:3000  
Emulator UI: http://localhost:4000

### 5. Deploy

```bash
# Deploy rules + functions
cd firebase
firebase deploy --only firestore:rules,storage,functions

# Build & deploy frontend (Firebase Hosting or Vercel)
cd ../contracts
npm run build
# For static export + Firebase Hosting, add output: 'export' to next.config.ts
firebase deploy --only hosting
```

For production, deploy the Next.js app to **Vercel** or **Firebase App Hosting** and set `SIGNING_BASE_URL` to your deployed URL.

## Security

- Signing tokens: 64-char hex, **only SHA-256 hash** stored in Firestore
- Firestore/Storage rules deny all client reads on contract data
- Customers access contracts only via `getContractByToken` / `acceptContract` callables
- Admin enforced server-side in every admin callable
- Signed contracts are immutable; signed PDFs cannot be overwritten
- Contract fields sanitized before HTML/PDF rendering

## Firestore collections

- `contracts` — contract records
- `contractTemplates` — optional template versions
- `contractAcceptances` — signature audit records
- `auditLogs` — full event timeline
- `emails` — email send log

## Storage paths

```
/contracts/unsigned/{contractId}.pdf
/contracts/signed/{contractId}.pdf
/contracts/signatures/{contractId}.png
```

## Cloud Functions

| Function | Description |
|----------|-------------|
| `createContract` | Create draft or create + send |
| `updateDraftContract` | Update draft only |
| `sendContractEmail` | Send signing link + generate unsigned PDF |
| `resendContractEmail` | Resend signing link |
| `getContractByToken` | Public contract lookup by token |
| `acceptContract` | Customer signs; generates signed PDF |
| `getSignedPdfDownloadUrl` | Admin signed/unsigned PDF URL |
| `emailSignedCopy` | Email signed PDF to client or admin |
| `renewContract` | Copy to new draft with `originalContractId` |
| `cancelContract` | Cancel unsigned contract |
| `previewContract` | Preview rendered contract text |
| `listContracts` | Admin list with filter/search |
| `getContractDetail` | Admin detail + audit + emails |

## Project structure

```
ORYN_webpage/
├── contracts/          # Next.js admin + signing UI
├── firebase/
│   ├── functions/      # Cloud Functions (TypeScript)
│   ├── firestore.rules
│   ├── storage.rules
│   └── firebase.json
└── (static site HTML)  # Existing orynsolutions.io pages
```
