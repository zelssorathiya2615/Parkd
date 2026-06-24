-- Run once if seed.sql failed on LOCAL_ADMIN (ORA-02291)
-- CONNECT parkd_user/parkd123@localhost:1521/FREEPDB1

INSERT INTO LOCAL_ADMIN (admin_id, facility_id)
SELECT 2, 2 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM LOCAL_ADMIN WHERE admin_id = 2);

COMMIT;
PROMPT LOCAL_ADMIN row fixed.
