// ═══════════════════════════════════════
// PARKD — Facility & Zone Routes
// GET /api/facilities
// GET /api/facilities/zones/:id/slots
// GET /api/zones/:id/slots  (alias)
// ═══════════════════════════════════════
const router = require('express').Router();
const { execute } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await execute(`
      SELECT f.facility_id, f.facility_name, f.location, fl.city,
             z.zone_id, z.zone_name, z.total_slots, z.tier_type,
             zr.base_rate,
             COUNT(CASE WHEN ps.status = 'free'     THEN 1 END) AS free_slots,
             COUNT(CASE WHEN ps.status = 'occupied' THEN 1 END) AS occupied_slots
      FROM FACILITY f
      LEFT JOIN FACILITY_LOCATION fl ON fl.location = f.location
      LEFT JOIN PARKING_ZONE z ON z.facility_id = f.facility_id
      LEFT JOIN ZONE_RATE zr ON zr.tier_type = z.tier_type
      LEFT JOIN PARKING_SLOT ps ON ps.zone_id = z.zone_id
      GROUP BY f.facility_id, f.facility_name, f.location, fl.city,
               z.zone_id, z.zone_name, z.total_slots, z.tier_type, zr.base_rate
      ORDER BY f.facility_id, z.zone_id`
    );

    const facilities = {};
    result.rows.forEach(row => {
      if (!facilities[row.FACILITY_ID]) {
        facilities[row.FACILITY_ID] = {
          facility_id: row.FACILITY_ID,
          name: row.FACILITY_NAME,
          location: row.LOCATION,
          city: row.CITY,
          zones: []
        };
      }
      if (row.ZONE_ID) {
        facilities[row.FACILITY_ID].zones.push({
          zone_id: row.ZONE_ID,
          zone_name: row.ZONE_NAME,
          total_slots: row.TOTAL_SLOTS,
          base_rate: row.BASE_RATE,
          tier_type: row.TIER_TYPE,
          free_slots: row.FREE_SLOTS,
          occupied_slots: row.OCCUPIED_SLOTS
        });
      }
    });

    res.json(Object.values(facilities));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

async function listZoneSlots(req, res) {
  try {
    const result = await execute(
      `SELECT slot_id, zone_id, slot_number, status
       FROM PARKING_SLOT
       WHERE zone_id = :zid
       ORDER BY slot_number`,
      { zid: req.params.id }
    );
    res.json(result.rows.map(r => ({
      slot_id: r.SLOT_ID,
      zone_id: r.ZONE_ID,
      slot_number: r.SLOT_NUMBER,
      status: r.STATUS
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
}

router.get('/zones/:id/slots', authMiddleware, listZoneSlots);

module.exports = router;
module.exports.listZoneSlots = listZoneSlots;
