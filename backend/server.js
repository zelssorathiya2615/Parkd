// ═══════════════════════════════════════
// PARKD — Express Server Entry Point
// ═══════════════════════════════════════
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config();

const { initPool } = require('./config/db');

const authRoutes      = require('./routes/auth');
const userRoutes      = require('./routes/users');
const vehicleRoutes   = require('./routes/vehicles');
const facilityRoutes  = require('./routes/facilities');
const slotRoutes      = require('./routes/slots');
const ticketRoutes    = require('./routes/tickets');
const recordRoutes    = require('./routes/records');
const billingRoutes   = require('./routes/billing');
const queueRoutes     = require('./routes/queue');
const adminDashRoutes = require('./routes/admin/dashboard');
const adminSlotRoutes = require('./routes/admin/slots');
const adminQueueRoutes= require('./routes/admin/queue');
const adminOfferRoutes= require('./routes/admin/offers');
const adminFacRoutes  = require('./routes/admin/facilities');
const adminLocalRoutes= require('./routes/admin/localAdmins');
const adminRatesRoutes= require('./routes/admin/rates');
const adminBillingRoutes = require('./routes/admin/billing');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const rootDir = path.join(__dirname, '..');

app.use(cors());
app.use(express.json());

// Your HTML pages (index.html, auth.html, dashboard.html, …)
app.use(express.static(rootDir));

// API Routes
app.use('/api/auth',    authRoutes);
app.use('/api/users',   userRoutes);
app.use('/api/vehicles',vehicleRoutes);
app.use('/api/facilities', facilityRoutes);
app.get('/api/zones/:id/slots', authMiddleware, facilityRoutes.listZoneSlots);
app.use('/api/slots',   slotRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/bills',   billingRoutes);
app.use('/api/queue',   queueRoutes);
app.use('/api/admin/dashboard', adminDashRoutes);
app.use('/api/admin/slots',     adminSlotRoutes);
app.use('/api/admin/queue',     adminQueueRoutes);
app.use('/api/admin/offers',    adminOfferRoutes);
app.use('/api/admin/facilities', adminFacRoutes);
app.use('/api/admin/local-admins', adminLocalRoutes);
app.use('/api/admin/rates',     adminRatesRoutes);
app.use('/api/admin/billing',   adminBillingRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initPool();
    app.listen(PORT, () => {
      console.log(`\n  Parkd server running at http://localhost:${PORT}`);
      console.log(`  Landing:  http://localhost:${PORT}/index.html`);
      console.log(`  Sign in:  http://localhost:${PORT}/auth.html`);
      console.log(`  Health:   http://localhost:${PORT}/api/health\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
