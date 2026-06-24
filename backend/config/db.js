// ═══════════════════════════════════════
// PARKD — Oracle DB Connection Pool
// ═══════════════════════════════════════
const oracledb = require('oracledb');

// Set Oracle Instant Client path if provided
if (process.env.ORACLE_CLIENT_PATH) {
  try {
    oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_PATH });
  } catch (err) {
    console.error('Oracle client init error:', err);
  }
}

let pool;

async function initPool() {
  try {
    pool = await oracledb.createPool({
      user          : process.env.DB_USER,
      password      : process.env.DB_PASSWORD,
      connectString : process.env.DB_CONNECT_STRING,
      poolMin       : 2,
      poolMax       : 10,
      poolIncrement : 1,
    });
    console.log('Oracle connection pool created');
  } catch (err) {
    console.error('Oracle pool creation failed:', err);
    throw err;
  }
}

async function getConnection() {
  if (!pool) throw new Error('Pool not initialised. Call initPool() first.');
  return await pool.getConnection();
}

async function execute(sql, binds = {}, options = {}) {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(sql, binds, {
      outFormat   : oracledb.OUT_FORMAT_OBJECT,
      autoCommit  : true,
      ...options,
    });
    return result;
  } finally {
    if (conn) await conn.close();
  }
}

module.exports = { initPool, getConnection, execute };
