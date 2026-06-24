/**
 * Run after seed.sql to set bcrypt passwords for demo accounts.
 * Usage: node database/set_passwords.js
 * Default password: parkd123
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const oracledb = require('oracledb');

if (process.env.ORACLE_CLIENT_PATH) {
  try {
    oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_PATH });
  } catch (e) {
    console.warn('Oracle client init:', e.message);
  }
}

async function main() {
  const hash = await bcrypt.hash('parkd123', 12);
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });
    await conn.execute(
      `UPDATE USER_TABLE SET password_hash = :h`,
      { h: hash },
      { autoCommit: false }
    );
    await conn.execute(
      `UPDATE ADMIN SET password_hash = :h`,
      { h: hash },
      { autoCommit: true }
    );
    console.log('Passwords set to: parkd123 (all users and admins)');
  } catch (err) {
    console.error('Failed:', err.message);
    console.error('Ensure .env has DB_USER, DB_PASSWORD, DB_CONNECT_STRING and seed.sql was run.');
    process.exit(1);
  } finally {
    if (conn) await conn.close();
  }
}

main();
