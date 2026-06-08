/**
 * routes/alerts.js
 * Alert management routes for the Vital X API.
 *
 * GET /api/alerts          — list all alerts visible to the current user
 * PUT /api/alerts/:id/resolve — mark an alert as resolved
 */

const express = require('express');
const mongoose = require('mongoose');
const Alert   = require('../models/Alert');
const Patient = require('../models/Patient');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All alert routes require authentication
router.use(protect);

// ─── GET /api/alerts ───────────────────────────────────────────────────────────
/**
 * @route   GET /api/alerts
 * @desc    Return all alerts for patients the current user is authorised to see.
 *          - Clinicians see alerts for their assigned patients only.
 *          - Providers see all alerts.
 *
 *          Supports query params:
 *            ?severity=   NORMAL | WARNING | CRITICAL
 *            ?isResolved= true | false
 *            ?limit=      number (default 100, max 500)
 * @access  Protected
 */
router.get('/', async (req, res) => {
  try {
    // ── Build patient scope filter ──────────────────────────────────────────
    let patientIds = null; // null means "all patients" (provider view)

    if (req.user.role === 'clinician') {
      // Fetch only the IDs of patients assigned to this clinician
      const patients = await Patient.find(
        { assignedClinicianId: req.user._id },
        '_id'
      );
      patientIds = patients.map((p) => p._id);
    } else if (req.user.role === 'patient') {
      // A patient can only see alerts for their own record
      if (!req.user.patientId) {
        return res.status(200).json({ success: true, count: 0, alerts: [] });
      }
      patientIds = [req.user.patientId];
    }

    // ── Build alert query filter ────────────────────────────────────────────
    const filter = {};
    if (patientIds !== null) {
      filter.patientId = { $in: patientIds };
    }

    // Optional severity filter
    if (req.query.severity) {
      filter.severity = req.query.severity.toUpperCase();
    }

    // Optional resolution status filter
    if (req.query.isResolved !== undefined) {
      filter.isResolved = req.query.isResolved === 'true';
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    const alerts = await Alert.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('patientId', 'name membershipId')
      .populate('readingId', 'spo2 heartRate timestamp')
      .populate('resolvedBy', 'name role');

    res.status(200).json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (err) {
    console.error('GET /alerts error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/alerts/:id/resolve ──────────────────────────────────────────────
/**
 * @route   PUT /api/alerts/:id/resolve
 * @desc    Mark a specific alert as resolved.
 *          Sets isResolved=true, resolvedBy=req.user._id, resolvedAt=now.
 * @access  Protected — clinicians and providers only
 */
router.put(
  '/:id/resolve',
  restrictTo('clinician', 'provider'),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid alert ID.' });
      }

      const alert = await Alert.findById(req.params.id).populate(
        'patientId',
        'assignedClinicianId'
      );

      if (!alert) {
        return res.status(404).json({ success: false, message: 'Alert not found.' });
      }

      // Clinicians can only resolve alerts for their own patients
      if (
        req.user.role === 'clinician' &&
        alert.patientId &&
        String(alert.patientId.assignedClinicianId) !== String(req.user._id)
      ) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorised to resolve alerts for this patient.',
        });
      }

      if (alert.isResolved) {
        return res.status(409).json({
          success: false,
          message: 'This alert has already been resolved.',
          alert,
        });
      }

      alert.isResolved = true;
      alert.resolvedAt = new Date();
      alert.resolvedBy = req.user._id;
      await alert.save();

      // Re-populate after save
      await alert.populate([
        { path: 'patientId', select: 'name membershipId' },
        { path: 'readingId', select: 'spo2 heartRate timestamp' },
        { path: 'resolvedBy', select: 'name role' },
      ]);

      res.status(200).json({
        success: true,
        message: 'Alert resolved successfully.',
        alert,
      });
    } catch (err) {
      console.error('PUT /alerts/:id/resolve error:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
