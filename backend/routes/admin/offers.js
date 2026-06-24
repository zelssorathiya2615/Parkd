const router = require('express').Router();
const { execute } = require('../../config/db');
const { adminMiddleware } = require('../../middleware/auth');

router.get('/', adminMiddleware, async (req, res) => {
  try {
    const result = await execute(
      `SELECT o.offer_id, o.admin_id, o.condition, o.discount_pct, a.name AS created_by
       FROM OFFER o JOIN ADMIN a ON a.admin_id = o.admin_id
       ORDER BY o.offer_id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

router.post('/', adminMiddleware, async (req, res) => {
  const { condition, discount_pct } = req.body;
  if (discount_pct == null) return res.status(400).json({ error: 'discount_pct required' });
  try {
    await execute(
      `INSERT INTO OFFER (admin_id, condition, discount_pct)
       VALUES (:admin_id, :cond, :disc)`,
      { admin_id: req.user.userId, cond: condition || '', disc: discount_pct }
    );
    res.status(201).json({ message: 'Offer created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

router.put('/:id', adminMiddleware, async (req, res) => {
  const { condition, discount_pct } = req.body;
  if (discount_pct == null) return res.status(400).json({ error: 'discount_pct required' });
  try {
    await execute(
      `UPDATE OFFER SET condition = :cond, discount_pct = :disc
       WHERE offer_id = :oid`,
      { cond: condition || '', disc: discount_pct, oid: req.params.id }
    );
    res.json({ message: 'Offer updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await execute(`DELETE FROM OFFER WHERE offer_id = :oid`, { oid: req.params.id });
    res.json({ message: 'Offer deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete offer' });
  }
});

module.exports = router;
