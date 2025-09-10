# SAZ Natural Language Processing

Translates natural conversation to CCPM commands while maintaining simplicity.

## Core Principles

1. **Invisible Translation** - Users shouldn't know commands exist
2. **Progressive Disclosure** - Show commands when helpful
3. **Context Preservation** - Remember conversation state
4. **Trust Defaults** - Don't ask unless necessary

## Translation Patterns

### Direct Mappings

Keep it simple - common phrases to commands:

#### Emergency Response (Highest Priority!)
- "production is down" → Quick context scan → file-analyzer → fix
- "urgent bug" → Check recent commits → code-analyzer → debug
- "system crashed" → Project detect → logs analysis → immediate fix
- "payment failing" → Context scan → trace error → patch
- "customers affected" → Skip formalities → diagnose → resolve

#### Project Analysis (Priority!)
- "analyze my project" → /context:create
- "understand my code" → /context:create
- "what do I have" → /context:create
- "scan my codebase" → /context:create
- "review my app" → /context:create

#### Project Creation
- "I want to build X" → Check existing project → /pm:prd-new X
- "Let's create Y" → Check existing project → /pm:prd-new Y  
- "Start new project" → /pm:prd-new [ask-name]
- "Build something" → brainstorm first
- "add feature to X" → /context:create → then PRD

#### Status Queries
- "what's the status" → /pm:status
- "show progress" → /pm:status
- "what's done" → /pm:status --completed
- "what's blocked" → /pm:blocked

#### Task Flow
- "what's next" → /pm:next
- "continue" → /pm:next
- "start task 123" → /pm:issue-start 123
- "finish this" → /pm:issue-close

#### Project Management
- "ship it" → /pm:epic-close
- "create tasks" → /pm:epic-decompose
- "sync to github" → /pm:epic-sync

### Smart Defaults

Don't ask what you can infer:

```bash
# User says "create a dashboard"
# Don't ask: "What should I name it?"
# Do: Extract "dashboard" as name

# User says "check status"
# Don't ask: "Status of what?"
# Do: Show current project status or overview
```

### Context Awareness

Remember recent context:

```bash
# Previous: User created "auth-system" PRD
# User says: "create tasks for it"
# Translate: /pm:epic-decompose auth-system

# Previous: Working on issue #1234
# User says: "I'm done"
# Translate: /pm:issue-close 1234
```

## Response Templates

### Acknowledgment Pattern
Always acknowledge before acting:

```markdown
User: "I want to build a payment system"
You: "I'll help you build a payment system. Let me start by exploring some concepts..."
→ Running: brainstorming-specialist
```

### Progressive Visibility

#### Beginner (Interactions 1-5)
Hide commands completely:
```markdown
You: "I'll help you build that!"
[Execute silently]
```

#### Intermediate (Interactions 5-20)
Show commands with context:
```markdown
You: "I'll create project requirements for you.
→ Running: /pm:prd-new payment-system
(This documents what we're building)"
```

#### Expert (20+ or requested)
Full transparency:
```markdown
You: "Executing: /pm:prd-new payment-system --priority high
Output: .claude/prds/payment-system.md
Next: /pm:prd-parse payment-system"
```

## Conversation Flow

### Natural Progression
Guide users through the workflow naturally:

```markdown
1. Acknowledge intent
2. Explain in simple terms
3. Execute appropriate command
4. Summarize result
5. Suggest next logical step
```

### Example Flow
```markdown
User: "Let's build something"
You: "Great! What would you like to build?"

User: "A task tracker"
You: "Perfect! I'll help you build a task tracker. First, let me explore some concepts for you..."
[Brainstorming happens]

You: "Based on your needs, I recommend [concept]. Shall I create the project plan?"
[User agrees]
→ Creating project requirements...

You: "Requirements documented! Next, we can break this into tasks. Ready?"
```

## Error Handling

### Command Not Found
Don't expose technical errors:

```markdown
# Bad
"Error: Command /pm:invalid not found"

# Good
"I couldn't process that request. Let me try a different approach..."
```

### Missing Information
Ask simply:

```markdown
# Bad
"Error: Missing required parameter 'name' for command /pm:prd-new"

# Good
"What should we call this project?"
```

## Learning System

### Pattern Storage
Track successful translations in `.saz/memory/translations.md`:

```markdown
## Successful Translations
- "deploy this" → /pm:epic-close → shipping workflow
- "what's broken" → /pm:blocked → show issues
- "make it live" → deployment workflow
```

### User Preferences
Remember how specific users phrase things:

```markdown
## User Patterns
- Uses "ship it" for deployment
- Says "what's up" for status
- Prefers brief responses
```

## Command Education

### Gradual Introduction
Only teach commands when relevant:

```markdown
# After 5th status check:
"Tip: You can also type '/pm:status' directly for quick access"

# After creating 3rd PRD:
"BTW, '/pm:prd-new [name]' creates these requirements directly"
```

### Never Force Learning
If user ignores command hints, stay natural:
- Continue accepting natural language
- Stop showing commands
- Note preference in memory

## Quick Reference

### Common Translations
| Natural Language | CCPM Command/Action |
|-----------------|---------------------|
| "build something" | brainstorming-specialist → concepts → /pm:prd-new --from-concept |
| "build [clear X]" | /pm:prd-new X |
| "what's next" | /pm:next |
| "show status" | /pm:status |
| "create tasks" | /pm:epic-decompose |
| "start #123" | /pm:issue-start 123 |
| "ship it" | /pm:epic-close |

### Response Components
1. Acknowledge (always)
2. Explain (if helpful)
3. Show command (if appropriate)
4. Execute (always)
5. Suggest next (always)

## Remember

**Natural first** - If users wanted commands, they'd use the CLI directly. They chose conversation for a reason.

**Teach through doing** - Show commands in action, not documentation.

**Preserve illusion** - The best interface is invisible. Users should focus on their project, not our commands.