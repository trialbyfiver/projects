# Security Review — Grocery List App
**Date:** 2026-03-14
**Reviewed files:** `app.js`, `firebase-config.js`, `sw.js`, `manifest.json`, `index.html`, `style.css`

---

## Summary

| Severity | Count |
|---|---|
| 🔴 High | 2 |
| 🟡 Medium | 4 |
| 🟢 Low / Hardening | 4 |

---

## 🔴 High

### H1 — API key exposed in public GitHub repository
**File:** `firebase-config.js`
**Issue:** The Firebase API key, app ID, and measurement ID are committed to a public GitHub repo (`trialbyfiver/projects`). Anyone can view them in git history.
**Risk:** Unauthorized use of your Firebase project, quota abuse, unexpected billing.
**Fix:**
- Restrict the API key to `grocery-list-c16cb.web.app` in [Google Cloud Console → APIs → Credentials](https://console.cloud.google.com/apis/credentials)
- Enforce Firebase App Check (reCAPTCHA v3) to block unauthorized clients
- The key cannot be removed from git history without a rewrite — consider rotating it in the Google Cloud Console

---

### H2 — Firestore Security Rules not verified in this review
**File:** Firebase Console (not in codebase)
**Issue:** The Firestore rules are managed in the Firebase Console and are not stored or version-controlled alongside the code. If rules were accidentally left in test mode (`allow read, write: if true`), any authenticated or unauthenticated user could read/write all lists.
**Risk:** Full data exposure or corruption by any internet user.
**Fix:**
- Add `firestore.rules` to the project directory and deploy via `firebase deploy --only firestore:rules`
- Minimum recommended rule:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lists/{listId}/items/{itemId} {
      allow read, write: if request.auth != null && listId.size() == 36;
    }
  }
}
```

---

## 🟡 Medium

### M1 — No input length limits on item and amount fields
**File:** `index.html`, `app.js`
**Issue:** The `item` and `amount` text inputs have no `maxlength` attribute, and `app.js` does not enforce a max length before writing to Firestore.
**Risk:** A user could submit very large strings, bloating the Firestore document size (max 1MB per document) or causing UI rendering issues.
**Fix:** Add `maxlength="200"` to `input-item` and `maxlength="50"` to `input-amount` in HTML, and validate length in `app.js` before `addDoc`.

---

### M2 — List ID accepted from URL without validation
**File:** `app.js` — `getListId()`
**Issue:** The `list` query parameter is taken directly from the URL and used as a Firestore collection path (`lists/{listId}/items`). There is no validation that it is a valid UUID.
**Risk:** A crafted URL with a malicious `list` value (e.g. path traversal characters) could attempt unexpected Firestore path access, or cause errors that leak information.
**Fix:** Validate the list ID against a UUID regex before use:
```js
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(id)) { id = crypto.randomUUID(); }
```

---

### M3 — Third-party icon URLs in manifest.json
**File:** `manifest.json`
**Issue:** PWA icons are loaded from `https://via.placeholder.com`, an external third-party service.
**Risk:** If `via.placeholder.com` goes down or changes, the PWA icons break. More critically, loading resources from third parties at install time is a supply-chain risk — a compromised CDN could serve malicious content.
**Fix:** Generate and host real icon files (192×192 and 512×512 PNGs) directly in the project. Tools like [favicon.io](https://favicon.io) can generate them.

---

### M4 — Service worker caches firebase-config.js indefinitely
**File:** `sw.js`
**Issue:** `firebase-config.js` is listed in `ASSETS` and cached by the service worker. If the Firebase config ever needs to be rotated (e.g. after a key compromise), users with a cached version will continue using the old config until the cache version is manually bumped.
**Risk:** Delayed propagation of security-critical config changes.
**Fix:** Either exclude `firebase-config.js` from the service worker cache, or adopt a network-first strategy for it:
```js
if (e.request.url.includes("firebase-config.js")) {
  e.respondWith(fetch(e.request));
  return;
}
```

---

## 🟢 Low / Hardening

### L1 — No Content Security Policy (CSP) header
**File:** `firebase.json` (hosting config)
**Issue:** No CSP header is set, meaning the browser will load scripts from any origin.
**Risk:** Increases XSS impact if any injection point is found.
**Fix:** Add a CSP to `firebase.json` hosting headers:
```json
"headers": [{
  "source": "**",
  "headers": [{
    "key": "Content-Security-Policy",
    "value": "default-src 'self'; script-src 'self' https://www.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; img-src 'self' https://lh3.googleusercontent.com data:; style-src 'self' 'unsafe-inline'"
  }]
}]
```

---

### L2 — Error messages from Firebase exposed to users
**File:** `app.js` lines 27–29
**Issue:** `err.message` from Firebase SDK is shown directly in the UI (`authError.textContent`). Firebase error messages can reveal internal details (e.g. `auth/internal-error`).
**Risk:** Low — but can aid an attacker in enumerating auth behaviour.
**Fix:** Map known error codes to user-friendly messages:
```js
const MSG = {
  "auth/popup-blocked": "Popup was blocked. Please allow popups and try again.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
};
authError.textContent = MSG[err.code] || "Sign-in failed. Please try again.";
```

---

### L3 — No delete confirmation
**File:** `app.js` lines 175–179
**Issue:** Tapping the ✕ delete button immediately deletes the item from Firestore with no confirmation.
**Risk:** Accidental deletes with no undo, especially on mobile where tap targets are close.
**Fix:** Show a brief confirmation (e.g. inline "Are you sure?" or a swipe-to-delete pattern) before calling `deleteDoc`.

---

### L4 — signOut does not clear local state
**File:** `app.js` line 34
**Issue:** `signOut(auth)` is called but the `?list=` URL parameter remains in the address bar. If the device is shared, the next person who opens the URL could access the same list once they sign in.
**Risk:** Low for private devices, moderate for shared devices.
**Fix:** Clear the URL parameter on sign-out:
```js
signoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.history.replaceState({}, "", window.location.pathname);
});
```

---

## What's Already Done Well ✅

- HTML output is escaped via `escHtml()` — XSS from Firestore data is mitigated
- Google Sign-In is required before any data access
- `crypto.randomUUID()` is used for list IDs (cryptographically secure)
- Firebase Auth state is properly cleaned up on sign-out (`unsubscribeItems`)
- `serverTimestamp()` is used instead of client-side dates (tamper-resistant ordering)
