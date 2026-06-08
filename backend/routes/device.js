/**
 * routes/device.js
 * IoT device (ESP32 / hardware sensor) routes for the Vital X API.
 * Authenticated via DEVICE_API_KEY (x-api-key header), NOT a user JWT.
 *
 * POST /api/device/reading  — submit a raw reading from a physical device
 * GET  /api/device/ping     — heartbeat / connectivity check
 */

const express = require('express');
const mongoose = require('mongoose');
const deviceAuth = require('../middleware/deviceAuth');
const Patient    = require('../models/Patient');
const { processReading } = require('./readings');

const router = express.Router();

// ─── GET /api/device/ping ─────────────────────────────────────────────────────
/**
 * @route   GET /api/device/ping
 * @desc    Simple liveness probe for IoT devices to verify API reachability.
 *          Does NOT require the device API key so it can be used pre-auth.
 * @access  Public
 */
router.get('/ping', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Vital X device API is reachable.',
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /api/device/reading ─────────────────────────────────────────────────
/**
 * @route   POST /api/device/reading
 * @desc    Accept a vital-sign reading submitted directly from an IoT device.
 *          Runs the full classification, persistence, and alert pipeline.
 *          The capturedBy field is null (device), captureContext is 'home'.
 *
 * @access  Device — requires x-api-key header matching DEVICE_API_KEY
 *
 * Body: {
 *   deviceId:     string  — unique hardware identifier (e.g. ESP32 MAC)
 *   patientId:    string  — Patient ObjectId (stored on device after provisioning)
 *   spo2:         number  — SpO2 percentage
 *   heartRate:    number  — heart rate in bpm
 *   timestamp?:   string  — ISO 8601 (device clock); defaults to server time
 *   gpsCoordinates?: { lat: number, lng: number }
 * }
 */
router.post('/reading', deviceAuth, async (req, res) => {
  try {
    const {
      deviceId,
      patientId,
      spo2,
      heartRate,
      timestamp,
      gpsCoordinates = null,
    } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    const validationErrors = [];

    if (!deviceId || typeof deviceId !== 'string') {
      validationErrors.push('deviceId is required and must be a string.');
    }
    if (!patientId) {
      validationErrors.push('patientId is required.');
    } else if (!mongoose.Types.ObjectId.isValid(patientId)) {
      validationErrors.push('patientId is not a valid ObjectId.');
    }
    if (typeof spo2 !== 'number' || spo2 < 0 || spo2 > 100) {
      validationErrors.push('spo2 must be a number between 0 and 100.');
    }
    if (typeof heartRate !== 'number' || heartRate < 0 || heartRate > 300) {
      validationErrors.push('heartRate must be a number between 0 and 300.');
    }
    if (gpsCoordinates) {
      if (
        typeof gpsCoordinates.lat !== 'number' ||
        typeof gpsCoordinates.lng !== 'number'
      ) {
        validationErrors.push('gpsCoordinates must contain numeric lat and lng fields.');
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: validationErrors,
      });
    }

    // ── Parse timestamp ───────────────────────────────────────────────────────
    let readingTime = new Date();
    if (timestamp) {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        readingTime = parsed;
      } else {
        console.warn(`Device "${deviceId}" sent an unparseable timestamp: "${timestamp}". Using server time.`);
      }
    }

    // ── Run shared processing pipeline ────────────────────────────────────────
    // capturedBy = null  (IoT device, not a user)
    // captureContext = 'home'  (remote monitoring)
    const { reading, classification, alert } = await processReading({
      patientId,
      spo2,
      heartRate,
      captureContext:  'home',
      capturedBy:      null,
      deviceId:        deviceId.trim(),
      sessionId:       null,
      gpsCoordinates,
      timestamp:       readingTime,
    });

    // Log device activity for monitoring
    console.log(
      `📡  Device "${deviceId}" → patient ${patientId}: ` +
      `SpO2=${spo2}% HR=${heartRate}bpm STATUS=${classification.status}`
    );

    res.status(201).json({
      success:        true,
      message:        'Device reading accepted and processed.',
      readingId:      reading._id,
      status:         classification.status,
      trendDirection: classification.trendDirection,
      suggestedAction: classification.suggestedAction,
      alertCreated:   alert !== null,
      timestamp:      reading.timestamp,
    });
  } catch (err) {
    console.error('POST /device/reading error:', err.message);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

module.exports = router;
