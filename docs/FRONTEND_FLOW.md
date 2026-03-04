# Frontend Documentation – Full Flow

This document describes the **full frontend flow** of the Kauvery Teleconnect Video Consultation application: routing, screens, state, and how the client talks to the backend and Zego.

---

## 1. Application Entry & Routing

- **Framework:** React with `react-router-dom` (BrowserRouter).
- **Entry:** `client/src/index.js` renders `App.js`; `App.js` wraps the app in `<BrowserRouter>` and defines `<Routes>`.

### Routes

| Path | Purpose | Who can access |
|------|--------|----------------|
| `/` | Landing / verification | Everyone. Renders loading, error, OTP screens, or redirects to `/consultation` when verified. |
| `/consultation` | Video consultation room | Only after decryption + (if required) OTP verification. Otherwise redirect to `/`. |
| `/patient` | Same as consultation (legacy) | Same as `/consultation`. |
| `*` | Fallback | Redirects to `/`. |

**Rule:** Reaching `/consultation` or `/patient` requires `decryptionComplete && isTokenValid`. If not, user is sent to `/`.

---

## 2. Query Parameters & Link Types

Consultation links can carry **encrypted parameters** (new flow) or **legacy** params.

### New encrypted parameters (query string)

- `a` → app_no (appointment number)
- `un` → username (patient name)
- `ui` → userid (patient id)
- `d` → doctorname
- `s` → speciality
- `ad` → appointment_date
- `at` → appointment_time

If **any** of these are present, the app treats the link as **encrypted** and **OTP-required**: user must verify mobile and OTP before decryption and video.

### Legacy parameters

- `id` → single encrypted string (decrypted on server; may contain app_no, username, userid, etc.)
- `token` → direct auth token (no OTP)
- `app_no`, `username`, `userid` → direct (no encryption)

For legacy links without encrypted params, the app may decrypt `id` or use direct params/token and **does not** require OTP.

---

## 3. Full User Flow (Step by Step)

### 3.1 User opens link with encrypted params (`a`, `un`, `ui`, `d`, `s`, `ad`, `at`)

1. **Initial load**  
   - `getQueryParams()` reads URL; `hasNewEncryptedParams` is true.  
   - `encryptedParams` and `requiresOtp` are set.  
   - Optional: doctor/appointment info is decrypted for display via **public** decrypt (e.g. single `/api/decrypt` for `d`, `s`, `ad`, `at` only for UI).  
   - If `consultationAccessToken` and `consultationLinkHash` exist in sessionStorage → `otpStep = 'verified'`.  
   - Else → `otpStep = 'mobile'`.

2. **Screen: Mobile entry** (`otpStep === 'mobile'`)  
   - User sees Identity Verification: “Registered mobile number”, +91, input.  
   - Header (Kauvery Teleconnect), doctor card (if decrypted), footer.  
   - User enters mobile → **Get Access Code** → `handleSendOtp` → `POST /api/consultation/precheck` with `{ mobile, params: encryptedParams }`.  
   - Server validates mobile against CRM/appointment; sends OTP via SMS; returns `precheckId`, `linkHash`, `maskedMobile`, `resendCooldownSeconds`.  
   - Client stores `linkHash` in sessionStorage, sets `otpStep = 'otp'`, shows OTP screen.

3. **Screen: OTP verification** (`otpStep === 'otp'`)  
   - User sees “Enter Access Code”, 6-digit OTP boxes, Resend code (with cooldown).  
   - Submit → `handleVerifyOtp` → `POST /api/consultation/verify-otp` with `{ precheckId, otp }`.  
   - Server validates OTP; returns `token` (consultation access token).  
   - Client stores `consultationAccessToken` in sessionStorage; sets `otpStep = 'verified'`.

4. **Screen: Verified / connecting** (`otpStep === 'verified'` && !decryptionComplete)  
   - “Verified!” and “Connecting to video server…”.  
   - “Enter video room” button (or auto) → `processMultipleEncryptedParams(encryptedParams)`.  
   - **Batch decrypt** with consultation auth: `POST /api/consultation/decrypt/batch` with `X-Consultation-Token` and `X-Consultation-Link`, body `{ texts: [ { key: 'a', text: params.a }, ... ] }`.  
   - Server validates token + link hash; decrypts; returns mapping (e.g. `a` → app_no, `un` → username, …).  
   - Client builds `appointmentData`, calls `storeAppointmentData(appointmentData)` → `POST /api/appointments`.  
   - Then sets `authToken`, `decryptedParams` in sessionStorage, `isTokenValid = true`, `decryptionComplete = true`.

5. **Redirect to video**  
   - Because `decryptionComplete && isTokenValid`, the `/` route renders `<Navigate to="/consultation" replace />`.  
   - User lands on `/consultation` and sees the **VideoConsultation** component.

### 3.2 User on `/consultation` (VideoConsultation component)

1. **VideoConsultation** reads appointment from sessionStorage/decryptedParams (or from URL/context as used in your app).  
2. **Zego init**  
   - `useEffect` runs when `appointmentData` (e.g. roomID, userid, username) is ready.  
   - Calls `initializeZego()`: fetches token from **backend** `POST /api/zego-token` (sends `X-Consultation-Token` if present), then creates Zego UIKit and joins room with **showPreJoinView: true**.  
3. **Pre-join screen**  
   - Zego shows device preview (camera/mic).  
   - Custom UI: “Welcome to Kauvery Hospital”, “Join Teleconsultation” button, and (if injected) Doctor/Patient card and “No one else in the room”.  
   - User clicks **Join Teleconsultation** → Zego fires `onJoinRoom`.  
   - Client stores appointment (if not already), starts call session `POST /api/call-sessions/start`, sets `zegoInitialized = true`.  
4. **In-call**  
   - Zego renders the live video UI (mute, video, end, chat).  
   - Events (e.g. leave) → `POST /api/call-sessions/end`, `POST /api/video-call-events`, then redirect/leave popup as implemented.  
5. **Leave / end**  
   - Custom leave confirmation can trigger; on confirm, session and events are sent to backend, then redirect (e.g. to health packages or home).

### 3.3 Legacy link (no encrypted params, e.g. `id` or `token`)

- If `params.id` exists: `processEncodedId(params.id)` → single `POST /api/decrypt` → parse decrypted string → build appointment → store → set token and `decryptionComplete`, `isTokenValid`.  
- If `params.app_no`, `username`, `userid` exist: `processDirectParams(params)` → no decrypt; store appointment and set token.  
- If `params.token` exists: store in sessionStorage, set `isTokenValid`, `decryptionComplete`.  
- No OTP steps; user can go straight to `/consultation` when token is valid.

---

## 4. Main Frontend Modules

| File / area | Role |
|-------------|------|
| `App.js` | Router, query params, OTP flow, decrypt flow, token state, redirect to `/consultation`. |
| `VideoConsultation.js` | Zego container, pre-join UI customization, join/leave, call session start/end, video-call events, leave popup. |
| `ConsultationHeader.js` | Top bar (logo, “Kauvery Teleconnect”, support line). |
| `ConsultationFooter.js` | Bottom bar (copyright, links). |
| `appointmentService.js` | API helpers: storeAppointment, storeVideoCallEvent, startCallSession, endCallSession, getAppointment, get/set/clear appointment id in sessionStorage. |
| `theme/colors.js` | Theme (e.g. pageBg, cardBg, primary). |

---

## 5. Session storage (client)

- `consultationAccessToken` – After OTP verify; sent as `X-Consultation-Token` for `/api/consultation/decrypt/batch` and `/api/zego-token`.  
- `consultationLinkHash` – From precheck; sent as `X-Consultation-Link` with token.  
- `authToken` – After decryption/legacy token; used to consider user “valid” for `/consultation`.  
- `decryptedParams` – JSON of appointment (app_no, username, userid, doctorname, speciality, appointment_date, appointment_time, roomID).  
- `appointment_id` – Stored by AppointmentService after store appointment; used for call-session and video-call-events.

---

## 6. Environment (frontend)

- `REACT_APP_SERVER_URL` – Backend base URL for API calls. If empty or relative, requests go to same origin.  
- Build-time checks (e.g. no internal IPs in bundle) are used as per your repo.

---

## 7. Summary flow diagram (encrypted link + OTP)

```
Open link (a, un, ui, d, s, ad, at)
    → Show mobile screen
    → POST /api/consultation/precheck → OTP sent
    → Show OTP screen
    → POST /api/consultation/verify-otp → token
    → “Enter video room” / auto
    → POST /api/consultation/decrypt/batch (with token + link)
    → POST /api/appointments
    → Navigate to /consultation
    → VideoConsultation: POST /api/zego-token → Zego joinRoom (pre-join)
    → User clicks Join → POST /api/call-sessions/start → in-call
    → On leave → POST /api/call-sessions/end, POST /api/video-call-events → redirect
```

This is the **full frontend flow** from link open to video room and leave.
