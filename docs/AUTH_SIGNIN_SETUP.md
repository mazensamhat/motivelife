# Sign in with Google + Apple — exact ops guide (MotiveLife)

Use this when enabling social login on **https://www.mymotivelife.com**.

---

## Which Google Cloud project?

**Use the MotiveLife project only.**

| Product | Google Cloud project? | Why |
|---------|----------------------|-----|
| **MotiveLife / MyMotiveLife** | **YES — this one** | Production `GOOGLE_CLIENT_ID` for Calendar + Sign-In |
| MotiveFX | No (for this task) | Separate product / marketing |
| MotivePulse IQ | No (for this task) | Separate product / marketing |
| MotiveIQ | No (for this task) | Separate product / marketing |

### How to pick the right project (don’t guess by name)

Production already uses this OAuth **Web client**:

```
176555209052-mhpuogi8gcqecstegqfne26d4gbsj88d.apps.googleusercontent.com
```

- **Project number:** `176555209052` (first part of the client ID)
- **Client ID fragment to find:** `mhpuogi8gcqecstegqfne26d4gbsj88d`

**Steps to open the correct project:**

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Click the **project picker** (top bar, next to “Google Cloud”)
3. In the search box, paste: `176555209052`
4. Select the project that matches that number  
   - If search by number fails: open **any** project → **APIs & Services → Credentials** → look for a client whose ID contains `mhpuogi8gcqecstegqfne26d4gbsj88d` → note the project name in the top bar → switch to that project
5. Confirm you are **not** in a MotiveFX / MotivePulse / MotiveIQ-only project unless that same client ID appears there (it shouldn’t for Life signup)

YouTube marketing docs sometimes say “reuse Calendar’s `GOOGLE_CLIENT_*`.” That shared client still lives on the **MotiveLife** Calendar project — still use this project for Sign-In.

---

## Part 1 — Google Sign-In (step by step)

Sign-In uses **Google Identity Services** (button on `/login` and `/register`).  
It needs **Authorized JavaScript origins**. Redirect URIs are optional fallback.

### 1.1 Open the Web client

1. Stay in the project with number **`176555209052`**
2. Left menu → **APIs & Services** → **Credentials**
3. Under **OAuth 2.0 Client IDs**, open the **Web application** client whose Client ID is:

   `176555209052-mhpuogi8gcqecstegqfne26d4gbsj88d.apps.googleusercontent.com`

4. If you don’t see it: filter / scroll — do **not** create a new client unless this one is missing (creating a new one would require updating Vercel `GOOGLE_CLIENT_ID` / `SECRET`)

### 1.2 Authorized JavaScript origins (required for Sign-In)

In that Web client, find **Authorized JavaScript origins** → **+ ADD URI** → add exactly:

```
https://www.mymotivelife.com
http://localhost:3002
```

Tips:

- No trailing slash
- Use `www` for production (`https://www.mymotivelife.com`, not the apex alone)
- Click **SAVE** at the bottom

Wait 1–5 minutes after saving (Google can lag).

### 1.3 Authorized redirect URIs (recommended — Calendar + fallback Sign-In)

Still on the same Web client → **Authorized redirect URIs** → add if missing:

```
https://www.mymotivelife.com/api/integrations/google/callback
http://localhost:3002/api/integrations/google/callback
```

Optional dedicated auth callback (only if you set `GOOGLE_AUTH_REDIRECT_URI` in Vercel):

```
https://www.mymotivelife.com/api/auth/google/callback
http://localhost:3002/api/auth/google/callback
```

Click **SAVE**.

### 1.4 OAuth consent screen (quick check)

1. **APIs & Services** → **OAuth consent screen**
2. App name should be **MotiveLife** (or clearly MotiveLife)
3. If status is **Testing**, add your Google account under **Test users** or you won’t see the button complete for other accounts
4. Publishing / verification is separate — Testing is fine for you + testers

### 1.5 Vercel (usually already done)

In [Vercel](https://vercel.com) → project **motivelife-web** → **Settings** → **Environment Variables** → **Production**:

| Variable | Expected |
|----------|----------|
| `GOOGLE_CLIENT_ID` | `176555209052-mhpuogi8gcqecstegqfne26d4gbsj88d.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Matching secret for that same Web client |
| `NEXT_PUBLIC_APP_URL` | `https://www.mymotivelife.com` |

No redeploy needed for Console origin changes. Redeploy only if you change Vercel env vars.

### 1.6 Test Google

1. Open a private/incognito window
2. Go to https://www.mymotivelife.com/login
3. You should see a **Google** button (or Google’s official GIS button)
4. Click it → pick your Google account → land on `/dashboard` (or `/family-map` if `?plan=family` register)
5. Also try https://www.mymotivelife.com/register (accept legal checkboxes first, then Google)

**If it fails:**

| Symptom | Fix |
|---------|-----|
| Origin / “not allowed” / button does nothing | JS origins missing or wrong project — redo §1.2 |
| `redirect_uri_mismatch` (fallback button) | Add redirect URIs in §1.3 |
| Works for you only | Consent screen still **Testing** — add test users or publish |

Confirm API: https://www.mymotivelife.com/api/auth/oauth-providers  
should show `"google": true` and the client id above.

---

## Part 2 — Sign in with Apple (step by step)

Apple is **separate** from Google. Use the **same Apple Developer team** as the MotiveLife iOS app.

| Item | Value |
|------|--------|
| iOS App ID (already exists) | `com.mymotivelife.app` |
| App Store app | MotiveLife (ASC id `6789397267`) |
| Web Services ID (create new) | `com.mymotivelife.web` (recommended) |
| Return URL | `https://www.mymotivelife.com/api/auth/apple/callback` |

Do **not** use MotiveFX / Pulse / IQ bundle IDs.

### 2.1 Find your Team ID

1. Open [Apple Developer Account](https://developer.apple.com/account)
2. **Membership details** (or top-right membership)
3. Copy **Team ID** (10 characters, e.g. `AB12CD34EF`)  
   → this becomes `APPLE_SIGNIN_TEAM_ID`

### 2.2 Enable Sign in with Apple on the App ID

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → **Identifiers**
2. Open **App IDs** → find **`com.mymotivelife.app`**
3. Edit → enable capability **Sign In with Apple** → **Save** / **Continue** / **Register**

### 2.3 Create a Services ID (web)

1. Identifiers → **+** → **Services IDs** → Continue
2. Description: `MotiveLife Web Sign In`
3. Identifier: **`com.mymotivelife.web`**
4. Continue → Register
5. Open the new Services ID → enable **Sign In with Apple** → **Configure**
6. **Primary App ID:** select **`com.mymotivelife.app`**
7. **Domains and Subdomains:**

   ```
   www.mymotivelife.com
   ```

8. **Return URLs:**

   ```
   https://www.mymotivelife.com/api/auth/apple/callback
   ```

9. **Save** → **Continue** → **Save**

→ `APPLE_SIGNIN_CLIENT_ID` = `com.mymotivelife.web`

### 2.4 Create a Sign in with Apple key (.p8)

1. Left menu → **Keys** → **+**
2. Key Name: `MotiveLife Sign In with Apple`
3. Enable **Sign in with Apple** → **Configure** → select Primary App ID **`com.mymotivelife.app`** → Save
4. Continue → Register
5. **Download** the `.p8` file **once** (you cannot download again)
6. Note the **Key ID** (10 characters) → `APPLE_SIGNIN_KEY_ID`

**Save the `.p8` in a password manager / encrypted backup immediately** (path, Key ID, Team ID, Services ID).

### 2.5 Put secrets in Vercel

1. [Vercel](https://vercel.com) → **motivelife-web** → **Settings** → **Environment Variables**
2. Environment: **Production** (and Preview if you want)
3. Add:

| Key | Value |
|-----|--------|
| `APPLE_SIGNIN_CLIENT_ID` | `com.mymotivelife.web` |
| `APPLE_SIGNIN_TEAM_ID` | your 10-char Team ID |
| `APPLE_SIGNIN_KEY_ID` | Key ID from §2.4 |
| `APPLE_SIGNIN_PRIVATE_KEY` | Full PEM contents of the `.p8` |

**How to paste the private key in Vercel:**

- Open the `.p8` in a text editor
- Copy everything including:

  ```
  -----BEGIN PRIVATE KEY-----
  ...
  -----END PRIVATE KEY-----
  ```

- In Vercel, either paste with real newlines, **or** replace each newline with `\n` so it’s one line

Optional:

| Key | Value |
|-----|--------|
| `APPLE_SIGNIN_REDIRECT_URI` | `https://www.mymotivelife.com/api/auth/apple/callback` |

4. **Deployments** → latest Production → **⋯** → **Redeploy** (required after new env vars)

### 2.6 Test Apple

1. After redeploy, open https://www.mymotivelife.com/api/auth/oauth-providers  
   → expect `"apple": true`
2. https://www.mymotivelife.com/login → **Apple** button visible
3. Sign in with Apple ID → land on dashboard
4. Register flow: accept legal checkboxes first, then Apple

**If it fails:**

| Symptom | Fix |
|---------|-----|
| `"apple": false` | Env vars missing/typo, or no redeploy |
| `invalid_client` / token errors | Wrong Team ID / Key ID / PEM / Services ID |
| Return URL error | Domains/Return URL must match §2.3 exactly (`www`) |

---

## Quick “done” checklist

- [ ] Google Cloud project number **176555209052** selected (MotiveLife Calendar client)
- [ ] JS origins: `https://www.mymotivelife.com` + `http://localhost:3002`
- [ ] Redirect URI for Calendar callback present
- [ ] `/login` Google sign-in works in incognito
- [ ] Apple Services ID `com.mymotivelife.web` + key in Vercel
- [ ] Redeployed after Apple env vars
- [ ] `/api/auth/oauth-providers` shows `"google":true,"apple":true`
