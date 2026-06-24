/** SQL fragment + bind for local_admin facility scoping */
function facilityScope(req, facilityColumn = 'f.facility_id') {
  if (req.user?.role === 'local_admin' && req.user.facilityId) {
    return {
      clause: ` AND ${facilityColumn} = :facility_id`,
      binds: { facility_id: req.user.facilityId }
    };
  }
  return { clause: '', binds: {} };
}

module.exports = { facilityScope };
