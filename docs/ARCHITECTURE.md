# Teleconsultation Application – Full Architecture

This document explains the **full architecture** of the Kauvery Teleconnect Video Consultation system: components, data flow, integrations, and deployment.

---

## 1. High-Level Overview

The application is a **web-based teleconsultation** product that:

1. Presents **encrypted consultation links** (or legacy token/id links) to patients.
2. Verifies the patient via **OTP on registered mobile** (for encrypted links).
3. **Decrypts** link parameters on the server and **stores** the appointment.
4. Lets the patient join a **Zego Cloud** video room using a **server-issued token**.
5. **Records** appointment, call-session, and video-call events in **Azure SQL**.
6. Optionally validates the patient’s mobile against an external **CRM**.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TELECONSULTATION SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   ┌─────────────┐     HTTPS      ┌─────────────────────────────────────────────┐ │
│   │   Patient   │◄──────────────►│           Node.js / Express Server          │ │
│   │   Browser   │               │  (API, decrypt, OTP, Zego token, CRM, SMS)   │ │
│   │  (React SPA) │               └───────────────┬─────────────────────────────┘ │
│   └──────┬──────┘                                │                              │
│          │                                       │                              │
│          │ Zego SDK (token from server)          │ SQL, CRM, SMS, Zego (server)  │
│          ▼                                       ▼                              │
│   ┌─────────────┐     WSS/RTC    ┌─────────────┐  ┌─────────┐  ┌───────────┐  │
│   │ Zego Cloud  │◄──────────────►│ Azure SQL   │  │   CRM    │  │ SMS (OTP)  │  │
│   │ (Video/RTC) │                │ (appointments│  │ (mobile │  │ (Airtel IQ)│  │
│   └─────────────┘                │  events,     │  │ verify) │  └───────────┘  │
│                                  │  sessions)   │  └─────────┘                  │
│                                  └─────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Client (Frontend) Architecture

### 2.1 Stack

- **React** – UI and state.
- **React Router (BrowserRouter)** – Routes: `/`, `/consultation`, `/patient`, fallback to `/`.
- **Session storage** – Consultation token, link hash, auth token, decrypted params, appointment id.
- **Zego UIKit Prebuilt (Web SDK)** – Pre-join UI and in-call UI (video, mute, chat, leave). Rendered inside a dedicated container in `VideoConsultation.js`.

### 2.2 Responsibilities

| Layer | Role |
|-------|------|
| **App.js** | Routing, URL params, OTP flow (mobile → OTP → verified), decrypt flow (batch/single), token state, redirect to `/consultation`. |
| **VideoConsultation.js** | Zego container, pre-join customization (Kauvery branding, doctor/patient card), join/leave handling, calling backend for Zego token, call-session start/end, video-call events. |
| **ConsultationHeader / Footer** | Branding and footer. |
| **appointmentService.js** | Centralized API calls: store appointment, video-call events, call-session start/end, get appointment. Uses relative or env `REACT_APP_SERVER_URL`. |

### 2.3 Data flow (client)

- **Link open** → Parse query → If encrypted params → OTP flow (precheck → verify-otp) → Consultation token + link hash stored.
- **Decrypt** → `POST /api/consultation/decrypt/batch` with token + link hash → Appointment payload → `POST /api/appointments` → Store auth token + decrypted params in sessionStorage.
- **Video** → Read roomID/userID/username from appointment → `POST /api/zego-token` → Zego UIKit joins room with pre-join → User clicks Join → `POST /api/call-sessions/start` → In-call (Zego UI) → On leave → `POST /api/call-sessions/end`, `POST /api/video-call-events`.

Client **never** holds decryption keys or Zego Server Secret; it only receives tokens and decrypted payloads from the server.

---

## 3. Server (Backend) Architecture

### 3.1 Stack

- **Node.js** + **Express** – Single process, all API routes in `server.js`.
- **mssql** – Azure SQL connection pool.
- **dotenv** – Configuration from environment.
- **axios** – Outbound HTTP (CRM token, TeleMobile, SMS).
- **crypto** – Decryption (AES), OTP hashing, consultation token generation.

### 3.2 Request pipeline

1. **CORS** – Validates origin against allowlist (Azure, localhost, Zego, Kauvery domains).
2. **Cookie / security headers** – SameSite, security headers (CSP, HSTS, X-Frame-Options, etc.), cache control for API/HTML.
3. **Body parsing** – `express.json()`, `express.urlencoded()`.
4. **SQL injection middleware** – Scans body/query for patterns, logs to `sql_injection_logs` when DB is available.
5. **Static files** – Serve `client/build` (React production build).
6. **API routes** – Decrypt, consultation (precheck, verify-otp, decrypt), appointments, video-call-events, call-sessions, Zego token, health, test-db, security logs.
7. **Catch-all** – SPA fallback: `index.html` for non-API routes.

### 3.3 Core server logic

| Concern | Implementation |
|--------|----------------|
| **Decryption** | AES (key from env), zero IV, Base64 input normalization. Single and batch decrypt handlers; consultation decrypt requires token + link hash. |
| **OTP** | Precheck: validate mobile via CRM TeleMobile API → generate OTP → send SMS → store session (precheckId, otpHash, linkHash, TTL). Verify: compare hashed OTP, issue consultation access token, store in consultationAccessStore with TTL. |
| **Consultation auth** | In-memory maps: `otpSessionStore` (precheckId → session), `consultationAccessStore` (token → session). Middleware checks `X-Consultation-Token` and `X-Consultation-Link`; used for consultation decrypt and (when sent) Zego token. |
| **Appointments** | Upsert by (app_no, userid); return `appointment_id` (PK). Date/time formatted for SQL (YYYY-MM-DD, HH:MM:SS). |
| **Video events & call sessions** | video_call_events: insert per event. call_sessions: end any active session for appointment, then insert new “active” row on start; on end, update that row with session_end and duration. |
| **Zego token** | `utils/zegoServerAssistant.generateToken04` (App ID + Server Secret from env); payload includes room_id and privilege; token returned to client only. |

---

## 4. Database (Azure SQL)

- **Provider:** Azure SQL Database.
- **Tables:**  
  - **appointments** – One row per consultation (created/updated when patient is verified).  
  - **video_call_events** – Event log (connected, disconnected, etc.).  
  - **call_sessions** – One active/ended session per join/leave.  
  - **sql_injection_logs** – Security audit (see `utils/sql_injection_logs_schema.sql`).
- **Connection:** Pool (mssql), timeouts and options from env. Used by appointment storage, video events, call sessions, and SQL injection logger.

---

## 5. External Integrations

### 5.1 Zego Cloud

- **Role:** Real-time video/audio and optional chat.
- **Client:** Zego UIKit Prebuilt (Web) loads in iframe/container; joins room with **roomID** (e.g. app_no) and **userID**/userName.
- **Server:** Only generates **Token04** via `/api/zego-token` (App ID + Server Secret in env). Server never joins the room; media flows client ↔ Zego.

### 5.2 CRM (Kauvery)

- **Purpose:** Verify that the mobile number entered by the user matches the one registered for the appointment.
- **Flow:** Server gets CRM access token (username/password or client_credentials), then calls “TeleMobile” API with appointment number; compares returned mobile with user input. Used only in `/api/consultation/precheck`.

### 5.3 SMS (OTP)

- **Purpose:** Send OTP to the patient’s mobile during precheck.
- **Provider:** Airtel IQ (or configurable URL). Template and credentials from env. OTP is generated on server, stored hashed in otpSessionStore, and sent via HTTP to SMS gateway.

---

## 6. Security Architecture

| Layer | Measures |
|-------|----------|
| **Link** | Consultation parameters are encrypted (AES). Decryption only on server with key in env. |
| **Identity** | OTP to registered mobile; CRM validates mobile for appointment. Consultation token bound to link hash and time-limited. |
| **API** | Consultation decrypt and (optional) Zego token require consultation token + link hash. Rate limiting on decrypt. |
| **SQL** | Parameterized or validated inputs where used; SQL injection middleware logs attempts to `sql_injection_logs`. (Note: some legacy query building in server may still use string interpolation; consider parameterized queries everywhere.) |
| **Headers** | CSP, HSTS, X-Frame-Options, no cache for sensitive responses, CORS allowlist. |
| **Secrets** | Decryption key, Zego Server Secret, CRM and SMS credentials only in server env (e.g. Azure App Settings). |

---

## 7. Deployment (Azure)

- **App host:** Azure App Service (Linux, Node.js).
- **Runtime:** Single Node process runs `server.js` (Express).
- **Static:** React build (`client/build`) served by Express; catch-all returns `index.html` for SPA routes.
- **Config:** All keys and URLs in Application Settings (env), e.g. `DB_*`, `DECRYPTION_KEY`, `REACT_APP_ZEGO_APP_ID`, `ZEGO_SERVER_SECRET`, CRM and SMS vars.
- **Database:** Azure SQL; connection string or separate DB_* vars.
- **Health:** `GET /health` for load balancer/probes; reports DB connected and environment.

---

## 8. End-to-End Data Flow (Encrypted Link + OTP)

1. **Patient** receives link with encrypted query params (`a`, `un`, `ui`, `d`, `s`, `ad`, `at`).
2. **Browser** loads React app; App.js parses params, shows mobile screen.
3. **Patient** enters mobile → **Server** precheck: CRM verifies mobile for appointment → server sends OTP via SMS → returns precheckId and linkHash.
4. **Patient** enters OTP → **Server** verify-otp: validates OTP → issues consultation token → stored in sessionStorage.
5. **Patient** clicks “Enter video room” → **Client** calls **Server** `/api/consultation/decrypt/batch` with token + link hash → **Server** decrypts and returns app_no, username, userid, doctor, date, time, etc.
6. **Client** calls **Server** `POST /api/appointments` with decrypted data → **Server** upserts **Azure SQL** `appointments`, returns appointment_id.
7. **Client** stores auth token and decrypted params, redirects to `/consultation`.
8. **VideoConsultation** mounts → **Client** calls **Server** `POST /api/zego-token` (roomID, userID, userName) → **Server** returns Zego token.
9. **Client** initializes Zego UIKit with token and joins room (pre-join). Patient clicks Join → **Client** calls **Server** `POST /api/call-sessions/start` → **Server** writes **Azure SQL** `call_sessions` (active).
10. **In-call:** Media and signaling between browser and **Zego Cloud**; optional events sent to **Server** `POST /api/video-call-events` → **Azure SQL** `video_call_events`.
11. **On leave:** **Client** calls **Server** `POST /api/call-sessions/end` and `POST /api/video-call-events` → **Server** updates **call_sessions** and inserts events → **Client** redirects or shows post-call UI.

---

## 9. File / Module Map

| Path | Purpose |
|------|--------|
| **Client** | |
| `client/src/index.js` | React entry, renders App. |
| `client/src/App.js` | Router, OTP/decrypt flow, token state, routes. |
| `client/src/components/VideoConsultation.js` | Zego container, pre-join UI, join/leave, API calls for token and sessions. |
| `client/src/components/ConsultationHeader.js` | Header. |
| `client/src/components/ConsultationFooter.js` | Footer. |
| `client/src/utils/appointmentService.js` | Appointment and call-session API helpers. |
| `client/src/theme/colors.js` | Theme. |
| **Server** | |
| `server.js` | Express app, middleware, all API routes, DB helpers (storeAppointment, storeVideoCallEvent, start/endCallSession), decrypt, OTP, Zego token. |
| `utils/zegoServerAssistant.js` | Zego Token04 generation. |
| `utils/sql_injectionMiddleware.js` | SQL injection detection. |
| `utils/sql_injectionDetector.js` | Pattern detection. |
| `utils/sql_injectionLogger.js` | Writes to sql_injection_logs. |
| `utils/sql_injection_logs_schema.sql` | Schema and indexes for sql_injection_logs. |

This is the **full architecture** of the teleconsultation system from frontend flow and backend APIs to database, external services, security, and deployment.
