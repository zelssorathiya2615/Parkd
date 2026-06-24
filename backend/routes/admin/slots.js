const router = require('express').Router();
const { execute } = require('../../config/db');
const { adminMiddleware } = require('../../middleware/auth');
const { facilityScope } = require('../../middleware/facilityScope');

router.get('/', adminMiddleware, async (req, res) => {
  const { zone_id, status } = req.query;
  const scope = facilityScope(req, 'pz.facility_id');
  let where = 'WHERE 1=1' + scope.clause;
  const binds = { ...scope.binds };
  if (zone_id) { where += ' AND ps.zone_id = :zid'; binds.zid = zone_id; }
  if (status)  { where += ' AND ps.status  = :st';  binds.st  = status;  }
  try {
    const result = await execute(
            `SELECT ps.slot_id, ps.zone_id, ps.slot_number, ps.status,
              pz.zone_name, pz.tier_type, f.facility_name, f.facility_id
       FROM PARKING_SLOT ps
       JOIN PARKING_ZONE pz ON pz.zone_id = ps.zone_id
       JOIN FACILITY f ON f.facility_id = pz.facility_id
       ${where}
       ORDER BY ps.zone_id, ps.slot_number`,
      binds
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

router.put('/:id', adminMiddleware, async (req, res) => {
  const { status, zone_id } = req.body;
  if (!['free','occupied','reserved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (!zone_id) {
    return res.status(400).json({ error: 'zone_id required in body' });
  }
  try {
    await execute(
      `UPDATE PARKING_SLOT SET status = :st
       WHERE slot_id = :sid AND zone_id = :zid`,
      { st: status, sid: req.params.id, zid: zone_id }
    );
    res.json({ message: 'Slot status updated', status });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

module.exports = router;
