---
created: 2025-09-10T05:59:59Z
last_updated: 2025-09-10T05:59:59Z
version: 1.0
author: Claude Code PM System
---

# System Patterns

## Architectural Style
- **Pattern**: Object-Oriented with Inheritance
- **Base Classes**: Abstract base classes for shared functionality
- **Composition**: Utility modules for cross-cutting concerns
- **Separation of Concerns**: Clear module boundaries

## Design Patterns Observed

### 1. Abstract Factory Pattern
- **Implementation**: BaseCollector abstract class
- **Purpose**: Standardize collector interface
- **Benefits**: Consistent API across all data collectors

### 2. Strategy Pattern
- **Location**: Different collector implementations
- **Purpose**: Interchangeable data collection strategies
- **Usage**: Each collector implements unique scraping logic

### 3. Singleton Pattern
- **Implementation**: Configuration and Logger modules
- **Purpose**: Single instance for app-wide services
- **Access**: Exported instances from index files

### 4. Module Pattern
- **Structure**: ES6 modules throughout
- **Exports**: Named and default exports
- **Organization**: One module per file principle

## Data Flow Architecture

### Collection Pipeline
1. **Initialization**: Configuration loading
2. **Browser Setup**: Playwright browser instance creation
3. **Collection**: Parallel or sequential data gathering
4. **Processing**: Data validation and transformation
5. **Storage**: SQLite database persistence
6. **Reporting**: Generated reports and notifications

### Error Handling Strategy
- **Try-Catch Blocks**: Comprehensive error catching
- **Retry Logic**: p-retry for transient failures
- **Logging**: Winston for structured error logging
- **Graceful Degradation**: Continue on partial failures

## Code Organization Patterns

### Collector Structure
```typescript
abstract class BaseCollector {
  abstract collect(): Promise<Data>
  protected validateData(): boolean
  protected saveToDatabase(): Promise<void>
}

class SpecificCollector extends BaseCollector {
  async collect(): Promise<Data> {
    // Implementation
  }
}
```

### Configuration Management
- **Centralized**: Single config module
- **Validation**: Zod schema validation
- **Environment**: dotenv for secrets
- **Defaults**: Fallback values for all settings

### Database Patterns
- **Repository Pattern**: Database operations abstracted
- **Migration Strategy**: Schema versioning planned
- **Connection Pooling**: SQLite3 connection management
- **Transaction Support**: ACID compliance

## Testing Patterns

### Test Organization
- **Mirror Structure**: Tests mirror source structure
- **Naming**: `[module].test.ts` convention
- **Coverage**: Unit and integration tests
- **Mocking**: Browser automation mocking

### Test Strategy
- **Unit Tests**: Individual function testing
- **Integration Tests**: Collector end-to-end tests
- **Snapshot Testing**: For report generation
- **Performance Tests**: Planned for optimization

## Async Patterns

### Concurrency Control
- **p-limit**: Rate limiting for API calls
- **Promise.all**: Parallel execution where possible
- **Sequential Processing**: When order matters
- **Queue Management**: Planned for job processing

### Promise Handling
- **Async/Await**: Primary async pattern
- **Error Boundaries**: Try-catch for all async operations
- **Promise Chains**: Avoided in favor of async/await

## Security Patterns

### Credential Management
- **Environment Variables**: Never hardcoded
- **Dotenv**: Local development secrets
- **Validation**: Check for required credentials
- **Sanitization**: Remove secrets from logs

### Browser Security
- **Stealth Mode**: Anti-detection measures
- **User Agents**: Rotation for authenticity
- **Cookie Management**: Session persistence
- **Proxy Support**: Planned for IP rotation

## Performance Patterns

### Optimization Strategies
- **Lazy Loading**: Load modules on demand
- **Caching**: Planned for API responses
- **Batch Processing**: Group database operations
- **Resource Cleanup**: Proper browser disposal

### Monitoring
- **Logging Levels**: Configurable verbosity
- **Performance Metrics**: Execution time tracking
- **Resource Usage**: Memory and CPU monitoring planned
- **Health Checks**: Endpoint availability checks

## Communication Patterns

### Inter-Module Communication
- **Direct Imports**: Explicit dependencies
- **Event Emitters**: Planned for decoupling
- **Message Queues**: Future consideration
- **Shared State**: Minimal, through database

### External Communication
- **HTTP Client**: Axios for API calls
- **WebSocket**: Planned for real-time updates
- **Webhook Support**: For notifications
- **Email Integration**: Nodemailer for reports

## Development Patterns

### Code Style
- **TypeScript Strict Mode**: Type safety enforced
- **ESLint Rules**: Consistent code style
- **Prettier Formatting**: Automatic formatting
- **Naming Conventions**: Clear and consistent

### Version Control
- **Feature Branches**: epic/feature-name pattern
- **Commit Messages**: Issue reference format
- **Git Flow**: Main/develop/feature branches
- **CI/CD**: GitHub Actions planned