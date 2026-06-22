/**
 * api/vitals.js
 * Frontend helpers for the live sensor (ESP8266 / MAX30102) vitals endpoints.
 * Data originates from Firebase Realtime Database and is proxied by the backend.
 */

import api from './axios';

/**
 * getLatestVitals
 * Fetches the single most recent reading from the hardware sensor.
 *
 * @returns {Promise<{ heartRate: number, spo2: number, timestamp: number }>}
 */
export const getLatestVitals = () =>
  api.get('/vitals/latest').then((r) => r.data.vitals);

/**
 * getVitalsHistory
 * Fetches the last `limit` sensor readings (newest first).
 *
 * @param {number} [limit=20]
 * @returns {Promise<Array<{ id: string, heartRate: number, spo2: number, timestamp: number }>>}
 */
export const getVitalsHistory = (limit = 20) =>
  api.get(`/vitals/history?limit=${limit}`).then((r) => r.data.vitals);
