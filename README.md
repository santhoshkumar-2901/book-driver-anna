# Book Driver Anna (BDA)

Namma Bengaluru's premier driver booking, vehicle rental, and doorstep driving school platform. Built with a production-ready Node.js/Express REST backend, flexible database layer (SQLite WAL or TiDB Cloud Serverless MySQL), and a responsive React + Vite frontend.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Operating System**: Linux, macOS, or Windows (WSL recommended)

---

## Quick Start

### 1. Installation

```bash
# Clone repository
git clone https://github.com/your-org/book-driver-anna.git
cd book-driver-anna

# Install dependencies
npm install
```

### 2. Environment Configuration

Copy the sample environment file and configure secrets:

```bash
cp .env.example .env
```

Edit `.env` to set your secrets. For local development, minimum required keys are pre-configured, but for production, generate strong random strings:

```bash
# Generate 256-bit secrets for production
openssl rand -base64 32
```

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite frontend dev server at `http://localhost:5173` |
| `npm run server` | Starts Express REST API backend at `http://localhost:5000` |
| `npm test` | Runs the automated test suite against isolated SQLite test DB |
| `npm run build` | Compiles production frontend bundle into `dist/` |
| `npm run preview` | Previews the production build locally via Vite |
| `npm run bootstrap:admin` | Standalone CLI script to create verified production admin accounts |

---

## Production Readiness & Security Controls

### 1. Zero-Demo Database & Seed Protection
- The database starts completely empty with 0 demo accounts or mock bookings across all environments (development, test, and production).
- In production (`NODE_ENV=production`), automatic seeding is strictly disabled by default (overrideable via `ALLOW_DB_SEED=true`).
- Administrator accounts—whether in local development or production—must be created explicitly via the standalone CLI script (`npm run bootstrap:admin`) with a secure password.

### 2. Production Admin Account Bootstrapping
To create an administrator account in production, run the standalone bootstrap script:

```bash
npm run bootstrap:admin -- \
  --email "admin@yourdomain.com" \
  --password "YourStrongProdPassword2026!" \
  --name "Lead Admin" \
  --phone "+91 98765 00000" \
  --area "Indiranagar"
```

Or provide credentials via environment variables:

```bash
BOOTSTRAP_ADMIN_EMAIL="admin@yourdomain.com" \
BOOTSTRAP_ADMIN_PASSWORD="YourStrongProdPassword2026!" \
npm run bootstrap:admin
```

**Security Rules Enforced by the Bootstrap Script:**
- Minimum password length: 8 characters.
- Insecure/default passwords (such as `admin123`, `password123`, `admin`) are strictly rejected.
- Passwords are encrypted using salted `bcrypt` (10 rounds).
- Re-running the script with an existing admin email is idempotent.

### 3. Content Security Policy (CSP)
The backend API enforces a tightened Content Security Policy via Helmet:
- **`scriptSrc`**: Restricted strictly to `['self']`. Dynamic code execution (`'unsafe-eval'`) and inline scripts (`'unsafe-inline'`) are disallowed.
- **`connectSrc`**: Restricted to authorized origins (`'self'`, local dev servers, Vercel deployments, and Google Gemini API).
- **`imgSrc`**: Restricted to `'self'`, `data:`, `blob:`, and trusted image CDN (`https://images.unsplash.com`).

### 4. Gemini AI Chatbot Architecture
- The chatbot interface queries `/api/chat` (Express backend proxy).
- `GEMINI_API_KEY` is loaded from server environment variables and is **never** bundled or exposed to client browsers.
- If no Gemini API key is configured, the service falls back gracefully to a curated offline assistant engine.

### 5. Production Environment Variables

| Variable | Required | Description |
| :--- | :--- | :--- |
| `PORT` | Optional | Port for Express server (default: `5000`) |
| `NODE_ENV` | Optional | `'development'`, `'production'`, or `'test'` |
| `JWT_SECRET` | **YES** | Cryptographic secret for signing JWTs (server will fail to boot without it) |
| `ADMIN_REGISTRATION_SECRET` | **YES** | Secret key for administrative operations (server will fail to boot without it) |
| `DATABASE_URL` | Optional | TiDB Cloud serverless connection URL. If empty, local SQLite WAL is used |
| `DB_PATH` | Optional | SQLite database path (default: `./bda_database.sqlite`) |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for Anna AI Chatbot |
| `CORS_ORIGIN` | Optional | Comma-separated list of allowed origins |
| `ALLOW_DB_SEED` | Optional | Set to `'true'` to force database seeding in production |

---

## Testing & Quality Assurance

Run the automated test suite:

```bash
npm test
```

The test runner utilizes Node.js native test runner (`node:test`) with SQLite concurrency isolation:
- Authentication & Password Security Tests (bcrypt hashing, HttpOnly cookies, duplicate rejection)
- Booking Security & Concurrency (server-side price tampering defense, past date rejection, slot locking, idempotency)
- User Booking Isolation (ensures users only view their own bookings)
- Role-Based Access Control (RBAC) & Ownership Enforcement
- Driver Portal Isolation & Admin Duty Tracking
- Production Seed Gating & Bootstrap Admin Verification
