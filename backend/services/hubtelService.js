/**
 * services/hubtelService.js
 * Hubtel SMS gateway integration for the Vital X system.
 *
 * Uses Hubtel's SMSC API v1 with HTTP Basic auth.
 * Docs: https://developers.hubtel.com/docs/send-message-api
 *
 * Exported functions:
 *   sendSMS(to, message)                                     — raw SMS send
 *   sendCriticalAlert(patient, reading, gpsCoords, phones)   — pre-built critical alert
 */

const axios = require('axios');

const HUBTEL_SMSC_URL = 'https://smsc.hubtel.com/v1/messages/send';

// ─── Axios instance pre-configured for Hubtel ─────────────────────────────────
/**
 * hubtelAxios
 * Creates a fresh Axios config object per request so that env vars are read
 * at call-time (supports runtime env injection in containerised deployments).
 *
 * @returns {import('axios').AxiosRequestConfig}
 */
function hubtelConfig() {
  return {
    auth: {
      username: process.env.HUBTEL_CLIENT_ID,
      password: process.env.HUBTEL_CLIENT_SECRET,
    },
    headers: { 'Content-Type': 'application/json' },
    timeout: 10_000, // 10 s timeout — SMS gateway should respond quickly
  };
}

// ─── sendSMS ──────────────────────────────────────────────────────────────────

/**
 * sendSMS
 * Sends a single SMS message through the Hubtel SMSC gateway.
 *
 * @param {string} to      — recipient phone number (E.164 format, e.g. "+233201234567")
 * @param {string} message — plain-text message body (max 160 chars per segment)
 * @returns {Promise<{ success: boolean, data: any }>}
 */
async function sendSMS(to, message) {
  if (!to || !message) {
    throw new Error('sendSMS: "to" and "message" are required.');
  }

  // Sanitise the phone number — Hubtel expects digits only or E.164
  const cleanNumber = to.replace(/\s+/g, '');

  const payload = {
    From:    process.env.HUBTEL_SENDER_ID || 'VitalX',
    To:      cleanNumber,
    Content: message,
  };

  try {
    const response = await axios.post(HUBTEL_SMSC_URL, payload, hubtelConfig());
    console.log(`📱  SMS sent to ${cleanNumber} — status: ${response.status}`);
    return { success: true, data: response.data };
  } catch (err) {
    // Extract the most useful error info from Axios error shape
    const errMessage = err.response
      ? `Hubtel API error ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;

    console.error(`❌  SMS failed to ${cleanNumber}: ${errMessage}`);
    // Return failure rather than throwing so one bad number doesn't block others
    return { success: false, error: errMessage, to: cleanNumber };
  }
}

// ─── sendCriticalAlert ────────────────────────────────────────────────────────

/**
 * sendCriticalAlert
 * Builds and dispatches a pre-formatted critical vitals alert SMS to one or
 * more recipients (typically a patient's emergency contacts).
 *
 * The message includes:
 *   - Patient name and membership ID
 *   - Current SpO2 and heart-rate values
 *   - Alert timestamp
 *   - A Google Maps link if GPS coordinates were provided
 *
 * All recipient SMSes are sent concurrently via Promise.allSettled so that
 * one failed delivery does not block the others.
 *
 * @param {object}   patient            — Patient document
 * @param {string}   patient.name       — patient full name
 * @param {string}   patient.membershipId — patient membership ID
 * @param {object}   reading            — Reading document
 * @param {number}   reading.spo2       — SpO2 value
 * @param {number}   reading.heartRate  — heart rate value
 * @param {object|null} gpsCoordinates  — { lat: number, lng: number } or null
 * @param {string[]} recipientPhones    — array of E.164 phone strings
 *
 * @returns {Promise<Array<{ success: boolean, to: string, data?: any, error?: string }>>}
 */
async function sendCriticalAlert(patient, reading, gpsCoordinates, recipientPhones) {
  if (!recipientPhones || recipientPhones.length === 0) {
    console.warn('sendCriticalAlert: no recipient phones provided — skipping SMS.');
    return [];
  }

  // ── Build GPS location string ───────────────────────────────────────────────
  let locationLine;
  if (
    gpsCoordinates &&
    typeof gpsCoordinates.lat === 'number' &&
    typeof gpsCoordinates.lng === 'number'
  ) {
    locationLine = `Location: https://maps.google.com/?q=${gpsCoordinates.lat},${gpsCoordinates.lng}`;
  } else {
    locationLine = 'Location: Not available';
  }

  // ── Format alert timestamp in a human-readable local string ────────────────
  const alertTime = new Date().toLocaleString('en-GB', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // ── Compose message ────────────────────────────────────────────────────────
  const message = [
    '🚨 CRITICAL ALERT — VitalX',
    `Patient : ${patient.name} (ID: ${patient.membershipId})`,
    `SpO2    : ${reading.spo2}%`,
    `HR      : ${reading.heartRate} bpm`,
    `Time    : ${alertTime}`,
    locationLine,
    'Please respond immediately. This is an automated alert from VitalX Medical Monitoring.',
  ].join('\n');

  // ── Dispatch to all recipients concurrently ────────────────────────────────
  const results = await Promise.allSettled(
    recipientPhones.map((phone) => sendSMS(phone, message))
  );

  // Normalise allSettled results
  return results.map((result, idx) => {
    if (result.status === 'fulfilled') {
      return { ...result.value, to: recipientPhones[idx] };
    }
    return { success: false, to: recipientPhones[idx], error: result.reason?.message };
  });
}

module.exports = { sendSMS, sendCriticalAlert };
