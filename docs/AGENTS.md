# Claude Workflow Guide

This document explains the three-layer system for working with Claude on HangarTrak Radar.

## Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SKILLS (Capabilities)                                       │
│  ~/.claude/skills/                                           │
│  • agent-browser - browser automation                        │
│  • vercel-react-best-practices - React/Next.js patterns     │
│  • web-design-guidelines - accessibility & UX                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  REVIEW AGENTS (Project-Specific Validation)                 │
│  .claude/agents/*.md                                         │
│  • Run in main context (uses skills, knows project rules)   │
│  • Worth the context cost for quality enforcement            │
│  • code-reviewer, browser-tester, test-runner, etc.         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  TASK SUBAGENTS (Generic Implementation Workers)             │
│  Built-in to Claude Code                                     │
│  • Run in subprocess (saves main context)                   │
│  • Generic knowledge, no project-specific rules             │
│  • api-developer, ui-designer, Explore, Bash, etc.          │
└─────────────────────────────────────────────────────────────┘
```

## Why This Architecture?

**Context is expensive.** Every file read, every code block, every conversation turn uses context. When you run out, Claude loses track of earlier information.

**The solution:**
- **Implementation** (bulky, lots of file I/O) → Run in Task subagents (separate context)
- **Review** (needs project rules) → Run in main context with custom agents (worth it)
- **Skills** (specialized knowledge) → Loaded on demand by agents

## Workflow

### Standard Implementation → Review Flow

```
You: "Add a flight search endpoint"
         │
         ▼
┌─────────────────────────────────┐
│  Task Subagent: api-developer   │  ← Saves your context
│  • Explores codebase            │
│  • Writes implementation        │
│  • Returns summary              │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Review Agent: code-reviewer    │  ← Uses main context (worth it)
│  • Reads your project rules     │
│  • Uses skills for standards    │
│  • Reports issues               │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Review Agent: browser-tester   │  ← Uses agent-browser skill
│  • Opens pages in real browser  │
│  • Takes screenshots            │
│  • Validates interactions       │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Review Agent: test-runner      │
│  • Runs build, lint, types      │
│  • Reports failures             │
└─────────────────────────────────┘
         │
         ▼
       Commit
```

## Skills

Skills are installed capabilities that provide specialized knowledge or tools.

| Skill | Location | Provides |
|-------|----------|----------|
| `agent-browser` | `~/.claude/skills/agent-browser` | Browser automation CLI |
| `vercel-react-best-practices` | `~/.claude/skills/vercel-react-best-practices` | React/Next.js performance patterns |
| `web-design-guidelines` | `~/.claude/skills/web-design-guidelines` | Accessibility & UX standards |

**Direct invocation:** Use `/skill-name` for one-off checks:
```
/web-design-guidelines    # Audit UI component
/vercel-react-best-practices  # Review React code
```

**Agent usage:** Skills are referenced in agent frontmatter:
```yaml
skills: vercel-react-best-practices, web-design-guidelines
```

## Review Agents

Review agents run in the main conversation with full project context. They're defined in `.claude/agents/*.md`.

| Agent | Purpose | Skills Used |
|-------|---------|-------------|
| `code-reviewer` | Performance, accessibility, security review | `vercel-react-best-practices`, `web-design-guidelines` |
| `browser-tester` | Visual testing, interactions, console errors | `agent-browser` |
| `test-runner` | Build, lint, type validation | — |
| `docs-updater` | Update CHANGELOG, SPEC, CLAUDE.md | — |
| `api-tester` | curl-based endpoint verification | — |
| `dependency-auditor` | Check outdated/vulnerable packages | — |

### Agent File Structure

```yaml
---
name: agent-name
description: One-line description
tools: Bash, Read, Glob, Grep
skills: skill-1, skill-2
---

You are a [role] for HangarTrak Radar.

## What to Check
- Item 1
- Item 2

## Reporting Format
| Column | Column |
|--------|--------|

## Rules
1. Do NOT fix issues, just report
2. Always close browser when done
```

## Task Subagents

Task subagents are built into Claude Code. They run in separate processes with their own context, saving your main conversation context.

| Subagent | Use For |
|----------|---------|
| `api-developer` | API routes, backend logic, database queries |
| `ui-designer` | Pages, components, Tailwind styling |
| `map-developer` | Mapbox GL, aircraft rendering, GeoJSON |
| `auth-developer` | Better Auth, sessions, permissions |
| `db-migrator` | Prisma schema, migrations |
| `Explore` | Finding files, understanding codebase |
| `Bash` | Shell commands, git operations |

**Invocation:** Just describe what you need. Claude automatically picks the right subagent:
```
"Add an API endpoint for flight search"  → api-developer subagent
"Find where auth is configured"          → Explore subagent
"Build a new settings page"              → ui-designer subagent
```

## Pre-Commit Checklist

Run these review agents before committing:

1. **test-runner** — Build, lint, types must pass
2. **code-reviewer** — Performance, accessibility, security
3. **browser-tester** — Visual validation (if UI changed)
4. **docs-updater** — Update CHANGELOG.md

## When to Use What

| Task Type | Use | Why |
|-----------|-----|-----|
| Implement new feature | Task subagent | Saves context |
| Fix a bug | Task subagent | Saves context |
| Review code quality | Review agent | Needs project rules |
| Test in browser | Review agent | Uses agent-browser skill |
| Validate build | Review agent | Quick, needs project config |
| Explore codebase | Task subagent (Explore) | Saves context |
| Update docs | Review agent | Needs to know what changed |

## Creating New Review Agents

1. Create `.claude/agents/my-agent.md`
2. Add frontmatter (name, description, tools, skills)
3. Write instructions (role, what to check, reporting format, rules)
4. Update CLAUDE.md to document it

**Template:**
```markdown
---
name: my-agent
description: Brief description
tools: Bash, Read, Glob, Grep
skills: relevant-skill
---

You are a [role] for HangarTrak Radar at /Users/austingeorge/Developer/Adsb.

## What to Check
- Check item 1
- Check item 2

## Reporting Format
Report as a table with columns: Severity, File, Issue, Fix

## Rules
1. Do NOT fix issues, just report
2. Rule 2
```

---

**Last Updated:** January 25, 2026
