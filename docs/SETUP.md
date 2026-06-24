# Setup Instructions

Welcome to the Parkd setup guide. This document will walk you through the process of getting the Smart Parking System up and running on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed on your system:
1. **Node.js** (v18 or higher) - [Download Node.js](https://nodejs.org/)
2. **Oracle Database** (Oracle 21c/23ai Free or Enterprise) - [Download Oracle DB](https://www.oracle.com/database/technologies/free-downloads.html)
3. **Oracle Instant Client** (Optional, only if `node-oracledb` requires it on your OS)

## Installation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/zelssorathiya2615/Parkd.git
cd Parkd
```

### 2. Configure Environment Variables
Copy the `.env.example` file to create your own `.env` file:
```bash
cp .env.example .env
```
Open the `.env` file and update it with your Oracle Database credentials:
```env
DB_USER=your_oracle_username
DB_PASSWORD=your_oracle_password
DB_CONNECT_STRING=localhost:1521/FREEPDB1
```

### 3. Initialize the Database
The project comes with SQL scripts to create the schema and seed initial data.

**Using the 1-Click Script (Windows):**
Simply double-click the `install-db.bat` file in the root directory.

**Manual Initialization:**
If you prefer to run it manually or are on macOS/Linux:
```bash
npm install
sqlplus your_oracle_username/your_oracle_password@localhost:1521/FREEPDB1 @init_db.sql
node database/set_passwords.js
```

### 4. Start the Application

**Using the 1-Click Script (Windows):**
Double-click `run-backend.bat` to start the Node server, then double-click `run-frontend.bat` to open the application in your browser.

**Manual Start:**
```bash
# Start the backend server
npm start
```
The server will start on `http://localhost:3000`. Open `http://localhost:3000/index.html` in your web browser.

## Testing the System

You can log in using the seed accounts provided in the database:

**Standard User (Gold Tier):**
- Email: `arjun@gmail.com`
- Password: `parkd123`

**Super Admin:**
- Email: `vikram@parkd.local`
- Password: `parkd123`

**Local Admin (Central Plaza):**
- Email: `kavita@parkd.local`
- Password: `parkd123`
