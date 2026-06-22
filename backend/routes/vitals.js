/**
 * routes/vitals.js
 * Live vital-sign routes — proxies ESP8266 / MAX30102 sensor data from
 * Firebase Realtime Database so the React frontend can consume it without
 * needing direct Firebase access.
 *
 * GET /api/vitals/latest          — most recent sensor reading
 * GET /api/vitals/history?limit=N — last N readings (default 20, max 100)
 *
 * These endpoints are intentionally public (no JWT required) so the
 * patient dashboard can poll them for live display.
 */

const express = require('express');
const {
  getLatestVitals,
  getVitalsHistory,
} = require('../services/firebaseVitalsService');

const router = express.Router();

// ─── GET /api/vitals/latest ───────────────────────────────────────────────────
/**
 * @route   GET /api/vitals/latest
 * @desc    Return the single most recent heartRate + SpO2 reading from Firebase.
 * @access  Public
 */
router.get('/latest', async (_req, res) => {
  try {
    const vitals = await getLatestVitals();

    if (!vitals) {
      return res.status(404).json({
        success: false,
        message: 'No sensor readings found in Firebase yet.',
      });
    }

    res.json({ success: true, vitals });
  } catch (err) {
    console.error('GET /vitals/latest error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/vitals/history ──────────────────────────────────────────────────
/**
 * @route   GET /api/vitals/history
 * @desc    Return the last N readings from Firebase, newest first.
 * @query   limit {number} — number of records to return (default 20, max 100)
 * @access  Public
 */
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const vitals = await getVitalsHistory(limit);

    res.json({ success: true, count: vitals.length, vitals });
  } catch (err) {
    console.error('GET /vitals/history error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
