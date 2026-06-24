const router = require('express').Router();
const { execute } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  const { status } = req.query;
  let whereExtra = '';
  if (status === 'active') {
    whereExtra = `AND pr.exit_date IS NULL AND pr.status = 'active'`;
  }
  if (status === 'completed') {
    whereExtra = `AND pr.exit_date IS NOT NULL AND pr.status = 'completed'`;
  }
  if (status === 'cancelled') {
    whereExtra = `AND pr.status = 'completed' AND b.payment_status = 'failed'`;
  }

  try {
    const result = await execute(
      `SELECT pr.record_id, pr.entry_date, pr.exit_date, pr.status,
              t.ticket_id, t.entry_day, t.entry_time,
              ps.slot_number, ps.zone_id,
              pz.zone_name, zr.base_rate,
              f.facility_name,
              v.vehicle_number, v.vehicle_type,
              b.bill_id, bc.amount, bc.discount, b.payment_status
       FROM PARKING_RECORD pr
       JOIN TICKET t ON t.ticket_id = pr.ticket_id
         AND t.vehicle_id = pr.vehicle_id AND t.zone_id = pr.zone_id AND t.slot_id = pr.slot_id
       JOIN PARKING_SLOT ps ON ps.slot_id = pr.slot_id AND ps.zone_id = pr.zone_id
       JOIN PARKING_ZONE pz ON pz.zone_id = pr.zone_id
       JOIN ZONE_RATE zr ON zr.tier_type = pz.tier_type
       JOIN FACILITY f ON f.facility_id = pz.facility_id
       JOIN VEHICLE v ON v.vehicle_id = pr.vehicle_id
       LEFT JOIN BILL b ON b.record_id = pr.record_id
       LEFT JOIN BILL_CALCULATION bc ON bc.record_id = pr.record_id
       WHERE v.user_id = :user_id ${whereExtra}
       ORDER BY pr.entry_date DESC, t.entry_time DESC`,
      { user_id: req.user.userId }
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.post('/:id/exit', authMiddleware, async (req, res) => {
  try {
    await execute(
      `UPDATE PARKING_RECORD SET exit_date = SYSDATE, status = 'completed'
       WHERE record_id = :rid AND exit_date IS NULL`,
      { rid: req.params.id }
    );
    await execute(
      `UPDATE PARKING_SLOT ps SET status = 'free'
       WHERE ps.slot_id = (SELECT slot_id FROM PARKING_RECORD WHERE record_id = :rid)
         AND ps.zone_id = (SELECT zone_id FROM PARKING_RECORD WHERE record_id = :rid)`,
      { rid: req.params.id }
    );
    res.json({ message: 'Exited parking. Proceed to billing.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Exit failed' });
  }
});

module.exports = router;
