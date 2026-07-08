# Auth / OTP / Refresh Flows

> **Source of truth:** `lib/api/services/auth.ts`, `lib/api/client/withRefresh.ts`,
> `lib/api/client/authEvents.ts`, `store/authStore.ts`. The diagrams below are
> function-level accurate to those files; regenerate when they change.

**Cookie model (frozen `server_2`, accommodated not changed):**

- `access_token` — `Path=/`, ~15-min TTL, sent on every `/api/v1/*` request.
- `refresh_token` — **path-scoped** to `/api/v1/auth/refresh`, ~30-day TTL, so
  it is only ever attached to the refresh call.
- Both cookies are `HttpOnly; SameSite=Lax` and `Secure` only when
  `NODE_ENV=production`. Lax + same-origin is why prod must serve FE + API under
  one origin (see `DEPLOYMENT.md`).
- The client base URL is `/api/v1`; `withRefresh` uses the **relative** path
  `/auth/refresh`, i.e. `/api/v1/auth/refresh` — exactly the refresh cookie's
  scope.

---

## 1. Login + cookie set + refresh lifecycle

```mermaid
sequenceDiagram
    participant UI as Login UI
    participant Store as authStore
    participant Svc as authService
    participant API as server_2 /api/v1
    participant Cookie as Browser cookie jar

    UI->>Store: login(email, password)
    Store->>Svc: authService.login({email, password})
    Svc->>API: POST /auth/login
    API-->>Cookie: Set-Cookie access_token (Path=/, 15m)
    API-->>Cookie: Set-Cookie refresh_token (Path=/api/v1/auth/refresh, 30d)
    API-->>Svc: 200 { user, … }
    Svc-->>Store: userAdapter(res.user)
    Store->>Store: setUser(user) → isAuthenticated = true

    Note over UI,API: Subsequent guarded reads
    UI->>Svc: e.g. authService.me()
    Svc->>API: GET /users/me (access_token cookie auto-sent)
    API-->>Svc: 200 user

    Note over Cookie,API: Access token expires (~15m) → next guarded call 401 → see diagram 2
```

## 2. Single-flight 401 → refresh → retry → `auth:expired`

`createRefreshingRequest` (`withRefresh.ts`) wraps the transport. A 401 of
`category === "auth"` triggers **one shared** refresh; concurrent 401s queue on
the same promise and each retries **once**. `/auth/login` and `/auth/refresh`
are **bypassed** (a 401 there is a real credential failure, not an expired
session).

```mermaid
sequenceDiagram
    participant R1 as Request A
    participant R2 as Request B (concurrent)
    participant W as withRefresh
    participant API as server_2 /api/v1
    participant Bus as authEvents
    participant Store as authStore

    R1->>W: GET /users/me
    R2->>W: GET /cart
    W->>API: GET /users/me
    W->>API: GET /cart
    API-->>W: 401 (auth) for A
    API-->>W: 401 (auth) for B

    Note over W: recordAuth401({path}) per intercepted 401
    W->>W: single-flight: A starts refresh, B queues on same promise
    W->>API: POST /auth/refresh (refresh_token cookie, path-scoped)

    alt refresh succeeds
        API-->>W: 200 (new access_token cookie set)
        W->>API: retry GET /users/me (once)
        W->>API: retry GET /cart (once)
        API-->>R1: 200
        API-->>R2: 200
        Note over W: a 2nd 401 on retry propagates unchanged (no re-refresh)
    else refresh fails
        API-->>W: 401 / error
        W->>W: recordAuthRefreshFailure() (once per cycle)
        W->>Bus: emitAuthExpired() (once per cycle)
        Bus->>Store: auth:expired listener → clearPersistedSession()
        W-->>R1: reject (original auth error)
        W-->>R2: reject (original auth error)
    end
```

## 3. Register + email / phone OTP verification

Register returns **201 with no cookies**; `authStore.register` auto-logs in
immediately. OTP send/verify are **authed** (server targets the current session);
phone send carries the phone number, both verifies carry `{ code }`.

```mermaid
sequenceDiagram
    participant UI as Register / Verify UI
    participant Store as authStore
    participant Svc as authService
    participant API as server_2 /api/v1

    UI->>Store: register(input)
    Store->>Svc: authService.register(input)
    Svc->>API: POST /auth/register (registerAdapter body)
    API-->>Svc: 201 { user } (NO cookies, empty tokens)
    Store->>Svc: authService.login({email, password})  %% auto-login
    Svc->>API: POST /auth/login
    API-->>Store: cookies set + user

    Note over UI,API: Email OTP (authed)
    UI->>Svc: sendEmailOtp()
    Svc->>API: POST /auth/email-otp/send → 204
    UI->>Svc: verifyEmailOtp(code)
    Svc->>API: POST /auth/email-otp/verify { code } → 204

    Note over UI,API: Phone OTP (authed, behind phoneVerification flag)
    UI->>Svc: sendPhoneOtp(phone)
    Svc->>API: POST /auth/phone-otp/send { phone } → 204
    UI->>Svc: verifyPhoneOtp(code)
    Svc->>API: POST /auth/phone-otp/verify { code } → 204
```

## 4. Forgot / reset password

`forgot-password` **always** returns 204 (no user enumeration); the emailed
code is later exchanged with the new password.

```mermaid
sequenceDiagram
    participant UI as Forgot/Reset UI
    participant Svc as authService
    participant API as server_2 /api/v1
    participant Mail as Email

    UI->>Svc: forgotPassword(email)
    Svc->>API: POST /auth/forgot-password { email }
    API-->>Svc: 204 (always — no enumeration)
    API-->>Mail: reset code (if account exists)

    UI->>Svc: resetPassword({ email, code, newPassword })
    Svc->>API: POST /auth/reset-password { email, code, newPassword }
    API-->>Svc: 204 → user logs in via diagram 1
```
