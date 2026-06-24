const router = require('express').Router();
const { execute } = require('../../config/db');
const { adminMiddleware } = require('../../middleware/auth');
const { facilityScope } = require('../../middleware/facilityScope');

router.get('/', adminMiddleware, async (req, res) => {
  const scope = facilityScope(req, 'pz.facility_id');
  try {
    const result = await execute(
      `SELECT q.queue_id, q.position, q.status, q.arrival_time,
              q.allocated_slot_id, q.zone_id, ps.slot_number,
              v.vehicle_number, v.vehicle_type,
              pz.zone_name, f.facility_name,
              ROUND((SYSDATE - CAST(q.arrival_time AS DATE)) * 1440) AS wait_minutes
       FROM QUEUE q
       JOIN VEHICLE v ON v.vehicle_id = q.vehicle_id
       JOIN PARKING_ZONE pz ON pz.zone_id = q.zone_id
       JOIN FACILITY f ON f.facility_id = pz.facility_id
       LEFT JOIN PARKING_SLOT ps ON ps.slot_id = q.allocated_slot_id AND ps.zone_id = q.zone_id
       WHERE q.status IN ('waiting','allocated','parked') ${scope.clause}
       ORDER BY q.status, q.position`,
      scope.binds
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

router.post('/:id/allocate', adminMiddleware, async (req, res) => {
  const { slot_id, zone_id } = req.body;
  if (!slot_id || !zone_id) {
    return res.status(400).json({ error: 'slot_id and zone_id required' });
  }
  try {
    const scope = facilityScope(req, 'pz.facility_id');
    const q = await execute(
      `SELECT q.queue_id, q.zone_id
       FROM QUEUE q
       JOIN PARKING_ZONE pz ON pz.zone_id = q.zone_id
       WHERE q.queue_id = :qid ${scope.clause}`,
      { qid: req.params.id, ...scope.binds }
    );
    if (!q.rows.length) return res.status(404).json({ error: 'Queue entry not found' });
    if (Number(q.rows[0].ZONE_ID) !== Number(zone_id)) {
      return res.status(400).json({ error: 'zone_id does not match queue entry' });
    }

    const slot = await execute(
      `SELECT status FROM PARKING_SLOT WHERE slot_id = :sid AND zone_id = :zid`,
      { sid: slot_id, zid: zone_id }
    );
    if (!slot.rows.length) return res.status(404).json({ error: 'Slot not found' });
    if (slot.rows[0].STATUS !== 'free') {
      return res.status(409).json({ error: 'Slot is not free' });
    }

    await execute(
      `UPDATE QUEUE SET status = 'allocated', allocated_slot_id = :sid
       WHERE queue_id = :qid`,
      { sid: slot_id, qid: req.params.id }
    );
    await execute(
      `UPDATE PARKING_SLOT SET status = 'reserved'
       WHERE slot_id = :sid AND zone_id = :zid`,
      { sid: slot_id, zid: zone_id }
    );
    res.json({ message: 'Slot allocated' });
  } catch (err) {
    res.status(500).json({ error: 'Allocation failed' });
  }
});

router.post('/:id/auto-allocate', adminMiddleware, async (req, res) => {
  let conn;
  try {
    const scope = facilityScope(req, 'pz.facility_id');
    const { getConnection } = require('../../config/db');
    conn = await getConnection();
    const q = await conn.execute(
      `SELECT q.queue_id, q.zone_id, q.status
       FROM QUEUE q
       JOIN PARKING_ZONE pz ON pz.zone_id = q.zone_id
       WHERE q.queue_id = :qid ${scope.clause}`,
      { qid: req.params.id, ...scope.binds }
    );
    if (!q.rows.length) return res.status(404).json({ error: 'Queue entry not found' });
    if (q.rows[0].STATUS !== 'waiting') return res.status(400).json({ error: 'Queue entry not waiting' });

    const zid = q.rows[0].ZONE_ID;
    const slot = await conn.execute(
      `SELECT slot_id FROM PARKING_SLOT WHERE zone_id = :zid AND status = 'free' ORDER BY slot_number ASC FETCH FIRST 1 ROW ONLY`,
      { zid }
    );
    if (!slot.rows.length) return res.status(409).json({ error: 'No free slots in this zone' });

    const sid = slot.rows[0].SLOT_ID;
    await conn.execute(`UPDATE QUEUE SET status = 'allocated', allocated_slot_id = :sid WHERE queue_id = :qid`, { sid, qid: req.params.id });
    await conn.execute(`UPDATE PARKING_SLOT SET status = 'reserved' WHERE slot_id = :sid`, { sid });
    await conn.commit();
    res.json({ message: 'Slot auto-allocated', slot_id: sid });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: 'Auto-allocation failed' });
  } finally {
    if (conn) await conn.close();
  }
});

router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const scope = facilityScope(req, 'pz.facility_id');
    const row = await execute(
      `SELECT q.allocated_slot_id, q.zone_id, q.status
       FROM QUEUE q
       JOIN PARKING_ZONE pz ON pz.zone_id = q.zone_id
       WHERE q.queue_id = :qid ${scope.clause}`,
      { qid: req.params.id, ...scope.binds }
    );
    if (!row.rows.length) return res.status(404).json({ error: 'Queue entry not found' });
    const r = row.rows[0];
    if (r.STATUS === 'allocated' && r.ALLOCATED_SLOT_ID) {
      await execute(
        `UPDATE PARKING_SLOT SET status = 'free'
         WHERE slot_id = :sid AND zone_id = :zid`,
        { sid: r.ALLOCATED_SLOT_ID, zid: r.ZONE_ID }
      );
    }
    await execute(
      `UPDATE QUEUE SET status = 'cancelled' WHERE queue_id = :qid`,
      { qid: req.params.id }
    );
    res.json({ message: 'Removed from queue' });
  } catch (err) {
    res.status(500).json({ error: 'Remove failed' });
  }
});

module.exports = router;
