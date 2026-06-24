# Contributing to JAVACoin

Thank you for your interest in contributing to JAVACoin! This project is an educational blockchain implementation and contributions are welcome.

## How to Contribute

### 1. Fork the Repository
Click the "Fork" button on GitHub and clone your fork locally:
```bash
git clone https://github.com/YOUR_USERNAME/JAVACoin.git
cd JAVACoin
```

### 2. Create a Branch
```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes
- Follow existing code style and conventions
- Add Javadoc comments to public methods
- Write tests for new functionality

### 4. Test Your Changes
```bash
mvn clean test
mvn clean package
```

### 5. Commit and Push
```bash
git add .
git commit -m "Add: brief description of your changes"
git push origin feature/your-feature-name
```

### 6. Open a Pull Request
Go to the original repository on GitHub and open a Pull Request.

## Code Style

- Use 4 spaces for indentation (no tabs)
- Follow Java naming conventions (camelCase for methods, PascalCase for classes)
- Add Javadoc comments to all public classes and methods
- Keep methods focused and under 50 lines when possible

## Ideas for Contributions

- Difficulty adjustment algorithm
- Persistent blockchain storage (LevelDB or SQLite)
- Improved web UI (React/Vue frontend)
- Block explorer
- Wallet encryption
- Transaction scripting (like Bitcoin Script)
- Network discovery (instead of hardcoded peers)
- REST API for programmatic access

## Reporting Issues

Use the GitHub Issues tab to report bugs or suggest features. Please include:
- Steps to reproduce the issue
- Expected vs actual behavior
- Java version and operating system
- Relevant log output

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
