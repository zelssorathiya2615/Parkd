-- ═══════════════════════════════════════════════════════════
-- PARKD — Seed Data (run AFTER @schema.sql)
-- Default login password for all users/admins: parkd123
-- (re-hash: node database/set_passwords.js)
-- ═══════════════════════════════════════════════════════════

-- ZONE RATES
INSERT INTO ZONE_RATE (tier_type, base_rate) VALUES ('general',  20.00);
INSERT INTO ZONE_RATE (tier_type, base_rate) VALUES ('gold',     30.00);
INSERT INTO ZONE_RATE (tier_type, base_rate) VALUES ('platinum', 50.00);

-- ADMINS
INSERT INTO ADMIN (admin_id, name, email, password_hash)
VALUES (1, 'Vikram Nair', 'vikram@parkd.local', '$2a$12$DlG/fFpHd05cpS5U1XeYSuwgv7WesPGmG82Fq2Nh6p.bg4keZoBRe');
INSERT INTO ADMIN (admin_id, name, email, password_hash)
VALUES (2, 'Kavita Joshi', 'kavita@parkd.local', '$2a$12$DlG/fFpHd05cpS5U1XeYSuwgv7WesPGmG82Fq2Nh6p.bg4keZoBRe');
INSERT INTO SUPER_ADMIN (admin_id) VALUES (1);

-- USERS
INSERT INTO USER_TABLE (user_id, name, phone_number, email, password_hash)
VALUES (1, 'Arjun Patel', '9876543210', 'arjun@gmail.com', '$2a$12$DlG/fFpHd05cpS5U1XeYSuwgv7WesPGmG82Fq2Nh6p.bg4keZoBRe');
INSERT INTO USER_TABLE (user_id, name, phone_number, email, password_hash)
VALUES (2, 'Priya Shah', '9812345678', 'priya.shah@yahoo.com', '$2a$12$DlG/fFpHd05cpS5U1XeYSuwgv7WesPGmG82Fq2Nh6p.bg4keZoBRe');
INSERT INTO USER_TABLE (user_id, name, phone_number, email, password_hash)
VALUES (3, 'Rahul Mehta', '9988776655', 'rahul.m@outlook.com', '$2a$12$DlG/fFpHd05cpS5U1XeYSuwgv7WesPGmG82Fq2Nh6p.bg4keZoBRe');
INSERT INTO USER_TABLE (user_id, name, phone_number, email, password_hash)
VALUES (4, 'Sneha Desai', '9871234567', 'sneha.d@gmail.com', '$2a$12$DlG/fFpHd05cpS5U1XeYSuwgv7WesPGmG82Fq2Nh6p.bg4keZoBRe');

-- PLANS + DETAILS + ISA
INSERT INTO PLAN (plan_id, plan_type) VALUES (1, 'general');
INSERT INTO PLAN (plan_id, plan_type) VALUES (2, 'gold');
INSERT INTO PLAN (plan_id, plan_type) VALUES (3, 'platinum');
INSERT INTO PLAN_DETAILS (plan_type, price, duration_type) VALUES ('general',  0.00,   'hourly');
INSERT INTO PLAN_DETAILS (plan_type, price, duration_type) VALUES ('gold',     499.00, 'monthly');
INSERT INTO PLAN_DETAILS (plan_type, price, duration_type) VALUES ('platinum', 999.00, 'monthly');
INSERT INTO GENERAL (plan_id, hourly_rate_multiplier) VALUES (1, 1.00);
INSERT INTO GOLD (plan_id, discount_rate, priority_level) VALUES (2, 10.00, 2);
INSERT INTO PLATINUM (plan_id, priority_level, premium_benefits, valet_access)
VALUES (3, 1, 'Reserved spot, lounge access, priority entry', 'true');

-- VEHICLES
INSERT INTO VEHICLE (vehicle_id, user_id, vehicle_number, vehicle_type) VALUES (1, 1, 'GJ01AB1234', 'Sedan');
INSERT INTO VEHICLE (vehicle_id, user_id, vehicle_number, vehicle_type) VALUES (2, 1, 'GJ01CD5678', 'SUV');
INSERT INTO VEHICLE (vehicle_id, user_id, vehicle_number, vehicle_type) VALUES (3, 2, 'GJ05XY9900', 'Hatchback');
INSERT INTO VEHICLE (vehicle_id, user_id, vehicle_number, vehicle_type) VALUES (4, 3, 'GJ07MN3344', 'Sedan');

-- LOCATIONS + FACILITIES
INSERT INTO FACILITY_LOCATION (location, city) VALUES ('Near Bus Stand, Ring Road', 'Ahmedabad');
INSERT INTO FACILITY_LOCATION (location, city) VALUES ('CG Road, Ellisbridge', 'Ahmedabad');
INSERT INTO FACILITY (facility_id, facility_name, admin_id, location)
VALUES (1, 'Central Plaza Parking', 1, 'Near Bus Stand, Ring Road');
INSERT INTO FACILITY (facility_id, facility_name, admin_id, location)
VALUES (2, 'City Mall Parking', 2, 'CG Road, Ellisbridge');

-- LOCAL_ADMIN must come after FACILITY (FK on facility_id)
INSERT INTO LOCAL_ADMIN (admin_id, facility_id) VALUES (2, 2);

-- ZONES
INSERT INTO PARKING_ZONE (zone_id, facility_id, zone_name, total_slots, tier_type) VALUES (1, 1, 'Zone A', 50, 'general');
INSERT INTO PARKING_ZONE (zone_id, facility_id, zone_name, total_slots, tier_type) VALUES (2, 1, 'Zone B', 20, 'gold');
INSERT INTO PARKING_ZONE (zone_id, facility_id, zone_name, total_slots, tier_type) VALUES (3, 2, 'Zone P', 10, 'platinum');

-- SLOTS (sample grid)
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (1, 1, 'A-01', 'occupied');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (2, 1, 'A-02', 'free');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (3, 1, 'A-03', 'free');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (4, 1, 'A-04', 'free');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (5, 1, 'A-05', 'occupied');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (6, 1, 'A-06', 'free');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (7, 1, 'A-07', 'free');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (8, 1, 'A-08', 'occupied');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (9, 1, 'A-09', 'free');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (10, 1, 'A-10', 'free');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (1, 2, 'B-01', 'reserved');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (2, 2, 'B-02', 'free');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (3, 2, 'B-03', 'occupied');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (4, 2, 'B-04', 'free');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (1, 3, 'P-01', 'free');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (2, 3, 'P-02', 'occupied');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (3, 3, 'P-03', 'free');
INSERT INTO PARKING_SLOT (slot_id, zone_id, slot_number, status) VALUES (4, 3, 'P-04', 'free');

-- OFFERS
INSERT INTO OFFER (offer_id, admin_id, condition, discount_pct)
VALUES (1, 1, 'Weekend special for all users', 15.00);
INSERT INTO OFFER (offer_id, admin_id, condition, discount_pct)
VALUES (2, 2, 'First time parking discount for new users', 100.00);

-- USER PLANS (end_date required in schema — use far future for active)
INSERT INTO USER_PLAN (user_plan_id, user_id, plan_id, start_date, end_date, is_active)
VALUES (1, 1, 2, DATE '2026-05-01', DATE '2027-05-01', 'true');
INSERT INTO USER_PLAN (user_plan_id, user_id, plan_id, start_date, end_date, is_active)
VALUES (2, 2, 1, DATE '2026-01-01', DATE '2027-01-01', 'true');
INSERT INTO USER_PLAN (user_plan_id, user_id, plan_id, start_date, end_date, is_active)
VALUES (3, 3, 3, DATE '2026-04-01', DATE '2026-04-30', 'false');
INSERT INTO USER_PLAN (user_plan_id, user_id, plan_id, start_date, end_date, is_active)
VALUES (4, 3, 2, DATE '2026-05-01', DATE '2027-05-01', 'true');
INSERT INTO USER_PLAN (user_plan_id, user_id, plan_id, start_date, end_date, is_active)
VALUES (5, 4, 1, DATE '2026-03-01', DATE '2027-03-01', 'true');

-- ACTIVE SESSION (Arjun — slot A-01)
INSERT INTO TICKET (ticket_id, vehicle_id, zone_id, slot_id, entry_day, entry_time)
VALUES (1, 1, 1, 1, '2026-05-03', TIMESTAMP '2026-05-03 08:30:00');
INSERT INTO PARKING_RECORD (record_id, vehicle_id, zone_id, slot_id, ticket_id, status, entry_date, exit_date)
VALUES (1, 1, 1, 1, 1, 'active', DATE '2026-05-03', NULL);
INSERT INTO BILL (bill_id, record_id, offer_id, payment_status) VALUES (1, 1, 1, 'pending');
INSERT INTO BILL_CALCULATION (record_id, offer_id, amount, discount) VALUES (1, 1, 0, 0);

-- QUEUE
INSERT INTO QUEUE (queue_id, vehicle_id, zone_id, allocated_slot_id, position, status, arrival_time)
VALUES (1, 3, 1, NULL, 1, 'waiting', TIMESTAMP '2026-05-03 09:00:00');
INSERT INTO QUEUE (queue_id, vehicle_id, zone_id, allocated_slot_id, position, status, arrival_time)
VALUES (2, 4, 2, 1, 1, 'allocated', TIMESTAMP '2026-05-03 09:05:00');

COMMIT;
PROMPT Seed data inserted. Run: node database/set_passwords.js
