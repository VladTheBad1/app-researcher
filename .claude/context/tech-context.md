---
created: 2025-09-10T05:59:59Z
last_updated: 2025-09-10T05:59:59Z
version: 1.0
author: Claude Code PM System
---

# Technology Context

## Language & Runtime
- **Primary Language**: TypeScript 5.3.3
- **Runtime**: Node.js >= 18.0.0
- **Module System**: ES Modules (type: "module")
- **Compilation Target**: ES2022

## Core Dependencies

### Browser Automation
- **playwright**: ^1.40.0 - Main browser automation framework
- **playwright-extra**: ^4.3.6 - Extended Playwright functionality
- **puppeteer**: ^21.0.0 - Alternative browser automation
- **puppeteer-extra-plugin-stealth**: ^2.11.2 - Stealth mode for automation

### Data Collection & Processing
- **axios**: ^1.6.2 - HTTP client for API requests
- **cheerio**: ^1.0.0-rc.12 - Server-side DOM manipulation
- **user-agents**: ^1.1.174 - User agent string generation

### Database
- **sqlite3**: ^5.1.6 - SQLite database driver
- **better-sqlite3**: ^9.0.0 - Synchronous SQLite3 bindings

### AI & Analysis
- **openai**: ^4.20.0 - OpenAI API integration
- **anthropic**: ^0.24.0 - Anthropic Claude API integration

### Configuration & Environment
- **dotenv**: ^16.3.1 - Environment variable management
- **zod**: ^3.22.4 - Schema validation and type safety

### Logging & Monitoring
- **winston**: ^3.11.0 - Logging framework

### Utilities
- **p-limit**: ^4.0.0 - Concurrency control
- **p-retry**: ^6.2.0 - Retry logic with exponential backoff
- **date-fns**: ^3.0.0 - Date manipulation
- **lodash**: ^4.17.21 - Utility functions
- **fs-extra**: ^11.2.0 - Enhanced file system operations

### Scheduling & Orchestration
- **cron**: ^3.1.0 - Cron job scheduling
- **yargs**: ^17.7.0 - Command-line argument parsing

### Reporting & Output
- **nodemailer**: ^6.9.0 - Email notifications
- **csv-writer**: ^1.6.0 - CSV file generation
- **markdown-it**: ^14.0.0 - Markdown processing
- **sharp**: ^0.32.0 - Image processing

## Development Dependencies

### TypeScript & Types
- **typescript**: ^5.3.3 - TypeScript compiler
- **@types/node**: ^20.10.5 - Node.js type definitions
- **@types/sqlite3**: ^3.1.11 - SQLite3 type definitions

### Development Tools
- **tsx**: ^4.6.2 - TypeScript execution for development
- **nodemon**: ^3.0.0 - Auto-restart on file changes

### Testing
- **vitest**: ^1.1.0 - Test runner
- **@vitest/ui**: ^1.1.0 - Test UI interface
- **@vitest/coverage-v8**: ^1.1.0 - Code coverage
- **@playwright/test**: ^1.40.0 - Playwright testing framework
- **jest**: ^29.7.0 - Alternative test runner (legacy)

### Code Quality
- **eslint**: ^8.56.0 - Linting framework
- **@typescript-eslint/eslint-plugin**: ^6.15.0 - TypeScript ESLint rules
- **@typescript-eslint/parser**: ^6.15.0 - TypeScript ESLint parser
- **prettier**: ^3.1.1 - Code formatting

## Build & Deployment

### Scripts
- `build`: TypeScript compilation to JavaScript
- `dev`: Development mode with hot reload
- `start`: Production execution
- `test`: Run test suite
- `test:ui`: Run tests with UI
- `test:coverage`: Generate coverage report
- `lint`: Check code quality
- `lint:fix`: Auto-fix linting issues
- `format`: Format code with Prettier

### Build Configuration
- **TypeScript Config**: Strict mode enabled
- **Target**: ES2022
- **Module**: ESNext
- **Output**: dist/ directory
- **Source Maps**: Enabled for debugging

## Environment Variables
Required environment variables (from .env.example):
- API keys for external services
- Database configuration
- Browser automation settings
- Logging levels and paths

## Package Management
- **NPM**: Primary package manager
- **Lock File**: package-lock.json for reproducible builds

## Browser Requirements
- Chromium (via Playwright)
- Optional: Firefox, WebKit support
- Headless and headed modes supported

## System Requirements
- Node.js 18+ for modern JavaScript features
- SQLite3 for local data persistence
- Adequate RAM for browser automation (4GB+ recommended)
- Network access for data collection APIs