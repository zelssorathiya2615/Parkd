const router = require('express').Router();
const { execute } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.get('/active', authMiddleware, async (req, res) => {
  try {
    const result = await execute(
      `SELECT t.ticket_id, t.entry_day, t.entry_time,
              ps.slot_number, ps.zone_id, ps.slot_id,
              pz.zone_name, zr.base_rate, pz.tier_type,
              f.facility_name, f.location,
              v.vehicle_number, v.vehicle_type,
              pr.record_id, pr.entry_date,
              b.bill_id, b.payment_status
       FROM TICKET t
       JOIN PARKING_SLOT ps ON ps.slot_id = t.slot_id AND ps.zone_id = t.zone_id
       JOIN PARKING_ZONE pz ON pz.zone_id = t.zone_id
       JOIN ZONE_RATE zr ON zr.tier_type = pz.tier_type
       JOIN FACILITY f ON f.facility_id = pz.facility_id
       JOIN VEHICLE v ON v.vehicle_id = t.vehicle_id
       JOIN PARKING_RECORD pr ON pr.ticket_id = t.ticket_id
         AND pr.vehicle_id = t.vehicle_id AND pr.zone_id = t.zone_id AND pr.slot_id = t.slot_id
       JOIN BILL b ON b.record_id = pr.record_id
       WHERE v.user_id = :user_id
         AND pr.exit_date IS NULL
         AND pr.status = 'active'
         AND b.payment_status = 'pending'
       FETCH FIRST 1 ROW ONLY`,
      { user_id: req.user.userId }
    );
    if (!result.rows.length) return res.status(404).json({ error: 'No active ticket' });

    const row = result.rows[0];
    const entryMs = new Date(row.ENTRY_TIME).getTime();
    const elapsedSeconds = Math.floor((Date.now() - entryMs) / 1000);
    const hours = elapsedSeconds / 3600;
    const estimatedCost = parseFloat((hours * row.BASE_RATE).toFixed(2));

    res.json({ ...row, elapsed_seconds: elapsedSeconds, estimated_cost: estimatedCost });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch active ticket' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await execute(
      `SELECT t.*, ps.slot_number, pz.zone_name, zr.base_rate,
              f.facility_name, v.vehicle_number, v.vehicle_type
       FROM TICKET t
       JOIN PARKING_SLOT ps ON ps.slot_id = t.slot_id AND ps.zone_id = t.zone_id
       JOIN PARKING_ZONE pz ON pz.zone_id = t.zone_id
       JOIN ZONE_RATE zr ON zr.tier_type = pz.tier_type
       JOIN FACILITY f ON f.facility_id = pz.facility_id
       JOIN VEHICLE v ON v.vehicle_id = t.vehicle_id
       WHERE t.ticket_id = :tid`,
      { tid: req.params.id }
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ticket not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

module.exports = router;
