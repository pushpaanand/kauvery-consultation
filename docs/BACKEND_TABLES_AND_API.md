# Backend Documentation – Tables & API Reference

This document describes all **database tables** (as used by the backend) and every **API endpoint** in the teleconsultation server.

---

## 1. Database Overview

- **Engine:** Microsoft SQL Server (Azure SQL Database).
- **Driver:** `mssql` (Node.js).
- **Config (env):** `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`, `DB_CONNECTION_TIMEOUT_MS`, `DB_REQUEST_TIMEOUT_MS`.

---

## 2. Table Definitions

### 2.1 `appointments`

Stores one row per consultation appointment (created/updated when the patient opens the link and passes verification).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (identity) | Primary key, auto-generated. |
| `app_no` | NVARCHAR | Appointment number (business key). |
| `username` | NVARCHAR | Patient name. |
| `userid` | NVARCHAR | Patient/user ID. |
| `doctorname` | NVARCHAR | Doctor name. |
| `speciality` | NVARCHAR | Doctor speciality. |
| `appointment_date` | DATE/DATETIME | Appointment date (stored as YYYY-MM-DD). |
| `appointment_time` | TIME/NVARCHAR | Appointment time (e.g. HH:MM:SS). |
| `room_id` | NVARCHAR | Room ID used for video (e.g. app_no). |
| `created_at` | DATETIME2 | Row creation time. |
| `updated_at` | DATETIME2 | Last update time. |

**Logic:** If a row exists for `(app_no, userid)`, it is updated; otherwise a new row is inserted. The backend returns `appointment_id` (the `id`) to the client.

---

### 2.2 `video_call_events`

Stores teleconsultation events (e.g. connected, disconnected, mute, etc.) for analytics/audit.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (identity) | Primary key. |
| `appointment_id` | INT | FK to `appointments.id`. |
| `event_type` | NVARCHAR | e.g. `connected`, `disconnected`, `mute`, etc. |
| `event_timestamp` | DATETIME2/NVARCHAR | When the event occurred (ISO string or datetime). |
| `event_data` | NVARCHAR(MAX) | JSON blob of extra event payload. |
| `room_id` | NVARCHAR | Zego room ID. |
| `user_id` | NVARCHAR | User/patient ID. |
| `username` | NVARCHAR | User display name. |
| `session_id` | NVARCHAR | Optional session identifier. |
| `duration_seconds` | INT | Optional duration. |
| `created_at` | DATETIME2 | Row creation time. |

**Note:** `appointment_id` can be resolved from `app_no` if the client sends `app_no` as `appointment_id` (server looks up `id` from `appointments`).

---

### 2.3 `call_sessions`

Tracks a single “call session” per appointment (start when user joins, end when they leave).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (identity) | Primary key. |
| `appointment_id` | INT | FK to `appointments.id`. |
| `session_start` | DATETIME2 | When the call session started. |
| `session_end` | DATETIME2 | When the call session ended (NULL until ended). |
| `room_id` | NVARCHAR | Zego room ID. |
| `user_id` | NVARCHAR | User/patient ID. |
| `username` | NVARCHAR | User display name. |
| `status` | NVARCHAR | `active` or `ended`. |
| `duration_seconds` | INT | Filled on end (DATEDIFF from session_start to session_end). |
| (created_at) | (if exists) | Optional audit column. |

**Logic:** On start, any existing `active` session for the same `appointment_id` is ended; then a new row is inserted with `status = 'active'`. On end, the latest `active` row for that `appointment_id` is updated with `session_end`, `duration_seconds`, and `status = 'ended'`.

---

### 2.4 `sql_injection_logs`

Used for security monitoring. Schema is defined in `utils/sql_injection_logs_schema.sql`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT IDENTITY | Primary key. |
| `timestamp` | DATETIME2 | When the attempt was detected. |
| `ip_address` | NVARCHAR(45) | Client IP. |
| `user_agent` | NVARCHAR(500) | Request User-Agent. |
| `request_method` | NVARCHAR(10) | e.g. GET, POST. |
| `request_path` | NVARCHAR(500) | Request path. |
| `risk_level` | NVARCHAR(20) | `none`, `medium`, `high`, `critical`. |
| `pattern_count` | INT | Number of patterns matched. |
| `detected_patterns` | NVARCHAR(MAX) | JSON array of detected patterns. |
| `suspicious_field` | NVARCHAR(200) | Field that triggered. |
| `suspicious_input` | NVARCHAR(MAX) | Raw suspicious input (sanitized in practice). |
| `query_text` | NVARCHAR(MAX) | Optional query context. |
| `user_id` | NVARCHAR(100) | Optional. |
| `session_id` | NVARCHAR(200) | Optional. |
| `request_body` | NVARCHAR(MAX) | Optional. |
| `response_status` | INT | HTTP status returned. |
| `created_at` | DATETIME2 | Row creation. |

Indexes and view `vw_recent_critical_sql_injections` are created by the schema script.

---

## 3. API Reference

Base URL is the server origin (e.g. `https://your-app.azurewebsites.net` or `http://localhost:3001`). All JSON request/response use `Content-Type: application/json` unless noted.

---

### 3.1 Consultation & decryption

#### `POST /api/consultation/precheck`

Initiates OTP flow: validates mobile against appointment (via CRM) and sends OTP.

**Request body:**

```json
{
  "mobile": "9876543210",
  "params": {
    "a": "<encrypted_app_no>",
    "un": "<encrypted_username>",
    "ui": "<encrypted_userid>",
    "d": "<encrypted_doctorname>",
    "s": "<encrypted_speciality>",
    "ad": "<encrypted_appointment_date>",
    "at": "<encrypted_appointment_time>"
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "precheckId": "<uuid>",
  "maskedMobile": "****3210",
  "linkHash": "<hex_hash>",
  "expiresIn": 300000,
  "resendCooldownSeconds": 30,
  "appointmentHint": "****1234"
}
```

**Errors:** 400 (invalid payload, invalid mobile, mobile_mismatch, invalid_link), 429 (otp_throttled), 500.

---

#### `POST /api/consultation/verify-otp`

Verifies OTP and issues consultation access token.

**Request body:**

```json
{
  "precheckId": "<from_precheck>",
  "otp": "123456"
}
```

**Response (200):**

```json
{
  "success": true,
  "token": "<consultation_access_token>",
  "expiresIn": 900000,
  "maskedMobile": "****3210",
  "appointmentHint": "****1234"
}
```

**Errors:** 400 (invalid payload, otp_expired, otp_invalid), 429 (otp_attempts_exceeded), 500.

---

#### `POST /api/decrypt`

Decrypts a single ciphertext (public; no consultation token). Rate-limited.

**Request body:**

```json
{
  "text": "<base64_ciphertext>"
}
```

**Response (200):**

```json
{
  "decryptedText": "<plaintext_or_json_string>"
}
```

**Errors:** 400 (invalid input), 429 (rate limit), 500.

---

#### `POST /api/consultation/decrypt`

Same as `/api/decrypt` but **requires** consultation auth headers. Used after OTP for single-item decrypt.

**Headers:** `X-Consultation-Token`, `X-Consultation-Link` (from precheck/verify-otp).

---

#### `POST /api/decrypt/batch`

Decrypts multiple items (public). Rate-limited. Max 20 items per request.

**Request body:**

```json
{
  "texts": [
    { "key": "a", "text": "<ciphertext>" },
    { "key": "un", "text": "<ciphertext>" }
  ]
}
```

**Response (200):**

```json
{
  "success": true,
  "results": {
    "a": "<decrypted_value>",
    "un": "<decrypted_value>"
  },
  "errors": { "s": "Decryption failed" },
  "timestamp": "<iso>"
}
```

---

#### `POST /api/consultation/decrypt/batch`

Same as `/api/decrypt/batch` but **requires** consultation auth. Used after OTP to decrypt all link params.

**Headers:** `X-Consultation-Token`, `X-Consultation-Link`.

---

### 3.2 Appointments & call tracking

#### `POST /api/appointments`

Creates or updates an appointment (used when user is verified and before joining video).

**Request body:**

```json
{
  "app_no": "APT001",
  "username": "Patient Name",
  "userid": "USER123",
  "roomID": "APT001",
  "doctorname": "Dr. Smith",
  "speciality": "Cardiology",
  "appointment_date": "15/09/2025 00:00:00",
  "appointment_time": "15:30"
}
```

**Required:** `app_no`, `username`, `userid`.

**Response (200):**

```json
{
  "success": true,
  "appointment_id": 42,
  "message": "Appointment created successfully"
}
```

**Errors:** 400 (missing fields), 500.

---

#### `GET /api/appointments/:appNo`

Returns one appointment by `app_no`.

**Response (200):**

```json
{
  "success": true,
  "appointment": {
    "id": 42,
    "app_no": "APT001",
    "username": "...",
    "userid": "...",
    "doctorname": "...",
    "speciality": "...",
    "appointment_date": "...",
    "appointment_time": "...",
    "room_id": "...",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

**Errors:** 404 (not found), 500.

---

#### `POST /api/video-call-events`

Stores a video call event.

**Request body:**

```json
{
  "appointment_id": 42,
  "event_type": "connected",
  "roomID": "APT001",
  "user_id": "USER123",
  "username": "Patient Name",
  "event_timestamp": "2025-02-28T10:00:00.000Z",
  "event_data": {},
  "session_id": "...",
  "duration_seconds": 0
}
```

**Required:** `appointment_id`, `event_type`, `roomID`, `user_id`, `username`.

**Response (200):** `{ "success": true, "appointment_id": 42, "message": "..." }`.  
**Errors:** 400 (missing fields), 404, 500.

---

#### `POST /api/call-sessions/start`

Starts a call session (when user joins the room).

**Request body:**

```json
{
  "appointment_id": 42,
  "roomID": "APT001",
  "user_id": "USER123",
  "username": "Patient Name"
}
```

**Required:** `appointment_id`, `roomID`, `user_id`, `username`.

**Response (200):** `{ "success": true, "message": "...", "timestamp": "<iso>" }`.  
**Errors:** 400, 500.

---

#### `POST /api/call-sessions/end`

Ends the active call session for the appointment.

**Request body:**

```json
{
  "appointment_id": 42
}
```

**Required:** `appointment_id`.

**Response (200):** `{ "success": true, "message": "...", "timestamp": "<iso>" }`.  
**Errors:** 400, 404, 500.

---

### 3.3 Zego token

#### `POST /api/zego-token`

Returns a Zego token for the given room/user. If the client sends consultation headers, they are validated.

**Request body:**

```json
{
  "roomID": "APT001",
  "userID": "USER123",
  "userName": "Patient Name"
}
```

**Required:** `roomID`, `userID`.

**Response (200):**

```json
{
  "success": true,
  "token": "<zego_token>",
  "appId": 1234567890
}
```

**Errors:** 400 (missing roomID/userID), 500 (invalid config), 503 (generator or Zego credentials missing).

---

### 3.4 Health & database

#### `GET /health`

Health check. No auth.

**Response (200):**

```json
{
  "status": "ok",
  "timestamp": "<iso>",
  "environment": "production",
  "isAzure": true,
  "database": "connected"
}
```

---

#### `GET /api/test-db`

Tests DB connectivity.

**Response (200):** `{ "success": true, "message": "Database connection successful", "data": [{ "test": 1 }] }`.  
**Errors:** 500.

---

### 3.5 Security (SQL injection logs)

#### `GET /api/security/sql-injection-logs`

Returns recent SQL injection log entries. Query params: `limit`, `risk_level`, `ip_address`, `start_date`, `end_date`.

**Response (200):** `{ "success": true, "count": N, "logs": [...] }`.

---

#### `GET /api/security/sql-injection-stats`

Aggregate stats (total attempts, unique IPs, counts by risk_level, last 24h/7d/30d).

**Response (200):** `{ "success": true, "statistics": { ... } }`.

---

#### `GET /api/security/sql-injection-top-ips`

Top IPs by attempt count. Query param: `limit`.

**Response (200):** `{ "success": true, "top_ips": [...] }`.

---

## 4. Middleware & security

- **CORS:** Configured allowed origins (Azure, localhost, Zego, etc.).
- **Body parsing:** `express.json({ limit: '10mb' })`, `express.urlencoded({ extended: true, limit: '10mb' })`.
- **SQL injection:** `sqlInjectionDetectionMiddleware` runs on all requests after body parsing; logs to `sql_injection_logs` when DB is available.
- **Decryption rate limit:** Applied to `/api/decrypt`, `/api/decrypt/batch`, and consultation decrypt variants.
- **Consultation auth:** `requireConsultationAccess` validates `X-Consultation-Token` and `X-Consultation-Link` against in-memory store; used for consultation decrypt and (when sent) for `/api/zego-token`.
- **Headers:** Security headers (CSP, HSTS, X-Frame-Options, etc.) and cache control for API/HTML (no-store for sensitive content).

---

## 5. External integrations (backend)

- **CRM:** Token endpoint + “TeleMobile” URL to verify patient mobile against appointment (used in precheck).
- **SMS (OTP):** Airtel IQ SMS (or configurable URL) for sending OTP; template and credentials via env.
- **Zego:** Server-side token generation via `utils/zegoServerAssistant.generateToken04` (App ID + Server Secret from env).

This document, together with the schema script for `sql_injection_logs`, describes the **backend tables and all APIs** for the teleconsultation application.
