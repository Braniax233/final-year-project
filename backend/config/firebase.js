/**
 * config/firebase.js
 * Firebase Realtime Database REST client for the Vital X backend.
 *
 * Authenticates against Firebase using email/password (the same credentials
 * stored on the ESP8266), caches the ID token, and exposes a thin helper for
 * authenticated GET requests against the Realtime Database REST API.
 *
 * No extra SDK is required — we reuse the axios instance that is already a
 * project dependency.
 *
 * Required environment variables (add these to your .env file):
 *   FIREBASE_API_KEY        — Web API key shown in Firebase console → Project Settings
 *   FIREBASE_DATABASE_URL   — Realtime Database URL, e.g.
 *                             https://vitalwatch123-default-rtdb.firebaseio.com
 *   FIREBASE_USER_EMAIL     — Firebase Auth account email (same as on the ESP8266)
 *   FIREBASE_USER_PASSWORD  — Firebase Auth account password
 */

const axios = require('axios');

const {
  FIREBASE_API_KEY,
  FIREBASE_DATABASE_URL,
  FIREBASE_USER_EMAIL,
  FIREBASE_USER_PASSWORD,
} = process.env;

// ── Token cache ────────────────────────────────────────────────────────────────
let _cachedToken  = null;
let _tokenExpiry  = 0; // ms since epoch

/**
 * getFirebaseToken
 * Returns a valid Firebase ID token, refreshing it ~60 s before it expires.
 * Firebase tokens are valid for 1 hour by default.
 */
async function getFirebaseToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  if (!FIREBASE_API_KEY || !FIREBASE_USER_EMAIL || !FIREBASE_USER_PASSWORD) {
    throw new Error(
      'Firebase credentials missing. Set FIREBASE_API_KEY, FIREBASE_USER_EMAIL, ' +
      'and FIREBASE_USER_PASSWORD in your .env file.',
    );
  }

  const url =
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` +
    `?key=${FIREBASE_API_KEY}`;

  const { data } = await axios.post(url, {
    email:             FIREBASE_USER_EMAIL,
    password:          FIREBASE_USER_PASSWORD,
    returnSecureToken: true,
  });

  _cachedToken = data.idToken;
  // expiresIn is in seconds; subtract 60 s as a safety buffer
  _tokenExpiry = Date.now() + (parseInt(data.expiresIn, 10) - 60) * 1000;

  return _cachedToken;
}

/**
 * firebaseGet
 * Performs an authenticated GET request against the Realtime Database REST API.
 *
 * @param {string} path     — Database path without leading slash, e.g. "vitals/latest"
 * @param {object} [params] — Additional query params (e.g. orderBy, limitToLast)
 * @returns {Promise<any>}  — Parsed JSON value at that path, or null if absent
 */
async function firebaseGet(path, params = {}) {
  if (!FIREBASE_DATABASE_URL) {
    throw new Error('FIREBASE_DATABASE_URL is not set in your .env file.');
  }

  const token = await getFirebaseToken();
  const { data } = await axios.get(
    `${FIREBASE_DATABASE_URL}/${path}.json`,
    { params: { ...params, auth: token } },
  );
  return data;  // null when the path doesn't exist in Firebase
}

module.exports = { getFirebaseToken, firebaseGet };
