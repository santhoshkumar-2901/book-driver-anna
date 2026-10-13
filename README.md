# 🚗 Book Driver Anna

> A full-stack ride and driver-booking platform for Bengaluru — book acting drivers, rental vehicles and doorstep driving classes, with live driver tracking, server-side fare calculation and a complete admin console.

![Node](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![Database](https://img.shields.io/badge/DB-TiDB%20Cloud%20%7C%20SQLite-4479A1)
![License](https://img.shields.io/badge/License-MIT-green)

**Live website:** <https://bookdriveranna.com>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Application Routes](#application-routes)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Known Limitations & Roadmap](#known-limitations--roadmap)
- [License](#license)

---

## Overview

Book Driver Anna connects customers with verified drivers through three role-based experiences:

| Role | What they can do |
|------|------------------|
| **Customer** | Estimate fares, book services, track the assigned driver live, pay via UPI, cancel bookings, review history, trigger SOS |
| **Driver** | Register and log in, manage profile and UPI ID, go on/off duty, accept duties, update trip status, broadcast GPS location |
| **Admin** | Monitor metrics and an operational map, assign drivers, manage users/drivers, edit the pricing table, view diagnostics |

Every fare is **calculated on the server** from live database tariffs. The client never decides what a booking costs.

---

## Features

### Booking & Services
- **Three service categories:** acting drivers (hourly, one-way, airport drop, night party, outstation, monthly), vehicle rental (sedan, SUV, tempo traveller, bus, coach) and driving classes (beginner, refresher, own-car, automatic).
- **Server-authoritative pricing engine** with admin-editable tariffs and a one-click reset to defaults.
- **Distance, ETA and fare estimation** using OSRM road routing, including round-trip and outstation maps.
- **Booking lifecycle:** `PENDING → CONFIRMED → ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED` (or `CANCELLED`).
- **Idempotent booking creation** via `Idempotency-Key`, preventing duplicate bookings on retries.
- **Guest booking** with phone/ID lookup, plus a post-booking prompt to create an account.

### Maps & Realtime
- **Interactive Leaflet map** with location search, reverse geocoding, pickup/destination markers and route polylines.
- **Live driver tracking** over WebSockets, with a REST fallback for serverless deployments.
- **Driver-to-pickup and active-trip routes** drawn on the map.
- **Operational map** for admins showing live fleet activity.

### Payments & Safety
- **UPI payment flow** with deep links (GPay, PhonePe, Paytm) and a dynamic QR code generated from the driver's UPI ID.
- **End-ride QR flow** for drivers.
- **SOS emergency button** with one-tap helpline dialing.

### Admin Console
- Dashboard metrics, booking management (assign / update / delete), user and driver management, pricing management, class enrollments and system diagnostics.

### AI Assistant
- **"Anna AI" chatbot** powered by Google Gemini, proxied through the backend so the API key never reaches the browser. Falls back to a built-in offline responder when no key is configured or the API fails.

### Experience
- Responsive, mobile-hardened UI with light/dark theme switching.
- Code-split routes with lazy loading and vendor chunking for faster loads.
- Password reset by email (Gmail SMTP, with a Resend fallback).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite 6, Tailwind CSS 3, Leaflet / React-Leaflet, Lucide icons |
| **Backend** | Node.js 22+, Express 5 (ES modules) |
| **Realtime** | `ws` (WebSocket server, embedded or standalone) |
| **Database** | TiDB Cloud Serverless (production) / SQLite (local), behind one abstraction layer |
| **Auth** | JWT in HttpOnly cookies, bcrypt password hashing |
| **Security** | Helmet, CORS allowlist, `express-rate-limit`, input validation, RBAC |
| **Email** | Nodemailer (Gmail SMTP), Resend |
| **External services** | OSRM (routing), OpenStreetMap Nominatim (geocoding), Google Gemini (chatbot) |
| **Hosting** | Vercel (frontend + serverless API), Node host for the realtime service |

---

## Architecture

```
┌────────────────────┐        HTTPS /api/*         ┌─────────────────────────────┐
│  React SPA (Vite)  │ ──────────────────────────▶ │  Express API                │
│  Customer · Driver │                             │  routes → services → db     │
│  · Admin           │ ◀────────────────────────── │                             │
└─────────┬──────────┘                             └───────┬─────────┬───────────┘
          │                                                │         │
          │  WebSocket (live driver location)              │         │ proxied calls
          ▼                                                ▼         ▼
┌────────────────────┐   internal publish (secret)  ┌───────────┐  ┌──────────────────┐
│  Realtime Server   │ ◀─────────────────────────── │ TiDB Cloud│  │ OSRM · Nominatim │
│  (ws, port 5001)   │                              │ / SQLite  │  │ · Gemini         │
└────────────────────┘                              └───────────┘  └──────────────────┘
```

**Design notes**

- **Layered backend:** `routes/` handle HTTP, `services/` hold business logic, `middleware/` handles auth, RBAC, validation and rate limiting, `db/` abstracts TiDB and SQLite.
- **Provider abstraction:** routing and geocoding sit behind service classes with timeouts, bounded TTL caches and custom `User-Agent` headers, so providers can be swapped without touching the app.
- **Third-party calls are proxied** through the backend; the browser never calls OSRM, Nominatim or Gemini directly.
- **Serverless-friendly:** `api/index.js` exports the Express app for Vercel. Because serverless functions can't hold WebSockets, the realtime service runs as a persistent process and receives events through an authenticated HTTP publish endpoint.

---

## Getting Started

### Prerequisites

- **Node.js 22 or newer**
- npm
- *(Optional)* a TiDB Cloud Serverless database; SQLite is used automatically if `DATABASE_URL` is empty

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/book-driver-anna.git
cd book-driver-anna
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env
```

At minimum, set strong values for the two required secrets:

```bash
openssl rand -base64 32   # use for JWT_SECRET
openssl rand -base64 32   # use for ADMIN_REGISTRATION_SECRET
```

The server **refuses to start** without them. See [Environment Variables](#environment-variables).

### 3. Run the app

Open two terminals:

```bash
# Terminal 1: API (+ embedded realtime WebSocket server on :5001)
npm run server

# Terminal 2: Vite dev server on :5173 (proxies /api to :5000)
npm run dev
```

Visit **<http://localhost:5173>**.

On first run in development, the database is created and seeded automatically.

### 4. Create the first admin

Admin accounts are never created with default credentials. Bootstrap one explicitly:

```bash
npm run bootstrap:admin -- --email admin@example.com --password '<strong-password>' --phone 9876543210
```

You can also supply `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` and `BOOTSTRAP_ADMIN_PHONE` as environment variables. Common weak passwords are rejected.

---

## Environment Variables

Copy `.env.example` and adjust. Variables marked **Required** have no fallback.

| Variable | Required | Description |
|----------|:--------:|-------------|
| `JWT_SECRET` | ✅ | Secret for signing auth tokens (≥ 32 chars in production) |
| `ADMIN_REGISTRATION_SECRET` | ✅ | Secret used to bootstrap admin accounts (≥ 32 chars in production) |
| `DATABASE_URL` | Prod | TiDB Cloud connection URL. Leave empty locally to use SQLite |
| `DB_PATH` | | SQLite file path (default `./bda_database.sqlite`) |
| `NODE_ENV` | | `development`, `production` or `test` |
| `PORT` | | API port (default `5000`) |
| `JWT_EXPIRES_IN` | | Token lifetime (default `24h`) |
| `CORS_ORIGIN` | | Comma-separated allowed origins |
| `APP_URL` | | Public frontend URL, used in email links |
| `GEMINI_API_KEY` | | Enables the live Anna AI chatbot; offline fallback otherwise |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | | Gmail SMTP for password-reset emails |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | | Resend SMTP fallback |
| `OSRM_BASE_URL` | | Routing provider (default public OSRM) |
| `REALTIME_PORT` | | Realtime WebSocket port (default `5001`) |
| `REALTIME_SERVICE_URL` | | Realtime HTTP endpoint for serverless event publishing |
| `REALTIME_INTERNAL_SECRET` | | Shared secret authenticating internal publish calls |
| `VITE_REALTIME_URL` | | WebSocket URL used by the browser client |
| `DISABLE_EMBEDDED_REALTIME` | | Set `true` to skip the embedded WebSocket server |
| `ALLOW_DB_SEED` | | Set `true` to allow seeding in production (off by default) |

> ⚠️ Never commit `.env`. It is already listed in `.gitignore`.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the production frontend into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run server` / `npm start` | Start the Express API (serves `dist/` if present) |
| `npm run realtime` | Run the standalone realtime WebSocket server |
| `npm run bootstrap:admin` | Create the initial admin account |
| `npm run db:clean` | Clean database data |
| `npm run db:lockdown-legacy` | Lock down legacy accounts |
| `npm test` | Run the full automated test suite |

---

## Application Routes

| Path | Purpose |
|------|---------|
| `/` · `/services` · `/about` · `/contact` | Public pages |
| `/login` · `/signup` · `/forgot-password` | Customer authentication |
| `/driver/login` · `/driver/signup` | Driver authentication |
| `/driver/portal` · `/driver/profile` | Driver dashboard and profile |
| `/admin` | Admin console |

---

## API Reference

All endpoints are available under `/api`. Responses follow a consistent `{ success, ... }` / `{ success: false, error: { code, message } }` shape.

<details>
<summary><strong>Authentication</strong> <code>/api/auth</code></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Customer registration |
| POST | `/login` | Customer login |
| POST | `/driver-register` · `/driver-login` | Driver registration and login |
| POST | `/admin-register` · `/admin-login` | Admin registration (secret-gated) and login |
| POST | `/forgot-password` | Request a reset email |
| GET | `/verify-reset-token` | Validate a reset token |
| POST | `/reset-password` | Complete a password reset |
| POST | `/change-password` | Change password (authenticated) |
| GET | `/me` | Current user |
| POST | `/logout` | Clear the session cookie |

</details>

<details>
<summary><strong>Bookings</strong> <code>/api/bookings</code></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/fare-estimate`, `/estimate` | Authoritative fare estimate |
| POST | `/` | Create a booking (guest or authenticated) |
| GET | `/my` | Current user's bookings |
| POST | `/lookup` | Guest booking lookup |
| GET | `/:id` | Booking details (owner only) |
| GET | `/:id/driver-location` | Live driver location (owner only) |
| POST | `/:id/cancel` | Cancel a booking |
| POST | `/:id/complete` | Complete a trip |

</details>

<details>
<summary><strong>Drivers</strong> <code>/api/drivers</code></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List drivers |
| GET/PUT | `/me` | Driver profile |
| GET | `/available-duties` | Open duties |
| POST | `/duties/:id/accept` | Accept a duty |
| GET | `/duties` · `/history` | Active duties and trip history |
| PATCH | `/duties/:id/status` | Update trip status |
| GET/PUT | `/location` | Read or publish GPS location |

</details>

<details>
<summary><strong>Admin</strong> <code>/api/admin</code> (admin role only)</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/metrics` · `/diagnostics` | Dashboard metrics and system diagnostics |
| GET/PATCH/DELETE | `/bookings`, `/bookings/:id` | Manage bookings and assign drivers |
| GET/POST/DELETE | `/users`, `/drivers` | Manage users and drivers |
| GET/PUT | `/pricing` | View or update tariffs |
| POST | `/pricing/reset` | Reset tariffs to defaults |
| POST | `/system/clear-data` | Clear system data |

</details>

<details>
<summary><strong>Location, Pricing, Chat, Health</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/location/search` | Place search (Nominatim, South India bounded) |
| GET | `/api/location/reverse` | Reverse geocoding |
| GET | `/api/location/route` | Road route via OSRM |
| GET | `/api/pricing` | Public service pricing |
| POST | `/api/chat` | Anna AI chatbot |
| GET | `/api/health` | Minimal health check |

</details>

---

## Data Model

Six core tables, defined in [`server/db/schema.sql`](server/db/schema.sql):

| Table | Purpose |
|-------|---------|
| `users` | Accounts with role (`customer` / `driver` / `admin`) and status |
| `drivers` | Driver profile, licence, UPI ID, duty status and last known GPS position |
| `bookings` | Bookings with coordinates, fare, status, assigned driver and idempotency key |
| `service_pricing` | Admin-editable tariff table |
| `password_reset_tokens` | Hashed, expiring, single-use reset tokens |
| `audit_logs` | Audit trail of sensitive actions |

---

## Security

Security was treated as a first-class concern and has been hardened over multiple phases:

- **No fallback secrets.** The server won't boot without `JWT_SECRET` and `ADMIN_REGISTRATION_SECRET`, and enforces minimum lengths in production.
- **HttpOnly, `SameSite` cookies** carry the session (`Secure` + `Strict` in production). Tokens are not stored in `localStorage`.
- **Role-based access control** (`requireRole`) plus booking **ownership checks** on every protected resource.
- **Helmet** with a Content Security Policy, anti-clickjacking and MIME-sniffing protection.
- **Strict CORS allowlist** with credentials.
- **Rate limiting** on auth, bookings, lookups, chat, location, routing and driver GPS updates.
- **Input validation** middleware and a **100 KB** body size limit.
- **bcrypt** password hashing; **hashed, expiring, single-use** password-reset tokens.
- **Server-side pricing**, so client-sent prices are never trusted.
- **Idempotent writes** and transactional driver assignment to avoid double-booking.
- **Audit logging** of sensitive actions.
- **Minimal health endpoint** that exposes no internal metrics.
- **Production seeding disabled** unless explicitly enabled.

To report a vulnerability, please open a private security advisory on the repository rather than a public issue.

---

## Testing

The project ships with a large suite of integration and regression tests built on Node's native test runner (no extra framework required):

```bash
npm test
```

Coverage spans authentication and RBAC, booking security and isolation, the pricing engine, trip lifecycle, driver GPS and realtime tracking, UPI/QR payments, admin tools, password reset, routing and geocoding, mobile UX and failure recovery. Tests run in `NODE_ENV=test` against an isolated SQLite database, serially (`--test-concurrency=1`).

---

## Deployment

### Vercel (frontend + API)

1. Import the repository into Vercel.
2. Add the environment variables from [above](#environment-variables), including a TiDB `DATABASE_URL`.
3. Deploy. [`vercel.json`](vercel.json) routes `/api/*` to the serverless function in `api/index.js` and everything else to the SPA.

### Realtime service

Vercel functions can't hold WebSocket connections. Deploy the realtime server separately on any persistent Node host:

```bash
npm run realtime
```

Then set:

- `REALTIME_SERVICE_URL` on the API to the service's HTTP URL
- `REALTIME_INTERNAL_SECRET` to the same secret on both sides
- `VITE_REALTIME_URL` to the public `wss://` URL for the frontend build

### Self-hosted (single server)

```bash
npm run build
NODE_ENV=production npm start
```

Express serves the built `dist/` assets and the API from one process, with the embedded realtime server on `REALTIME_PORT`.

---

## Project Structure

```
book-driver-anna/
├── api/                    # Vercel serverless entrypoint
├── server/
│   ├── config/             # Environment and security configuration
│   ├── db/                 # Database abstraction, schema, seed
│   ├── middleware/         # auth, rbac, validation, rate limiting, errors
│   ├── routes/             # auth, bookings, drivers, admin, chat, pricing, location
│   ├── scripts/            # bootstrapAdmin, cleanDatabase, lockdownLegacyAccounts
│   ├── services/           # booking, pricing, routing, geocoding, realtime, email, audit, Gemini
│   ├── index.js            # Express app
│   └── realtimeServer.js   # Standalone WebSocket server
├── src/
│   ├── components/         # UI components, modals, map components
│   ├── context/            # Pricing context
│   ├── pages/              # Public, driver and admin pages
│   ├── services/           # API client
│   └── utils/              # Hooks and helpers
├── tests/                  # Automated test suite
├── vercel.json
├── vite.config.js
└── .env.example
```

---

## Known Limitations & Roadmap

- **Rate limiting is per-instance.** The in-memory store isn't shared across serverless instances. Moving to a Redis-backed store (e.g. Upstash) is the planned fix.
- **Public OSRM and Nominatim** are suitable for demos; self-host or use a paid provider at scale.
- **Payments are UPI deep-link/QR based.** There is no payment gateway integration or server-side payment verification yet.
- **Gemini model** is configured server-side; review the model name periodically as versions are retired.

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

© 2026 Santhosh Kumar S
