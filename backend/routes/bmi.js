/**
 * routes/bmi.js
 * BMI calculation and record management routes.
 *
 * POST /api/bmi  — calculate BMI, save record, update patient, return recommendation
 * GET  /api/bmi/patient/:patientId — retrieve BMI history for a patient
 */

const express = require('express');
const mongoose = require('mongoose');
const BmiRecord = require('../models/BmiRecord');
const Patient   = require('../models/Patient');
const { protect, restrictTo }          = require('../middleware/auth');
const { calculateBMI, classifyBMI, generateThresholdRecommendation } = require('../engines/bmiEngine');

const router = express.Router();

// All BMI routes require authentication
router.use(protect);

// ─── POST /api/bmi ─────────────────────────────────────────────────────────────
/**
 * @route   POST /api/bmi
 * @desc    Calculate BMI from weight and height, persist the record, and update
 *          the patient's bmi sub-document and threshold recommendation.
 *
 * @access  Protected — clinicians and providers only
 *
 * Body: { patientId, weight (kg), height (cm) }
 *
 * Returns: { bmiRecord, classification, thresholdRecommendation, patient }
 */
router.post('/', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    const { patientId, weight, height } = req.body;

    // ── Validate ────────────────────────────────────────────────────────────
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'patientId is required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patientId.' });
    }
    if (typeof weight !== 'number' || weight <= 0) {
      return res.status(400).json({
        success: false,
        message: 'weight must be a positive number (kg).',
      });
    }
    if (typeof height !== 'number' || height <= 0) {
      return res.status(400).json({
        success: false,
        message: 'height must be a positive number (cm).',
      });
    }

    // ── Load patient ────────────────────────────────────────────────────────
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    // ── Run BMI engine ──────────────────────────────────────────────────────
    const bmiValue         = calculateBMI(weight, height);
    const classification   = classifyBMI(bmiValue);
    const recommendation   = generateThresholdRecommendation(classification);

    // ── Save BMI record ─────────────────────────────────────────────────────
    const bmiRecord = await BmiRecord.create({
      patientId,
      recordedBy:              req.user._id,
      weight,
      height,
      bmi:                     bmiValue,
      classification,
      thresholdRecommendation: recommendation,
    });

    // ── Update patient's bmi sub-document and apply threshold recommendation ─
    patient.bmi = {
      weight,
      height,
      value:          bmiValue,
      classification,
    };

    // Apply the recommendation to the patient's threshold (preserving any
    // manual overrides for warningMargin and trendWindow)
    patient.threshold = {
      ...( patient.threshold ? patient.threshold.toObject() : {} ),
      spo2Min: recommendation.spo2Min,
      spo2Max: recommendation.spo2Max,
      hrMin:   recommendation.hrMin,
      hrMax:   recommendation.hrMax,
    };

    await patient.save();

    res.status(201).json({
      success: true,
      message: `BMI calculated: ${bmiValue} kg/m² — ${classification}`,
      bmiRecord,
      classification,
      thresholdRecommendation: recommendation,
      patient,
    });
  } catch (err) {
    console.error('POST /bmi error:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/bmi/patient/:patientId ──────────────────────────────────────────
/**
 * @route   GET /api/bmi/patient/:patientId
 * @desc    Retrieve the BMI measurement history for a specific patient.
 * @access  Protected
 */
router.get('/patient/:patientId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patientId.' });
    }

    const records = await BmiRecord.find({ patientId: req.params.patientId })
      .sort({ timestamp: -1 })
      .populate('recordedBy', 'name role');

    res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (err) {
    console.error('GET /bmi/patient/:patientId error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
