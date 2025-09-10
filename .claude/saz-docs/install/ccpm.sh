#!/bin/bash

REPO_URL="https://github.com/Gravicity/SAZ-CCPM.git"
TEMP_DIR=".saz_temp_$$"

echo "🚀 Installing SAZ-CCPM..."

# Clone to temp directory
echo "Downloading framework..."
git clone -q "$REPO_URL" "$TEMP_DIR" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ Download complete"
    
    # Create directories
    mkdir -p .claude/saz-docs
    
    # Move ONLY framework documentation to safe location
    echo "Organizing framework files..."
    [ -f "$TEMP_DIR/README.md" ] && mv "$TEMP_DIR/README.md" .claude/saz-docs/
    [ -f "$TEMP_DIR/LICENSE" ] && mv "$TEMP_DIR/LICENSE" .claude/saz-docs/LICENSE.md
    [ -f "$TEMP_DIR/AGENTS.md" ] && mv "$TEMP_DIR/AGENTS.md" .claude/saz-docs/
    [ -f "$TEMP_DIR/COMMANDS.md" ] && mv "$TEMP_DIR/COMMANDS.md" .claude/saz-docs/
    [ -f "$TEMP_DIR/CHANGELOG.md" ] && mv "$TEMP_DIR/CHANGELOG.md" .claude/saz-docs/
    [ -f "$TEMP_DIR/screenshot.webp" ] && mv "$TEMP_DIR/screenshot.webp" .claude/saz-docs/
    
    # Copy .claude contents (preserving structure)
    cp -r "$TEMP_DIR/.claude/"* .claude/ 2>/dev/null
    
    # Copy install directory for reference (but not in root)
    [ -d "$TEMP_DIR/install" ] && cp -r "$TEMP_DIR/install" .claude/saz-docs/
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    echo "✅ SAZ-CCPM installed successfully!"
    echo "📚 Documentation: .claude/saz-docs/"
    echo "🎯 Next: Run '/pm:init' to initialize project management"
else
    echo "❌ Installation failed"
    rm -rf "$TEMP_DIR"
    exit 1
fi