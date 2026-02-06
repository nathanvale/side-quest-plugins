# Research Plugin Setup

This document covers deployment of the AI Trends Digest automated email system.

## Overview

The research plugin includes two skills:
1. **last-30-days** - Interactive topic research (no setup required)
2. **ai-trends-digest** - Automated weekly email digest (requires setup)

---

## Environment Configuration

Create the config file at `~/.config/research/.env`:

```bash
mkdir -p ~/.config/research
cat > ~/.config/research/.env << 'ENVEOF'
# AI Trends Digest Configuration

# Required for email delivery (https://resend.com)
RESEND_API_KEY=re_xxxxx
DIGEST_RECIPIENT=your-email@example.com

# Optional - for enhanced research with engagement metrics
OPENAI_API_KEY=sk-...    # Reddit via OpenAI web_search
XAI_API_KEY=xai-...      # X/Twitter via xAI x_search
ENVEOF

chmod 600 ~/.config/research/.env
```

### Getting API Keys

**Resend** (required for email):
1. Sign up at https://resend.com
2. Create an API key at https://resend.com/api-keys
3. Free tier: 3,000 emails/month

**OpenAI** (optional, for Reddit):
1. Sign up at https://platform.openai.com
2. Create API key at https://platform.openai.com/api-keys

**xAI** (optional, for X/Twitter):
1. Sign up at https://x.ai
2. Create API key in console

---

## Script Installation

Install dependencies for the digest script:

```bash
cd ~/code/side-quest-plugins/scripts/ai-trends-digest
bun install
```

Test the script manually:

```bash
# Dry run (no email sent)
bun run send-digest.ts --dry-run

# Send to specific recipient
bun run send-digest.ts --recipient your-email@example.com

# Send to default recipient
bun run send-digest.ts
```

---

## launchd Setup (Mac Mini Automation)

The digest runs automatically every Monday at 7:00 AM local time.

### Install the Launch Agent

**Important:** The plist contains hardcoded `/Users/nathanvale/` paths. If you're not nathanvale, edit the plist to replace all occurrences with your home directory before copying:

```bash
# Create logs directory
mkdir -p ~/Library/Logs/ai-trends-digest

# Copy plist and customize paths
cp ~/code/side-quest-plugins/launchd/com.sidequest.ai-trends-digest.plist ~/Library/LaunchAgents/
sed -i '' "s|/Users/nathanvale|$HOME|g" ~/Library/LaunchAgents/com.sidequest.ai-trends-digest.plist

# Load the agent
launchctl load ~/Library/LaunchAgents/com.sidequest.ai-trends-digest.plist
```

### Verify Installation

```bash
# Check if loaded
launchctl list | grep ai-trends-digest

# Check job status
launchctl print gui/$(id -u)/com.sidequest.ai-trends-digest
```

### Manual Trigger

```bash
# Run immediately (doesn't wait for schedule)
launchctl start com.sidequest.ai-trends-digest

# Watch logs
tail -f ~/Library/Logs/ai-trends-digest/output.log
```

### Log Rotation

launchd does not rotate logs automatically. Periodically clean up log files to prevent unbounded growth:

```bash
# Truncate logs
> ~/Library/Logs/ai-trends-digest/output.log
> ~/Library/Logs/ai-trends-digest/error.log
```

### Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/com.sidequest.ai-trends-digest.plist
rm ~/Library/LaunchAgents/com.sidequest.ai-trends-digest.plist
```

---

## Troubleshooting

### Email Not Sending

1. Check RESEND_API_KEY is set correctly:
   ```bash
   grep RESEND ~/.config/research/.env
   ```

2. Verify Resend domain is configured:
   - Go to https://resend.com/domains
   - The "from" address uses `digest@sidequest.dev`
   - Either verify this domain or update `send-digest.ts`

3. Check logs:
   ```bash
   cat ~/Library/Logs/ai-trends-digest/error.log
   ```

### launchd Not Running

1. Check if agent is loaded:
   ```bash
   launchctl list | grep ai-trends-digest
   ```

2. Check for load errors:
   ```bash
   launchctl print gui/$(id -u)/com.sidequest.ai-trends-digest 2>&1
   ```

3. Verify Bun path is correct:
   ```bash
   which bun
   # Should match path in plist: /Users/nathanvale/.bun/bin/bun
   ```

### Research Failing

1. Test research directly:
   ```bash
   bunx --bun @side-quest/last-30-days "AI agentic workflows" --emit=json
   ```

2. Check API keys (optional but recommended):
   ```bash
   grep -E "OPENAI|XAI" ~/.config/research/.env
   ```

---

## Customizing Topics

Edit `scripts/ai-trends-digest/send-digest.ts` to change research topics:

```typescript
const DEFAULT_TOPICS = [
  'AI agentic workflows 2026 trends',
  'Claude Code MCP tools best practices',
  'AI coding assistants productivity',
];
```

---

## Schedule Options

The plist uses `StartCalendarInterval` for scheduling. To change:

**Different day** (1=Mon, 7=Sun):
```xml
<key>Weekday</key>
<integer>5</integer>  <!-- Friday -->
```

**Different time**:
```xml
<key>Hour</key>
<integer>9</integer>  <!-- 9 AM -->
<key>Minute</key>
<integer>30</integer> <!-- 9:30 AM -->
```

**Daily instead of weekly**:
```xml
<key>StartCalendarInterval</key>
<dict>
  <key>Hour</key>
  <integer>7</integer>
  <key>Minute</key>
  <integer>0</integer>
</dict>
```

After editing, reload the agent:
```bash
launchctl unload ~/Library/LaunchAgents/com.sidequest.ai-trends-digest.plist
launchctl load ~/Library/LaunchAgents/com.sidequest.ai-trends-digest.plist
```
