---
created: 2025-09-10T05:59:59Z
last_updated: 2025-09-10T05:59:59Z
version: 1.0
author: Claude Code PM System
---

# Project Structure

## Root Directory Layout
```
app-researcher/
├── .claude/                  # Claude PM system files
│   ├── context/              # Project context documentation
│   ├── epics/                # Epic tracking and management
│   │   └── AppRadar-Personal/
│   │       ├── execution-status.md
│   │       └── tasks/        # Individual task definitions
│   ├── rules/                # System rules and guidelines
│   └── scripts/              # Automation scripts
├── app-radar/                # Main TypeScript application
│   ├── src/                  # Source code
│   │   ├── collectors/       # Data collection modules
│   │   ├── config/           # Configuration management
│   │   ├── database/         # Database layer
│   │   ├── types/            # TypeScript type definitions
│   │   ├── utils/            # Utility functions
│   │   └── index.ts          # Main entry point
│   ├── tests/                # Test files
│   │   └── collectors/       # Collector-specific tests
│   ├── dist/                 # Compiled JavaScript output
│   ├── node_modules/         # Dependencies
│   ├── data/                 # Data storage directory
│   ├── logs/                 # Application logs
│   └── docs/                 # Documentation
├── src/                      # Legacy source directory
│   └── workflows/            # Workflow orchestration
├── config/                   # Configuration files
├── data/                     # Data storage
├── logs/                     # Application logs
└── package.json              # Root package configuration
```

## Key Directories

### `/app-radar/src/`
Main application source code in TypeScript:
- **collectors/**: Individual data collector implementations
  - `base-collector.ts`: Abstract base class for all collectors
  - `producthunt.ts`: Product Hunt data collector
  - `indiehackers.ts`: IndieHackers data collector
  - `twitter.ts`: Twitter/X data collector
  - `exploding-topics.ts`: Exploding Topics trend collector
- **config/**: Configuration management
  - `index.ts`: Central configuration module
- **database/**: Data persistence layer
  - `index.ts`: Database operations and schema
- **types/**: TypeScript type definitions
  - `index.ts`: Shared type definitions
- **utils/**: Utility modules
  - `browser.ts`: Browser automation utilities
  - `logger.ts`: Logging utilities
- **index.ts**: Application entry point

### `/app-radar/tests/`
Test files organized by module:
- **collectors/**: Tests for each collector
  - `producthunt.test.ts`
  - `indiehackers.test.ts`
  - `twitter.test.ts`
  - `exploding-topics.test.ts`

### `/.claude/`
Claude PM system files:
- **epics/**: Epic and task management
- **context/**: Project context documentation
- **rules/**: System rules and behaviors
- **scripts/**: Automation and utility scripts

## File Naming Patterns
- **TypeScript files**: `kebab-case.ts` (e.g., `base-collector.ts`)
- **Test files**: `[module-name].test.ts`
- **Configuration**: `index.ts` in dedicated directories
- **Documentation**: `UPPERCASE.md` or `kebab-case.md`

## Module Organization
1. **Collectors**: Each collector extends BaseCollector class
2. **Configuration**: Centralized in config/index.ts
3. **Database**: SQLite3-based persistence
4. **Types**: Shared TypeScript interfaces and types
5. **Utils**: Reusable utility functions

## Build Artifacts
- **dist/**: TypeScript compilation output
- **node_modules/**: NPM dependencies
- **logs/**: Runtime logs (gitignored)
- **data/**: Database and collected data (gitignored)

## Configuration Files
- **package.json**: Main and app-radar specific configs
- **tsconfig.json**: TypeScript configuration
- **.eslintrc.json**: ESLint rules
- **.prettierrc**: Code formatting rules
- **vitest.config.ts**: Test configuration
- **.env.example**: Environment variable template

## Entry Points
- **Main application**: `app-radar/src/index.ts`
- **Legacy orchestrator**: `src/workflows/orchestrator.js`
- **Test runner**: `npm test` (Vitest)
- **Development**: `npm run dev` (tsx watch mode)