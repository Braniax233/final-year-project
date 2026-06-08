/**
 * models/BmiRecord.js
 * Mongoose schema for BMI measurement records. Each record captures the
 * measurement, its classification, and the auto-generated threshold
 * recommendations derived from the patient's BMI category.
 */

const mongoose = require('mongoose');

// ─── Threshold recommendation sub-schema ──────────────────────────────────────
const thresholdRecommendationSchema = new mongoose.Schema(
  {
    spo2Min: { type: Number, required: true },
    spo2Max: { type: Number, default: 100 },
    hrMin: { type: Number, required: true },
    hrMax: { type: Number, required: true },
  },
  { _id: false }
);

// ─── BMI Record schema ────────────────────────────────────────────────────────
const bmiRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient ID is required'],
      index: true,
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recorder ID is required'],
    },

    weight: {
      type: Number,
      required: [true, 'Weight is required'],
      min: [1, 'Weight must be positive'],
    }, // kg

    height: {
      type: Number,
      required: [true, 'Height is required'],
      min: [1, 'Height must be positive'],
    }, // cm

    bmi: {
      type: Number,
      required: true,
    }, // kg/m²

    classification: {
      type: String,
      enum: ['Underweight', 'Normal', 'Overweight', 'Obese'],
      required: true,
    },

    thresholdRecommendation: {
      type: thresholdRecommendationSchema,
      required: true,
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
bmiRecordSchema.index({ patientId: 1, timestamp: -1 });

module.exports = mongoose.model('BmiRecord', bmiRecordSchema);
