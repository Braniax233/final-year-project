/**
 * services/firebaseVitalsService.js
 * Reads vital-sign data pushed by the ESP8266 / MAX30102 sensor from
 * Firebase Realtime Database and returns it in a normalised format.
 *
 * Supports both Firebase write strategies used by the hardware:
 *
 *   pushJSON  → /vitals/{randomPushKey} → { heartRate, spo2, timestamp }
 *   setJSON   → /vitals/latest          → { heartRate, spo2, timestamp }
 *
 * getLatestVitals() tries /vitals/latest first; if that node is absent or
 * empty it falls back to querying the last entry inserted via pushJSON.
 */

const { firebaseGet } = require('../config/firebase');

/**
 * getLatestVitals
 * Returns the most recent sensor reading from Firebase.
 *
 * @returns {Promise<{ heartRate: number, spo2: number, timestamp: number } | null>}
 */
async function getLatestVitals() {
  // ── Strategy 1: fixed /vitals/latest node (setJSON approach) ────────────────
  try {
    const latest = await firebaseGet('vitals/latest');
    if (latest && typeof latest.heartRate === 'number') {
      return latest;
    }
  } catch (_) {
    // Node doesn't exist or read failed — fall through to strategy 2
  }

  // ── Strategy 2: last entry from pushJSON (random-key children) ───────────────
  const data = await firebaseGet('vitals', {
    orderBy:     '"$key"',
    limitToLast: 1,
  });

  if (!data || typeof data !== 'object') return null;

  const entries = Object.values(data);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

/**
 * getVitalsHistory
 * Returns up to `limit` recent readings from Firebase, newest first.
 * Works with both pushJSON (random-key children) and mixed structures.
 *
 * @param {number} [limit=20] — Maximum number of readings to return (capped at 100)
 * @returns {Promise<Array<{ id: string, heartRate: number, spo2: number, timestamp: number }>>}
 */
async function getVitalsHistory(limit = 20) {
  const data = await firebaseGet('vitals', {
    orderBy:     '"$key"',
    limitToLast: Math.min(limit, 100),
  });

  if (!data || typeof data !== 'object') return [];

  return Object.entries(data)
    .filter(([key, val]) => key !== 'latest' && val && typeof val.heartRate === 'number')
    .map(([key, val]) => ({ id: key, ...val }))
    .sort((a, b) => b.timestamp - a.timestamp); // newest first
}

module.exports = { getLatestVitals, getVitalsHistory };
