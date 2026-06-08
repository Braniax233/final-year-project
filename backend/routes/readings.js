/**
 * routes/readings.js
 * Vital-sign reading submission and retrieval routes.
 *
 * POST /api/readings       — submit a reading (runs classification + alert pipeline)
 * GET  /api/readings/:id   — retrieve a single reading by ID
 */

const express = require('express');
const mongoose = require('mongoose');
const Patient  = require('../models/Patient');
const Reading  = require('../models/Reading');
const Alert    = require('../models/Alert');
const { protect, restrictTo } = require('../middleware/auth');
const { classifyReading }     = require('../engines/classificationEngine');
const { sendCriticalAlert }   = require('../services/hubtelService');

const router = express.Router();

// All reading routes require authentication
router.use(protect);

// ─── Shared reading pipeline ───────────────────────────────────────────────────
/**
 * processReading
 * Core pipeline shared between the user-facing and device reading endpoints.
 * Accepts the raw measurement data, runs classification, persists the reading,
 * creates alerts and fires SMS on WARNING/CRITICAL, then returns the result.
 *
 * @param {object} params
 * @param {string}  params.patientId
 * @param {number}  params.spo2
 * @param {number}  params.heartRate
 * @param {string}  params.captureContext — 'clinical' | 'home'
 * @param {string|null} params.capturedBy — User ObjectId (null for devices)
 * @param {string|null} params.deviceId
 * @param {string|null} params.sessionId
 * @param {object|null} params.gpsCoordinates — { lat, lng } | null
 * @param {Date}    params.timestamp
 * @returns {Promise<{ reading, classification, alert: alert|null }>}
 */
async function processReading({
  patientId,
  spo2,
  heartRate,
  captureContext = 'clinical',
  capturedBy     = null,
  deviceId       = null,
  sessionId      = null,
  gpsCoordinates = null,
  timestamp      = new Date(),
}) {
  // ── 1. Load patient with threshold ─────────────────────────────────────────
  const patient = await Patient.findById(patientId);
  if (!patient) {
    const err = new Error(`Patient with ID "${patientId}" not found.`);
    err.status = 404;
    throw err;
  }

  // ── 2. Fetch recent readings for trend analysis ─────────────────────────────
  // Retrieve one more than trendWindow in case the oldest is needed for slope calc
  const trendWindow = (patient.threshold && patient.threshold.trendWindow) || 5;
  const recentReadings = await Reading.find({ patientId })
    .sort({ timestamp: -1 })
    .limit(trendWindow + 1)
    .select('spo2 heartRate timestamp status');

  // ── 3. Run classification engine ────────────────────────────────────────────
  const classification = classifyReading(
    spo2,
    heartRate,
    patient.threshold ? patient.threshold.toObject() : {},
    recentReadings
  );

  // ── 4. Persist reading ──────────────────────────────────────────────────────
  const reading = await Reading.create({
    patientId,
    capturedBy,
    captureContext,
    spo2,
    heartRate,
    status:         classification.status,
    trendDirection: classification.trendDirection,
    timestamp,
    deviceId,
    sessionId,
    details:        classification.details,
  });

  // ── 5. Create alert for WARNING and CRITICAL readings ──────────────────────
  let alert = null;
  if (classification.status !== 'NORMAL') {
    alert = new Alert({
      patientId,
      readingId: reading._id,
      severity:  classification.status,
      message:   classification.suggestedAction,
      timestamp: reading.timestamp,
      gpsCoordinates: gpsCoordinates || { lat: null, lng: null },
    });

    // ── 6. Send SMS for CRITICAL readings ───────────────────────────────────
    if (classification.status === 'CRITICAL') {
      const phones = (patient.emergencyContacts || [])
        .map((c) => c.phone)
        .filter(Boolean);

      if (phones.length > 0) {
        try {
          const smsResults = await sendCriticalAlert(patient, reading, gpsCoordinates, phones);
          const allDelivered = smsResults.every((r) => r.success);
          alert.smsDelivered = allDelivered;
          alert.smsSentTo    = phones;
          console.log(
            `📱  CRITICAL alert SMS: ${smsResults.filter((r) => r.success).length}/${phones.length} delivered`
          );
        } catch (smsErr) {
          // SMS failure must not block the reading from being saved
          console.error('SMS dispatch error:', smsErr.message);
          alert.smsDelivered = false;
          alert.smsSentTo    = phones;
        }
      }
    }

    await alert.save();
  }

  return { reading, classification, alert };
}

// ─── POST /api/readings ────────────────────────────────────────────────────────
/**
 * @route   POST /api/readings
 * @desc    Submit a new vital-sign reading (by a clinician or provider).
 *          Runs the full classification + alert pipeline.
 * @access  Protected — clinicians and providers only
 *
 * Body: { patientId, spo2, heartRate, captureContext?, deviceId?, sessionId?,
 *          gpsCoordinates?, timestamp? }
 */
router.post('/', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    const {
      patientId,
      spo2,
      heartRate,
      captureContext = 'clinical',
      deviceId       = null,
      sessionId      = null,
      gpsCoordinates = null,
      timestamp,
    } = req.body;

    // ── Validate required fields ─────────────────────────────────────────────
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'patientId is required.' });
    }
    if (typeof spo2 !== 'number' || typeof heartRate !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'spo2 and heartRate must be numbers.',
      });
    }
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patientId.' });
    }

    const { reading, classification, alert } = await processReading({
      patientId,
      spo2,
      heartRate,
      captureContext,
      capturedBy: req.user._id,
      deviceId,
      sessionId,
      gpsCoordinates,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Reading submitted successfully.',
      reading,
      classification,
      alert: alert || null,
    });
  } catch (err) {
    console.error('POST /readings error:', err.message);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/readings/:id ─────────────────────────────────────────────────────
/**
 * @route   GET /api/readings/:id
 * @desc    Retrieve a single reading by its ObjectId.
 * @access  Protected
 */
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid reading ID.' });
    }

    const reading = await Reading.findById(req.params.id)
      .populate('patientId', 'name membershipId')
      .populate('capturedBy', 'name role');

    if (!reading) {
      return res.status(404).json({ success: false, message: 'Reading not found.' });
    }

    res.status(200).json({ success: true, reading });
  } catch (err) {
    console.error('GET /readings/:id error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Export processReading so the device route can reuse the same pipeline
module.exports = router;
module.exports.processReading = processReading;
