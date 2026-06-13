/**
 * routes/device.js
 * IoT device (ESP32 / hardware sensor) routes for the Vital X API.
 * Authenticated via DEVICE_API_KEY (x-api-key header), NOT a user JWT.
 *
 * POST /api/device/reading  — submit a raw reading from a physical device
 * GET  /api/device/ping     — heartbeat / connectivity check
 */

const express = require("express");
const mongoose = require("mongoose");
const deviceAuth = require("../middleware/deviceAuth");
const Patient = require("../models/Patient");
const { processReading } = require("./readings");

const router = express.Router();

// ─── GET /api/device/ping ─────────────────────────────────────────────────────
/**
 * @route   GET /api/device/ping
 * @desc    Simple liveness probe for IoT devices to verify API reachability.
 *          Does NOT require the device API key so it can be used pre-auth.
 * @access  Public
 */
router.get("/ping", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Vital X device API is reachable.",
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /api/device/reading ─────────────────────────────────────────────────
/**
 * @route   POST /api/device/reading
 * @desc    Accept a vital-sign reading submitted directly from an IoT device.
 *          Runs the full classification, persistence, and alert pipeline.
 *
 * @access  Device — requires x-api-key header matching DEVICE_API_KEY
 *
 * Body: {
 *   deviceId:      string  — unique hardware identifier (e.g. ESP32 MAC address)
 *   membershipId:  string  — Patient membership ID e.g. "GH-2025-001"  ← preferred
 *   patientId?:    string  — Patient ObjectId (fallback, if membershipId not supplied)
 *   spo2:          number  — SpO2 percentage (0–100)
 *   heartRate:     number  — heart rate in bpm (0–300)
 *   timestamp?:    string  — ISO 8601; defaults to server time if omitted/invalid
 *   gpsCoordinates?: { lat: number, lng: number }
 * }
 */
router.post("/reading", deviceAuth, async (req, res) => {
  try {
    const {
      deviceId,
      membershipId, // preferred — ESP32 stores this as a simple string
      patientId: rawPatientId,
      spo2,
      heartRate,
      timestamp,
      gpsCoordinates = null,
    } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    const validationErrors = [];

    if (!deviceId || typeof deviceId !== "string") {
      validationErrors.push("deviceId is required.");
    }
    if (!membershipId && !rawPatientId) {
      validationErrors.push("Either membershipId or patientId is required.");
    }
    if (typeof spo2 !== "number" || spo2 < 0 || spo2 > 100) {
      validationErrors.push("spo2 must be a number between 0 and 100.");
    }
    if (typeof heartRate !== "number" || heartRate < 0 || heartRate > 300) {
      validationErrors.push("heartRate must be a number between 0 and 300.");
    }
    if (gpsCoordinates) {
      if (
        typeof gpsCoordinates.lat !== "number" ||
        typeof gpsCoordinates.lng !== "number"
      ) {
        validationErrors.push("gpsCoordinates must have numeric lat and lng.");
      }
    }
    if (validationErrors.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Validation failed.",
          errors: validationErrors,
        });
    }

    // ── Resolve patient ───────────────────────────────────────────────────────
    // ESP32 sends membershipId (a simple string like "GH-2025-001").
    // Fall back to ObjectId lookup if membershipId is not provided.
    let resolvedPatientId;

    if (membershipId) {
      const patient = await Patient.findOne(
        { membershipId: membershipId.trim().toUpperCase() },
        "_id",
      );
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: `No patient found with membershipId "${membershipId}".`,
        });
      }
      resolvedPatientId = patient._id;
    } else {
      if (!mongoose.Types.ObjectId.isValid(rawPatientId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid patientId ObjectId." });
      }
      resolvedPatientId = rawPatientId;
    }

    // ── Parse timestamp ───────────────────────────────────────────────────────
    let readingTime = new Date();
    if (timestamp) {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) readingTime = parsed;
      else
        console.warn(
          `Device "${deviceId}" sent invalid timestamp "${timestamp}". Using server time.`,
        );
    }

    // ── Run shared pipeline ───────────────────────────────────────────────────
    const { reading, classification, alert } = await processReading({
      patientId: resolvedPatientId,
      spo2,
      heartRate,
      captureContext: "home",
      capturedBy: null,
      deviceId: deviceId.trim(),
      sessionId: null,
      gpsCoordinates,
      timestamp: readingTime,
    });

    console.log(
      `📡  Device "${deviceId}" → [${membershipId || resolvedPatientId}]: ` +
        `SpO2=${spo2}% HR=${heartRate}bpm → ${classification.status}`,
    );

    res.status(201).json({
      success: true,
      message: "Reading accepted.",
      readingId: reading._id,
      status: classification.status,
      trendDirection: classification.trendDirection,
      suggestedAction: classification.suggestedAction,
      alertCreated: alert !== null,
      timestamp: reading.timestamp,
    });
  } catch (err) {
    console.error("POST /device/reading error:", err.message);
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
});

module.exports = router;
