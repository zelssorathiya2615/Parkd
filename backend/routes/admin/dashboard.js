const router = require('express').Router();
const { execute } = require('../../config/db');
const { adminMiddleware } = require('../../middleware/auth');
const { facilityScope } = require('../../middleware/facilityScope');

router.get('/', adminMiddleware, async (req, res) => {
  const scope = facilityScope(req, 'pz.facility_id');
  const binds = { ...scope.binds };
  try {
    const rev = await execute(
      `SELECT NVL(SUM(bc.amount),0) AS revenue_today
       FROM BILL b
       JOIN BILL_CALCULATION bc ON bc.record_id = b.record_id
       JOIN PARKING_RECORD pr ON pr.record_id = b.record_id
       JOIN PARKING_ZONE pz ON pz.zone_id = pr.zone_id
       WHERE TRUNC(pr.exit_date) = TRUNC(SYSDATE) AND b.payment_status = 'paid' ${scope.clause}`,
      binds
    );
    const active = await execute(
      `SELECT COUNT(*) AS active_vehicles FROM PARKING_RECORD pr
       JOIN PARKING_ZONE pz ON pz.zone_id = pr.zone_id
       WHERE pr.exit_date IS NULL AND pr.status = 'active' ${scope.clause}`,
      binds
    );
    const free = await execute(
      `SELECT COUNT(*) AS free_slots FROM PARKING_SLOT ps
       JOIN PARKING_ZONE pz ON pz.zone_id = ps.zone_id
       WHERE ps.status = 'free' ${scope.clause}`,
      binds
    );
    const q = await execute(
      `SELECT COUNT(*) AS queue_length FROM QUEUE qu
       JOIN PARKING_ZONE pz ON pz.zone_id = qu.zone_id
       WHERE qu.status IN ('waiting','allocated') ${scope.clause}`,
      binds
    );

    const facilities = await execute(
      `SELECT COUNT(DISTINCT f.facility_id) AS facility_count
       FROM FACILITY f
       WHERE 1=1 ${scope.clause.replace('pz.facility_id', 'f.facility_id')}`,
      binds
    );

    const slots = await execute(
      `SELECT COUNT(*) AS total_slots
       FROM PARKING_SLOT ps
       JOIN PARKING_ZONE pz ON pz.zone_id = ps.zone_id
       WHERE 1=1 ${scope.clause}`,
      binds
    );

    const qStats = await execute(
      `SELECT
         COUNT(CASE WHEN qu.status = 'waiting' THEN 1 END) AS waiting_count,
         COUNT(CASE WHEN qu.status = 'allocated' THEN 1 END) AS allocated_count
       FROM QUEUE qu
       JOIN PARKING_ZONE pz ON pz.zone_id = qu.zone_id
       WHERE qu.status IN ('waiting','allocated') ${scope.clause}`,
      binds
    );

    const revSeries = await execute(
      `SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS day, NVL(r.total, 0) AS total
       FROM (
         SELECT TRUNC(SYSDATE) - (LEVEL - 1) AS day
         FROM dual CONNECT BY LEVEL <= 7
       ) d
       LEFT JOIN (
         SELECT TRUNC(pr.exit_date) AS day, SUM(bc.amount) AS total
         FROM BILL b
         JOIN BILL_CALCULATION bc ON bc.record_id = b.record_id
         JOIN PARKING_RECORD pr ON pr.record_id = b.record_id
         JOIN PARKING_ZONE pz ON pz.zone_id = pr.zone_id
         WHERE b.payment_status = 'paid'
           AND pr.exit_date IS NOT NULL
           AND pr.exit_date >= TRUNC(SYSDATE) - 6 ${scope.clause}
         GROUP BY TRUNC(pr.exit_date)
       ) r ON r.day = d.day
       ORDER BY d.day`,
      binds
    );

    const activity = await execute(
      `SELECT * FROM (
         SELECT 'entry' AS kind,
                t.entry_time AS ts,
                v.vehicle_number,
                pz.zone_name,
                f.facility_name,
                NULL AS amount
         FROM PARKING_RECORD pr
         JOIN TICKET t ON t.ticket_id = pr.ticket_id
           AND t.vehicle_id = pr.vehicle_id AND t.zone_id = pr.zone_id AND t.slot_id = pr.slot_id
         JOIN VEHICLE v ON v.vehicle_id = pr.vehicle_id
         JOIN PARKING_ZONE pz ON pz.zone_id = pr.zone_id
         JOIN FACILITY f ON f.facility_id = pz.facility_id
         WHERE pr.status = 'active' ${scope.clause}

         UNION ALL

         SELECT 'payment' AS kind,
                CAST(pr.exit_date AS TIMESTAMP) AS ts,
                v.vehicle_number,
                pz.zone_name,
                f.facility_name,
                bc.amount
         FROM BILL b
         JOIN BILL_CALCULATION bc ON bc.record_id = b.record_id
         JOIN PARKING_RECORD pr ON pr.record_id = b.record_id
         JOIN VEHICLE v ON v.vehicle_id = pr.vehicle_id
         JOIN PARKING_ZONE pz ON pz.zone_id = pr.zone_id
         JOIN FACILITY f ON f.facility_id = pz.facility_id
         WHERE b.payment_status = 'paid'
           AND pr.exit_date IS NOT NULL ${scope.clause}
       )
       ORDER BY ts DESC
       FETCH FIRST 6 ROWS ONLY`,
      binds
    );

    res.json({
      revenue_today:   rev.rows[0].REVENUE_TODAY,
      active_vehicles: active.rows[0].ACTIVE_VEHICLES,
      free_slots:      free.rows[0].FREE_SLOTS,
      queue_length:    q.rows[0].QUEUE_LENGTH,
      facility_count:  facilities.rows[0].FACILITY_COUNT,
      total_slots:     slots.rows[0].TOTAL_SLOTS,
      waiting_count:   qStats.rows[0].WAITING_COUNT,
      allocated_count: qStats.rows[0].ALLOCATED_COUNT,
      revenue_series:  revSeries.rows.map(r => ({ day: r.DAY, total: r.TOTAL })),
      activity:        activity.rows.map(r => ({
        kind: r.KIND,
        ts: r.TS,
        vehicle_number: r.VEHICLE_NUMBER,
        zone_name: r.ZONE_NAME,
        facility_name: r.FACILITY_NAME,
        amount: r.AMOUNT
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/occupancy', adminMiddleware, async (req, res) => {
  const scope = facilityScope(req, 'pz.facility_id');
  try {
    const result = await execute(
      `SELECT pz.zone_id, pz.zone_name, pz.total_slots, pz.tier_type,
              COUNT(CASE WHEN ps.status='free'     THEN 1 END) AS free_slots,
              COUNT(CASE WHEN ps.status='occupied' THEN 1 END) AS occupied_slots,
              COUNT(CASE WHEN ps.status='reserved' THEN 1 END) AS reserved_slots
       FROM PARKING_ZONE pz
       JOIN PARKING_SLOT ps ON ps.zone_id = pz.zone_id
       WHERE 1=1 ${scope.clause}
       GROUP BY pz.zone_id, pz.zone_name, pz.total_slots, pz.tier_type
       ORDER BY pz.zone_id`,
      scope.binds
    );
    res.json(result.rows.map(r => ({
      zone_id: r.ZONE_ID, zone_name: r.ZONE_NAME, tier_type: r.TIER_TYPE,
      total: r.TOTAL_SLOTS, free: r.FREE_SLOTS,
      occupied: r.OCCUPIED_SLOTS, reserved: r.RESERVED_SLOTS,
      pct: Math.round((r.OCCUPIED_SLOTS / r.TOTAL_SLOTS) * 100)
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch occupancy' });
  }
});

module.exports = router;
