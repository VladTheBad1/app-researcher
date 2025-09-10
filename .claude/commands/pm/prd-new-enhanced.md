---
allowed-tools: Bash, Read, Write, LS, Task
---

# PRD New (Enhanced with Brainstorming)

Create a comprehensive PRD with integrated brainstorming workflow when needed.

## Usage
```
/pm:prd-new-enhanced <feature_name> [--force-brainstorm] [--from-concept <path>]
```

## Options
- `--force-brainstorm`: Always run brainstorming even if requirements seem clear
- `--from-concept <path>`: Create PRD from existing brainstormed concept

## Required Rules

**IMPORTANT:** Before executing this command, read and follow:
- `.claude/rules/datetime.md` - For getting real current date/time

## Important Note

**This enhanced version is typically invoked automatically** when the main workflow detects:
- Complex projects (9+ features)
- Uncertain requirements needing exploration
- User explicitly requests brainstorming

For simple/medium projects, use `/pm:prd-new` instead.

## Workflow Integration

This command assumes the intent detection and complexity scaling have already been done by the main workflow. It focuses on executing the enhanced PRD creation with brainstorming integration.

## Preflight Checklist

### Input Validation
1. **Validate feature name format:**
   - Must contain only lowercase letters, numbers, and hyphens
   - Must start with a letter
   - No spaces or special characters allowed
   - If invalid: "❌ Feature name must be kebab-case. Examples: user-auth, payment-v2"

2. **Check for existing work:**
   - Check `.claude/prds/$ARGUMENTS.md`
   - Check `.claude/ideas/*/` for related brainstorming
   - If exists: "⚠️ Found existing [PRD/brainstorming]. Options: overwrite, continue, or new name?"

3. **Verify directory structure:**
   - Ensure `.claude/prds/` exists
   - Ensure `.claude/ideas/` exists for brainstorming output
   - Create if missing

## Brainstorming Integration

### When Brainstorming Triggers

#### Automatic Trigger (Vague Input)
```
User: "I want to build something with AI for small businesses"

Response: "💡 This sounds like it needs exploration! Let me brainstorm concepts first..."
→ Task: brainstorming-specialist

[After brainstorming completes]
"I've generated 5 concepts for AI solutions for small businesses. 
Which resonates most with your vision?
1. AI Invoice Assistant - Automated invoice processing
2. Customer Insights AI - Sentiment analysis dashboard
3. [...]"

[After user selection]
"Great! Now I'll create a comprehensive PRD for [selected concept]..."
```

#### Suggested Trigger (Moderate Clarity)
```
User: "Create a user dashboard"

Response: "I can create a PRD for a user dashboard. However, there are many directions this could take.

Would you like me to:
1. 🎯 Create PRD directly with standard dashboard features
2. 💡 Brainstorm different dashboard concepts first (recommended)

Your choice?"
```

#### Direct PRD (Clear Requirements)
```
User: "Create user authentication with OAuth2, MFA, and session management"

Response: "Clear requirements detected. Creating comprehensive PRD for user authentication..."
[Proceeds directly to PRD creation]
```

### Importing Brainstorming Concepts

If brainstorming was done previously or externally:

```bash
/pm:prd-new my-feature --with-concept .claude/ideas/2024-01-15/selected.md
```

This will:
1. Read the selected concept file
2. Extract vision, user stories, and technical approach
3. Use as foundation for PRD sections
4. Maintain traceability to original brainstorming

## Enhanced PRD Structure

### With Brainstorming Context
When creating PRD from brainstorming:

```markdown
---
name: $ARGUMENTS
description: [From brainstorming concept summary]
status: backlog
created: [Current ISO datetime]
brainstorming_session: .claude/ideas/[date]/
selected_concept: [concept name]
---

# PRD: $ARGUMENTS

## Executive Summary
[Derived from selected concept overview]

## Origin & Ideation
- **Brainstorming Date**: [date]
- **Concepts Explored**: [count]
- **Selected Approach**: [concept name]
- **Selection Rationale**: [why this concept won]

## Problem Statement
[Enhanced with brainstorming insights]

[Continue with standard sections...]
```

## Brainstorming Workflow

### Step 1: Invoke Brainstorming
```
Task: Explore concepts for $ARGUMENTS

Agent: brainstorming-specialist

Requirements:
- Generate 3-5 distinct concepts
- Include technical feasibility analysis
- Assess market opportunity
- Evaluate implementation complexity
- Calculate success probability
- Save outputs to .claude/ideas/[date]/
```

### Step 2: Present Options
After brainstorming completes:
1. Read summary from `.claude/ideas/[date]/summary.md`
2. Present concepts to user with clear differentiation
3. Ask for selection or further exploration
4. Handle user feedback

### Step 3: Create PRD with Context
Once concept selected:
1. Read selected concept details
2. Import key information:
   - Vision → Executive Summary
   - User segments → User Stories
   - Technical approach → Requirements
   - Feasibility → Constraints
3. Generate comprehensive PRD with full context

## Quality Enhancements

### Brainstorming Quality Gates
Before proceeding to PRD:
- [ ] At least 3 viable concepts generated
- [ ] Each concept has feasibility scores
- [ ] User has made informed selection
- [ ] Technical approach is validated

### PRD Quality Gates
Enhanced with brainstorming context:
- [ ] Links to original brainstorming session
- [ ] Includes alternative approaches considered
- [ ] Documents why this approach was selected
- [ ] Realistic estimates based on feasibility analysis

## Post-Creation

### After Successful PRD Creation
```
✅ PRD created: .claude/prds/$ARGUMENTS.md

📊 Summary:
- Brainstorming: [Yes/No]
- Concepts explored: [count if applicable]
- Selected approach: [name]
- Estimated complexity: [Low/Medium/High]
- Time to MVP: [X weeks]

📋 Next steps:
1. Review PRD: cat .claude/prds/$ARGUMENTS.md
2. Create epic: /pm:prd-parse $ARGUMENTS
3. View alternatives: ls .claude/ideas/[date]/ (if brainstormed)

Ready to create implementation epic? Run: /pm:prd-parse $ARGUMENTS
```

## Error Recovery

### Brainstorming Failures
If brainstorming doesn't yield viable concepts:
1. Ask user for more context
2. Suggest pivoting direction
3. Offer to proceed with direct PRD creation
4. Document why brainstorming didn't work

### Integration Failures
If concept import fails:
1. Offer to create PRD without brainstorming context
2. Allow manual concept details entry
3. Preserve brainstorming outputs for manual review

## Command Aliases

For user convenience, these aliases trigger the enhanced flow:
- `/pm:brainstorm <name>`: Force brainstorming-first approach
- `/pm:explore <name>`: Same as brainstorm
- `/pm:ideate <name>`: Same as brainstorm
- `/pm:prd-quick <name>`: Skip brainstorming, direct PRD

## Success Metrics

Track enhancement effectiveness:
- Brainstorming trigger rate: [auto/suggested/skipped]
- Concept selection rate: X% of brainstormed concepts used
- PRD quality improvement: Before/after brainstorming
- Time from idea to PRD: Target < 1 hour
- User satisfaction: Feedback on process

Remember: The goal is to ensure we build the RIGHT thing, not just build things right. Brainstorming prevents premature commitment to suboptimal solutions.