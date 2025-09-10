# MCP Integration Rules

> Smart delegation to mcp-handler agent for external service operations

## When to Delegate to MCP-Handler

### Immediate MCP Needs (Direct Delegation)
- **Screenshots/Browser**: "screenshot", "browser", "automate", "navigate"
- **YouTube Transcripts**: "youtube", "transcript", "video", "youtu.be"
- **Web Scraping**: "scrape", "extract" (beyond basic WebFetch)
- **Service APIs**: Direct service calls (Slack messages, etc.)

### Project Integration Needs (Contextual Delegation)
- **Authentication**: "auth", "login", "sign up", "user management"
- **Database**: "database", "store data", "persist", "SQL", "query"
- **Deployment**: "deploy", "host", "production", "CI/CD"
- **External Services**: Firebase, Supabase, MongoDB, GitHub, Slack integration

### Service Detection Patterns
```javascript
const servicePatterns = {
  "firebase": ["firebase", "firestore", "firebase auth", "firebase hosting"],
  "supabase": ["supabase", "postgres", "postgrest"],
  "mongodb": ["mongodb", "mongo", "atlas"],
  "github": ["github", "repo", "pull request", "issue"],
  "slack": ["slack", "message", "channel", "workspace"],
  "playwright": ["screenshot", "browser", "automate"],
  "youtube": ["youtube", "transcript", "video"]
}
```

## Context-Efficient Delegation Strategy

### File-Pointer Method (Preferred)
Instead of copying context, point mcp-handler to relevant files:

```javascript
Task({
    description: "Brief task description",
    prompt: `
User Request: ${originalRequest}

Context Files to Read:
- package.json (tech stack, dependencies)
- ${relevantConfigFiles}
- ${existingServiceFiles}
- ${environmentFiles}

Read these files to understand the project, then handle the MCP integration.
`,
    subagent_type: "mcp-handler"
})
```

### Smart File Selection Rules

**Authentication Requests:**
- Always: `package.json`, `.env.example`
- Auth files: `src/components/*[Aa]uth*`, `middleware.*`, `pages/api/auth/`
- Framework config: `next.config.js`, `app/layout.*`

**Database Requests:**
- Always: `package.json`, schema files
- Data files: `prisma/schema.prisma`, `*.sql`, `src/models/`
- API routes: `pages/api/`, `src/routes/`, data endpoints

**Deployment Requests:**
- Always: `package.json` (build scripts)
- Config files: `next.config.js`, `vite.config.ts`, `tsconfig.json`
- Deployment configs: `vercel.json`, `firebase.json`, `netlify.toml`

**Service Integration:**
- Service-specific configs: `firebase.json`, `.supabase/`, etc.
- Environment docs: `.env.example`, `README.md`
- Related API files: integration endpoints

## File Discovery Patterns

### Automatic Detection
```bash
# Authentication files
find src -name "*[Aa]uth*" -o -name "*[Ll]ogin*" -o -name "*[Ss]ign*"
ls middleware.* pages/api/auth/ app/(auth)/ 2>/dev/null

# Database files  
ls prisma/ *.sql src/models/ src/lib/db* 2>/dev/null

# Config files
ls *.config.* .env.example firebase.json vercel.json 2>/dev/null
```

### Context Optimization Benefits
- **Accuracy**: Always current file state
- **Efficiency**: File pointers instead of copied content
- **Scalability**: Works with any project size

## Integration Examples

### Firebase Auth Setup
```javascript
// User: "Add Firebase authentication"
Task({
    description: "Set up Firebase auth",
    prompt: `
User wants to add Firebase authentication to their app.

Read these files to understand the project:
- package.json (current tech stack)
- src/app/layout.tsx (app structure)  
- src/components/ui/ (UI patterns)
- .env.example (environment setup)

Configure Firebase Auth with appropriate integration for this stack.
`,
    subagent_type: "mcp-handler"
})
```

### Database Integration
```javascript  
// User: "Add database to store user profiles"
Task({
    description: "Database integration",
    prompt: `
User needs database for user profile storage.

Context files:
- package.json (current data handling)
- src/types/user.ts (data models)
- pages/api/users/ (existing API structure)

Set up appropriate database MCP and integration.
`,
    subagent_type: "mcp-handler"
})
```

## Error Handling

### MCP Configuration Issues
When mcp-handler reports configuration problems:
1. **Missing Environment Variables**: Guide user through secure setup
2. **Service Authentication**: Help with API key/token configuration  
3. **Package Dependencies**: Install required packages
4. **Framework Integration**: Adjust for specific tech stack

### Delegation Failures
If mcp-handler can't handle the request:
1. **Check file accessibility**: Ensure files exist and are readable
2. **Verify service availability**: Confirm MCP can be installed/configured
3. **Fallback options**: Suggest manual setup or alternative approaches
4. **Context adjustment**: Provide additional context if needed

## Best Practices

### Do's
- ✅ Always provide relevant file paths
- ✅ Include project overview files (README, package.json)
- ✅ Point to existing service configurations
- ✅ Include environment variable documentation
- ✅ Let mcp-handler read files directly

### Don'ts  
- ❌ Copy large amounts of file content into prompts
- ❌ Assume mcp-handler knows project structure
- ❌ Skip environment setup context
- ❌ Forget to include tech stack information
- ❌ Use MCP delegation for simple tasks

## Context Preservation Rules

1. **File References Only**: Never copy file contents, only point to paths
2. **Essential Files First**: Start with package.json, README, key configs
3. **Service-Specific Context**: Include files relevant to the specific integration
4. **Environment Awareness**: Always include .env.example or environment docs
5. **Let Agent Explore**: mcp-handler can read additional files as needed

This approach ensures mcp-handler has complete project context.