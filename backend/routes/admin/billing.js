const router = require('express').Router();
const { execute } = require('../../config/db');
const { adminMiddleware } = require('../../middleware/auth');
const { facilityScope } = require('../../middleware/facilityScope');

// GET /api/admin/billing
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const scope = facilityScope(req, 'z.facility_id');
    const sql = `
      SELECT b.bill_id, b.payment_status, bc.amount, bc.discount,
             r.entry_date, r.exit_date, v.vehicle_number, f.facility_name as facility_name
      FROM BILL b
      JOIN BILL_CALCULATION bc ON b.record_id = bc.record_id
      JOIN PARKING_RECORD r ON b.record_id = r.record_id
      JOIN VEHICLE v ON r.vehicle_id = v.vehicle_id
      JOIN PARKING_ZONE z ON r.zone_id = z.zone_id
      JOIN FACILITY f ON z.facility_id = f.facility_id
      WHERE 1=1 ${scope.clause}
      ORDER BY b.bill_id DESC`;

    const result = await execute(sql, scope.binds);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
