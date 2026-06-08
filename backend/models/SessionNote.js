/**
 * models/SessionNote.js
 * Mongoose schema for clinical session notes written by clinicians
 * about a patient reading or general visit.
 */

const mongoose = require('mongoose');

const sessionNoteSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient ID is required'],
      index: true,
    },

    clinicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Clinician ID is required'],
    },

    // Optional — links the note to a specific reading event
    readingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reading',
      default: null,
    },

    note: {
      type: String,
      required: [true, 'Note content is required'],
      trim: true,
      maxlength: [5000, 'Note must be 5000 characters or fewer'],
    },

    // Free-form clinical tags, e.g. ['follow-up', 'medication-review']
    tags: {
      type: [String],
      default: [],
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
sessionNoteSchema.index({ patientId: 1, timestamp: -1 });
sessionNoteSchema.index({ clinicianId: 1 });

module.exports = mongoose.model('SessionNote', sessionNoteSchema);
