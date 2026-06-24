const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { execute, getConnection } = require('../../config/db');
const { adminMiddleware, requireSuperAdmin } = require('../../middleware/auth');

// GET /api/admin/local-admins
router.get('/', adminMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const r = await execute(
      `SELECT a.admin_id, a.name, a.email, la.facility_id, f.facility_name as facility_name
       FROM ADMIN a
       JOIN LOCAL_ADMIN la ON la.admin_id = a.admin_id
       LEFT JOIN FACILITY f ON f.facility_id = la.facility_id
       ORDER BY a.name`
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/local-admins
router.post('/', adminMiddleware, requireSuperAdmin, async (req, res) => {
  const { name, email, password, facility_id } = req.body;
  if (!name || !email || !password || !facility_id) {
    return res.status(400).json({ error: 'name, email, password, facility_id required' });
  }
  let conn;
  try {
    const hash = await bcrypt.hash(password, 12);
    conn = await getConnection();
    const r = await conn.execute(
      `INSERT INTO ADMIN (name, email, password_hash) VALUES (:name, :email, :hash) RETURNING admin_id INTO :aid`,
      { name, email: email.toLowerCase(), hash, aid: { type: require('oracledb').NUMBER, dir: require('oracledb').BIND_OUT } }
    );
    const aid = r.outBinds.aid[0];
    await conn.execute(
      `INSERT INTO LOCAL_ADMIN (admin_id, facility_id) VALUES (:aid, :fid)`,
      { aid, fid: facility_id }
    );
    await conn.commit();
    res.status(201).json({ admin_id: aid });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// PUT /api/admin/local-admins/:id
router.put('/:id', adminMiddleware, requireSuperAdmin, async (req, res) => {
  const { name, email, password, facility_id } = req.body;
  if (!name && !email && !password && !facility_id) {
    return res.status(400).json({ error: 'Provide at least one field to update' });
  }
  let conn;
  try {
    conn = await getConnection();
    const sets = [];
    const binds = { aid: req.params.id };
    if (name) { sets.push('name = :name'); binds.name = name; }
    if (email) { sets.push('email = :email'); binds.email = email.toLowerCase(); }
    if (password) {
      binds.hash = await bcrypt.hash(password, 12);
      sets.push('password_hash = :hash');
    }
    if (sets.length) {
      await conn.execute(`UPDATE ADMIN SET ${sets.join(', ')} WHERE admin_id = :aid`, binds);
    }
    if (facility_id) {
      await conn.execute(`UPDATE LOCAL_ADMIN SET facility_id = :fid WHERE admin_id = :aid`, { fid: facility_id, aid: req.params.id });
    }
    await conn.commit();
    res.json({ message: 'Local admin updated' });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// DELETE /api/admin/local-admins/:id
router.delete('/:id', adminMiddleware, requireSuperAdmin, async (req, res) => {
  const aid = req.params.id;
  let conn;
  try {
    conn = await getConnection();
    const la = await conn.execute(`SELECT facility_id FROM LOCAL_ADMIN WHERE admin_id = :aid`, { aid });
    if (!la.rows.length) return res.status(404).json({ error: 'Local admin not found' });
    const fid = la.rows[0].FACILITY_ID;

    const active = await conn.execute(
      `SELECT COUNT(*) AS cnt
       FROM PARKING_RECORD pr
       JOIN PARKING_ZONE pz ON pz.zone_id = pr.zone_id
       WHERE pr.exit_date IS NULL AND pr.status = 'active' AND pz.facility_id = :fid`,
      { fid }
    );
    if (active.rows[0].CNT > 0) {
      return res.status(409).json({ error: 'Facility has active records. Reassign before deleting admin.' });
    }

    await conn.execute(`DELETE FROM LOCAL_ADMIN WHERE admin_id = :aid`, { aid });
    await conn.execute(`DELETE FROM ADMIN WHERE admin_id = :aid`, { aid });
    await conn.commit();
    res.json({ message: 'Local admin removed' });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;

