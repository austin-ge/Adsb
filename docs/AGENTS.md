# Custom Agents Guide

This document explains how to use the custom agent system in HangarTrak Radar.

## Overview

HangarTrak Radar uses **custom agents** - specialized instruction files that Claude reads and follows for domain-specific work. These are different from Claude Code's built-in Task subagents.

### Two Agent Systems

| System | Location | How it works | Best for |
|--------|----------|--------------|----------|
| **Custom Agents** | `.claude/agents/*.md` | Claude reads instructions and follows them in main conversation | Domain work requiring project context |
| **Task Subagents** | Built-in to Claude Code | Spawns separate process with generic knowledge | Parallel tasks, exploration, simple operations |

## Custom Agents

### Available Agents

**Domain Agents** (for implementation work):

| Agent | Purpose | Tools |
|-------|---------|-------|
| `api-developer` | API routes, database queries, backend logic, auth | Bash, Read, Write, Edit, Glob, Grep |
| `map-developer` | Mapbox GL, aircraft rendering, GeoJSON, playback | Bash, Read, Write, Edit, Glob, Grep |
| `ui-designer` | Pages, layouts, components, Tailwind styling | Bash, Read, Write, Edit, Glob, Grep |
| `auth-developer` | Better Auth, sessions, permissions, 2FA | Bash, Read, Write, Edit, Glob, Grep |
| `db-migrator` | Prisma schema, migrations, indexes | Bash, Read, Edit, Glob, Grep |

**Supporting Agents** (for validation and maintenance):

| Agent | Purpose | Tools |
|-------|---------|-------|
| `code-reviewer` | Review for performance, accessibility, security | Read, Glob, Grep |
| `test-runner` | Validate build, lint, types before commit | Bash, Read, Grep |
| `docs-updater` | Update CHANGELOG, SPEC, CLAUDE.md | Read, Edit, Glob, Grep |
| `docker-ops` | Aggregator container management | Bash, Read, Grep |
| `api-tester` | curl-based endpoint verification | Bash, Read, Grep |
| `dependency-auditor` | Check outdated/vulnerable packages | Bash, Read, Grep |
| `git-workflow` | Branch management, PR preparation | Bash, Read, Grep |

### How to Invoke

Ask Claude to use a specific agent:

```
"Use the api-developer agent to implement the search endpoint"
"Have the code-reviewer agent check my changes"
"Use the map-developer agent to add clustering"
"Run the test-runner agent before I commit"
```

Claude reads `.claude/agents/[name].md` and follows the specialized instructions.

### Frontmatter Schema

Each agent file has YAML frontmatter:

```yaml
---
name: agent-name
description: One-line description shown in CLAUDE.md
tools: Bash, Read, Write, Edit, Glob, Grep  # Allowed tools
model: inherit  # or "haiku" for simpler tasks
skills: skill-1, skill-2  # Skills to apply (optional)
---
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Agent identifier (matches filename) |
| `description` | Yes | Brief description for documentation |
| `tools` | Yes | Comma-separated list of allowed tools |
| `model` | No | `inherit` (default) or `haiku` for simple tasks |
| `skills` | No | Skills to apply (e.g., `vercel-react-best-practices`) |

### Agent Content Structure

After frontmatter, include:

1. **Role statement** - "You are a [role] for HangarTrak Radar..."
2. **Domain section** - Key files and areas of responsibility
3. **Technical context** - Patterns, integrations, dependencies
4. **Critical rules** - Security, performance, or quality requirements
5. **Reporting format** - How to report results (tables, file:line refs)
6. **When done** - What to do after completing work

## Task Subagents

Use the Task tool for operations that benefit from parallelization or don't need project-specific context.

### When to Use Task Subagents

| Use Case | Subagent Type |
|----------|---------------|
| Explore codebase, find files | `Explore` |
| Git operations | `git-workflow` |
| Run shell commands | `Bash` |
| Research questions | `general-purpose` |
| Run multiple checks in parallel | Multiple Tasks |

### Example: Parallel Validation

```
"Run the test-runner and code-reviewer agents in parallel"
```

This spawns two Task subagents that run simultaneously.

**Note:** Task subagents do NOT read `.claude/agents/` files. They have generic knowledge only. For domain work, use custom agents in the main conversation.

## Workflow: When to Use What

### Implementation Work

Use **custom agents** in the main conversation:

```
User: "Add a new API endpoint for flight search"
Claude: [Reads .claude/agents/api-developer.md]
        [Follows security rules, patterns, file locations]
        [Implements with project-specific context]
```

### Validation Work

Use **custom agents** for thorough review:

```
User: "Review my changes for issues"
Claude: [Reads .claude/agents/code-reviewer.md]
        [Checks performance, accessibility, security]
        [Reports in table format with file:line refs]
```

### Exploration

Use **Task subagent** for speed:

```
User: "Where is authentication handled?"
Claude: [Task tool with Explore subagent]
        [Returns quickly with file locations]
```

### Pre-Commit Checklist

Recommended workflow before committing:

1. `test-runner` agent - Verify build/lint/types pass
2. `code-reviewer` agent - Check for issues
3. `docs-updater` agent - Update CHANGELOG and docs

## Creating New Agents

### Template

```markdown
---
name: my-agent
description: Brief description for CLAUDE.md
tools: Bash, Read, Write, Edit, Glob, Grep
model: inherit
skills: relevant-skill-1
---

You are a [role] for the HangarTrak Radar project at /home/austingeorge/developer/adsb.

## Your Domain

You work on [area]. Key files:

- `path/to/files` - Description
- `another/path` - Description

## Technical Context

- **Technology** - How it's used
- **Patterns** - Common patterns in this domain

## Critical Rules

1. Rule one (why it matters)
2. Rule two (why it matters)

## When Done

Report what you did with file:line references.
```

### Guidelines

1. **Be specific** - Include exact file paths, not general patterns
2. **Add guardrails** - Security rules, performance constraints
3. **Define output** - Specify reporting format
4. **Limit scope** - Each agent should have a clear domain
5. **Update CLAUDE.md** - Add new agents to the Custom Agents section

## Troubleshooting

### "Agent didn't follow my custom rules"

Ensure you asked Claude to use the agent explicitly. Generic requests won't trigger agent instructions.

### "Task subagent didn't use project context"

Task subagents don't read `.claude/agents/` files. Use custom agents for project-specific work, or include context directly in the Task prompt.

### "Agent used tools not in its allowed list"

The `tools` field in frontmatter is documentation/intent only - Claude Code doesn't enforce it automatically. It serves as guidance for the agent role.

---

**Last Updated:** January 25, 2026
