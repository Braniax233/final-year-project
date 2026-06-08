/**
 * scripts/testConnection.js
 * Quick diagnostic — run with:  node scripts/testConnection.js
 * Tells you exactly what's wrong with your Atlas connection.
 */

const dotenv = require('dotenv');
const path   = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');

const uri = process.env.MONGO_URI || '';

console.log('\n🔍  Vital X — MongoDB Atlas Connection Diagnostic\n');

// ── 1. Check URI is present ───────────────────────────────────────────────────
if (!uri) {
  console.error('❌  MONGO_URI is missing from your .env file.');
  process.exit(1);
}

// ── 2. Show redacted URI so you can spot obvious typos ───────────────────────
// Masks the password but shows everything else
const redacted = uri.replace(/:([^@]+)@/, ':****@');
console.log('   URI (password hidden):', redacted);

// ── 3. Check for unencoded special characters in the password ────────────────
const match = uri.match(/\/\/([^:]+):([^@]+)@/);
if (match) {
  const password = match[2];
  const problematic = ['@', '#', '!', '$', '%', '&', "'", '(', ')', '*', '+', ',', '/', ':', ';', '=', '?', '[', ']'];
  const found = problematic.filter(c => password.includes(c));
  if (found.length > 0) {
    console.warn('\n⚠️   PASSWORD ISSUE DETECTED!');
    console.warn('   Your password contains these characters that MUST be URL-encoded:');
    console.warn('  ', found.join('  '));
    console.warn('\n   Fix: URL-encode your password using this table:');
    console.warn('   @  →  %40');
    console.warn('   #  →  %23');
    console.warn('   !  →  %21');
    console.warn('   $  →  %24');
    console.warn('   %  →  %25');
    console.warn('   &  →  %26');
    console.warn('   =  →  %3D');
    console.warn('   ?  →  %3F');
    console.warn('   /  →  %2F');
    console.warn('\n   Example: if password is  p@ss#word');
    console.warn('   Change URI to:  mongodb+srv://user:p%40ss%23word@cluster.../db\n');
  } else {
    console.log('   ✅  No special characters detected in password.');
  }
}

// ── 4. Try to connect ─────────────────────────────────────────────────────────
console.log('\n🔌  Attempting connection (timeout: 10s)...\n');

mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  .then((conn) => {
    console.log('✅  SUCCESS! Connected to:', conn.connection.host);
    console.log('   Database name:', conn.connection.name);
    console.log('\n   Your backend is ready to run.  →  npm run dev\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌  Connection failed:', err.message);

    if (err.message.includes('bad auth') || err.message.includes('authentication failed')) {
      console.error('\n   CAUSE: Wrong username or password in Atlas.');
      console.error('   FIX:');
      console.error('   1. Go to Atlas → Database Access');
      console.error('   2. Click Edit on your user → Edit Password');
      console.error('   3. Create a simple password with NO special characters');
      console.error('      e.g.  VitalX2025  (letters + numbers only)');
      console.error('   4. Update MONGO_URI in your .env with the new password');
    }

    if (err.message.includes('ECONNREFUSED') || err.message.includes('connect ETIMEDOUT') || err.message.includes('timed out')) {
      console.error('\n   CAUSE: Atlas is blocking your IP address.');
      console.error('   FIX:');
      console.error('   1. Go to Atlas → Network Access → Add IP Address');
      console.error('   2. Click "Allow Access from Anywhere"  →  0.0.0.0/0');
      console.error('   3. Click Confirm and wait 30 seconds');
    }

    if (err.message.includes('ENOTFOUND')) {
      console.error('\n   CAUSE: Cannot reach Atlas. Check your internet connection.');
    }

    process.exit(1);
  });
