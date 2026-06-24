const router = require('express').Router();
const { execute } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.get('/current', authMiddleware, async (req, res) => {
  try {
    const result = await execute(
            `SELECT b.bill_id, b.record_id, b.offer_id, b.payment_status,
              bc.amount, bc.discount,
              pr.entry_date, pr.exit_date, t.entry_time, t.ticket_id,
              ps.slot_number, pz.zone_name, zr.base_rate,
              f.facility_name,
              o.condition, o.discount_pct,
              v.vehicle_number
       FROM BILL b
       JOIN BILL_CALCULATION bc ON bc.record_id = b.record_id
       JOIN PARKING_RECORD pr ON pr.record_id = b.record_id
       JOIN TICKET t ON t.ticket_id = pr.ticket_id
         AND t.vehicle_id = pr.vehicle_id AND t.zone_id = pr.zone_id AND t.slot_id = pr.slot_id
       JOIN PARKING_SLOT ps ON ps.slot_id = pr.slot_id AND ps.zone_id = pr.zone_id
       JOIN PARKING_ZONE pz ON pz.zone_id = pr.zone_id
       JOIN ZONE_RATE zr ON zr.tier_type = pz.tier_type
       JOIN FACILITY f ON f.facility_id = pz.facility_id
       JOIN VEHICLE v ON v.vehicle_id = pr.vehicle_id
       LEFT JOIN OFFER o ON o.offer_id = b.offer_id
       WHERE v.user_id = :user_id AND b.payment_status = 'pending'
       ORDER BY t.entry_time DESC
       FETCH FIRST 1 ROW ONLY`,
      { user_id: req.user.userId }
    );
    if (!result.rows.length) return res.status(404).json({ error: 'No pending bill' });

    let bill = result.rows[0];
    if (!bill.OFFER_ID) {
      // Auto-apply best offer
      const bestOffer = await execute(`SELECT * FROM OFFER ORDER BY discount_pct DESC FETCH FIRST 1 ROW ONLY`);
      if (bestOffer.rows.length) {
        const off = bestOffer.rows[0];
        await execute(`UPDATE BILL SET offer_id = :oid WHERE bill_id = :bid`, { oid: off.OFFER_ID, bid: bill.BILL_ID });
        bill.OFFER_ID = off.OFFER_ID;
        bill.CONDITION = off.CONDITION;
        bill.DISCOUNT_PCT = off.DISCOUNT_PCT;
      }
    }

    res.json(bill);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bill' });
  }
});

router.get('/offers/available', authMiddleware, async (req, res) => {
  try {
    const offers = await execute(`SELECT * FROM OFFER ORDER BY discount_pct DESC`);
    res.json(offers.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

router.put('/:id/offer', authMiddleware, async (req, res) => {
  const { offer_id } = req.body;
  try {
    await execute(`UPDATE BILL SET offer_id = :oid WHERE bill_id = :bid`, { oid: offer_id || null, bid: req.params.id });
    res.json({ message: 'Offer updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to apply offer' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await execute(
            `SELECT b.*, bc.amount, bc.discount,
              o.condition, o.discount_pct,
              pr.entry_date, pr.exit_date, t.entry_time, t.ticket_id,
              ps.slot_number, pz.zone_name, zr.base_rate,
              f.facility_name, v.vehicle_number
       FROM BILL b
       JOIN BILL_CALCULATION bc ON bc.record_id = b.record_id
       JOIN PARKING_RECORD pr ON pr.record_id = b.record_id
       JOIN TICKET t ON t.ticket_id = pr.ticket_id
         AND t.vehicle_id = pr.vehicle_id AND t.zone_id = pr.zone_id AND t.slot_id = pr.slot_id
       JOIN PARKING_SLOT ps ON ps.slot_id = pr.slot_id AND ps.zone_id = pr.zone_id
       JOIN PARKING_ZONE pz ON pz.zone_id = pr.zone_id
       JOIN ZONE_RATE zr ON zr.tier_type = pz.tier_type
       JOIN FACILITY f ON f.facility_id = pz.facility_id
       JOIN VEHICLE v ON v.vehicle_id = pr.vehicle_id
       LEFT JOIN OFFER o ON o.offer_id = b.offer_id
       WHERE b.bill_id = :bid`,
      { bid: req.params.id }
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Bill not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bill' });
  }
});

router.post('/:id/pay', authMiddleware, async (req, res) => {
  try {
    const billRes = await execute(
      `SELECT b.bill_id, b.record_id, b.offer_id,
              t.entry_time, pr.exit_date,
              zr.base_rate,
              o.discount_pct AS offer_disc,
              p.plan_type, g.discount_rate AS gold_disc
       FROM BILL b
       JOIN PARKING_RECORD pr ON pr.record_id = b.record_id
       JOIN TICKET t ON t.ticket_id = pr.ticket_id
         AND t.vehicle_id = pr.vehicle_id AND t.zone_id = pr.zone_id AND t.slot_id = pr.slot_id
       JOIN PARKING_ZONE pz ON pz.zone_id = pr.zone_id
       JOIN ZONE_RATE zr ON zr.tier_type = pz.tier_type
       JOIN VEHICLE v ON v.vehicle_id = pr.vehicle_id
       LEFT JOIN OFFER o ON o.offer_id = b.offer_id
       LEFT JOIN USER_PLAN up ON up.user_id = v.user_id AND up.is_active = 'true'
       LEFT JOIN PLAN p ON p.plan_id = up.plan_id
       LEFT JOIN GOLD g ON g.plan_id = p.plan_id
       WHERE b.bill_id = :bid`,
      { bid: req.params.id }
    );
    if (!billRes.rows.length) return res.status(404).json({ error: 'Bill not found' });
    const b = billRes.rows[0];

    if (!b.EXIT_DATE) {
      return res.status(400).json({ error: 'Exit parking before paying (POST /api/records/:id/exit)' });
    }

    const exitTime = new Date(b.EXIT_DATE);
    const entryTime = new Date(b.ENTRY_TIME);
    const durationHrs = (exitTime - entryTime) / 3600000;
    const base = parseFloat((durationHrs * b.BASE_RATE).toFixed(2));
    const goldDisc  = b.GOLD_DISC  ? base * (b.GOLD_DISC / 100) : 0;
    const offerDisc = b.OFFER_DISC ? base * (b.OFFER_DISC / 100) : 0;
    const totalDisc = parseFloat((goldDisc + offerDisc).toFixed(2));
    const finalAmt  = parseFloat(Math.max(0, base - totalDisc).toFixed(2));

    await execute(
      `UPDATE BILL SET payment_status = 'paid' WHERE bill_id = :bid`,
      { bid: req.params.id }
    );
    await execute(
      `UPDATE BILL_CALCULATION SET amount = :amt, discount = :disc WHERE record_id = :rid`,
      { amt: finalAmt, disc: totalDisc, rid: b.RECORD_ID }
    );
    await execute(
      `UPDATE PARKING_SLOT ps SET status = 'free'
       WHERE ps.slot_id = (SELECT slot_id FROM PARKING_RECORD WHERE record_id = :rid)
         AND ps.zone_id = (SELECT zone_id FROM PARKING_RECORD WHERE record_id = :rid)`,
      { rid: b.RECORD_ID }
    );

    res.json({ bill_id: b.BILL_ID, amount: finalAmt, discount: totalDisc, payment_status: 'paid' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment failed', detail: err.message });
  }
});

module.exports = router;
