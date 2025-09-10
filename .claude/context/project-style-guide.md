---
created: 2025-09-10T05:59:59Z
last_updated: 2025-09-10T05:59:59Z
version: 1.0
author: Claude Code PM System
---

# Project Style Guide

## Code Style Conventions

### TypeScript Guidelines

#### Naming Conventions
- **Files**: `kebab-case.ts` (e.g., `base-collector.ts`, `exploding-topics.ts`)
- **Classes**: `PascalCase` (e.g., `ProductHuntCollector`, `BaseCollector`)
- **Interfaces**: `PascalCase` with `I` prefix avoided (e.g., `CollectorConfig`, not `ICollectorConfig`)
- **Functions**: `camelCase` (e.g., `collectData`, `validateResponse`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`, `API_TIMEOUT`)
- **Variables**: `camelCase` (e.g., `userData`, `isLoading`)
- **Private members**: Prefix with underscore (e.g., `_privateMethod`)

#### Type Definitions
```typescript
// Prefer interfaces for objects
interface UserData {
  id: string;
  name: string;
  createdAt: Date;
}

// Use type for unions and primitives
type Status = 'active' | 'inactive' | 'pending';
type UserId = string;

// Avoid any, use unknown or generics
function processData<T>(data: T): T {
  return data;
}
```

#### Function Signatures
```typescript
// Use arrow functions for consistency
const fetchData = async (url: string): Promise<Response> => {
  // Implementation
};

// Destructure parameters when appropriate
const createUser = ({ name, email }: UserInput): User => {
  // Implementation
};

// Document complex functions
/**
 * Fetches trending products from Product Hunt
 * @param limit - Maximum number of products to fetch
 * @returns Array of product data
 */
const fetchTrendingProducts = async (limit: number = 10): Promise<Product[]> => {
  // Implementation
};
```

### File Organization

#### Import Order
```typescript
// 1. External dependencies
import { Browser } from 'playwright';
import axios from 'axios';

// 2. Internal modules
import { BaseCollector } from './base-collector';
import { logger } from '../utils/logger';

// 3. Types and interfaces
import type { CollectorConfig, Product } from '../types';

// 4. Constants
import { API_BASE_URL, MAX_RETRIES } from '../constants';
```

#### Module Structure
```typescript
// 1. Imports
// 2. Constants
// 3. Interfaces/Types
// 4. Class/Function definitions
// 5. Exports

export class ProductHuntCollector extends BaseCollector {
  // Public members first
  public async collect(): Promise<void> {
    // Implementation
  }

  // Protected members
  protected validateData(): boolean {
    // Implementation
  }

  // Private members last
  private async fetchPage(): Promise<void> {
    // Implementation
  }
}
```

### Error Handling

#### Try-Catch Pattern
```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new CustomError('Operation failed', { cause: error });
}
```

#### Error Messages
```typescript
// Be specific and actionable
throw new Error('Failed to connect to database: Connection timeout after 30s');

// Include context
throw new Error(`Invalid product ID: ${productId} - must be a valid UUID`);

// Use custom error classes
class CollectorError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CollectorError';
  }
}
```

### Async/Await Patterns

```typescript
// Always use async/await over promises
// Good
const data = await fetchData();

// Avoid
fetchData().then(data => {});

// Parallel execution
const [products, users] = await Promise.all([
  fetchProducts(),
  fetchUsers()
]);

// Sequential when dependent
const user = await fetchUser();
const profile = await fetchProfile(user.id);
```

### Comments and Documentation

#### Code Comments
```typescript
// Use comments sparingly, prefer self-documenting code
// BAD: i++ // increment i
// GOOD: userCount++ // Track total users for rate limiting

// TODO comments should include assignee and date
// TODO(john, 2024-01): Implement caching for API responses

// Complex logic deserves explanation
// Calculate opportunity score using weighted factors:
// - Trend velocity (40%)
// - Market size (30%)
// - Competition level (30%)
const score = (velocity * 0.4) + (marketSize * 0.3) + (competition * 0.3);
```

#### JSDoc
```typescript
/**
 * Collector for Product Hunt trending products
 * @class
 * @extends BaseCollector
 */
export class ProductHuntCollector extends BaseCollector {
  /**
   * Fetches and processes trending products
   * @param {number} [limit=10] - Maximum products to fetch
   * @returns {Promise<Product[]>} Array of processed products
   * @throws {CollectorError} When API is unavailable
   */
  async collect(limit: number = 10): Promise<Product[]> {
    // Implementation
  }
}
```

### Testing Conventions

#### Test File Naming
- Test files: `[module].test.ts`
- Test utilities: `test-utils.ts`
- Fixtures: `__fixtures__/[data].json`

#### Test Structure
```typescript
describe('ProductHuntCollector', () => {
  let collector: ProductHuntCollector;

  beforeEach(() => {
    collector = new ProductHuntCollector();
  });

  describe('collect', () => {
    it('should fetch trending products', async () => {
      const products = await collector.collect();
      expect(products).toHaveLength(10);
    });

    it('should handle API errors gracefully', async () => {
      // Mock API failure
      await expect(collector.collect()).rejects.toThrow('API Error');
    });
  });
});
```

### Git Conventions

#### Branch Naming
- Feature: `feature/add-scoring-engine`
- Fix: `fix/collector-timeout`
- Epic: `epic/AppRadar-Personal`
- Release: `release/v1.0.0`

#### Commit Messages
```bash
# Format: [Type] #[Issue]: Description

# Examples:
git commit -m "feat #7: Implement scoring engine for opportunities"
git commit -m "fix #23: Handle timeout in Product Hunt collector"
git commit -m "docs: Update README with setup instructions"
git commit -m "refactor #15: Extract common collector logic to base class"

# Types:
# feat: New feature
# fix: Bug fix
# docs: Documentation
# refactor: Code refactoring
# test: Adding tests
# chore: Maintenance tasks
```

### Configuration Files

#### Environment Variables
```bash
# .env.example format
# API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_PATH=./data/app-radar.db

# Feature Flags
ENABLE_AI_ANALYSIS=true
DEBUG_MODE=false

# Rate Limits
MAX_REQUESTS_PER_MINUTE=60
```

#### Package.json Scripts
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "test": "vitest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
  }
}
```

### Database Conventions

#### Table Naming
- Use snake_case: `product_data`, `user_scores`
- Plural for collections: `products`, `collectors`
- Singular for single-row tables: `config`, `metadata`

#### Column Naming
```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,           -- UUID
  name TEXT NOT NULL,            -- Required fields
  description TEXT,              -- Optional fields
  score REAL DEFAULT 0,          -- Defaults
  is_active BOOLEAN DEFAULT true, -- Boolean with is_ prefix
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Performance Guidelines

#### Optimization Rules
1. Measure before optimizing
2. Cache expensive operations
3. Use lazy loading for large datasets
4. Implement pagination for lists
5. Clean up resources (close browsers, connections)

#### Resource Management
```typescript
// Always clean up resources
const browser = await playwright.launch();
try {
  // Use browser
} finally {
  await browser.close();
}

// Use connection pooling
const pool = new DatabasePool({ max: 10 });

// Implement timeouts
const result = await Promise.race([
  fetchData(),
  timeout(30000)
]);
```

### Security Guidelines

#### Never Commit
- API keys or secrets
- Personal information
- Production database URLs
- Authentication tokens

#### Input Validation
```typescript
// Always validate external input
const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Sanitize user input
const sanitizedInput = input.trim().toLowerCase();
```

### Accessibility & Usability

#### CLI Output
```typescript
// Use clear, colored output
console.log(chalk.green('✓ Success:'), 'Data collected');
console.log(chalk.yellow('⚠ Warning:'), 'Rate limit approaching');
console.log(chalk.red('✗ Error:'), 'Collection failed');

// Provide progress indicators
const spinner = ora('Collecting data...').start();
// ... operation
spinner.succeed('Data collected successfully');
```

#### Error Messages
- Be specific about what went wrong
- Suggest how to fix the issue
- Include relevant context
- Avoid technical jargon for user-facing errors

### Code Review Checklist

Before submitting PR:
- [ ] Code follows style guide
- [ ] Tests pass locally
- [ ] No hardcoded values
- [ ] Error handling implemented
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Performance considered
- [ ] Security reviewed