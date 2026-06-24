const router = require('express').Router();
const oracledb = require('oracledb');
const { execute, getConnection } = require('../../config/db');
const { adminMiddleware, requireSuperAdmin } = require('../../middleware/auth');
const { facilityScope } = require('../../middleware/facilityScope');

function slotPrefix(name) {
  const n = String(name || '').trim();
  return (n[0] || 'Z').toUpperCase();
}

// GET /api/admin/facilities
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const scope = facilityScope(req, 'f.facility_id');
    let sql = `
      SELECT f.facility_id, f.facility_name as name, fl.location, fl.city,
             z.zone_id, z.zone_name, z.tier_type, z.total_slots
      FROM FACILITY f
      LEFT JOIN FACILITY_LOCATION fl ON f.location = fl.location
      LEFT JOIN PARKING_ZONE z ON f.facility_id = z.facility_id
      WHERE 1=1 ${scope.clause}
      ORDER BY f.facility_id, z.zone_name
    `;

    const r = await execute(sql, scope.binds);
    
    // Group zones by facility
    const facs = [];
    let cur = null;
    for (const row of r.rows) {
      if (!cur || cur.facility_id !== row.FACILITY_ID) {
        if (cur) facs.push(cur);
        cur = {
          facility_id: row.FACILITY_ID,
          name: row.NAME,
          location: row.LOCATION,
          city: row.CITY,
          zones: []
        };
      }
      if (row.ZONE_ID) {
        cur.zones.push({
          zone_id: row.ZONE_ID,
          zone_name: row.ZONE_NAME,
          tier_type: row.TIER_TYPE,
          total_slots: row.TOTAL_SLOTS
        });
      }
    }
    if (cur) facs.push(cur);

    res.json(facs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/facilities
router.post('/', adminMiddleware, requireSuperAdmin, async (req, res) => {
  const { name, location, city } = req.body;
  if (!name || !location || !city) return res.status(400).json({ error: 'name, location, city required' });
  let conn;
  try {
    conn = await getConnection();
    // Insert into location if not exists
    await conn.execute(
      `BEGIN
         INSERT INTO FACILITY_LOCATION (location, city) VALUES (:loc, :city);
       EXCEPTION
         WHEN DUP_VAL_ON_INDEX THEN NULL;
       END;`,
      { loc: location, city }
    );
    const r = await conn.execute(
      `INSERT INTO FACILITY (facility_name, admin_id, location) VALUES (:name, :aid, :loc) RETURNING facility_id INTO :fid`,
      { name, aid: req.user.userId, loc: location, fid: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
    );
    const fid = r.outBinds.fid[0];
    await conn.commit();
    res.status(201).json({ facility_id: fid });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// PUT /api/admin/facilities/:id
router.put('/:id', adminMiddleware, requireSuperAdmin, async (req, res) => {
  const { name, location, city } = req.body;
  if (!name && !location && !city) {
    return res.status(400).json({ error: 'Provide at least one field to update' });
  }
  if ((location && !city) || (!location && city)) {
    return res.status(400).json({ error: 'Both location and city are required together' });
  }
  let conn;
  try {
    conn = await getConnection();
    if (location && city) {
      await conn.execute(
        `BEGIN
           INSERT INTO FACILITY_LOCATION (location, city) VALUES (:loc, :city);
         EXCEPTION
           WHEN DUP_VAL_ON_INDEX THEN
             UPDATE FACILITY_LOCATION SET city = :city WHERE location = :loc;
         END;`,
        { loc: location, city }
      );
    }

    const sets = [];
    const binds = { fid: req.params.id };
    if (name) { sets.push('facility_name = :name'); binds.name = name; }
    if (location) { sets.push('location = :loc'); binds.loc = location; }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    const r = await conn.execute(
      `UPDATE FACILITY SET ${sets.join(', ')} WHERE facility_id = :fid`,
      binds
    );
    if (!r.rowsAffected) return res.status(404).json({ error: 'Facility not found' });
    await conn.commit();
    res.json({ message: 'Facility updated' });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// DELETE /api/admin/facilities/:id
router.delete('/:id', adminMiddleware, requireSuperAdmin, async (req, res) => {
  const fid = req.params.id;
  let conn;
  try {
    conn = await getConnection();

    const fRow = await conn.execute(
      `SELECT location FROM FACILITY WHERE facility_id = :fid`,
      { fid }
    );
    if (!fRow.rows.length) return res.status(404).json({ error: 'Facility not found' });
    const location = fRow.rows[0].LOCATION;

    const rec = await conn.execute(
      `SELECT COUNT(*) AS cnt
       FROM PARKING_RECORD pr
       JOIN PARKING_ZONE pz ON pz.zone_id = pr.zone_id
       WHERE pz.facility_id = :fid`,
      { fid }
    );
    if (rec.rows[0].CNT > 0) {
      return res.status(409).json({ error: 'Facility has records. Remove history before deleting.' });
    }

    const q = await conn.execute(
      `SELECT COUNT(*) AS cnt
       FROM QUEUE q
       JOIN PARKING_ZONE pz ON pz.zone_id = q.zone_id
       WHERE pz.facility_id = :fid AND q.status IN ('waiting','allocated','parked')`,
      { fid }
    );
    if (q.rows[0].CNT > 0) {
      return res.status(409).json({ error: 'Facility has active queue entries' });
    }

    const la = await conn.execute(
      `SELECT admin_id FROM LOCAL_ADMIN WHERE facility_id = :fid`,
      { fid }
    );

    await conn.execute(
      `DELETE FROM QUEUE WHERE zone_id IN (SELECT zone_id FROM PARKING_ZONE WHERE facility_id = :fid)`,
      { fid }
    );
    await conn.execute(
      `DELETE FROM PARKING_SLOT WHERE zone_id IN (SELECT zone_id FROM PARKING_ZONE WHERE facility_id = :fid)`,
      { fid }
    );
    await conn.execute(`DELETE FROM PARKING_ZONE WHERE facility_id = :fid`, { fid });
    await conn.execute(`DELETE FROM LOCAL_ADMIN WHERE facility_id = :fid`, { fid });
    if (la.rows.length) {
      const ids = la.rows.map(r => r.ADMIN_ID);
      for (const id of ids) {
        await conn.execute(`DELETE FROM ADMIN WHERE admin_id = :aid`, { aid: id });
      }
    }
    await conn.execute(`DELETE FROM FACILITY WHERE facility_id = :fid`, { fid });

    if (location) {
      const left = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM FACILITY WHERE location = :loc`,
        { loc: location }
      );
      if (left.rows[0].CNT === 0) {
        await conn.execute(`DELETE FROM FACILITY_LOCATION WHERE location = :loc`, { loc: location });
      }
    }

    await conn.commit();
    res.json({ message: 'Facility deleted' });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// POST /api/admin/facilities/:id/zones
router.post('/:id/zones', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { zone_name, tier_type, total_slots } = req.body;
  if (!zone_name || !tier_type || !total_slots) return res.status(400).json({ error: 'zone_name, tier_type, total_slots required' });
  if (req.user?.role === 'local_admin' && req.user.facilityId && String(req.user.facilityId) !== String(id)) {
    return res.status(403).json({ error: 'Local admin cannot manage this facility' });
  }
  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(
      `INSERT INTO PARKING_ZONE (facility_id, zone_name, tier_type, total_slots) 
       VALUES (:fid, :name, :tier, :tot) RETURNING zone_id INTO :zid`,
      { fid: id, name: zone_name, tier: tier_type, tot: total_slots, zid: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
    );
    const zid = r.outBinds.zid[0];
    
    // Auto-create slots
    for(let i=1; i<=total_slots; i++) {
      const p = i < 10 ? '0' + i : i;
      const pref = slotPrefix(zone_name);
      await conn.execute(
        `INSERT INTO PARKING_SLOT (zone_id, slot_number, status) VALUES (:zid, :snum, 'free')`,
        { zid, snum: `${pref}-${p}` }
      );
    }
    
    await conn.commit();
    res.status(201).json({ zone_id: zid });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// PUT /api/admin/facilities/:id/zones/:zid
router.put('/:id/zones/:zid', adminMiddleware, async (req, res) => {
  const { id, zid } = req.params;
  const { zone_name, tier_type, total_slots } = req.body;
  if (req.user?.role === 'local_admin' && req.user.facilityId && String(req.user.facilityId) !== String(id)) {
    return res.status(403).json({ error: 'Local admin cannot manage this facility' });
  }
  let conn;
  try {
    conn = await getConnection();
    const z = await conn.execute(
      `SELECT zone_name, tier_type, total_slots FROM PARKING_ZONE WHERE zone_id = :zid AND facility_id = :fid`,
      { zid, fid: id }
    );
    if (!z.rows.length) return res.status(404).json({ error: 'Zone not found' });
    const cur = z.rows[0];
    const nextName = zone_name || cur.ZONE_NAME;
    const nextTier = tier_type || cur.TIER_TYPE;
    const nextTotal = total_slots != null ? Number(total_slots) : cur.TOTAL_SLOTS;
    if (!nextTotal || nextTotal < 1) return res.status(400).json({ error: 'total_slots must be >= 1' });

    const updates = [];
    const binds = { zid, name: nextName, tier: nextTier, total: nextTotal };
    if (zone_name) updates.push('zone_name = :name');
    if (tier_type) updates.push('tier_type = :tier');
    if (total_slots != null) updates.push('total_slots = :total');

    const slotCountRes = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM PARKING_SLOT WHERE zone_id = :zid`,
      { zid }
    );
    const actualSlots = slotCountRes.rows[0].CNT;

    if (nextTotal > actualSlots) {
      const pref = slotPrefix(nextName);
      
      // Find the highest existing slot number suffix to avoid unique constraint violations
      const maxSlotRes = await conn.execute(
        `SELECT MAX(TO_NUMBER(REGEXP_SUBSTR(slot_number, '\\d+'))) as max_num 
         FROM PARKING_SLOT WHERE zone_id = :zid`,
        { zid }
      );
      const startIdx = (maxSlotRes.rows[0].MAX_NUM || 0) + 1;
      const addCount = nextTotal - actualSlots;
      
      for (let i = 0; i < addCount; i++) {
        const slotIdx = startIdx + i;
        const p = slotIdx < 10 ? '0' + slotIdx : slotIdx;
        await conn.execute(
          `INSERT INTO PARKING_SLOT (zone_id, slot_number, status) VALUES (:zid, :snum, 'free')`,
          { zid, snum: `${pref}-${p}` }
        );
      }
    }

    if (nextTotal < actualSlots) {
      const removeCount = actualSlots - nextTotal;
      const slots = await conn.execute(
        `SELECT slot_id, slot_number, status FROM PARKING_SLOT WHERE zone_id = :zid ORDER BY slot_number DESC`,
        { zid }
      );
      const toRemove = slots.rows.slice(0, removeCount);
      for (const s of toRemove) {
        if (s.STATUS !== 'free') {
          return res.status(409).json({ error: 'Cannot remove occupied or reserved slots' });
        }
        const r = await conn.execute(
          `SELECT COUNT(*) AS cnt FROM PARKING_RECORD WHERE zone_id = :zid AND slot_id = :sid`,
          { zid, sid: s.SLOT_ID }
        );
        if (r.rows[0].CNT > 0) {
          return res.status(409).json({ error: 'Cannot remove slots with history' });
        }
      }
      for (const s of toRemove) {
        await conn.execute(`DELETE FROM PARKING_SLOT WHERE zone_id = :zid AND slot_id = :sid`, { zid, sid: s.SLOT_ID });
      }
    }

    if (updates.length) {
      await conn.execute(
        `UPDATE PARKING_ZONE SET ${updates.join(', ')} WHERE zone_id = :zid`,
        binds
      );
    }
    await conn.commit();
    res.json({ message: 'Zone updated' });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// DELETE /api/admin/facilities/:id/zones/:zid
router.delete('/:id/zones/:zid', adminMiddleware, async (req, res) => {
  const { id, zid } = req.params;
  if (req.user?.role === 'local_admin' && req.user.facilityId && String(req.user.facilityId) !== String(id)) {
    return res.status(403).json({ error: 'Local admin cannot manage this facility' });
  }
  let conn;
  try {
    conn = await getConnection();
    const z = await conn.execute(
      `SELECT zone_id FROM PARKING_ZONE WHERE zone_id = :zid AND facility_id = :fid`,
      { zid, fid: id }
    );
    if (!z.rows.length) return res.status(404).json({ error: 'Zone not found' });

    const busy = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM PARKING_SLOT WHERE zone_id = :zid AND status <> 'free'`,
      { zid }
    );
    if (busy.rows[0].CNT > 0) {
      return res.status(409).json({ error: 'All slots must be free to delete a zone' });
    }

    const rec = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM PARKING_RECORD WHERE zone_id = :zid`,
      { zid }
    );
    if (rec.rows[0].CNT > 0) {
      return res.status(409).json({ error: 'Zone has records. Remove history before deleting.' });
    }

    const q = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM QUEUE WHERE zone_id = :zid AND status IN ('waiting','allocated','parked')`,
      { zid }
    );
    if (q.rows[0].CNT > 0) {
      return res.status(409).json({ error: 'Zone has active queue entries' });
    }

    await conn.execute(`DELETE FROM QUEUE WHERE zone_id = :zid`, { zid });
    await conn.execute(`DELETE FROM PARKING_SLOT WHERE zone_id = :zid`, { zid });
    await conn.execute(`DELETE FROM PARKING_ZONE WHERE zone_id = :zid`, { zid });
    await conn.commit();
    res.json({ message: 'Zone deleted' });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;
