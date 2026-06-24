// PUT /api/slots/:id/book  (requires zone_id in body)
const router = require('express').Router();
const { getConnection } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const oracledb = require('oracledb');

router.put('/:id/book', authMiddleware, async (req, res) => {
  const { vehicle_id, zone_id } = req.body;
  const slotId = req.params.id;

  if (!vehicle_id || !zone_id) {
    return res.status(400).json({ error: 'vehicle_id and zone_id required' });
  }

  let conn;
  try {
    conn = await getConnection();

    const owns = await conn.execute(
      `SELECT vehicle_id FROM VEHICLE WHERE vehicle_id = :vid AND user_id = :user_id`,
      { vid: vehicle_id, user_id: req.user.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!owns.rows.length) {
      return res.status(403).json({ error: 'Vehicle does not belong to this user' });
    }

    const activeRes = await conn.execute(
      `SELECT pr.record_id FROM PARKING_RECORD pr
       JOIN VEHICLE v ON v.vehicle_id = pr.vehicle_id
       WHERE v.user_id = :user_id AND pr.exit_date IS NULL AND pr.status = 'active'`,
      { user_id: req.user.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (activeRes.rows.length) {
      return res.status(409).json({ error: 'You already have an active parking session. Exit or pay first.' });
    }

    const slotRes = await conn.execute(
      `SELECT ps.slot_id, ps.zone_id, ps.status, ps.slot_number,
              pz.tier_type, zr.base_rate
       FROM PARKING_SLOT ps
       JOIN PARKING_ZONE pz ON pz.zone_id = ps.zone_id
       JOIN ZONE_RATE zr ON zr.tier_type = pz.tier_type
       WHERE ps.slot_id = :sid AND ps.zone_id = :zid`,
      { sid: slotId, zid: zone_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!slotRes.rows.length) return res.status(404).json({ error: 'Slot not found' });
    const slot = slotRes.rows[0];

    let queueId = null;
    if (slot.STATUS !== 'free') {
      if (slot.STATUS !== 'reserved') {
        return res.status(409).json({ error: 'Slot not available' });
      }
      const qRes = await conn.execute(
        `SELECT q.queue_id FROM QUEUE q
         JOIN VEHICLE v ON v.vehicle_id = q.vehicle_id
         WHERE v.user_id = :user_id
           AND q.status = 'allocated'
           AND q.zone_id = :zid
           AND q.allocated_slot_id = :sid
         FETCH FIRST 1 ROW ONLY`,
        { user_id: req.user.userId, zid: zone_id, sid: slotId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (!qRes.rows.length) {
        return res.status(409).json({ error: 'Slot is reserved for another user' });
      }
      queueId = qRes.rows[0].QUEUE_ID;
    }

    const planRes = await conn.execute(
      `SELECT p.plan_type FROM USER_PLAN up
       JOIN PLAN p ON p.plan_id = up.plan_id
       WHERE up.user_id = :user_id AND up.is_active = 'true'`,
      { user_id: req.user.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const planType = planRes.rows[0]?.PLAN_TYPE || 'general';
    const tierAllowed = {
      general:  ['general'],
      gold:     ['general', 'gold'],
      platinum: ['general', 'gold', 'platinum']
    };
    if (!tierAllowed[planType]?.includes(slot.TIER_TYPE)) {
      return res.status(403).json({
        error: `Your ${planType} plan cannot access ${slot.TIER_TYPE} zones`
      });
    }

    const entryDay = new Date().toISOString().slice(0, 10);
    await conn.execute(
      `INSERT INTO TICKET (vehicle_id, zone_id, slot_id, entry_day, entry_time)
       VALUES (:vid, :zid, :sid, :eday, CURRENT_TIMESTAMP)`,
      { vid: vehicle_id, zid: zone_id, sid: slotId, eday: entryDay },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const ticketRow = await conn.execute(
      `SELECT ticket_id FROM TICKET
       WHERE vehicle_id = :vid AND zone_id = :zid AND slot_id = :sid
       ORDER BY entry_time DESC FETCH FIRST 1 ROW ONLY`,
      { vid: vehicle_id, zid: zone_id, sid: slotId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const ticketId = ticketRow.rows[0].TICKET_ID;

    await conn.execute(
      `INSERT INTO PARKING_RECORD (vehicle_id, zone_id, slot_id, ticket_id, status, entry_date)
       VALUES (:vid, :zid, :sid, :tid, 'active', TRUNC(SYSDATE))`,
      { vid: vehicle_id, zid: zone_id, sid: slotId, tid: ticketId }
    );
    const recordRow = await conn.execute(
      `SELECT record_id FROM PARKING_RECORD
       WHERE vehicle_id = :vid AND zone_id = :zid AND slot_id = :sid AND ticket_id = :tid`,
      { vid: vehicle_id, zid: zone_id, sid: slotId, tid: ticketId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const recordId = recordRow.rows[0].RECORD_ID;

    await conn.execute(
      `INSERT INTO BILL (record_id, payment_status) VALUES (:rid, 'pending')`,
      { rid: recordId }
    );
    await conn.execute(
      `INSERT INTO BILL_CALCULATION (record_id, amount, discount) VALUES (:rid, 0, 0)`,
      { rid: recordId }
    );
    await conn.execute(
      `UPDATE PARKING_SLOT SET status = 'occupied'
       WHERE slot_id = :sid AND zone_id = :zid`,
      { sid: slotId, zid: zone_id }
    );

    if (queueId) {
      await conn.execute(
        `UPDATE QUEUE SET status = 'parked' WHERE queue_id = :qid`,
        { qid: queueId }
      );
    }

    await conn.commit();
    res.status(201).json({
      ticket_id: ticketId,
      record_id: recordId,
      slot_number: slot.SLOT_NUMBER,
      zone_id: zone_id,
      entry_time: new Date().toISOString()
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Booking failed', detail: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;
