/**
 * models/Alert.js
 * Mongoose schema for clinical alerts generated when a reading crosses
 * a WARNING or CRITICAL threshold for a patient.
 */

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient ID is required'],
      index: true,
    },

    readingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reading',
      required: [true, 'Reading ID is required'],
    },

    severity: {
      type: String,
      enum: {
        values: ['NORMAL', 'WARNING', 'CRITICAL'],
        message: 'Severity must be NORMAL, WARNING, or CRITICAL',
      },
      required: [true, 'Severity is required'],
    },

    message: {
      type: String,
      trim: true,
      default: '',
    },

    // ── SMS Notification Tracking ─────────────────────────────────────────────
    smsDelivered: {
      type: Boolean,
      default: false,
    },

    smsSentTo: {
      type: [String],
      default: [],
    },

    // ── GPS Coordinates (patient location at time of alert) ───────────────────
    gpsCoordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    // ── Resolution Tracking ───────────────────────────────────────────────────
    resolvedAt: {
      type: Date,
      default: null,
    },

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    isResolved: {
      type: Boolean,
      default: false,
      index: true,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
alertSchema.index({ patientId: 1, timestamp: -1 });
alertSchema.index({ severity: 1, isResolved: 1 });

module.exports = mongoose.model('Alert', alertSchema);
