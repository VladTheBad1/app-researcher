# Project Structure Rules

## Default Organization
All new projects should be created in their own subfolder to maintain clean workspace.

## Structure Pattern
```
workspace-root/
├── .claude/           # SAZ-CCPM system files
├── project-1/         # First project
│   ├── package.json
│   ├── src/
│   └── ...
├── project-2/         # Second project
│   ├── requirements.txt
│   ├── app/
│   └── ...
└── README.md          # Workspace overview (optional)
```

## Benefits
- Multiple projects can coexist
- Clear separation of concerns
- Easy to archive/remove projects
- No file conflicts between projects
- Clean git management per project

## Implementation
When creating tasks via `/pm:epic-decompose`:
1. First task should create project subfolder
2. All code, packages, configs go in subfolder
3. Root stays clean with only .claude/ and project folders

## Example Structure
```
my-workspace/
├── .claude/
│   ├── agents/
│   ├── commands/
│   ├── rules/
│   ├── epics/
│   └── prds/
├── todo-app/          # Project 1
│   ├── package.json
│   ├── src/
│   └── public/
├── auth-service/      # Project 2
│   ├── requirements.txt
│   ├── app/
│   └── tests/
└── dashboard-ui/      # Project 3
    ├── package.json
    └── src/
```

## Exceptions
- Utility scripts can stay in root
- Workspace-wide configs (if needed)
- Documentation that spans projects
- Shared libraries or components