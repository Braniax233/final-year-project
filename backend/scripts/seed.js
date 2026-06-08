/**
 * scripts/seed.js
 * Seeds the Vital X database with demo data:
 *   - 1 Clinician user
 *   - 1 Healthcare Provider user
 *   - 1 Patient user
 *   - 3 Patient records
 *   - 15 Readings (5 per patient, declining SpO2 on one patient)
 *   - 3 Alerts
 *   - 2 Session notes
 *
 * Run: npm run seed
 * WARNING: Clears all existing collections before inserting.
 */

const dotenv = require("dotenv");
dotenv.config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");

// ── Models ────────────────────────────────────────────────────────────────────
const User = require("../models/User");
const Patient = require("../models/Patient");
const Reading = require("../models/Reading");
const Alert = require("../models/Alert");
const SessionNote = require("../models/SessionNote");
const BmiRecord = require("../models/BmiRecord");

// ── Helpers ───────────────────────────────────────────────────────────────────
const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000);

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅  Connected to MongoDB:", process.env.MONGO_URI);

    // ── 1. Clear existing data ────────────────────────────────────────────────
    await Promise.all([
      User.deleteMany({}),
      Patient.deleteMany({}),
      Reading.deleteMany({}),
      Alert.deleteMany({}),
      SessionNote.deleteMany({}),
      BmiRecord.deleteMany({}),
    ]);
    console.log("🗑️   Cleared existing collections");

    // ── 2. Users ──────────────────────────────────────────────────────────────
    const clinician = await User.create({
      name: "Dr. Abena Mensah",
      email: "clinician@vitalx.com",
      passwordHash: "password123",
      role: "clinician",
      phone: "+233201234567",
      department: "Internal Medicine",
    });

    const provider = await User.create({
      name: "Nurse Akosua Frempong",
      email: "provider@vitalx.com",
      passwordHash: "password123",
      role: "provider",
      phone: "+233209876543",
      department: "General Ward",
    });

    console.log("👤  Users created: clinician, provider");

    // ── 3. Patients ───────────────────────────────────────────────────────────
    const patient1 = await Patient.create({
      membershipId: "GH-2025-001",
      barcode: "0001",
      name: "Kwame Asante",
      dob: new Date("1965-03-12"),
      gender: "Male",
      bloodGroup: "O+",
      assignedClinicianId: clinician._id,
      bmi: {
        weight: 82,
        height: 175,
        value: 26.8,
        classification: "Overweight",
      },
      threshold: {
        spo2Min: 93,
        spo2Max: 100,
        hrMin: 55,
        hrMax: 100,
        warningMargin: 2,
        trendWindow: 5,
      },
      emergencyContacts: [
        { name: "Ama Asante", relationship: "Spouse", phone: "+233241234567" },
      ],
      locationSharingConsent: true,
      address: "Accra, Ghana",
      primaryCondition: "COPD",
      allergies: "Penicillin",
      medications: "Salbutamol, Ipratropium",
      isActive: true,
    });

    const patient2 = await Patient.create({
      membershipId: "GH-2025-002",
      barcode: "0002",
      name: "Abena Owusu",
      dob: new Date("1979-07-22"),
      gender: "Female",
      bloodGroup: "A+",
      assignedClinicianId: clinician._id,
      bmi: { weight: 65, height: 162, value: 24.8, classification: "Normal" },
      threshold: {
        spo2Min: 95,
        spo2Max: 100,
        hrMin: 60,
        hrMax: 100,
        warningMargin: 2,
        trendWindow: 5,
      },
      emergencyContacts: [
        { name: "Kofi Owusu", relationship: "Husband", phone: "+233557654321" },
      ],
      locationSharingConsent: true,
      address: "Kumasi, Ghana",
      primaryCondition: "Hypertension",
      allergies: "None",
      medications: "Amlodipine 5mg",
      isActive: true,
    });

    const patient3 = await Patient.create({
      membershipId: "GH-2025-003",
      barcode: "0003",
      name: "Emmanuel Tetteh",
      dob: new Date("1990-01-05"),
      gender: "Male",
      bloodGroup: "B+",
      assignedClinicianId: clinician._id,
      bmi: {
        weight: 90,
        height: 180,
        value: 27.8,
        classification: "Overweight",
      },
      threshold: {
        spo2Min: 94,
        spo2Max: 100,
        hrMin: 60,
        hrMax: 105,
        warningMargin: 2,
        trendWindow: 5,
      },
      emergencyContacts: [
        {
          name: "Gloria Tetteh",
          relationship: "Mother",
          phone: "+233248765432",
        },
      ],
      locationSharingConsent: false,
      address: "Tamale, Ghana",
      primaryCondition: "Asthma",
      allergies: "Aspirin",
      medications: "Budesonide inhaler",
      isActive: true,
    });

    // Create a linked patient user account for patient1
    await User.create({
      name: "Kwame Asante",
      email: "patient@vitalx.com",
      passwordHash: "password123",
      role: "patient",
      phone: "+233241234567",
      patientId: patient1._id,
    });

    console.log(
      "🏥  Patients created: Kwame Asante, Abena Owusu, Emmanuel Tetteh",
    );

    // ── 4. Readings for Patient 1 (COPD — SpO2 declining, will hit WARNING) ──
    const readings1 = await Reading.insertMany([
      {
        patientId: patient1._id,
        capturedBy: provider._id,
        captureContext: "clinical",
        spo2: 96,
        heartRate: 72,
        status: "NORMAL",
        trendDirection: "stable",
        deviceId: "ESP32-001",
        timestamp: hoursAgo(24),
      },
      {
        patientId: patient1._id,
        capturedBy: provider._id,
        captureContext: "clinical",
        spo2: 95,
        heartRate: 74,
        status: "NORMAL",
        trendDirection: "stable",
        deviceId: "ESP32-001",
        timestamp: hoursAgo(18),
      },
      {
        patientId: patient1._id,
        capturedBy: provider._id,
        captureContext: "clinical",
        spo2: 94.5,
        heartRate: 76,
        status: "WARNING",
        trendDirection: "declining",
        deviceId: "ESP32-001",
        timestamp: hoursAgo(12),
      },
      {
        patientId: patient1._id,
        capturedBy: provider._id,
        captureContext: "clinical",
        spo2: 94,
        heartRate: 78,
        status: "WARNING",
        trendDirection: "declining",
        deviceId: "ESP32-001",
        timestamp: hoursAgo(6),
      },
      {
        patientId: patient1._id,
        capturedBy: provider._id,
        captureContext: "clinical",
        spo2: 92,
        heartRate: 88,
        status: "CRITICAL",
        trendDirection: "declining",
        deviceId: "ESP32-001",
        timestamp: hoursAgo(1),
      },
    ]);

    // ── 5. Readings for Patient 2 (Hypertension — HR elevated, WARNING) ──────
    const readings2 = await Reading.insertMany([
      {
        patientId: patient2._id,
        capturedBy: provider._id,
        captureContext: "clinical",
        spo2: 98,
        heartRate: 75,
        status: "NORMAL",
        trendDirection: "stable",
        deviceId: "ESP32-001",
        timestamp: hoursAgo(20),
      },
      {
        patientId: patient2._id,
        capturedBy: provider._id,
        captureContext: "clinical",
        spo2: 97,
        heartRate: 85,
        status: "NORMAL",
        trendDirection: "stable",
        deviceId: "ESP32-001",
        timestamp: hoursAgo(15),
      },
      {
        patientId: patient2._id,
        capturedBy: provider._id,
        captureContext: "clinical",
        spo2: 97,
        heartRate: 98,
        status: "WARNING",
        trendDirection: "stable",
        deviceId: "ESP32-001",
        timestamp: hoursAgo(10),
      },
      {
        patientId: patient2._id,
        capturedBy: provider._id,
        captureContext: "clinical",
        spo2: 96,
        heartRate: 101,
        status: "CRITICAL",
        trendDirection: "stable",
        deviceId: "ESP32-001",
        timestamp: hoursAgo(5),
      },
      {
        patientId: patient2._id,
        capturedBy: provider._id,
        captureContext: "clinical",
        spo2: 96,
        heartRate: 99,
        status: "WARNING",
        trendDirection: "improving",
        deviceId: "ESP32-001",
        timestamp: hoursAgo(2),
      },
    ]);

    // ── 6. Readings for Patient 3 (Asthma — all normal) ──────────────────────
    const readings3 = await Reading.insertMany([
      {
        patientId: patient3._id,
        capturedBy: provider._id,
        captureContext: "home",
        spo2: 97,
        heartRate: 68,
        status: "NORMAL",
        trendDirection: "stable",
        deviceId: "ESP32-002",
        timestamp: hoursAgo(48),
      },
      {
        patientId: patient3._id,
        capturedBy: provider._id,
        captureContext: "home",
        spo2: 97,
        heartRate: 70,
        status: "NORMAL",
        trendDirection: "stable",
        deviceId: "ESP32-002",
        timestamp: hoursAgo(36),
      },
      {
        patientId: patient3._id,
        capturedBy: provider._id,
        captureContext: "home",
        spo2: 96,
        heartRate: 72,
        status: "NORMAL",
        trendDirection: "stable",
        deviceId: "ESP32-002",
        timestamp: hoursAgo(24),
      },
      {
        patientId: patient3._id,
        capturedBy: provider._id,
        captureContext: "home",
        spo2: 95,
        heartRate: 75,
        status: "NORMAL",
        trendDirection: "stable",
        deviceId: "ESP32-002",
        timestamp: hoursAgo(12),
      },
      {
        patientId: patient3._id,
        capturedBy: provider._id,
        captureContext: "home",
        spo2: 96,
        heartRate: 71,
        status: "NORMAL",
        trendDirection: "improving",
        deviceId: "ESP32-002",
        timestamp: hoursAgo(3),
      },
    ]);

    console.log("📊  Readings created: 15 total (5 per patient)");

    // ── 7. Alerts ─────────────────────────────────────────────────────────────
    await Alert.insertMany([
      {
        patientId: patient1._id,
        readingId: readings1[4]._id,
        severity: "CRITICAL",
        message: "SpO₂ critically low at 92% — COPD patient Kwame Asante",
        smsDelivered: true,
        smsSentTo: ["+233201234567", "+233241234567"],
        gpsCoordinates: { lat: 5.6037, lng: -0.187 },
        resolvedAt: null,
        timestamp: hoursAgo(1),
      },
      {
        patientId: patient2._id,
        readingId: readings2[3]._id,
        severity: "CRITICAL",
        message: "Heart rate critically elevated at 101 bpm — Abena Owusu",
        smsDelivered: true,
        smsSentTo: ["+233201234567", "+233557654321"],
        gpsCoordinates: { lat: 6.6885, lng: -1.6244 },
        resolvedAt: null,
        timestamp: hoursAgo(5),
      },
      {
        patientId: patient2._id,
        readingId: readings2[2]._id,
        severity: "WARNING",
        message: "Heart rate approaching threshold at 98 bpm — Abena Owusu",
        smsDelivered: false,
        smsSentTo: [],
        resolvedAt: new Date(),
        resolvedBy: clinician._id,
        timestamp: hoursAgo(10),
      },
    ]);

    console.log("🚨  Alerts created: 2 CRITICAL, 1 WARNING (1 resolved)");

    // ── 8. Session Notes ──────────────────────────────────────────────────────
    await SessionNote.insertMany([
      {
        patientId: patient1._id,
        clinicianId: clinician._id,
        readingId: readings1[2]._id,
        note: "Patient reports shortness of breath in the mornings. SpO₂ consistently 94–95%. Adjusted threshold minimum to 93%. Monitoring closely. Follow-up in 2 weeks.",
        tags: ["Threshold Change", "Follow-up Required"],
        timestamp: hoursAgo(12),
      },
      {
        patientId: patient2._id,
        clinicianId: clinician._id,
        readingId: readings2[4]._id,
        note: "HR elevated during morning session. Patient reports stress and poor sleep. Advised salt restriction and rest. Medication review scheduled.",
        tags: ["Medication Review", "Lifestyle Advice"],
        timestamp: hoursAgo(2),
      },
    ]);

    console.log("📝  Session notes created: 2");

    // ── 9. BMI Records ────────────────────────────────────────────────────────
    await BmiRecord.insertMany([
      {
        patientId: patient1._id,
        recordedBy: provider._id,
        weight: 82,
        height: 175,
        bmi: 26.8,
        classification: "Overweight",
        thresholdRecommendation: {
          spo2Min: 94,
          spo2Max: 100,
          hrMin: 60,
          hrMax: 100,
        },
        timestamp: hoursAgo(24),
      },
      {
        patientId: patient2._id,
        recordedBy: provider._id,
        weight: 65,
        height: 162,
        bmi: 24.8,
        classification: "Normal",
        thresholdRecommendation: {
          spo2Min: 95,
          spo2Max: 100,
          hrMin: 60,
          hrMax: 100,
        },
        timestamp: hoursAgo(20),
      },
    ]);

    console.log("⚖️   BMI records created: 2");

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("\n✅  Seed complete! Login credentials:");
    console.log("   Clinician  → clinician@vitalx.com  / password123");
    console.log("   Provider   → provider@vitalx.com   / password123");
    console.log("   Patient    → patient@vitalx.com    / password123");
    console.log("\n   Frontend: http://localhost:5173");
    console.log("   Backend:  http://localhost:5000");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

seed();
