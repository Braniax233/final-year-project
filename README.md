# Vital X — IoT Remote Medical Monitoring System

**MediMonitor** | BSc Computer Science Final Year Project  
Kofi Abordo Benyah & Zulfawu Mohammed | KNUST 2025/2026

---

## Project Structure

```
Vital X/
├── backend/          # Node.js + Express API server
│   ├── config/       # MongoDB connection
│   ├── engines/      # Classification engine, BMI engine
│   ├── middleware/   # JWT auth, device auth
│   ├── models/       # Mongoose schemas
│   ├── routes/       # API route handlers
│   ├── scripts/      # Database seeder
│   ├── services/     # Hubtel SMS service
│   └── server.js     # Entry point
└── frontend/         # React.js web application
    └── src/
        ├── api/          # Axios instance
        ├── components/   # Reusable UI components
        ├── context/      # Auth context
        ├── layouts/      # Role-based layouts
        └── pages/        # All page components
```

---

## Prerequisites

- **Node.js** v18+
- **MongoDB** running locally on port 27017  
  → Download: https://www.mongodb.com/try/download/community
- **npm** v9+

---

## Setup & Running

### Step 1 — Start MongoDB
Make sure MongoDB is running locally:
```
mongod
```
Or use MongoDB Compass / MongoDB as a Windows Service.

### Step 2 — Start the Backend
Open a terminal in `Vital X/backend/`:
```bash
npm run dev
```
The API will start at **http://localhost:5000**

### Step 3 — Seed the Database (first time only)
In the `backend/` terminal:
```bash
npm run seed
```
This creates 3 patients, 3 users, 15 readings, and sample alerts.

### Step 4 — Start the Frontend
Open a **second** terminal in `Vital X/frontend/`:
```bash
npm run dev
```
The web app will start at **http://localhost:5173**

---

## Login Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Clinician (Dr. Abena Mensah) | clinician@vitalx.com | password123 |
| Healthcare Provider (Nurse Akosua) | provider@vitalx.com | password123 |
| Patient (Kwame Asante) | patient@vitalx.com | password123 |

---

## Features

| # | Feature | Status |
|---|---------|--------|
| 1 | Per-patient clinician-configured thresholds | ✅ |
| 2 | Trend-based alerting (OLS linear regression) | ✅ |
| 3 | Normal / Warning / Critical classification | ✅ |
| 4 | Session notes / consultation records | ✅ |
| 5 | BMI calculator | ✅ |
| 6 | BMI-informed threshold recommendations | ✅ |
| 7 | Barcode + membership ID patient identification | ✅ |
| 8 | Three-role authenticated platform | ✅ |
| 9 | Hubtel SMS + GPS location alert | ✅ |
| 10 | Historical trend visualisation (dual-axis chart) | ✅ |
| 11 | Spot-check reading model | ✅ |
| 12 | In-Clinic Session View | ✅ |
| 13 | Escalating alert logic | ✅ |

---

## API Endpoints

### Auth
```
POST /api/auth/login
GET  /api/auth/me
```

### Patients
```
GET  /api/patients
GET  /api/patients/:id
POST /api/patients
PUT  /api/patients/:id/threshold
GET  /api/patients/:id/readings
GET  /api/patients/:id/alerts
GET  /api/patients/lookup/:membershipId
GET  /api/patients/barcode/:barcode
```

### Readings & Alerts
```
POST /api/readings
GET  /api/alerts
PUT  /api/alerts/:id/resolve
```

### Device (ESP32)
```
POST /api/device/reading
Headers: x-api-key: esp32_device_secret_key_2025
Body: { deviceId, spo2, heartRate, patientId, timestamp }
```

### Other
```
POST /api/bmi
GET  /api/notes/patient/:id
POST /api/notes
GET  /api/dashboard/stats
```

---

## Environment Variables (backend/.env)

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/vitalx
JWT_SECRET=vitalx_super_secret_jwt_key_2025
JWT_EXPIRE=7d
HUBTEL_CLIENT_ID=your_hubtel_client_id
HUBTEL_CLIENT_SECRET=your_hubtel_client_secret
HUBTEL_SENDER_ID=VitalX
DEVICE_API_KEY=esp32_device_secret_key_2025
```

> **Note:** Replace Hubtel credentials with your actual Hubtel API keys from https://developers.hubtel.com

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Hardware MCU | ESP32-WROOM |
| Sensor | MAX30102 (SpO₂ + HR) |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Frontend | React.js + Vite |
| Styling | Tailwind CSS v3 |
| Charts | Recharts |
| Auth | JWT (JSON Web Tokens) |
| SMS Alerts | Hubtel API (Ghana) |
| GPS | Browser Geolocation API |
