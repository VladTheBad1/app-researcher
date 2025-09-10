# Complexity Scaling Rules

Adaptive command sequences and process overhead based on project complexity.

## 🎯 Complexity Detection

### Dual Detection Approach

**For Existing Projects:** Use file count
**For New Projects:** Use concept scope from brainstorming

### File-Based Assessment (Existing Projects)
```bash
# File count-based detection
file_count=$(find . -type f \( -name "*.js" -o -name "*.py" -o -name "*.ts" -o -name "*.go" \) | wc -l)

if [ $file_count -lt 5 ]; then
  COMPLEXITY="simple"
elif [ $file_count -lt 20 ]; then
  COMPLEXITY="medium"
elif [ $file_count -lt 50 ]; then
  COMPLEXITY="complex"
else
  COMPLEXITY="enterprise"
fi
```

### Concept-Based Assessment (New Projects)
When starting from brainstorming concepts, assess based on:

| Complexity | Features | Timeline | Integrations | Examples |
|------------|----------|----------|--------------|----------|
| **Simple** | 1-3 | < 1 week | 0-1 | MVP, prototype, proof of concept |
| **Medium** | 4-8 | 1-3 weeks | 2-3 | Full app, standard SaaS |
| **Complex** | 9-15 | 3-8 weeks | 4+ | Multi-module system, marketplace |
| **Enterprise** | 15+ | 8+ weeks | Ecosystem | Platform, multi-tenant, distributed |

### Unified Indicators

| Complexity | Files (Existing) | Features (New) | Timeline | Scope | Team Size |
|------------|------------------|----------------|----------|-------|-----------|
| **Simple** | < 5 | 1-3 | 1-2 days | Single feature/fix | Solo |
| **Medium** | 5-20 | 4-8 | 1-2 weeks | Multiple features | 2-5 |
| **Complex** | 20-50 | 9-15 | 2-8 weeks | System changes | 5-10 |
| **Enterprise** | 50+ | 15+ | 8+ weeks | Multi-system | 10+ |

## 📋 Command Sequences by Complexity

### Simple Projects
**Philosophy:** Just do it - skip ceremony

```bash
# Direct execution path
/pm:epic-oneshot simple-task    # Skip PRD entirely
/pm:issue-start 123             # Begin work immediately
/pm:issue-close 123             # Mark complete

# OR even simpler (no PM at all):
# Just make the changes directly
# Document in commit message
```

**Characteristics:**
- ❌ No PRDs needed
- ❌ No epic decomposition
- ✅ Optional GitHub sync
- ✅ Single branch work
- ✅ Direct implementation

### Medium Projects  
**Philosophy:** Balance process with productivity

```bash
# Standard workflow
/pm:prd-new feature             # Create requirements
/pm:prd-parse feature           # Convert to epic
/pm:epic-decompose feature      # Break into 3-5 tasks
/pm:epic-sync feature           # Push to GitHub
/pm:epic-start feature          # Begin development
/pm:standup                     # Daily progress check
/pm:epic-close feature          # Complete
```

**Characteristics:**
- ✅ Light PRD (key points only)
- ✅ Basic decomposition
- ✅ GitHub recommended
- ✅ Standard branch
- ✅ Progress tracking

### Complex Projects
**Philosophy:** Full rigor for coordination

```bash
# Comprehensive workflow
/pm:prd-new-enhanced complex    # Detailed requirements
/pm:prd-parse complex           # Comprehensive epic
/pm:epic-decompose complex      # Break into 10+ tasks
/pm:issue-analyze complex       # Identify parallel streams
/pm:epic-sync complex           # Full GitHub integration
/pm:epic-start-worktree complex # Isolated parallel work
/pm:blocked                     # Monitor dependencies
/pm:standup                     # Daily sync
/pm:epic-refresh complex        # Update progress
/pm:epic-merge complex          # Complex integration
```

**Characteristics:**
- ✅ Full PRD with analysis
- ✅ Detailed decomposition
- ✅ GitHub required
- ✅ Worktree isolation
- ✅ Parallel execution
- ✅ Daily standups

### Enterprise Projects
**Philosophy:** Maximum coordination and visibility

```bash
# Enterprise workflow
/pm:prd-new-enhanced system     # Multi-stakeholder requirements
/pm:prd-parse system            # System-wide epic
/pm:epic-decompose system       # 20+ coordinated tasks
/pm:issue-analyze system        # Complex dependency mapping
/pm:epic-sync system            # GitHub with labels/milestones
/pm:epic-start-worktree system  # Multiple parallel streams
/pm:blocked                     # Dependency tracking
/pm:standup                     # Multiple daily syncs
/pm:epic-status system          # Executive dashboards
/pm:epic-refresh system         # Continuous updates
```

**Characteristics:**
- ✅ Multiple PRDs per system
- ✅ Sub-epic hierarchies
- ✅ Full GitHub integration
- ✅ Multiple worktrees
- ✅ Extensive documentation
- ✅ Quality gates

## 🔄 Process Overhead Scaling

| Aspect | Simple | Medium | Complex | Enterprise |
|--------|--------|--------|---------|------------|
| **PRD** | Skip | 1 page | 3-5 pages | 10+ pages |
| **Tasks** | 0-1 | 3-5 | 10-20 | 20+ |
| **GitHub** | Optional | Recommended | Required | Required+ |
| **Branches** | Main | Feature | Worktree | Multiple |
| **Updates** | End only | Weekly | Daily | Continuous |
| **Testing** | Basic | Standard | Comprehensive | Full QA |
| **Docs** | Comments | README | Full docs | Architecture |

## 🚀 Execution Strategy

### Serial vs Parallel

**Simple/Medium:** Serial execution
```bash
/pm:issue-start 123  # One task at a time
/pm:issue-close 123
/pm:issue-start 124
```

**Complex:** Parallel with coordination
```bash
/pm:issue-analyze 123         # Find parallel opportunities
/pm:epic-start-worktree epic  # Multiple streams
```

**Enterprise:** Full parallel orchestration
```bash
/pm:epic-start-worktree system --parallel-max=10
# Multiple teams, multiple streams
```

## 🎭 Mode Overrides

Certain modes override complexity-based decisions:

### Emergency Mode
```bash
# Complexity IGNORED - fastest path only
# Skip all ceremony regardless of project size
git status && git log -5  # Quick context
# Direct fix
/pm:issue-start emergency-fix  # Document after
```

### Educational Mode
```bash
# Start simple regardless of actual complexity
# Even complex projects begin with basic commands
/pm:prd-new simple-tutorial   # Simple even if complex
/pm:epic-show simple-tutorial  # Explain each step
```

### Brainstorming Mode
```bash
# Complexity unknown until concepts solidify
Task(brainstorming-specialist)  # Generate concepts first
# THEN assess complexity based on chosen concept
# THEN apply appropriate workflow
```

### Maintenance Mode
```bash
# Treat as simple regardless of codebase size
/pm:issue-start bug-fix  # Quick fix workflow
/pm:issue-close bug-fix  # Minimal overhead
```

## 🗣️ Natural Language Mapping

### Keywords to Complexity
```
EXISTING PROJECTS:
"quick fix", "typo", "small change" → Simple
"new feature", "add capability" → Medium
"refactor", "redesign", "architecture" → Complex
"platform", "system", "infrastructure" → Enterprise

NEW PROJECTS/CONCEPTS:
"MVP", "prototype", "proof of concept" → Simple (1-3 features)
"full app", "complete system", "standard SaaS" → Medium (4-8 features)
"marketplace", "multi-module", "ecosystem" → Complex (9+ features)
"platform", "multi-tenant", "distributed" → Enterprise (15+ features)

UNCERTAIN:
"build something", "not sure", "maybe" → Brainstorm first
"explore", "could we", "what if" → Concepts before complexity
```

### User Experience Adaptation

**New Users:**
- Start with simple commands regardless of project
- Gradually introduce based on comfort
- Show success before complexity

**Experienced Users:**
- Jump to appropriate complexity immediately
- Offer shortcuts and batch operations
- Skip explanations unless requested

**Teams:**
- Scale to highest common denominator
- Ensure GitHub integration for visibility
- Emphasize coordination points

## 📊 Decision Flow

```
User Input
    ↓
Emergency? → YES → Skip complexity assessment
    ↓ NO
Educational? → YES → Force simple workflow
    ↓ NO
Vague idea? → YES → Brainstorm first
    ↓ NO
Assess scope → Determine complexity
    ↓
Apply workflow:
├── Simple → epic-oneshot or direct
├── Medium → Standard PRD flow
├── Complex → Enhanced with parallel
└── Enterprise → Full orchestration
```

## 🎯 GitHub Strategy by Complexity

| Level | Local Work | GitHub Issues | Sub-Issues | Labels | Milestones |
|-------|------------|---------------|------------|--------|------------|
| Simple | ✅ Primary | Optional | No | No | No |
| Medium | ✅ Yes | ✅ Recommended | Optional | Basic | No |
| Complex | Some | ✅ Required | ✅ Yes | ✅ Yes | Optional |
| Enterprise | Minimal | ✅ Required | ✅ Required | ✅ Required | ✅ Required |

## 📈 Progress Tracking

**Simple:** Git commits only
**Medium:** GitHub issue comments
**Complex:** Daily standups + issue updates
**Enterprise:** Dashboards + metrics + reports

## ⚡ Performance Tips

1. **Under-complexity is better than over-complexity**
   - Start simple, add process only when needed
   - Can always upgrade workflow mid-project

2. **Mode overrides complexity**
   - Emergency → Skip everything
   - Educational → Start simple
   - Brainstorming → Assess after

3. **Team size affects minimum complexity**
   - Solo can stay simple longer
   - Teams need GitHub earlier
   - Large teams require full process

4. **Iterate on complexity assessment**
   - Reassess as project grows
   - Adjust workflow accordingly
   - Don't be afraid to simplify

Remember: The goal is appropriate process, not maximum process. Scale intelligently.