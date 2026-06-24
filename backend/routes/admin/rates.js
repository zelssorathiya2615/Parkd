const router = require('express').Router();
const { execute } = require('../../config/db');
const { adminMiddleware, requireSuperAdmin } = require('../../middleware/auth');

// GET /api/admin/rates
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const r = await execute(`SELECT tier_type, base_rate FROM ZONE_RATE ORDER BY base_rate ASC`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/rates/:tier
router.put('/:tier', adminMiddleware, requireSuperAdmin, async (req, res) => {
  const { base_rate } = req.body;
  if (base_rate === undefined || base_rate < 0) return res.status(400).json({ error: 'Valid base_rate required' });
  try {
    await execute(
      `UPDATE ZONE_RATE SET base_rate = :rate WHERE tier_type = :tier`,
      { rate: base_rate, tier: req.params.tier }
    );
    res.json({ message: 'Rate updated successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
