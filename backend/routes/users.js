const router = require('express').Router();
const { execute, getConnection } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const r = await execute(
      `SELECT u.user_id, u.name, u.phone_number, u.email,
              p.plan_type, p.plan_id, pd.price
       FROM USER_TABLE u
       LEFT JOIN USER_PLAN up ON up.user_id = u.user_id AND up.is_active = 'true'
       LEFT JOIN PLAN p ON p.plan_id = up.plan_id
       LEFT JOIN PLAN_DETAILS pd ON pd.plan_type = p.plan_type
       WHERE u.user_id = :user_id`,
      { user_id: req.user.userId }
    );
    if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/plans', authMiddleware, async (req, res) => {
  try {
    const r = await execute(
      `SELECT p.plan_id, p.plan_type, pd.price, pd.duration_type 
       FROM PLAN p 
       JOIN PLAN_DETAILS pd ON p.plan_type = pd.plan_type
       ORDER BY pd.price ASC`
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/plan', authMiddleware, async (req, res) => {
  const { plan_id } = req.body;
  if (!plan_id) return res.status(400).json({ error: 'plan_id required' });
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(`UPDATE USER_PLAN SET is_active = 'false' WHERE user_id = :user_id AND is_active = 'true'`, { user_id: req.user.userId });
    await conn.execute(
      `INSERT INTO USER_PLAN (user_id, plan_id, start_date, end_date, is_active)
       VALUES (:user_id, :pid, TRUNC(SYSDATE), ADD_MONTHS(TRUNC(SYSDATE), 1), 'true')`,
      { user_id: req.user.userId, pid: plan_id }
    );
    const r = await conn.execute(`SELECT plan_type FROM PLAN WHERE plan_id = :pid`, { pid: plan_id });
    const planType = r.rows[0].PLAN_TYPE;
    await conn.commit();
    
    const token = jwt.sign(
      { userId: req.user.userId, role: 'user', planType },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    res.json({ token, planType });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  const { name, email, phone_number, password } = req.body;
  if (!name || !phone_number || !email) return res.status(400).json({ error: 'Name, email and phone required' });
  let query = `UPDATE USER_TABLE SET name = :name, email = :email, phone_number = :phone`;
  const params = { name, email: email.toLowerCase(), phone: phone_number, user_id: req.user.userId };
  if (password) {
    const bcrypt = require('bcryptjs');
    params.pwd = await bcrypt.hash(password, 12);
    query += `, password_hash = :pwd`;
  }
  query += ` WHERE user_id = :user_id`;
  try {
    await execute(query, params);
    res.json({ message: 'Profile updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

