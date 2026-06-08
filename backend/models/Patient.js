/**
 * models/Patient.js
 * Mongoose schema for patient records in the Vital X system.
 * Captures demographic, clinical, BMI, threshold, and consent data.
 */

const mongoose = require('mongoose');

// ─── Emergency Contact sub-schema ─────────────────────────────────────────────
const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// ─── BMI sub-schema ───────────────────────────────────────────────────────────
const bmiSchema = new mongoose.Schema(
  {
    weight: { type: Number, default: null },       // kg
    height: { type: Number, default: null },       // cm
    value: { type: Number, default: null },        // kg/m²
    classification: { type: String, default: '' }, // Underweight / Normal / Overweight / Obese
  },
  { _id: false }
);

// ─── Threshold sub-schema ─────────────────────────────────────────────────────
const thresholdSchema = new mongoose.Schema(
  {
    spo2Min: { type: Number, default: 95 },         // % — critical lower bound
    spo2Max: { type: Number, default: 100 },        // % — sanity upper bound
    hrMin: { type: Number, default: 60 },           // bpm — critical lower bound
    hrMax: { type: Number, default: 100 },          // bpm — critical upper bound
    warningMargin: { type: Number, default: 2 },    // units before critical threshold
    trendWindow: { type: Number, default: 5 },      // number of readings used for trend
  },
  { _id: false }
);

// ─── Main Patient schema ──────────────────────────────────────────────────────
const patientSchema = new mongoose.Schema(
  {
    membershipId: {
      type: String,
      required: [true, 'Membership ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },

    barcode: {
      type: String,
      trim: true,
      default: '',
    },

    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
    },

    dob: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: '',
    },

    bloodGroup: {
      type: String,
      trim: true,
      default: '',
    },

    // The clinician primarily responsible for this patient
    assignedClinicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    bmi: {
      type: bmiSchema,
      default: () => ({}),
    },

    threshold: {
      type: thresholdSchema,
      default: () => ({}),
    },

    emergencyContacts: {
      type: [emergencyContactSchema],
      default: [],
    },

    locationSharingConsent: {
      type: Boolean,
      default: false,
    },

    address: {
      type: String,
      trim: true,
      default: '',
    },

    primaryCondition: {
      type: String,
      trim: true,
      default: '',
    },

    allergies: {
      type: String,
      trim: true,
      default: '',
    },

    medications: {
      type: String,
      trim: true,
      default: '',
    },

    // Base64 data URL or cloud storage URL for patient photo
    photo: {
      type: String,
      default: '',
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
patientSchema.index({ assignedClinicianId: 1 });
patientSchema.index({ membershipId: 1 });
patientSchema.index({ barcode: 1 });
patientSchema.index({ isActive: 1 });

module.exports = mongoose.model('Patient', patientSchema);
