const router = require('express').Router();
const { execute, getConnection } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const oracledb = require('oracledb');

router.get('/position', authMiddleware, async (req, res) => {
  try {
    const result = await execute(
            `SELECT q.queue_id, q.position, q.status, q.arrival_time,
              q.allocated_slot_id, q.zone_id,
              ps.slot_number,
              pz.zone_name, f.facility_name, v.vehicle_number
             FROM QUEUE q
             JOIN VEHICLE v ON v.vehicle_id = q.vehicle_id
             JOIN PARKING_ZONE pz ON pz.zone_id = q.zone_id
             JOIN FACILITY f ON f.facility_id = pz.facility_id
             LEFT JOIN PARKING_SLOT ps ON ps.slot_id = q.allocated_slot_id AND ps.zone_id = q.zone_id
       WHERE v.user_id = :user_id AND q.status IN ('waiting','allocated')
       FETCH FIRST 1 ROW ONLY`,
      { user_id: req.user.userId }
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not in queue' });

    const row = result.rows[0];
    res.json({ ...row, estimated_wait_minutes: Math.ceil(row.POSITION * 4) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch queue position' });
  }
});

router.post('/join', authMiddleware, async (req, res) => {
  const { zone_id, vehicle_id } = req.body;
  if (!zone_id || !vehicle_id) {
    return res.status(400).json({ error: 'zone_id and vehicle_id required' });
  }
  let conn;
  try {
    const owns = await execute(
      `SELECT vehicle_id FROM VEHICLE WHERE vehicle_id = :vid AND user_id = :user_id`,
      { vid: vehicle_id, user_id: req.user.userId }
    );
    if (!owns.rows.length) {
      return res.status(403).json({ error: 'Vehicle does not belong to this user' });
    }

    const activeRes = await execute(
      `SELECT pr.record_id FROM PARKING_RECORD pr
       JOIN VEHICLE v ON v.vehicle_id = pr.vehicle_id
       WHERE v.user_id = :user_id AND pr.exit_date IS NULL AND pr.status = 'active'
       FETCH FIRST 1 ROW ONLY`,
      { user_id: req.user.userId }
    );
    if (activeRes.rows.length) {
      return res.status(409).json({ error: 'You already have an active parking session' });
    }

    const existing = await execute(
      `SELECT q.queue_id FROM QUEUE q
       JOIN VEHICLE v ON v.vehicle_id = q.vehicle_id
       WHERE v.user_id = :user_id AND q.status IN ('waiting','allocated')
       FETCH FIRST 1 ROW ONLY`,
      { user_id: req.user.userId }
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'You are already in the queue' });
    }

    const freeRes = await execute(
      `SELECT COUNT(*) AS c FROM PARKING_SLOT WHERE zone_id = :zid AND status = 'free'`,
      { zid: zone_id }
    );
    if ((freeRes.rows[0].C || 0) > 0) {
      return res.status(409).json({ error: 'Slots are available — book directly instead of joining queue' });
    }

    conn = await getConnection();
    const planRes = await conn.execute(
      `SELECT p.plan_type FROM USER_PLAN up
       JOIN PLAN p ON p.plan_id = up.plan_id
       WHERE up.user_id = :user_id AND up.is_active = 'true'`,
      { user_id: req.user.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const planType = planRes.rows[0]?.PLAN_TYPE || 'general';

    const posRes = await conn.execute(
      `SELECT NVL(MAX(position),0) AS max_pos FROM QUEUE
       WHERE zone_id = :zid AND status IN ('waiting','allocated')`,
      { zid: zone_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    let maxPos = posRes.rows[0].MAX_POS || 0;
    let nextPos = maxPos + 1;
    if (planType === 'gold' || planType === 'platinum') {
      nextPos = Math.max(1, Math.ceil(maxPos / 2));
      await conn.execute(
        `UPDATE QUEUE SET position = position + 1
         WHERE zone_id = :zid AND status IN ('waiting','allocated') AND position >= :pos`,
        { zid: zone_id, pos: nextPos }
      );
    }

    await conn.execute(
      `INSERT INTO QUEUE (vehicle_id, zone_id, arrival_time, position, status)
       VALUES (:vid, :zid, CURRENT_TIMESTAMP, :pos, 'waiting')`,
      { vid: vehicle_id, zid: zone_id, pos: nextPos }
    );
    await conn.commit();
    res.status(201).json({ message: 'Joined queue', position: nextPos });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: 'Failed to join queue', detail: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

router.delete('/leave', authMiddleware, async (req, res) => {
  try {
    const alloc = await execute(
      `SELECT q.allocated_slot_id, q.zone_id
       FROM QUEUE q
       JOIN VEHICLE v ON v.vehicle_id = q.vehicle_id
       WHERE v.user_id = :user_id AND q.status = 'allocated' AND q.allocated_slot_id IS NOT NULL`,
      { user_id: req.user.userId }
    );
    for (const row of alloc.rows) {
      await execute(
        `UPDATE PARKING_SLOT SET status = 'free'
         WHERE slot_id = :sid AND zone_id = :zid`,
        { sid: row.ALLOCATED_SLOT_ID, zid: row.ZONE_ID }
      );
    }
    await execute(
      `UPDATE QUEUE SET status = 'cancelled'
       WHERE vehicle_id IN (SELECT vehicle_id FROM VEHICLE WHERE user_id = :user_id)
         AND status IN ('waiting','allocated')`,
      { user_id: req.user.userId }
    );
    res.json({ message: 'Left queue' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave queue' });
  }
});

module.exports = router;
