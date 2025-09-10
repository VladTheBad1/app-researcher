# Changelog

## [Unreleased]

### Added
- CHANGELOG.md for tracking improvements
- TodoWrite tool to project-manager for workflow setup
- Project assessment logic using `ls` command

### Feature Improvements
- project-manager now checks PM initialization status:
  - Verifies GitHub CLI installation and authentication
  - Checks for required .claude directories
  - Adds /pm:init to todos if system not initialized
  - Prevents workflow issues before they occur

### Documentation
- Updated README.md to reflect all v2.1 improvements:
  - Two-phase delegation workflow explanation
  - Project subfolder organization
  - PM initialization check feature
  - Testing workflow improvements
  - Updated troubleshooting section

### Changed
- ✅ All requests now route through project-manager first (two-phase approach)
- ✅ project-manager: workflow specialist → initial assessment agent
- ✅ project-manager tools: removed Write, added Grep, LS, TodoWrite
- ✅ Simplified delegation logic in CLAUDE.md
- ✅ Parallel execution references `/pm:epic-start` command

### Phase 2: PRD Improvements ✅
- Added UI/UX Design section to PRD template with:
  - Interface concept and key screens
  - Feature-to-UI mapping table
  - Design references for user-provided screenshots
  - ASCII wireframe examples
- Updated discovery to ask for visual references
- Added Visual Reference Mode to brainstorming-specialist
- Updated quality checks to include UI/UX validation

### Phase 3: File Organization ✅
- Updated install scripts (ccpm.sh and ccpm.bat) to move docs to .claude/saz-docs/
- Added CHANGELOG.md to files moved during installation
- Updated script references (init.sh, help.sh) to new doc location
- Prevents conflicts with user's README.md and LICENSE files

### Phase 4: Testing Enhancements ✅
- Strengthened test-runner delegation in CLAUDE.md
- Added visual delegation pattern showing test flow
- Listed common mistakes to avoid (npm test, pytest directly)
- Added test routing to project-manager for test-related requests

### Phase 5: Project Structure ✅
- Added project structure guidelines to epic-decompose.md
- Created new .claude/rules/project-structure.md
- Updated project-manager with project organization section
- Default behavior: new projects in subfolders (e.g., my-app/)

## [2.0.0] - 2024-09-08
- Initial SAZ-CCPM v2.0 release