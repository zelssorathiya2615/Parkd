-- ═══════════════════════════════════════════════════════════
-- PARKD — Oracle DDL (DBMS course schema + sequences/triggers)
-- Run in SQL*Plus AFTER @drop_all.sql (optional reset)
-- Command: @schema.sql
-- ═══════════════════════════════════════════════════════════

-- SEQUENCES (Oracle has no AUTO_INCREMENT)
CREATE SEQUENCE seq_user      START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_admin     START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_plan      START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_vehicle   START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_facility  START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_zone      START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_slot      START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_offer     START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_user_plan START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_ticket    START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_record    START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_bill      START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE seq_queue     START WITH 100 INCREMENT BY 1 NOCACHE NOCYCLE;

-- ============================================================
-- CREATE TABLES (correct dependency order)
-- ============================================================

CREATE TABLE USER_TABLE (
    user_id       NUMBER(5)     PRIMARY KEY,
    name          VARCHAR2(100) NOT NULL,
    phone_number  VARCHAR2(15)  NOT NULL UNIQUE,
    email         VARCHAR2(100) NOT NULL UNIQUE,
    password_hash VARCHAR2(255) NOT NULL
);

CREATE TABLE ADMIN (
    admin_id      NUMBER(5)     PRIMARY KEY,
    name          VARCHAR2(100) NOT NULL,
    email         VARCHAR2(100) NOT NULL UNIQUE,
    password_hash VARCHAR2(255) NOT NULL
);

CREATE TABLE FACILITY (
    facility_id   NUMBER(5)     PRIMARY KEY,
    facility_name VARCHAR2(100) NOT NULL,
    admin_id      NUMBER(5)     NOT NULL,
    location      VARCHAR2(100) NOT NULL,
    FOREIGN KEY (admin_id) REFERENCES ADMIN(admin_id)
);

CREATE TABLE SUPER_ADMIN (
    admin_id NUMBER(5) PRIMARY KEY,
    FOREIGN KEY (admin_id) REFERENCES ADMIN(admin_id) ON DELETE CASCADE
);

CREATE TABLE LOCAL_ADMIN (
    admin_id    NUMBER(5) PRIMARY KEY,
    facility_id NUMBER(5) NOT NULL,
    FOREIGN KEY (admin_id) REFERENCES ADMIN(admin_id) ON DELETE CASCADE,
    FOREIGN KEY (facility_id) REFERENCES FACILITY(facility_id)
);

CREATE TABLE PLAN (
    plan_id   NUMBER(5)    PRIMARY KEY,
    plan_type VARCHAR2(20) NOT NULL UNIQUE
);

CREATE TABLE PLAN_DETAILS (
    plan_type     VARCHAR2(20) PRIMARY KEY,
    price         NUMBER(10,2) NOT NULL CHECK(price >= 0),
    duration_type VARCHAR2(20) NOT NULL CHECK(duration_type IN ('hourly','weekly','monthly','yearly'))
);

CREATE TABLE GENERAL (
    plan_id                NUMBER(5)   PRIMARY KEY,
    hourly_rate_multiplier NUMBER(5,2) NOT NULL CHECK(hourly_rate_multiplier > 0),
    FOREIGN KEY (plan_id) REFERENCES PLAN(plan_id) ON DELETE CASCADE
);

CREATE TABLE GOLD (
    plan_id        NUMBER(5)   PRIMARY KEY,
    discount_rate  NUMBER(5,2) CHECK(discount_rate BETWEEN 0 AND 100),
    priority_level NUMBER(2)   NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES PLAN(plan_id) ON DELETE CASCADE
);

CREATE TABLE PLATINUM (
    plan_id          NUMBER(5)     PRIMARY KEY,
    priority_level   NUMBER(2)     NOT NULL,
    premium_benefits VARCHAR2(255) NOT NULL,
    valet_access     VARCHAR2(5)   CHECK(valet_access IN ('true','false')),
    FOREIGN KEY (plan_id) REFERENCES PLAN(plan_id) ON DELETE CASCADE
);

CREATE TABLE VEHICLE (
    vehicle_id     NUMBER(5)    PRIMARY KEY,
    user_id        NUMBER(5)    NOT NULL,
    vehicle_number VARCHAR2(20) NOT NULL UNIQUE,
    vehicle_type   VARCHAR2(30) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES USER_TABLE(user_id) ON DELETE CASCADE
);

CREATE TABLE FACILITY_LOCATION (
    location VARCHAR2(100) PRIMARY KEY,
    city     VARCHAR2(50)  NOT NULL
);

CREATE TABLE ZONE_RATE (
    tier_type VARCHAR2(20) PRIMARY KEY,
    base_rate NUMBER(10,2) NOT NULL CHECK(base_rate >= 0)
);

CREATE TABLE PARKING_ZONE (
    zone_id     NUMBER(5)     PRIMARY KEY,
    facility_id NUMBER(5)     NOT NULL,
    zone_name   VARCHAR2(100) NOT NULL,
    total_slots NUMBER(5)     NOT NULL CHECK(total_slots > 0),
    tier_type   VARCHAR2(20)  NOT NULL,
    FOREIGN KEY (facility_id) REFERENCES FACILITY(facility_id),
    FOREIGN KEY (tier_type) REFERENCES ZONE_RATE(tier_type)
);

CREATE TABLE PARKING_SLOT (
    slot_id     NUMBER(5),
    zone_id     NUMBER(5),
    slot_number VARCHAR2(10) NOT NULL,
    status      VARCHAR2(15) CHECK(status IN ('free','occupied','reserved')),
    PRIMARY KEY (slot_id, zone_id),
    FOREIGN KEY (zone_id) REFERENCES PARKING_ZONE(zone_id)
);

CREATE TABLE OFFER (
    offer_id     NUMBER(5),
    admin_id     NUMBER(5),
    condition    VARCHAR2(255) NOT NULL,
    discount_pct NUMBER(5,2)  CHECK(discount_pct BETWEEN 0 AND 100),
    PRIMARY KEY (offer_id, admin_id),
    FOREIGN KEY (admin_id) REFERENCES ADMIN(admin_id)
);

CREATE TABLE USER_PLAN (
    user_plan_id NUMBER(5),
    user_id      NUMBER(5),
    plan_id      NUMBER(5)   NOT NULL,
    start_date   DATE        NOT NULL,
    end_date     DATE        NOT NULL,
    is_active    VARCHAR2(5) CHECK(is_active IN ('true','false')),
    PRIMARY KEY (user_plan_id, user_id),
    FOREIGN KEY (user_id) REFERENCES USER_TABLE(user_id),
    FOREIGN KEY (plan_id) REFERENCES PLAN(plan_id)
);

CREATE TABLE TICKET (
    ticket_id  NUMBER(5),
    vehicle_id NUMBER(5),
    zone_id    NUMBER(5),
    slot_id    NUMBER(5),
    entry_day  VARCHAR2(10) NOT NULL,
    entry_time TIMESTAMP    NOT NULL,
    PRIMARY KEY (ticket_id, vehicle_id, zone_id, slot_id),
    FOREIGN KEY (vehicle_id) REFERENCES VEHICLE(vehicle_id),
    FOREIGN KEY (zone_id) REFERENCES PARKING_ZONE(zone_id),
    FOREIGN KEY (slot_id, zone_id) REFERENCES PARKING_SLOT(slot_id, zone_id)
);

CREATE TABLE PARKING_RECORD (
    record_id  NUMBER(5),
    vehicle_id NUMBER(5),
    zone_id    NUMBER(5),
    slot_id    NUMBER(5),
    ticket_id  NUMBER(5),
    status     VARCHAR2(20) CHECK(status IN ('active','completed')),
    entry_date DATE         NOT NULL,
    exit_date  DATE,
    PRIMARY KEY (record_id, vehicle_id, zone_id, slot_id, ticket_id),
    FOREIGN KEY (vehicle_id) REFERENCES VEHICLE(vehicle_id),
    FOREIGN KEY (zone_id) REFERENCES PARKING_ZONE(zone_id),
    FOREIGN KEY (slot_id, zone_id) REFERENCES PARKING_SLOT(slot_id, zone_id),
    FOREIGN KEY (ticket_id, vehicle_id, zone_id, slot_id) REFERENCES TICKET(ticket_id, vehicle_id, zone_id, slot_id),
    CHECK (exit_date IS NULL OR exit_date > entry_date)
);

CREATE TABLE BILL (
    bill_id        NUMBER(5) PRIMARY KEY,
    record_id      NUMBER(5),
    offer_id       NUMBER(5),
    payment_status VARCHAR2(20) CHECK(payment_status IN ('paid','pending','failed'))
);

CREATE TABLE BILL_CALCULATION (
    record_id NUMBER(5)    PRIMARY KEY,
    offer_id  NUMBER(5),
    amount    NUMBER(10,2) NOT NULL CHECK(amount >= 0),
    discount  NUMBER(10,2) CHECK(discount >= 0)
);

CREATE TABLE QUEUE (
    queue_id          NUMBER(5)    PRIMARY KEY,
    vehicle_id        NUMBER(5)    NOT NULL,
    zone_id           NUMBER(5)    NOT NULL,
    allocated_slot_id NUMBER(5),
    position          NUMBER(5)    NOT NULL,
    status            VARCHAR2(20) CHECK(status IN ('waiting','allocated','parked','cancelled')),
    arrival_time      TIMESTAMP    NOT NULL,
    FOREIGN KEY (vehicle_id) REFERENCES VEHICLE(vehicle_id),
    FOREIGN KEY (zone_id) REFERENCES PARKING_ZONE(zone_id),
    FOREIGN KEY (allocated_slot_id, zone_id) REFERENCES PARKING_SLOT(slot_id, zone_id)
);

-- ============================================================
-- TRIGGERS (auto-assign IDs)
-- ============================================================

CREATE OR REPLACE TRIGGER trg_user_id
BEFORE INSERT ON USER_TABLE FOR EACH ROW
BEGIN IF :NEW.user_id IS NULL THEN :NEW.user_id := seq_user.NEXTVAL; END IF; END;
/

CREATE OR REPLACE TRIGGER trg_admin_id
BEFORE INSERT ON ADMIN FOR EACH ROW
BEGIN IF :NEW.admin_id IS NULL THEN :NEW.admin_id := seq_admin.NEXTVAL; END IF; END;
/

CREATE OR REPLACE TRIGGER trg_plan_id
BEFORE INSERT ON PLAN FOR EACH ROW
BEGIN IF :NEW.plan_id IS NULL THEN :NEW.plan_id := seq_plan.NEXTVAL; END IF; END;
/

CREATE OR REPLACE TRIGGER trg_vehicle_id
BEFORE INSERT ON VEHICLE FOR EACH ROW
BEGIN IF :NEW.vehicle_id IS NULL THEN :NEW.vehicle_id := seq_vehicle.NEXTVAL; END IF; END;
/

CREATE OR REPLACE TRIGGER trg_facility_id
BEFORE INSERT ON FACILITY FOR EACH ROW
BEGIN IF :NEW.facility_id IS NULL THEN :NEW.facility_id := seq_facility.NEXTVAL; END IF; END;
/

CREATE OR REPLACE TRIGGER trg_zone_id
BEFORE INSERT ON PARKING_ZONE FOR EACH ROW
BEGIN IF :NEW.zone_id IS NULL THEN :NEW.zone_id := seq_zone.NEXTVAL; END IF; END;
/

CREATE OR REPLACE TRIGGER trg_slot_id
BEFORE INSERT ON PARKING_SLOT FOR EACH ROW
BEGIN IF :NEW.slot_id IS NULL THEN :NEW.slot_id := seq_slot.NEXTVAL; END IF; END;
/

CREATE OR REPLACE TRIGGER trg_offer_id
BEFORE INSERT ON OFFER FOR EACH ROW
BEGIN IF :NEW.offer_id IS NULL THEN :NEW.offer_id := seq_offer.NEXTVAL; END IF; END;
/

CREATE OR REPLACE TRIGGER trg_user_plan_id
BEFORE INSERT ON USER_PLAN FOR EACH ROW
BEGIN IF :NEW.user_plan_id IS NULL THEN :NEW.user_plan_id := seq_user_plan.NEXTVAL; END IF; END;
/

CREATE OR REPLACE TRIGGER trg_ticket_id
BEFORE INSERT ON TICKET FOR EACH ROW
BEGIN IF :NEW.ticket_id IS NULL THEN :NEW.ticket_id := seq_ticket.NEXTVAL; END IF; END;
/

CREATE OR REPLACE TRIGGER trg_record_id
BEFORE INSERT ON PARKING_RECORD FOR EACH ROW
BEGIN IF :NEW.record_id IS NULL THEN :NEW.record_id := seq_record.NEXTVAL; END IF; END;
/

CREATE OR REPLACE TRIGGER trg_bill_id
BEFORE INSERT ON BILL FOR EACH ROW
BEGIN IF :NEW.bill_id IS NULL THEN :NEW.bill_id := seq_bill.NEXTVAL; END IF; END;
/

CREATE OR REPLACE TRIGGER trg_queue_id
BEFORE INSERT ON QUEUE FOR EACH ROW
BEGIN IF :NEW.queue_id IS NULL THEN :NEW.queue_id := seq_queue.NEXTVAL; END IF; END;
/

COMMIT;
PROMPT Schema created successfully.
