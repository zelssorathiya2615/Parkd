# System Architecture

Parkd is built using a monolithic Client-Server architecture, chosen for its simplicity, ease of deployment, and tight integration with the Oracle Database layer.

## High-Level Diagram

```text
[ Client (Browser) ]
      |
      | (HTTP/REST)
      v
[ Node.js + Express Server ]
      |
      | (node-oracledb connection pool)
      v
[ Oracle Database 21c/23ai ]
```

## 1. The Frontend (Client)
The frontend is composed of Vanilla HTML, CSS, and JavaScript. It does not use heavy frameworks like React or Angular, allowing for lightning-fast page loads and straightforward native DOM manipulation.
- **Routing:** Pages are served statically from the root directory (`index.html`, `dashboard.html`, `slots.html`).
- **State Management:** Session tokens (JWTs) are stored in `localStorage`.
- **API Communication:** The `js/parkd-api.js` script handles all `fetch()` calls to the backend REST API, automatically attaching the JWT Authorization header.

## 2. The Backend (Node.js + Express)
The backend acts as the central brain of the application, enforcing business logic, securing routes, and managing database connections.
- **Entry Point:** `backend/server.js` initializes the Express app, configures CORS, and registers all API route handlers.
- **Security:** `backend/middleware/auth.js` verifies JWT tokens to protect sensitive endpoints.
- **Modularity:** Routes are logically grouped in the `backend/routes/` directory (e.g., `auth.js`, `slots.js`, `billing.js`).

## 3. The Database (Oracle DB)
Oracle Database is used to ensure robust ACID compliance, which is critical for a booking system where double-booking a slot must be mathematically impossible.
- **Connection Pooling:** `backend/config/db.js` initializes an Oracle connection pool on startup to handle concurrent requests efficiently.
- **Schema:** Defined in `database/schema.sql`, featuring foreign key constraints and triggers (e.g., auto-updating `updated_at` timestamps).
- **Security:** Passwords are never stored in plain text. The `database/set_passwords.js` script hashes passwords using `bcrypt` before they are persisted to the database.

## REST API Endpoints (Core)
- `POST /api/auth/login` - Authenticate user and return JWT.
- `GET /api/facilities` - List all parking facilities.
- `GET /api/zones/:id/slots` - Get real-time slot statuses for a zone.
- `POST /api/slots/book` - Attempt to reserve a specific slot.
- `POST /api/bills/pay` - Process payment and mark ticket as completed.
