/**
 * routes/dashboard.js
 * Dashboard statistics route for the Vital X API.
 *
 * GET /api/dashboard/stats  — aggregate counts and recent activity for the dashboard
 */

const express = require('express');
const Patient = require('../models/Patient');
const Reading = require('../models/Reading');
const Alert   = require('../models/Alert');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All dashboard routes require authentication
router.use(protect);

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
/**
 * @route   GET /api/dashboard/stats
 * @desc    Return aggregated dashboard statistics:
 *            - totalPatients    — total number of patients in scope
 *            - normalCount      — patients whose latest reading is NORMAL
 *            - warningCount     — patients whose latest reading is WARNING
 *            - criticalCount    — patients whose latest reading is CRITICAL
 *            - noReadingCount   — patients with no readings yet
 *            - recentReadings   — last 5 readings across all in-scope patients
 *            - unresolvedAlerts — count of open alerts
 *            - onlineDevices    — distinct device IDs active in the past 5 minutes
 *
 *          Clinicians see stats for their assigned patients.
 *          Providers see stats for all patients.
 *
 * @access  Protected
 */
router.get('/stats', async (req, res) => {
  try {
    // ── 1. Build patient scope ──────────────────────────────────────────────
    let patientFilter = {};
    if (req.user.role === 'clinician') {
      patientFilter = { assignedClinicianId: req.user._id };
    } else if (req.user.role === 'patient') {
      // A patient-role user sees only their own patient stats
      if (!req.user.patientId) {
        return res.status(200).json({
          success: true,
          data: {
            totalPatients:    0,
            normalCount:      0,
            warningCount:     0,
            criticalCount:    0,
            noReadingCount:   0,
            recentReadings:   [],
            unresolvedAlerts: 0,
            onlineDevices:    0,
          },
        });
      }
      patientFilter = { _id: req.user.patientId };
    }

    // Get all in-scope patient IDs in one query
    const patients = await Patient.find(patientFilter, '_id');
    const patientIds = patients.map((p) => p._id);
    const totalPatients = patientIds.length;

    if (totalPatients === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalPatients:    0,
          normalCount:      0,
          warningCount:     0,
          criticalCount:    0,
          noReadingCount:   0,
          recentReadings:   [],
          unresolvedAlerts: 0,
          onlineDevices:    0,
        },
      });
    }

    // ── 2. Get latest reading status per patient (aggregation) ──────────────
    //    Pipeline: filter by in-scope patients → sort → group by patient → first status
    const latestPerPatient = await Reading.aggregate([
      { $match: { patientId: { $in: patientIds } } },
      { $sort:  { timestamp: -1 } },
      {
        $group: {
          _id:    '$patientId',
          status: { $first: '$status' },
        },
      },
    ]);

    // Count by status
    let normalCount   = 0;
    let warningCount  = 0;
    let criticalCount = 0;

    for (const entry of latestPerPatient) {
      if (entry.status === 'NORMAL')   normalCount++;
      else if (entry.status === 'WARNING')  warningCount++;
      else if (entry.status === 'CRITICAL') criticalCount++;
    }

    // Patients who have never had a reading
    const noReadingCount = totalPatients - latestPerPatient.length;

    // ── 3. Recent readings (last 5 across all in-scope patients) ─────────────
    const recentReadings = await Reading.find({ patientId: { $in: patientIds } })
      .sort({ timestamp: -1 })
      .limit(5)
      .populate('patientId', 'name membershipId')
      .populate('capturedBy', 'name role');

    // ── 4. Unresolved alert count ─────────────────────────────────────────────
    const unresolvedAlerts = await Alert.countDocuments({
      patientId:  { $in: patientIds },
      isResolved: false,
    });

    // ── 5. Online devices (readings in the last 5 minutes with a deviceId) ───
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1_000);
    const onlineDeviceList = await Reading.distinct('deviceId', {
      patientId:  { $in: patientIds },
      timestamp:  { $gte: fiveMinutesAgo },
      deviceId:   { $ne: null, $exists: true },
    });
    // Filter out any null/empty strings that might have slipped through
    const onlineDevices = onlineDeviceList.filter(Boolean).length;

    // ── 6. Build and return response ─────────────────────────────────────────
    res.status(200).json({
      success: true,
      data: {
        totalPatients,
        normalCount,
        warningCount,
        criticalCount,
        noReadingCount,
        recentReadings,
        unresolvedAlerts,
        onlineDevices,
      },
    });
  } catch (err) {
    console.error('GET /dashboard/stats error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
