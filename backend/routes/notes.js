/**
 * routes/notes.js
 * Clinical session note routes for the Vital X API.
 *
 * GET /api/notes/patient/:id  — all notes for a patient
 * POST /api/notes             — create a new note
 * PUT  /api/notes/:id         — update an existing note
 */

const express = require('express');
const mongoose = require('mongoose');
const SessionNote = require('../models/SessionNote');
const Patient     = require('../models/Patient');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All note routes require authentication
router.use(protect);

// ─── GET /api/notes/patient/:id ───────────────────────────────────────────────
/**
 * @route   GET /api/notes/patient/:id
 * @desc    Retrieve all session notes for a given patient, sorted newest first.
 *          Supports optional ?tags= comma-separated filter.
 * @access  Protected
 */
router.get('/patient/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    // Verify patient exists (and is accessible to the requesting user)
    let patientFilter = { _id: req.params.id };
    if (req.user.role === 'clinician') {
      patientFilter.assignedClinicianId = req.user._id;
    } else if (req.user.role === 'patient') {
      patientFilter._id = req.user.patientId;
    }

    const patientExists = await Patient.exists(patientFilter);
    if (!patientExists) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or access denied.',
      });
    }

    // Build note query
    const noteFilter = { patientId: req.params.id };

    // Optional tag filter: ?tags=follow-up,medication-review
    if (req.query.tags) {
      const tags = req.query.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tags.length > 0) {
        noteFilter.tags = { $in: tags };
      }
    }

    const notes = await SessionNote.find(noteFilter)
      .sort({ timestamp: -1 })
      .populate('clinicianId', 'name role department')
      .populate('readingId', 'spo2 heartRate status timestamp');

    res.status(200).json({
      success: true,
      count: notes.length,
      notes,
    });
  } catch (err) {
    console.error('GET /notes/patient/:id error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/notes ──────────────────────────────────────────────────────────
/**
 * @route   POST /api/notes
 * @desc    Create a new clinical session note.
 * @access  Protected — clinicians and providers only
 *
 * Body: { patientId, note, readingId?, tags? }
 */
router.post('/', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    const { patientId, note, readingId, tags } = req.body;

    // ── Validate ────────────────────────────────────────────────────────────
    if (!patientId || !note) {
      return res.status(400).json({
        success: false,
        message: 'patientId and note content are required.',
      });
    }
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patientId.' });
    }
    if (readingId && !mongoose.Types.ObjectId.isValid(readingId)) {
      return res.status(400).json({ success: false, message: 'Invalid readingId.' });
    }

    // Verify patient exists
    const patientExists = await Patient.exists({ _id: patientId });
    if (!patientExists) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const sessionNote = await SessionNote.create({
      patientId,
      clinicianId: req.user._id,
      readingId:   readingId || null,
      note:        note.trim(),
      tags:        Array.isArray(tags) ? tags.map((t) => t.trim()).filter(Boolean) : [],
    });

    await sessionNote.populate([
      { path: 'clinicianId', select: 'name role' },
      { path: 'readingId',   select: 'spo2 heartRate status timestamp' },
    ]);

    res.status(201).json({
      success: true,
      message: 'Session note created successfully.',
      note: sessionNote,
    });
  } catch (err) {
    console.error('POST /notes error:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/notes/:id ───────────────────────────────────────────────────────
/**
 * @route   PUT /api/notes/:id
 * @desc    Update the content and/or tags of an existing session note.
 *          Only the clinician who created the note (or a provider) may update it.
 * @access  Protected — clinicians and providers only
 *
 * Body: { note?, tags? }
 */
router.put('/:id', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid note ID.' });
    }

    const existingNote = await SessionNote.findById(req.params.id);
    if (!existingNote) {
      return res.status(404).json({ success: false, message: 'Session note not found.' });
    }

    // Clinicians can only edit their own notes
    if (
      req.user.role === 'clinician' &&
      String(existingNote.clinicianId) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorised to edit this note.',
      });
    }

    const { note, tags } = req.body;
    if (!note && !tags) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one field to update: note or tags.',
      });
    }

    const updates = {};
    if (note)  updates.note = note.trim();
    if (tags)  updates.tags = Array.isArray(tags)
      ? tags.map((t) => t.trim()).filter(Boolean)
      : existingNote.tags;

    const updatedNote = await SessionNote.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate([
      { path: 'clinicianId', select: 'name role' },
      { path: 'readingId',   select: 'spo2 heartRate status timestamp' },
    ]);

    res.status(200).json({
      success: true,
      message: 'Session note updated successfully.',
      note: updatedNote,
    });
  } catch (err) {
    console.error('PUT /notes/:id error:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
