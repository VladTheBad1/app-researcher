---
allowed-tools: Bash, Read, Write, LS
---

# PRD New

Create a Product Requirements Document from requirements or brainstormed concepts.

## Usage
```
/pm:prd-new <feature_name> [--from-concept <path>]
```

## Options
- `--from-concept <path>`: Create PRD from existing brainstormed concept (e.g., `.claude/ideas/2024-01-15/concept-1.md`)

## Required Rules

**IMPORTANT:** Before executing this command, read and follow:
- `.claude/rules/datetime.md` - For getting real current date/time

## Preflight Checklist

Before proceeding, complete these validation steps.
Do not bother the user with preflight checks progress ("I'm not going to ..."). Just do them and move on.

### Input Validation
1. **Validate feature name format:**
   - Must contain only lowercase letters, numbers, and hyphens
   - Must start with a letter
   - No spaces or special characters allowed
   - If invalid, tell user: "❌ Feature name must be kebab-case (lowercase letters, numbers, hyphens only). Examples: user-auth, payment-v2, notification-system"

2. **Check for existing PRD:**
   - Check if `.claude/prds/$ARGUMENTS.md` already exists
   - If it exists, ask user: "⚠️ PRD '$ARGUMENTS' already exists. Do you want to overwrite it? (yes/no)"
   - Only proceed with explicit 'yes' confirmation
   - If user says no, suggest: "Use a different name or run: /pm:prd-parse $ARGUMENTS to create an epic from the existing PRD"

3. **Verify directory structure:**
   - Check if `.claude/prds/` directory exists
   - If not, create it first
   - If unable to create, tell user: "❌ Cannot create PRD directory. Please manually create: .claude/prds/"

## Instructions

You are a product manager creating a comprehensive Product Requirements Document (PRD) for: **$ARGUMENTS**

### Check for Concept Input
If `--from-concept` flag is provided:
1. Read the concept file from the specified path
2. Extract key details: features, technical approach, target users
3. Skip discovery phase - use concept as foundation
4. Jump directly to PRD creation with concept details

If no concept provided, follow this structured approach:

### 1. Discovery & Context
- Ask clarifying questions about the feature/product "$ARGUMENTS"
- **Check for visual references**: "Do you have any screenshots or examples of apps/sites you like?"
- **If screenshots provided**: Analyze and extract design patterns, UI elements, flow concepts
- Understand the problem being solved
- Identify target users and use cases
- Gather constraints and requirements

### 2. PRD Structure
Create a comprehensive PRD with these sections:

#### Executive Summary
- Brief overview and value proposition

#### Problem Statement
- What problem are we solving?
- Why is this important now?

#### User Stories
- Primary user personas
- Detailed user journeys
- Pain points being addressed

#### Requirements
**Functional Requirements**
- Core features and capabilities
- User interactions and flows

**Non-Functional Requirements**
- Performance expectations
- Security considerations
- Scalability needs

#### Success Criteria
- Measurable outcomes
- Key metrics and KPIs

#### Constraints & Assumptions
- Technical limitations
- Timeline constraints
- Resource limitations

#### Technical Considerations
- Technology stack recommendations (high-level)
- Integration requirements (APIs, third-party services)
- Data requirements and storage needs
- Security and compliance considerations
- Performance and scalability expectations

#### UI/UX Design

**Interface Concept**
- Visual style and overall aesthetic
- Navigation patterns and user flow
- Responsive design approach (mobile-first, desktop-first, adaptive)

**Key Screens & Components**
- List of main screens/views needed
- Core UI components and their purpose
- Layout structure for primary interfaces

**Design References**
- Similar apps/websites user likes: [If user provided examples]
- Screenshots provided: [Reference any user-provided screenshots]
- Wireframes: [Simple ASCII diagrams or descriptions]

Example wireframe:
```
+------------------+
|   Header/Nav     |
+------+-----------+
| Side |  Main     |
| Menu | Content   |
|      |           |
+------+-----------+
```

**Feature-to-UI Mapping**
| Feature | UI Location | User Interaction |
|---------|-------------|------------------|
| Login | Top-right header | Click avatar icon |
| Search | Top navigation | Type in search bar |
| [Feature] | [Where in UI] | [How user accesses] |

**Design System Considerations**
- Component library preference (if any)
- Accessibility requirements (WCAG 2.1 AA)
- Brand consistency needs
- Dark mode support (if applicable)

**User Flow Integration**
- How features connect in the user journey
- Primary paths through the application
- Entry and exit points for key workflows

#### Implementation Roadmap
**Phase 1: MVP**
- Core features for initial release
- Essential user flows
- Basic integrations

**Phase 2: Full Release**
- Additional features and enhancements
- Advanced integrations
- Performance optimizations

#### Risk Assessment
- **Technical Risks**: Potential implementation challenges
- **Business Risks**: Market/user adoption concerns
- **Mitigation Strategies**: How to address identified risks

#### Resource Planning
- **Team Composition**: Required roles and expertise
- **External Dependencies**: Third-party services, APIs, tools
- **Infrastructure Needs**: Hosting, databases, monitoring

#### Out of Scope
- What we're explicitly NOT building
- Features deferred to future phases

#### Dependencies
- External dependencies
- Internal team dependencies

### 3. File Format with Frontmatter
Save the completed PRD to: `.claude/prds/$ARGUMENTS.md` with this exact structure:

```markdown
---
name: $ARGUMENTS
description: [Brief one-line description of the PRD]
status: backlog
created: [Current ISO date/time]
---

# PRD: $ARGUMENTS

## Executive Summary
[Content...]

## Problem Statement
[Content...]

[Continue with all sections...]
```

### 4. Frontmatter Guidelines
- **name**: Use the exact feature name (same as $ARGUMENTS)
- **description**: Write a concise one-line summary of what this PRD covers
- **status**: Always start with "backlog" for new PRDs
- **created**: Get REAL current datetime by running: `date -u +"%Y-%m-%dT%H:%M:%SZ"`
  - Never use placeholder text
  - Must be actual system time in ISO 8601 format

### 5. Quality Checks

Before saving the PRD, verify:
- [ ] All sections are complete (no placeholder text)
- [ ] User stories include acceptance criteria
- [ ] Success criteria are measurable
- [ ] Technical considerations address key implementation areas
- [ ] UI/UX design section includes interface concept and key screens
- [ ] Feature-to-UI mapping is complete for all major features
- [ ] Design references capture any user-provided examples
- [ ] Implementation roadmap has clear MVP and full release phases
- [ ] Risk assessment identifies both technical and business risks
- [ ] Dependencies are clearly identified
- [ ] Out of scope items are explicitly listed

### 6. Post-Creation

After successfully creating the PRD:
1. Confirm: "✅ PRD created: .claude/prds/$ARGUMENTS.md"
2. Show brief summary of what was captured
3. Suggest next step: "Ready to create implementation epic? Run: /pm:prd-parse $ARGUMENTS"

## Error Recovery

If any step fails:
- Clearly explain what went wrong
- Provide specific steps to fix the issue
- Never leave partial or corrupted files

Conduct a thorough brainstorming session before writing the PRD. Ask questions, explore edge cases, and ensure comprehensive coverage of the feature requirements for "$ARGUMENTS".
