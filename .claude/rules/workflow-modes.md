# Workflow Modes - SAZ-Enhanced CCPM

Comprehensive guide for mode-based behavior, command sequences, and agent orchestration.

## 🎯 Detection Priority Order

**ALWAYS check in this exact sequence - first match wins:**

### 1. 🚨 Emergency Mode (Highest Priority)
**Triggers:** urgent, critical, down, broken, emergency, production, failing, ASAP, immediately, fix now, losing money, customers affected
**Override:** Skips ALL other modes - direct problem-solving only

### 2. 📚 Educational Mode
**Triggers:** learn, tutorial, explain, teach, beginner, understand, how does, step by step, walk through
**Skill Levels:**
- **Beginner:** "new to", "just started", "don't understand", "explain basics"
- **Intermediate:** "familiar with", "want to improve", "best practices"
- **Advanced:** "optimize", "performance", "architecture", "scale"

### 3. 🔧 Initialization Mode
**Auto-Trigger:** `.claude/epics/` directory doesn't exist
**Action:** Automatically run `/pm:init` without asking

### 4. 📂 Analysis Mode
**Triggers:** Existing project files detected (package.json, .git/, src/, requirements.txt, Cargo.toml, go.mod)
**User Phrases:** "analyze my project", "understand my code", "what do I have", "review my app"

### 5. 💡 Brainstorming Mode
**Triggers:** "idea", "something", "maybe", "explore", "not sure", "thinking about", "want to build", "could we"
**Vague Indicators:** Unclear requirements, multiple possibilities mentioned

### 6. 🏗️ Build Mode
**Triggers:** Clear feature requirements, specific technical descriptions
**Indicators:** User knows what they want, can describe functionality

### 7. 🔄 Improve Mode
**Triggers:** "enhance", "improve", "add to", "modify", "update existing", "refactor"
**Context:** Existing project with working features

### 8. 🔨 Maintenance Mode
**Triggers:** "bug", "fix", "quick", "small change", "minor update", "hotfix"
**Indicators:** Isolated issues, no architectural changes

---

## 📋 Mode Specifications

## 🚨 Emergency Mode

**Purpose:** Immediate problem resolution with minimal but critical context

### Behavior
- Quick 15-second context scan first
- Skip formal PM processes (PRDs, epics)
- Use analyzers for rapid diagnosis
- Direct problem-solving with context
- Document after resolution

### Command Sequence
```bash
# Emergency context scan (< 15 seconds):
/pm:status                       # If .claude/epics exists (skip if not)
ls package.json requirements.txt # Detect project type
git status --short               # Recent changes (potential causes)
git log -5 --oneline            # Recent commits
test -d .claude/context && echo "Context exists"

# During emergency:
Task(file-analyzer)              # Scan error logs/configs
Task(code-analyzer)              # Trace error paths
Task(general-purpose)            # Implement fix

# After resolution:
/pm:issue-start emergency-fix    # Document the fix
/pm:issue-sync emergency-fix     # Update GitHub
/pm:issue-close emergency-fix    # Mark complete
```

### Mandatory Agents
- **file-analyzer** for logs/configs (if needed)
- **code-analyzer** for debugging (if needed)
- **general-purpose** for fixing (always)

### NEVER DO
- ❌ Spend > 15 seconds on context scan
- ❌ Create PRDs or epics
- ❌ Run brainstorming sessions
- ❌ Follow full PM processes
- ❌ Delay critical fixes for analysis

### Transitions
- After fix → **Maintenance Mode** for documentation
- If root cause complex → **Improve Mode** for proper fix

---

## 📚 Educational Mode

**Purpose:** Progressive learning with hands-on examples

### Behavior
- Explain every step before execution
- Define terms and concepts
- Show simple examples first
- Progress slowly with confirmation
- Provide learning resources

### Command Sequence

#### Beginner Level
```bash
/pm:help                    # Show available commands
/pm:init                    # Set up system (with explanation)
/pm:status                  # Understand current state
/pm:prd-new simple-todo     # Create simple example
/pm:prd-parse simple-todo   # Show conversion process
/pm:epic-show simple-todo   # Review structure
```

#### Intermediate Level
```bash
/pm:prd-new feature         # More complex PRD
/pm:epic-decompose feature  # Understand task breakdown
/pm:epic-sync feature       # Learn GitHub integration
/pm:issue-analyze 123       # Explore parallel work
```

#### Advanced Level
```bash
/pm:epic-start-worktree complex  # Parallel execution
/pm:issue-analyze complex        # Identify work streams
/pm:sync                         # Full system synchronization
```

### Mandatory Agents
- **tutorial-guide**: Step-by-step learning paths
- **general-purpose**: Simple demonstrations only

### NEVER DO
- ❌ Skip explanations
- ❌ Use complex specialized agents initially
- ❌ Jump to advanced concepts
- ❌ Create production-complexity examples
- ❌ Rush through concepts

### Transitions
- Concepts understood → **Brainstorming Mode** for practice
- Ready for real work → **Build Mode**

---

## 🔧 Initialization Mode

**Purpose:** First-time setup and system configuration

### Auto-Detection
```bash
if [ ! -d ".claude/epics/" ]; then
  echo "🔧 Initializing PM system..."
  /pm:init
fi
```

### Command Sequence
```bash
/pm:init        # Install GitHub CLI, create directories
/pm:validate    # Verify installation
/pm:status      # Show system state
```

### Dependencies
- GitHub CLI installation
- gh-sub-issue extension
- Directory structure creation
- Git repository (optional but recommended)

### NEVER DO
- ❌ Skip initialization check
- ❌ Proceed without validation
- ❌ Ignore setup failures

### Transitions
- Existing project detected → **Analysis Mode**
- Empty project → **Brainstorming Mode**
- Clear requirements → **Build Mode**

---

## 📂 Analysis Mode

**Purpose:** Understand existing project before making changes

### Behavior
- Detect project type and structure
- Inventory existing features
- Identify improvement opportunities
- Build on existing patterns

### Command Sequence
```bash
/context:create             # Analyze project structure
/pm:status                  # Current PM state
/pm:prd-list               # Existing requirements
/pm:epic-list              # Active work
/pm:search [term]          # Find relevant items
/pm:import                 # Import external issues (optional)
/pm:sync                   # Update from GitHub
```

### Mandatory Agents
- **project-analyzer**: Codebase assessment
- **file-analyzer**: For configs and logs
- **code-analyzer**: For architecture understanding

### NEVER DO
- ❌ Suggest conflicting architectures
- ❌ Ignore existing patterns
- ❌ Create redundant features

### Transitions
- New feature needed → **Brainstorming Mode**
- Enhancements needed → **Improve Mode**
- Bugs found → **Maintenance Mode**

---

## 💡 Brainstorming Mode

**Purpose:** Explore ideas and generate concrete concepts

### Behavior
1. Check for existing project first
2. If exists, run `/context:create`
3. Ask 2-3 clarifying questions
4. Generate 3-5 concepts with scope analysis
5. Analyze feasibility and complexity
6. Guide selection based on concept scope
7. Apply workflow matching concept complexity

### Command Sequence
```bash
# With existing project:
/context:create                           # Understand current state

# Brainstorming flow:
/pm:prd-new-enhanced [name] --brainstorm  # Generate concepts with complexity
# [User selects concept]
# Assess concept complexity:
#   1-3 features → Simple → /pm:epic-oneshot [name]
#   4-8 features → Medium → /pm:prd-parse [name]
#   9+ features → Complex → /pm:prd-parse [name] + worktree
# → Transition to Build Mode with appropriate workflow
```

### Mandatory Agents
- **brainstorming-specialist**: Concept generation (ALWAYS)
- **project-analyzer**: If existing project
- **general-purpose**: Concept refinement

### NEVER DO
- ❌ Skip concept evaluation
- ❌ Proceed without user selection
- ❌ Force single solution
- ❌ Ignore feasibility analysis
- ❌ Create PRD without exploration

### Transitions
- Concept selected → **Build Mode**
- Need more info → Stay in **Brainstorming**
- Too complex → **Educational Mode** first

---

## 🏗️ Build Mode

**Purpose:** Structured development from requirements to deployment

### Behavior
- Follow disciplined workflow
- Create comprehensive documentation
- Decompose into manageable tasks
- Enable parallel execution
- Track progress continuously

### Command Sequences by Complexity

#### Simple Projects (< 5 files, 1-2 days)
```bash
/pm:epic-oneshot simple-feature   # Skip PRD for simple work
/pm:issue-start 123               # Direct implementation
/pm:issue-close 123               # Complete
```

#### Medium Projects (5-20 files, 1-2 weeks)
```bash
/pm:prd-new feature               # Define requirements
/pm:prd-parse feature             # Create technical epic
/pm:epic-decompose feature        # Break into tasks
/pm:epic-sync feature             # Push to GitHub
/pm:epic-start feature            # Launch development
/pm:epic-status feature           # Monitor progress
/pm:standup                       # Daily updates
/pm:epic-close feature            # Mark complete
/pm:epic-merge feature            # Integrate changes
```

#### Complex Projects (20+ files, 2+ weeks)
```bash
/pm:prd-new-enhanced complex      # Enhanced planning
/pm:prd-parse complex             # Detailed epic
/pm:epic-decompose complex        # Comprehensive breakdown
/pm:issue-analyze complex         # Identify parallel streams
/pm:epic-sync complex             # Full GitHub sync
/pm:epic-start-worktree complex  # Isolated branch execution
/pm:epic-status complex           # Track all streams
/pm:blocked                       # Monitor blockers
/pm:epic-refresh complex          # Update from changes
/pm:epic-close complex            # Complete
/pm:epic-merge complex            # Complex integration
```

### Mandatory Agents by Project Type
- **Simple:** general-purpose only
- **Medium:** 1-2 specialists (e.g., nextjs-app-builder)
- **Complex:** Multiple specialists + integration-coordinator
- **Enterprise:** Full agent ecosystem with parallel coordination

### Progress Tracking
```bash
/pm:next                   # Next priority item
/pm:standup               # Daily progress report
/pm:blocked               # Identify obstacles
/pm:in-progress           # Active work
/pm:epic-status [name]    # Epic-level progress
```

### NEVER DO
- ❌ Skip testing
- ❌ Bypass GitHub sync
- ❌ Ignore blocked items
- ❌ Create without PRD (except simple)
- ❌ Merge without validation

### Transitions
- Feature complete → **Maintenance Mode**
- New requirements → **Brainstorming Mode**
- Issues found → **Maintenance Mode**

---

## 🔄 Improve Mode

**Purpose:** Enhance existing project with new capabilities

### Behavior
- Always analyze current state first
- Build on existing patterns
- Maintain backward compatibility
- Focus on incremental improvements

### Command Sequence
```bash
/context:create            # Understand current project
/pm:status                 # Check PM state
/pm:epic-list             # Review existing work

# For major features (use Build Mode sequence):
/pm:prd-new enhancement
/pm:prd-parse enhancement
# ... (full Build Mode flow)

# For targeted improvements:
/pm:issue-analyze 123      # Find improvement areas
/pm:issue-start 123        # Begin enhancement
/pm:issue-sync 123         # Update progress
/pm:issue-close 123        # Complete
```

### Mandatory Agents
- **project-analyzer**: Current state assessment (ALWAYS)
- **performance-optimizer**: For performance improvements
- **Specialists**: Based on enhancement type
- **code-analyzer**: For refactoring

### NEVER DO
- ❌ Break existing functionality
- ❌ Ignore current architecture
- ❌ Skip compatibility checks
- ❌ Rush without analysis

### Transitions
- Major feature → **Build Mode**
- Quick fix → **Maintenance Mode**
- Unclear requirements → **Brainstorming Mode**

---

## 🔨 Maintenance Mode

**Purpose:** Quick fixes and minor updates with minimal overhead

### Behavior
- Minimal process overhead
- Direct issue creation
- Quick implementation
- Simple documentation
- Fast iteration

### Command Sequence
```bash
# Quick fix flow:
/pm:issue-start bug-fix    # Start work immediately
/pm:issue-status bug-fix   # Check progress
/pm:issue-sync bug-fix     # Update GitHub
/pm:issue-close bug-fix    # Complete

# Cleanup:
/pm:clean                  # Archive completed work
```

### Mandatory Agents
- **general-purpose**: Quick fixes
- **Specialist**: Only if domain-specific

### NEVER DO
- ❌ Create PRDs for bugs
- ❌ Over-engineer fixes
- ❌ Skip testing
- ❌ Ignore root causes

### Transitions
- Root cause complex → **Improve Mode**
- Multiple related bugs → **Build Mode**
- Complete → **Analysis Mode** for health check

---

## 📊 Complexity Scaling

### Project Size Detection
```bash
# Automatic complexity assessment
if [ $(find . -name "*.js" -o -name "*.py" | wc -l) -lt 5 ]; then
  COMPLEXITY="simple"
elif [ $(find . -name "*.js" -o -name "*.py" | wc -l) -lt 20 ]; then
  COMPLEXITY="medium"
else
  COMPLEXITY="complex"
fi
```

### Command Selection by Complexity

| Complexity | Commands | Agents | Parallel | GitHub |
|------------|----------|--------|----------|---------|
| **Simple** | epic-oneshot, issue-* | 1 general | No | Optional |
| **Medium** | Full PRD flow | 1-2 specialists | Optional | Required |
| **Complex** | Enhanced PRD + worktree | 3+ specialists | Yes | Required |
| **Enterprise** | Full process + coordination | All available | Required | Required |

---

## 🔀 Parallel Execution Guide

### Parallel-Safe Commands (Can run simultaneously)
```bash
# Read-only operations
/pm:prd-list & /pm:epic-list & /pm:issue-show 123

# Status checks
/pm:epic-status & /pm:issue-status & /pm:standup

# System queries
/pm:search term & /pm:help & /pm:validate
```

### Sequential-Only Commands (Must run in order)
```bash
# Initialization sequence
/pm:init → /pm:validate → /pm:status

# PRD workflow
/pm:prd-new → /pm:prd-parse → /pm:epic-decompose

# Epic workflow
/pm:epic-decompose → /pm:epic-sync → /pm:epic-start
```

### Parallel Agent Limits
- Maximum 10 agents during `/pm:epic-start`
- Use `/pm:epic-start-worktree` for isolation
- Monitor with `/pm:epic-status`

---

## 🔄 Mode Transitions

### Transition Map
```
Initialization → Analysis OR Brainstorming
Analysis → Brainstorming OR Improve OR Maintenance
Brainstorming → Build
Build → Maintenance
Improve → Build OR Maintenance
Maintenance → Analysis OR Improve
Educational → Any mode (when ready)
Emergency → Maintenance (for documentation)
```

### Automatic Transitions
- Project detected during init → **Analysis Mode**
- Concept selected in brainstorming → **Build Mode**
- Emergency resolved → **Maintenance Mode**
- Epic complete → **Maintenance Mode**

---

## 📝 Progress Tracking

### Per-Mode Tracking Methods

| Mode | Primary Tracking | Secondary | Documentation |
|------|-----------------|-----------|---------------|
| **Emergency** | None during | issue-* after | `.claude/epics/emergency/` |
| **Educational** | Manual observation | help history | `.claude/context/learning.md` |
| **Brainstorming** | Concept files | PRD creation | `.claude/ideas/[date]/` |
| **Build** | GitHub issues | epic-status | `.claude/epics/[name]/` |
| **Improve** | GitHub issues | issue-status | `.claude/epics/improvements/` |
| **Maintenance** | Issue tracking | status | `.claude/epics/maintenance/` |

---

## ⚙️ GitHub Integration Requirements

### Modes Requiring GitHub
- **Build Mode**: Full GitHub integration required
- **Improve Mode**: GitHub recommended
- **Maintenance Mode**: GitHub optional but helpful

### Modes Working Offline
- **Emergency Mode**: No GitHub needed
- **Educational Mode**: Works offline
- **Brainstorming Mode**: Initial work offline
- **Analysis Mode**: Can work offline

---

## 🚫 Universal NEVER DO List

Across ALL modes, NEVER:
- ❌ Guess user intent - always ask
- ❌ Skip `/pm:init` check
- ❌ Ignore error messages
- ❌ Create without user confirmation
- ❌ Mix modes simultaneously
- ❌ Bypass security checks
- ❌ Exceed parallel agent limits (10)
- ❌ Ignore GitHub API rate limits

---

## 📍 Quick Reference

### Mode Selection Flowchart
```
User Input
    ↓
Emergency keywords? → YES → Emergency Mode
    ↓ NO
Educational keywords? → YES → Educational Mode
    ↓ NO
.claude/epics/ exists? → NO → Initialization Mode
    ↓ YES
Project files exist? → YES → Analysis Mode
    ↓ NO
Requirements vague? → YES → Brainstorming Mode
    ↓ NO
New feature? → YES → Build Mode
    ↓ NO
Enhancement? → YES → Improve Mode
    ↓ NO
Bug/minor? → YES → Maintenance Mode
    ↓ NO
Default → Brainstorming Mode
```

This comprehensive guide ensures consistent, intelligent mode-based behavior across all SAZ-Enhanced CCPM interactions.