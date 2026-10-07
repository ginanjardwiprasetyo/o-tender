---
name: prompt-master
description: Generates optimized prompts for AI tools. Use when you need to write, fix, improve, or adapt a prompt for a specific AI tool (LLM, Cursor, Midjourney, image AI, video AI, coding agents, etc.). Does not activate for general coding tasks.
---

# Prompt Master (opencode-compatible)

Generate production-ready prompts for any AI tool. Invoke explicitly when you need prompt engineering help.

## Usage

```
/prompt-master <your request>
```

Examples:
- `/prompt-master Write a prompt for Cursor to refactor my auth module`
- `/prompt-master I need a Midjourney prompt for cyberpunk city at night`
- `/prompt-master Fix this prompt for GPT-4o: [paste prompt]`
- `/prompt-master Build a Claude Code prompt for REST API with Supabase`

## How It Works

1. **Detects target tool** — identifies which AI system the prompt is for
2. **Extracts intent** — task, input, output, constraints, context, audience, success criteria
3. **Asks clarifying questions** (max 3) if critical info missing
4. **Applies tool-specific framework** — optimized for each AI system
5. **Delivers clean prompt** — copyable block with strategy note

## Tool Profiles (Key Ones)

| Tool | Key Optimization |
|------|------------------|
| **Claude Code** | File scope + stop conditions + verification commands |
| **Cursor/Windsurf** | File path + function name + do-not-touch list + done-when |
| **Codex** | Goal + Context + Scope + Approval Boundaries + Done |
| **ChatGPT/GPT-5** | Lean 4-section: Goal, Context, Constraints, Done |
| **o3/o4-mini** | Short clean instructions only, no CoT scaffolding |
| **Midjourney** | Comma-separated descriptors, aspect ratio, version lock, negative prompt |
| **Gemini** | Explicit format locks, citation requirements |
| **Claude (API)** | XML structure, positive instructions, adaptive thinking |

## Quick Reference — Prompt Templates

### Claude Code / Cline / Agentic
```
Objective: [what to build]
Stack: [tech stack, versions]
Scope: [specific files/dirs to touch, what NOT to touch]
Constraints: [hard limits, style, patterns]
Stop Conditions: [exact criteria to stop]
Verification: [commands to prove it works]
Done When: [binary acceptance criteria]
```

### Cursor / Windsurf
```
File: [path]
Function: [name]
Current: [behavior]
Desired: [change]
Don't Touch: [list]
Language: [version]
Done When: [criteria]
```

### Image AI (Midjourney, DALL-E, SD)
```
[subject], [medium], [style], [lighting], [composition], [mood], [technical specs]
Negative: [what to avoid]
--ar [ratio] --v [version] --style [raw/creative]
```

### General LLM (ChatGPT, Gemini, etc.)
```
Goal: [outcome]
Context: [background]
Constraints: [must/must-not]
Output Format: [exact structure]
Done When: [success criteria]
```

## Strategy Notes

- **Every word load-bearing** — strip fluff, keep only what changes output
- **Tool-native patterns** — use each tool's expected format (XML for Claude, lean for GPT, etc.)
- **Verification over trust** — include checkable done criteria
- **Scope down** — prevent bloat with explicit don't-touch lists
- **Model-aware** — adapt for reasoning vs non-reasoning models