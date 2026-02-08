---
name: ai-trends-digest
description: >
  Send a weekly AI trends email digest. Researches trending topics and sends
  a formatted email via Resend API.
argument-hint: "[--dry-run] [--recipient email]"
context: fork
agent: general-purpose
disable-model-invocation: true
allowed-tools: Bash, Read, Write, AskUserQuestion, WebSearch
---

# ai-trends-digest: Weekly AI Trends Email Digest

Generate and send a weekly email digest of AI trends researched from Reddit, X, and the web.

## Usage

```
/ai-trends-digest                    # Send to default recipient
/ai-trends-digest --dry-run          # Preview without sending
/ai-trends-digest --recipient email  # Override recipient
```

## Environment Setup

The digest requires environment variables configured at `~/.config/research/.env`:

```bash
# Required for email delivery
RESEND_API_KEY=re_xxxxx
DIGEST_RECIPIENT=nathan@example.com

# Optional (for enhanced research)
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
```

### First-Time Setup

```bash
mkdir -p ~/.config/research
cat > ~/.config/research/.env << 'ENVEOF'
# AI Trends Digest Configuration

# Required for email
RESEND_API_KEY=
DIGEST_RECIPIENT=

# Optional (existing from last-30-days)
OPENAI_API_KEY=
XAI_API_KEY=
ENVEOF

chmod 600 ~/.config/research/.env
echo "Config created. Add your RESEND_API_KEY and DIGEST_RECIPIENT."
```

---

## Execution

### Step 1: Parse Arguments

Extract flags from `$ARGUMENTS`:

- `--dry-run` - Preview email content without sending
- `--recipient <email>` - Override the default recipient

Store:
- `DRY_RUN = true/false`
- `RECIPIENT = <email from flag or "default">`

### Step 2: Check Environment

```bash
if [ -f ~/.config/research/.env ]; then
  source ~/.config/research/.env
  echo "Environment loaded"
  [ -n "$RESEND_API_KEY" ] && echo "✓ RESEND_API_KEY configured" || echo "✗ RESEND_API_KEY missing"
  [ -n "$DIGEST_RECIPIENT" ] && echo "✓ DIGEST_RECIPIENT configured" || echo "✗ DIGEST_RECIPIENT missing"
else
  echo "No config file found at ~/.config/research/.env"
  echo "Run the first-time setup above."
fi
```

**If RESEND_API_KEY is missing and not --dry-run, stop and show setup instructions.**

### Step 3: Run the Digest Script

The script lives at the project root (not in the plugin):

```bash
cd ~/code/side-quest-plugins/scripts/ai-trends-digest

# Install dependencies if needed
[ -d node_modules ] || bun install

# Run the script
if [ "$DRY_RUN" = "true" ]; then
  bun run send-digest.ts --dry-run
elif [ "$RECIPIENT" != "default" ]; then
  bun run send-digest.ts --recipient "$RECIPIENT"
else
  bun run send-digest.ts
fi
```

### Step 4: Report Results

**On Success:**
```
✓ AI Trends Digest sent successfully!
  Recipient: {email}
  Topics: AI agentic workflows, Claude Code MCP tools, AI coding assistants
  Sources: {n} Reddit threads, {n} X posts, {n} web pages
```

**On Dry Run:**
```
--- DRY RUN ---
Would send to: {email}
Subject: AI Trends Digest - Week of {date}

[Preview of email content]

To send for real, run without --dry-run
```

**On Error:**
```
✗ Failed to send digest
  Error: {error message}

Troubleshooting:
1. Check RESEND_API_KEY is valid at ~/.config/research/.env
2. Verify recipient email is correct
3. Check logs at ~/Library/Logs/ai-trends-digest/
```

---

## Automated Scheduling

This skill is designed to run automatically via launchd. See SETUP.md for:
- launchd plist installation
- Mac Mini deployment
- Log monitoring

To manually trigger what the scheduler runs:
```bash
cd ~/code/side-quest-plugins/scripts/ai-trends-digest && bun run send-digest.ts
```

---

## Research Topics

The digest researches these topics (configurable in send-digest.ts):

1. **AI agentic workflows 2026 trends** - Latest developments in AI agents
2. **Claude Code MCP tools best practices** - Model Context Protocol insights
3. **AI coding assistants productivity** - Developer productivity with AI

Each topic uses the `@side-quest/last-30-days` package for research.
