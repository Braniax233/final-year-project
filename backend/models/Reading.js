/**
 * models/Reading.js
 * Mongoose schema for individual vital-sign readings captured by clinicians,
 * providers, or IoT devices (ESP32) attached to patients.
 */

const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient ID is required'],
      index: true,
    },

    // The user (clinician / provider) who submitted this reading.
    // Null for readings submitted directly by an IoT device.
    capturedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    captureContext: {
      type: String,
      enum: {
        values: ['clinical', 'home'],
        message: 'captureContext must be "clinical" or "home"',
      },
      required: [true, 'captureContext is required'],
      default: 'clinical',
    },

    spo2: {
      type: Number,
      required: [true, 'SpO2 value is required'],
      min: [0, 'SpO2 cannot be negative'],
      max: [100, 'SpO2 cannot exceed 100%'],
    },

    heartRate: {
      type: Number,
      required: [true, 'Heart rate is required'],
      min: [0, 'Heart rate cannot be negative'],
      max: [300, 'Heart rate value out of physiological range'],
    },

    status: {
      type: String,
      enum: {
        values: ['NORMAL', 'WARNING', 'CRITICAL'],
        message: 'Status must be NORMAL, WARNING, or CRITICAL',
      },
      required: true,
      default: 'NORMAL',
    },

    // Direction determined by linear regression on recent SpO2 readings
    trendDirection: {
      type: String,
      enum: ['improving', 'stable', 'declining', 'unknown'],
      default: 'unknown',
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Hardware device identifier — set when submitted via /api/device
    deviceId: {
      type: String,
      trim: true,
      default: null,
    },

    // Groups readings captured in the same clinical session
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Additional classification details from the engine
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
readingSchema.index({ patientId: 1, timestamp: -1 });
readingSchema.index({ status: 1 });
readingSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('Reading', readingSchema);
