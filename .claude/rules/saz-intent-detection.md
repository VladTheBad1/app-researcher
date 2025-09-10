# SAZ Intent Detection Rules

Extends CCPM with natural language understanding and adaptive intelligence.

## Core Principles

1. **Trust User Intent** - Don't over-question what users mean
2. **Fail Gracefully** - When unclear, offer simple choices
3. **Act Quickly** - Emergency overrides everything
4. **Learn Progressively** - Adapt to user expertise over time

## Priority Detection Order

ALWAYS check in this exact sequence - first match wins.

### 1. Emergency Detection (Highest Priority)

#### Quick Check
```bash
# If message contains emergency keywords
if [[ "$input" =~ (urgent|critical|down|broken|emergency|production|failing|ASAP) ]]; then
  echo "🚨 Emergency detected - quick context scan"
  # Quick 15-second context scan
  ls package.json requirements.txt Cargo.toml go.mod 2>/dev/null | head -1
  git status --short 2>/dev/null | head -5
  git log -3 --oneline 2>/dev/null
  test -d .claude/context && echo "Context available"
fi
```

#### Emergency Keywords
- urgent, critical, emergency, down, broken
- production issue, failing, crashed, not working
- ASAP, immediately, losing money, customers affected

#### Action
- Quick context scan (< 15 seconds)
- Detect project type and recent changes
- Use file-analyzer for logs/configs if needed
- Use code-analyzer for debugging if needed
- Direct fix with general-purpose
- Document after resolution with /pm:issue-start

### 2. Existing Project Detection

#### Quick Check
```bash
# Check if existing project files present
if [[ -f "package.json" || -f "requirements.txt" || -f "Cargo.toml" || -f "go.mod" || -d ".git" ]]; then
  echo "📂 Existing project detected - suggest analysis first"
fi
```

#### Project Indicators
- **Files**: package.json, requirements.txt, Cargo.toml, go.mod, pom.xml
- **Directories**: .git/, src/, app/, lib/, components/
- **User phrases**: "my project", "existing app", "current codebase", "what I have"

#### Action
- Suggest: "I notice you have an existing project. Should I analyze it first with /context:create?"
- Understand current architecture before suggesting new features
- Build on existing patterns and conventions
- Avoid redundant or conflicting recommendations

### 3. Educational Detection

#### Quick Check
```bash
# If user is learning
if [[ "$input" =~ (learn|teach|explain|understand|beginner|tutorial) ]]; then
  echo "📚 Educational mode"
fi
```

#### Educational Keywords
- learn, teach, explain, understand, how does
- what is, tutorial, guide, help me understand
- new to, beginner, step by step, walk through

#### Action
- Activate progressive teaching
- Start with concepts, then practice
- Show commands gradually
- Explain while doing

### 3. Brainstorming Detection

#### Quick Check
```bash
# If idea is vague
if [[ "$input" =~ (ideas|brainstorm|explore|maybe|something) ]]; then
  echo "💡 Brainstorming mode"
fi
```

#### Brainstorming Keywords
- ideas, brainstorm, explore, concepts, thinking about
- not sure, maybe, could, possibilities, options
- something with, what if, innovative, creative

#### Action
- Launch brainstorming-specialist
- Generate 3-5 concepts
- Analyze feasibility
- Guide selection

### 4. Build Detection

#### Quick Check
```bash
# If creating something new
if [[ "$input" =~ (build|create|develop|implement|feature) ]]; then
  # Assess clarity first
  echo "🏗️ Build mode"
fi
```

#### Build Keywords
- build, create, develop, make, implement
- add feature, new feature, want to build
- let's build, start building, develop

#### Action
1. Assess requirement clarity:
   - Vague ("build something") → brainstorming-specialist → concepts
   - Clear ("build OAuth") → /pm:prd-new directly
2. After brainstorming (if done):
   - User selects concept → /pm:prd-new feature --from-concept path
3. Then continue workflow:
   - /pm:prd-parse → /pm:epic-decompose → /pm:epic-sync

### 5. Status Detection

#### Quick Check
```bash
if [[ "$input" =~ (status|progress|happening|show) ]]; then
  echo "📊 Status request"
fi
```

#### Status Keywords
- status, progress, what's happening, where are we
- what's done, show me, current state
- completion, finished, remaining

#### Action
- Run /pm:status or equivalent
- Show relevant metrics
- Suggest next actions

### 6. Continuation Detection

#### Quick Check
```bash
if [[ "$input" =~ (next|continue|what.should) ]]; then
  echo "➡️ Next task"
fi
```

#### Next Keywords
- what's next, next, what should I do
- continue, keep going, move forward
- then what, what now, ready for next

#### Action
- Run /pm:next
- Load context
- Present priority task

## Clarity Assessment

### Pattern Recognition
Don't overthink - quick assessment:

#### Vague Indicators
- something, maybe, not sure, thinking
- could, might, possibly, exploring
- some kind of, similar to

#### Specific Indicators
- OAuth, API, database, authentication
- specific requirements, must have
- technical specs, exact features

### Assessment Logic
```bash
# Simple scoring
vague_count=$(echo "$input" | grep -o -E "(something|maybe|not sure)" | wc -l)
specific_count=$(echo "$input" | grep -o -E "(OAuth|API|database)" | wc -l)

if [ $vague_count -gt $specific_count ]; then
  clarity="vague"
elif [ $specific_count -gt $(($vague_count * 2)) ]; then
  clarity="specific"
else
  clarity="moderate"
fi
```

## Confidence Handling

### High Confidence (>80%)
Direct pattern match - execute immediately

### Medium Confidence (50-80%)
Partial match - quick confirmation:
"Sounds like you want to [action]. Should I proceed?"

### Low Confidence (<50%)
Unclear - offer choices:
"I can help you:
1. Start a new project
2. Check status
3. Explore ideas
Which one?"

## Error Recovery

### When Intent Unclear
```bash
# Don't over-explain, just clarify
echo "What are you trying to do?"
echo "1. Build something (new project)"
echo "2. Check something (status)"
echo "3. Fix something (debug)"
```

### When Multiple Intents
Take the highest priority:
- Emergency > Educational > Brainstorming > Build > Status

## Pattern Learning

Track successful matches in `.saz/memory/patterns.md`:
```markdown
## Successful Patterns
- "deploy to prod" → shipping workflow
- "what's broken" → emergency mode
- "how do I" → educational mode
```

## Quick Reference

### Priority Order
1. 🚨 Emergency - immediate help
2. 📚 Educational - teaching mode
3. 💡 Brainstorming - idea exploration
4. 🏗️ Build - project creation
5. 📊 Status - progress check
6. ➡️ Next - continuation

### Response Speed
- Emergency: < 1 second
- Other intents: < 2 seconds
- Unclear: < 3 seconds with choices

## Remember

**Speed over precision** - It's better to act quickly and adjust than to overthink. Users will correct us if we're wrong.

**Trust the user** - Don't second-guess obvious intent. If someone says "build X", they want to build X.

**Learn and adapt** - Track patterns that work and improve over time.