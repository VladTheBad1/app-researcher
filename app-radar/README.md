# AppRadar Personal

Browser automation foundation for collecting app opportunities from various sources using Playwright MCP.

## Features

- **Browser Automation**: Stealth-mode browsing with human-like patterns
- **Multiple Sources**: Support for Product Hunt, IndieHackers, Twitter, and Exploding Topics
- **Rate Limiting**: Respectful scraping with configurable delays
- **Data Storage**: SQLite database for opportunity tracking
- **Error Handling**: Robust retry mechanisms and error recovery
- **Modular Design**: Easy to extend with new collectors

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   npm run playwright:install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

## Project Structure

```
app-radar/
├── src/
│   ├── collectors/          # Data collectors for different sources
│   │   └── base-collector.ts
│   ├── config/              # Configuration management
│   │   └── index.ts
│   ├── database/            # SQLite database layer
│   │   └── index.ts
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── browser.ts       # Browser automation utilities
│   │   └── logger.ts        # Logging system
│   └── index.ts             # Main entry point
├── tests/                   # Test files
├── data/                    # Database files (created at runtime)
├── logs/                    # Log files (created at runtime)
└── docs/                    # Documentation
```

## Configuration

Key configuration options in `.env`:

- `HEADLESS=true` - Run browser in headless mode
- `BROWSER_TIMEOUT=30000` - Page load timeout in milliseconds
- `MAX_CONCURRENT_BROWSERS=3` - Maximum concurrent browser instances
- `REQUEST_DELAY_MIN=1000` - Minimum delay between requests
- `REQUEST_DELAY_MAX=3000` - Maximum delay between requests
- `DATABASE_PATH=./data/opportunities.db` - SQLite database file path
- `LOG_LEVEL=info` - Logging level (debug, info, warn, error)

## Architecture

### Base Collector

The `BaseCollector` class provides common functionality for all data sources:

- Browser session management with stealth mode
- Rate limiting and retry mechanisms
- Data validation and filtering
- Database storage integration
- Error handling and logging

### Browser Utilities

Advanced browser automation features:

- User agent rotation
- Stealth measures to avoid detection
- Human-like scrolling and delays
- Request monitoring and security logging
- Concurrent session management

### Database Layer

SQLite database with optimized schema for:

- Opportunity tracking with full metadata
- Collector statistics and performance metrics
- Data cleanup and archival
- Fast querying with proper indexes

## Testing

Comprehensive test suite covering:

- Configuration validation
- Database operations
- Browser automation
- Collector functionality
- Error scenarios

Run tests with coverage:
```bash
npm run test:coverage
```

## Development

Development workflow:

```bash
# Start development mode with auto-reload
npm run dev

# Run linting
npm run lint
npm run lint:fix

# Format code
npm run format

# Run tests in watch mode
npm run test:ui
```

## Next Steps

This foundation is ready for implementing specific collectors:

1. **Product Hunt Collector** - Extract trending products
2. **IndieHackers Collector** - Monitor startup discussions
3. **Twitter Collector** - Track hashtags and mentions
4. **Exploding Topics Collector** - Identify trending topics

Each collector extends `BaseCollector` and implements:
- `getStartUrl()` - Starting URL for collection
- `extractOpportunities()` - Extract data from page
- `getNextPageUrl()` - Pagination handling
- `isValidOpportunity()` - Data validation

## Security

The system implements several anti-detection measures:

- Randomized user agents
- Human-like browsing patterns
- Request timing randomization
- Stealth browser configuration
- Error monitoring and adaptation