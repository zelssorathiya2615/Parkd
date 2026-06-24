const router = require('express').Router();
const { execute } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const r = await execute(
      `SELECT vehicle_id, vehicle_number, vehicle_type FROM VEHICLE WHERE user_id = :user_id`,
      { user_id: req.user.userId }
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authMiddleware, async (req, res) => {
  const { vehicle_number, vehicle_type } = req.body;
  if (!vehicle_number || !vehicle_type) {
    return res.status(400).json({ error: 'vehicle_number and vehicle_type required' });
  }
  try {
    await execute(
      `INSERT INTO VEHICLE (user_id, vehicle_number, vehicle_type)
       VALUES (:user_id, :vnum, :vtype)`,
      { user_id: req.user.userId, vnum: vehicle_number.toUpperCase(), vtype: vehicle_type }
    );
    res.status(201).json({ message: 'Vehicle registered' });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('ORA-00001')) {
      return res.status(409).json({ error: 'Vehicle number already registered' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { vehicle_number, vehicle_type } = req.body;
  if (!vehicle_number || !vehicle_type) return res.status(400).json({ error: 'vehicle_number and vehicle_type required' });
  try {
    await execute(
      `UPDATE VEHICLE SET vehicle_number = :vnum, vehicle_type = :vtype
       WHERE vehicle_id = :vid AND user_id = :user_id`,
      { vnum: vehicle_number.toUpperCase(), vtype: vehicle_type, vid: req.params.id, user_id: req.user.userId }
    );
    res.json({ message: 'Vehicle updated' });
  } catch (err) {
    if (err.message && err.message.includes('ORA-00001')) {
      return res.status(409).json({ error: 'Vehicle number already registered' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await execute(`DELETE FROM VEHICLE WHERE vehicle_id = :vid AND user_id = :user_id`, { vid: req.params.id, user_id: req.user.userId });
    res.json({ message: 'Vehicle deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

