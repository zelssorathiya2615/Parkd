// ═══════════════════════════════════════
// PARKD — Auth Routes
// POST /api/auth/register
// POST /api/auth/login
// ═══════════════════════════════════════
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { execute } = require('../config/db');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, phone_number, email, password, vehicle_number, vehicle_type } = req.body;

  if (!name || !phone_number || !email || !password) {
    return res.status(400).json({ error: 'name, phone_number, email, password required' });
  }

  try {
    const checkUser = await execute(
      `SELECT email, phone_number FROM USER_TABLE WHERE email = :email OR phone_number = :phone`,
      { email: String(email).toLowerCase(), phone: String(phone_number) }
    );
    if (checkUser.rows.length > 0) {
      const row = checkUser.rows[0];
      if (row.EMAIL === String(email).toLowerCase()) {
        return res.status(409).json({ error: 'Email already registered. Use Log In, or pick a new email for Register.' });
      }
      if (row.PHONE_NUMBER === String(phone_number)) {
        return res.status(409).json({ error: 'Phone number already registered. Use a different number.' });
      }
    }

    if (vehicle_number) {
      const checkVeh = await execute(
        `SELECT vehicle_id FROM VEHICLE WHERE vehicle_number = :vnum`,
        { vnum: String(vehicle_number).toUpperCase() }
      );
      if (checkVeh.rows.length > 0) {
        return res.status(409).json({ error: 'Vehicle number already registered. Use a different plate number.' });
      }
    }

    const hash = await bcrypt.hash(password, 12);

    await execute(
      `INSERT INTO USER_TABLE (name, phone_number, email, password_hash)
       VALUES (:name, :phone, :email, :hash)`,
      {
        name: String(name),
        phone: String(phone_number),
        email: String(email).toLowerCase(),
        hash
      }
    );

    const idRes = await execute(
      `SELECT user_id FROM USER_TABLE WHERE email = :email`,
      { email: String(email).toLowerCase() }
    );
    const userId = idRes.rows[0].USER_ID;

    if (vehicle_number && vehicle_type) {
      await execute(
        `INSERT INTO VEHICLE (user_id, vehicle_number, vehicle_type)
         VALUES (:user_id, :vnum, :vtype)`,
        { user_id: userId, vnum: String(vehicle_number).toUpperCase(), vtype: String(vehicle_type) }
      );
    }

    await execute(
      `INSERT INTO USER_PLAN (user_id, plan_id, start_date, end_date, is_active)
       VALUES (:user_id, 1, TRUNC(SYSDATE), DATE '2099-12-31', 'true')`,
      { user_id: userId }
    );

    const token = jwt.sign(
      { userId, role: 'user', planType: 'general' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({ token, user: { userId, name, email, planType: 'general' } });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('ORA-00001')) {
      if (msg.toLowerCase().includes('vehicle') || msg.includes('VEH')) {
        return res.status(409).json({ error: 'Vehicle number already registered. Use a different plate number.' });
      }
      if (msg.toLowerCase().includes('phone') || msg.includes('PHONE')) {
        return res.status(409).json({ error: 'Phone number already registered. Use a different number.' });
      }
      return res.status(409).json({
        error: 'Email already registered. Use Log In, or pick a new email for Register.'
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed', detail: msg });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  try {
    const result = await execute(
      `SELECT u.user_id, u.name, u.email, u.password_hash,
              p.plan_type
       FROM USER_TABLE u
       LEFT JOIN USER_PLAN up ON up.user_id = u.user_id AND up.is_active = 'true'
       LEFT JOIN PLAN p ON p.plan_id = up.plan_id
       WHERE u.email = :email
       FETCH FIRST 1 ROW ONLY`,
      { email: String(email).toLowerCase() }
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const row = result.rows[0];
    const hash = row.PASSWORD_HASH != null ? String(row.PASSWORD_HASH) : '';
    const valid = await bcrypt.compare(String(password), hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const planType = row.PLAN_TYPE || 'general';
    const userId = Number(row.USER_ID);
    const token = jwt.sign(
      { userId, role: 'user', planType },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: { userId, name: row.NAME, email: row.EMAIL, planType }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

// POST /api/auth/admin/login
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  try {
    const result = await execute(
      `SELECT a.admin_id, a.name, a.email, a.password_hash,
              CASE WHEN sa.admin_id IS NOT NULL THEN 'super_admin'
                   WHEN la.admin_id IS NOT NULL THEN 'local_admin'
                   ELSE 'admin' END AS admin_role,
              la.facility_id
       FROM ADMIN a
       LEFT JOIN SUPER_ADMIN sa ON sa.admin_id = a.admin_id
       LEFT JOIN LOCAL_ADMIN la ON la.admin_id = a.admin_id
       WHERE LOWER(a.email) = :email`,
      { email: String(email).toLowerCase() }
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const row = result.rows[0];
    const hash = row.PASSWORD_HASH != null ? String(row.PASSWORD_HASH) : '';
    const valid = await bcrypt.compare(String(password), hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const role = row.ADMIN_ROLE;
    const token = jwt.sign(
      {
        userId: Number(row.ADMIN_ID),
        role,
        facilityId: row.FACILITY_ID || null
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      admin: {
        adminId: row.ADMIN_ID,
        name: row.NAME,
        email: row.EMAIL,
        role,
        facilityId: row.FACILITY_ID
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Admin login failed', detail: err.message });
  }
});

module.exports = router;
