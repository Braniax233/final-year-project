/**
 * models/User.js
 * Mongoose schema for system users — clinicians, providers, and patients.
 * Passwords are hashed automatically via a pre-save hook using bcryptjs.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name must be 100 characters or fewer'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    // Stores the bcrypt hash; plain-text password is never persisted
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },

    role: {
      type: String,
      enum: {
        values: ['clinician', 'provider', 'patient'],
        message: 'Role must be clinician, provider, or patient',
      },
      required: [true, 'Role is required'],
      default: 'clinician',
    },

    phone: {
      type: String,
      trim: true,
      default: '',
    },

    department: {
      type: String,
      trim: true,
      default: '',
    },

    // Only populated when role === 'patient' — links to the Patient record
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      default: null,
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

// ─── Pre-save Hook: hash password if it has been modified ─────────────────────
userSchema.pre('save', async function (next) {
  // Only rehash if the passwordHash field was explicitly set / changed
  if (!this.isModified('passwordHash')) return next();

  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
    next();
  } catch (err) {
    next(err);
  }
});

// ─── Instance Method: verify a plain-text password against the stored hash ────
/**
 * comparePassword
 * @param {string} plainText — the raw password from the login request
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (plainText) {
  return bcrypt.compare(plainText, this.passwordHash);
};

// ─── toJSON transform: never expose the password hash in API responses ────────
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
