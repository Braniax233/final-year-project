/**
 * routes/patients.js
 * Patient management routes for the Vital X API.
 * All routes require a valid JWT (protect middleware).
 *
 * GET    /api/patients                     — list patients (role-filtered)
 * GET    /api/patients/lookup/:membershipId — find by membership ID
 * GET    /api/patients/barcode/:barcode    — find by barcode
 * GET    /api/patients/:id                 — patient detail + latest reading
 * POST   /api/patients                     — create patient
 * PUT    /api/patients/:id                 — update patient
 * PUT    /api/patients/:id/threshold       — update thresholds (returns BMI rec)
 * GET    /api/patients/:id/readings        — reading history (desc, limit 50)
 * GET    /api/patients/:id/alerts          — alert history
 */

const express = require('express');
const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Reading = require('../models/Reading');
const Alert   = require('../models/Alert');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All patient routes require authentication
router.use(protect);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * buildPatientFilter
 * Constructs a Mongoose query filter based on the requesting user's role.
 *   clinician → only see their assigned patients
 *   provider  → see all patients
 *   patient   → see only their own record (via patientId on their User doc)
 */
function buildPatientFilter(user) {
  if (user.role === 'clinician') {
    return { assignedClinicianId: user._id };
  }
  if (user.role === 'patient') {
    return { _id: user.patientId };
  }
  // provider — no filter
  return {};
}

/**
 * isValidObjectId — quick guard to avoid Mongoose CastError on bad IDs
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ─── GET /api/patients/lookup/:membershipId ────────────────────────────────────
/**
 * @route   GET /api/patients/lookup/:membershipId
 * @desc    Find a patient by their membership ID (case-insensitive)
 * @access  Protected
 */
router.get('/lookup/:membershipId', async (req, res) => {
  try {
    const filter = {
      ...buildPatientFilter(req.user),
      membershipId: req.params.membershipId.toUpperCase(),
    };

    const patient = await Patient.findOne(filter).populate(
      'assignedClinicianId',
      'name email department'
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: `No patient found with membership ID "${req.params.membershipId}".`,
      });
    }

    res.status(200).json({ success: true, patient });
  } catch (err) {
    console.error('GET /patients/lookup/:membershipId error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/patients/barcode/:barcode ───────────────────────────────────────
/**
 * @route   GET /api/patients/barcode/:barcode
 * @desc    Find a patient by their barcode value
 * @access  Protected
 */
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const filter = {
      ...buildPatientFilter(req.user),
      barcode: req.params.barcode,
    };

    const patient = await Patient.findOne(filter).populate(
      'assignedClinicianId',
      'name email department'
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: `No patient found with barcode "${req.params.barcode}".`,
      });
    }

    res.status(200).json({ success: true, patient });
  } catch (err) {
    console.error('GET /patients/barcode/:barcode error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/patients ────────────────────────────────────────────────────────
/**
 * @route   GET /api/patients
 * @desc    Return all patients the requesting user is authorised to see.
 *          Supports ?search= and ?isActive= query params.
 * @access  Protected
 */
router.get('/', async (req, res) => {
  try {
    const { search, isActive } = req.query;

    const filter = buildPatientFilter(req.user);

    // Optional active status filter
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Optional name / membershipId text search
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [
        { name: re },
        { membershipId: re },
        { primaryCondition: re },
      ];
    }

    const patients = await Patient.find(filter)
      .populate('assignedClinicianId', 'name email department')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: patients.length,
      patients,
    });
  } catch (err) {
    console.error('GET /patients error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/patients/:id ────────────────────────────────────────────────────
/**
 * @route   GET /api/patients/:id
 * @desc    Return a single patient record with their most recent reading.
 * @access  Protected
 */
router.get('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    const filter = { _id: req.params.id, ...buildPatientFilter(req.user) };

    const patient = await Patient.findOne(filter).populate(
      'assignedClinicianId',
      'name email department phone'
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    // Attach the most recent reading
    const latestReading = await Reading.findOne({ patientId: patient._id })
      .sort({ timestamp: -1 })
      .populate('capturedBy', 'name role');

    res.status(200).json({
      success: true,
      patient,
      latestReading: latestReading || null,
    });
  } catch (err) {
    console.error('GET /patients/:id error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/patients ───────────────────────────────────────────────────────
/**
 * @route   POST /api/patients
 * @desc    Create a new patient record.
 * @access  Protected — clinicians and providers only
 */
router.post('/', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    const {
      membershipId, barcode, name, dob, gender, bloodGroup,
      assignedClinicianId, bmi, threshold, emergencyContacts,
      locationSharingConsent, address, primaryCondition,
      allergies, medications, photo, isActive,
    } = req.body;

    if (!membershipId || !name) {
      return res.status(400).json({
        success: false,
        message: 'membershipId and name are required.',
      });
    }

    // If a clinician is creating the patient, default to themselves as clinician
    const clinicianId =
      assignedClinicianId ||
      (req.user.role === 'clinician' ? req.user._id : null);

    const patient = await Patient.create({
      membershipId,
      barcode:     barcode || '',
      name,
      dob:         dob || null,
      gender:      gender || '',
      bloodGroup:  bloodGroup || '',
      assignedClinicianId: clinicianId,
      bmi:         bmi || {},
      threshold:   threshold || {},
      emergencyContacts: emergencyContacts || [],
      locationSharingConsent: locationSharingConsent || false,
      address:          address || '',
      primaryCondition: primaryCondition || '',
      allergies:        allergies || '',
      medications:      medications || '',
      photo:            photo || '',
      isActive:         isActive !== undefined ? isActive : true,
    });

    res.status(201).json({
      success: true,
      message: 'Patient created successfully.',
      patient,
    });
  } catch (err) {
    console.error('POST /patients error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A patient with that membership ID already exists.',
      });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/patients/:id ────────────────────────────────────────────────────
/**
 * @route   PUT /api/patients/:id
 * @desc    Update an existing patient record (partial update supported).
 * @access  Protected — clinicians and providers only
 */
router.put('/:id', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    const filter = { _id: req.params.id, ...buildPatientFilter(req.user) };

    // Prevent overwriting the _id or membershipId (use the dedicated route for that)
    const { _id, membershipId: _mid, ...updates } = req.body;

    const patient = await Patient.findOneAndUpdate(
      filter,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('assignedClinicianId', 'name email');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or you are not authorised to update this record.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Patient updated successfully.',
      patient,
    });
  } catch (err) {
    console.error('PUT /patients/:id error:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/patients/:id/threshold ──────────────────────────────────────────
/**
 * @route   PUT /api/patients/:id/threshold
 * @desc    Update a patient's monitoring thresholds.
 *          Returns the updated patient and the BMI-based recommendations for context.
 * @access  Protected — clinicians and providers only
 */
router.put('/:id/threshold', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    const { spo2Min, spo2Max, hrMin, hrMax, warningMargin, trendWindow } = req.body;

    // Build only the fields that were explicitly supplied
    const thresholdUpdate = {};
    if (spo2Min        !== undefined) thresholdUpdate['threshold.spo2Min']       = spo2Min;
    if (spo2Max        !== undefined) thresholdUpdate['threshold.spo2Max']       = spo2Max;
    if (hrMin          !== undefined) thresholdUpdate['threshold.hrMin']         = hrMin;
    if (hrMax          !== undefined) thresholdUpdate['threshold.hrMax']         = hrMax;
    if (warningMargin  !== undefined) thresholdUpdate['threshold.warningMargin'] = warningMargin;
    if (trendWindow    !== undefined) thresholdUpdate['threshold.trendWindow']   = trendWindow;

    if (Object.keys(thresholdUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No threshold fields provided in the request body.',
      });
    }

    const filter = { _id: req.params.id, ...buildPatientFilter(req.user) };

    const patient = await Patient.findOneAndUpdate(
      filter,
      { $set: thresholdUpdate },
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or you are not authorised to update this record.',
      });
    }

    // Return BMI-based recommendation alongside so the UI can compare
    const { generateThresholdRecommendation } = require('../engines/bmiEngine');
    let bmiRecommendation = null;
    if (patient.bmi && patient.bmi.classification) {
      try {
        bmiRecommendation = generateThresholdRecommendation(patient.bmi.classification);
      } catch (_) {
        // Classification may not be set yet — silently skip
      }
    }

    res.status(200).json({
      success: true,
      message: 'Thresholds updated successfully.',
      patient,
      bmiRecommendation,
    });
  } catch (err) {
    console.error('PUT /patients/:id/threshold error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/patients/:id/readings ───────────────────────────────────────────
/**
 * @route   GET /api/patients/:id/readings
 * @desc    Return the reading history for a patient (newest first, max 50).
 *          Supports optional ?limit= and ?status= query filters.
 * @access  Protected
 */
router.get('/:id/readings', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    // Verify the requesting user can access this patient
    const patientFilter = { _id: req.params.id, ...buildPatientFilter(req.user) };
    const patientExists = await Patient.exists(patientFilter);
    if (!patientExists) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or access denied.',
      });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const readingFilter = { patientId: req.params.id };
    if (req.query.status) readingFilter.status = req.query.status.toUpperCase();

    const readings = await Reading.find(readingFilter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('capturedBy', 'name role');

    res.status(200).json({
      success: true,
      count: readings.length,
      readings,
    });
  } catch (err) {
    console.error('GET /patients/:id/readings error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/patients/:id/alerts ─────────────────────────────────────────────
/**
 * @route   GET /api/patients/:id/alerts
 * @desc    Return the alert history for a patient (newest first).
 *          Supports optional ?isResolved= query filter.
 * @access  Protected
 */
router.get('/:id/alerts', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    // Verify access
    const patientFilter = { _id: req.params.id, ...buildPatientFilter(req.user) };
    const patientExists = await Patient.exists(patientFilter);
    if (!patientExists) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or access denied.',
      });
    }

    const alertFilter = { patientId: req.params.id };
    if (req.query.isResolved !== undefined) {
      alertFilter.isResolved = req.query.isResolved === 'true';
    }

    const alerts = await Alert.find(alertFilter)
      .sort({ timestamp: -1 })
      .limit(100)
      .populate('readingId')
      .populate('resolvedBy', 'name role');

    res.status(200).json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (err) {
    console.error('GET /patients/:id/alerts error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
