<div align="center">
  <img src="https://raw.githubusercontent.com/zelssorathiya2615/Parkd/main/.assets/logo.png" alt="Parkd Logo" width="120" />

  # Parkd — Smart Parking System
  
  **A scalable, full-stack Parking Management System built with Node.js, Express, and Oracle Database.**

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)
  [![Oracle DB](https://img.shields.io/badge/Oracle-Database-red.svg)](https://www.oracle.com/database/)

  [Features](#features) •
  [Architecture](#architecture) •
  [Getting Started](#getting-started) •
  [Documentation](#documentation)
</div>

---

## 🚘 Overview

**Parkd** is a comprehensive Smart Parking Management System designed to handle real-world parking scenarios. It features multi-tier user authentication, real-time slot booking, dynamic pricing, and a robust queuing system for fully occupied facilities.

This project demonstrates professional-grade backend development using Node.js and an Oracle Relational Database to ensure data integrity and high performance.

## ✨ Features

- **Multi-Role Authentication:** Separate portals and permissions for Standard Users, Super Admins, and Local Facility Admins.
- **Dynamic Slot Management:** Real-time visual slot grid indicating Free, Occupied, and Selected states.
- **Queue System:** Automatic queue management when a facility reaches maximum capacity.
- **Tier-Based Pricing:** Dynamic billing logic based on the parking zone tier (General, Gold, Platinum).
- **Comprehensive Dashboard:** Analytics, historical records, and active ticket management.

## 🏗 Architecture

Parkd follows a monolithic Client-Server architecture:
- **Frontend:** HTML5, Vanilla JavaScript, CSS (Native DOM manipulation, no heavy frontend frameworks).
- **Backend:** Node.js with Express framework exposing a RESTful API.
- **Database:** Oracle Database (handled via `node-oracledb`).

For deeper technical details, please refer to the [Architecture Document](docs/ARCHITECTURE.md).

## 🚀 Getting Started

The project is designed to be easily runnable on any Windows or macOS system with Node.js and an Oracle Database instance.

### Prerequisites
- **Node.js** (v18 or higher)
- **Oracle Database** (e.g., Oracle 21c/23ai Free or Enterprise)

### 1-Click Setup (Windows)
1. Clone this repository: `git clone https://github.com/zelssorathiya2615/Parkd.git`
2. Open the `Parkd` folder and configure the `.env` file with your Oracle credentials.
3. Double-click `install-db.bat` to initialize the database schema and seed data.
4. Double-click `run-backend.bat` to start the Node server.
5. Double-click `run-frontend.bat` to launch the application in your browser!

For detailed manual setup instructions across different operating systems, see the [Setup Guide](docs/SETUP.md).

## 📚 Documentation

Explore the `docs/` folder for in-depth information about the system:

- [Setup Instructions](docs/SETUP.md) - Detailed installation and configuration guide.
- [System Architecture](docs/ARCHITECTURE.md) - High-level system design and REST API endpoints.
- [Core Concepts](docs/CONCEPTS.md) - Explanation of the business logic, pricing, and queue structures.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a Pull Request.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
