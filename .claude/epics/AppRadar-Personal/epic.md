---
name: AppRadar-Personal
status: backlog
created: 2025-09-10T03:57:58Z
progress: 0%
prd: .claude/prds/PRD-AppRadar-Personal.md
github: https://github.com/VladTheBad1/app-researcher/issues/1
---

# Epic: AppRadar-Personal

## Overview
Build a lightweight, zero-cost browser automation system that discovers and analyzes successful apps worth cloning. Uses Playwright MCP for web scraping 30+ data sources, local AI analysis (Ollama) or browser-automated ChatGPT/Claude, and generates actionable opportunity reports—all without any API fees.

## Architecture Decisions
- **Browser Automation Only**: No APIs, using Playwright MCP for all data collection (saves $800+/month)
- **Local-First Processing**: SQLite database, JSON caching, local file storage
- **Smart Rate Limiting**: Human-like browsing patterns (30-100 requests/hour per site)
- **Session Persistence**: Maintain logged-in states to access premium data with existing accounts
- **Modular Collectors**: Each data source as independent module for easy maintenance
- **Queue-Based Processing**: Sequential scraping with realistic delays to avoid detection

## Technical Approach
### Frontend Components
- **CLI Dashboard**: Simple terminal UI for monitoring progress
- **Report Viewer**: Markdown/HTML reports viewable in browser
- **Configuration UI**: Web-based settings page for managing sources

### Backend Services
- **Orchestrator Service**: Manages collector scheduling and rate limiting
- **Collector Modules**: 5 primary collectors (Exploding Topics, Product Hunt, Twitter, Reddit, IndieHackers)
- **Scoring Engine**: Multi-factor evaluation (buildability, demand, revenue, marketing)
- **Analysis Pipeline**: Local Ollama or browser-automated AI analysis
- **Report Generator**: Markdown reports with GitHub issue creation

### Infrastructure
- **Deployment**: Runs locally or on $5 VPS
- **Storage**: SQLite + local files (~1GB total)
- **Monitoring**: Simple health checks and error logging
- **Backup**: Daily SQLite exports

## Implementation Strategy
- Start with highest-value collectors (Product Hunt, IndieHackers)
- Test anti-detection with one source before scaling
- Build scoring after 100+ opportunities collected
- Add AI analysis as final enhancement

## Task Breakdown Preview
High-level task categories that will be created:
- [ ] Task 1: Setup Playwright MCP and browser automation foundation
- [ ] Task 2: Build Product Hunt collector (highest value data source)
- [ ] Task 3: Build IndieHackers collector (transparent revenue data)
- [ ] Task 4: Build Twitter/X collector (real-time launches)
- [ ] Task 5: Build Exploding Topics collector (trend discovery)
- [ ] Task 6: Implement scoring engine and opportunity evaluation
- [ ] Task 7: Setup AI analysis (Ollama local or browser ChatGPT)
- [ ] Task 8: Create report generator and notification system
- [ ] Task 9: Add scheduling and orchestration layer
- [ ] Task 10: Package for easy deployment (Docker optional)

## Dependencies
- **External Services**: None required (all browser-based)
- **Browser Requirements**: Chrome/Chromium for Playwright
- **Optional Services**: Existing ChatGPT/Claude subscriptions for AI
- **System Requirements**: 4GB RAM, 10GB disk space

## Success Criteria (Technical)
- Collect 50+ opportunities in first week
- Zero API costs (100% browser automation)
- <5% detection rate (no captchas/blocks)
- Process all 30 sources daily in <2 hours
- Generate actionable reports with <30 second latency

## Estimated Effort
- **Overall Timeline**: 2 weeks to MVP, 4 weeks to full system
- **Development Hours**: 30-40 hours total
- **Critical Path**: Playwright MCP setup → First collector → Scoring → Reports
- **Quick Win**: Product Hunt collector operational in 1 day

## Tasks Created
- [ ] #2 - Setup Playwright MCP and browser automation foundation (parallel: false)
- [ ] #3 - Build Product Hunt collector (parallel: true)
- [ ] #4 - Build IndieHackers collector (parallel: true)
- [ ] #5 - Build Twitter/X collector (parallel: true)
- [ ] #6 - Build Exploding Topics collector (parallel: true)
- [ ] #7 - Implement scoring engine and opportunity evaluation (parallel: false)
- [ ] #8 - Setup AI analysis (parallel: false)
- [ ] #9 - Create report generator and notification system (parallel: false)
- [ ] #10 - Add scheduling and orchestration layer (parallel: true)
- [ ] #11 - Package for easy deployment (parallel: false)

Total tasks: 10
Parallel tasks: 5
Sequential tasks: 5
Estimated total effort: 74-106 hours