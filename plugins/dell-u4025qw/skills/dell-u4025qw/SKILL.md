---
name: dell-u4025qw
description: >
  Knowledge bank for the Dell UltraSharp U4025QW 40" curved Thunderbolt hub monitor.
  Multi-computer switching, macOS software control, firmware, troubleshooting, and DDC automation.
  Triggers on: dell monitor, u4025qw, kvm switching, monitor input, ddc, m1ddc, thunderbolt monitor,
  ultrawide setup, multi-mac monitor, monitor firmware, BetterDisplay, Lunar, MonitorControl.
argument-hint: "[question about your U4025QW]"
allowed-tools: Bash, Read, Write, Glob, Grep, WebSearch, AskUserQuestion
hooks:
  PreToolUse:
    - matcher: "Read"
      hooks:
        - type: command
          command: "bun run ${CLAUDE_PLUGIN_ROOT}/scripts/refresh-cache.ts"
          timeout: 120
          once: true
---

# Dell U4025QW Knowledge Bank

Expert guidance for the Dell UltraSharp U4025QW 40" curved 5K2K Thunderbolt hub monitor. Covers multi-computer switching (up to 3 Macs), macOS software control, DDC automation, firmware, and troubleshooting.

## Step 1: Check Community Intelligence

Community knowledge is auto-refreshed every 30 days by a plugin hook.

Read [community-intel.md](cache/community-intel.md) for recent findings before answering.

If the cache appears empty or outdated, manually refresh:

```bash
bunx --bun @side-quest/last-30-days "Dell U4025QW firmware update issues" --emit=compact --quick 2>&1
```

## Step 2: Classify the Question

Parse the user's question into one or more categories:

| Category | Keywords / Signals | Reference File |
|----------|-------------------|----------------|
| **Setup / Wiring** | connect, setup, cable, port, 2 macs, 3 macs | [multi-computer-setup.md](references/multi-computer-setup.md) |
| **Input Switching** | switch input, KVM, toggle, change source | [multi-computer-setup.md](references/multi-computer-setup.md) + [ddc-automation.md](references/ddc-automation.md) |
| **Software** | BetterDisplay, Lunar, MonitorControl, DDPM, HiDPI | [macos-software.md](references/macos-software.md) |
| **DDC Automation** | m1ddc, Karabiner, hotkey, shortcut, script | [ddc-automation.md](references/ddc-automation.md) |
| **Troubleshooting** | not working, flickering, disconnect, black screen | [troubleshooting.md](references/troubleshooting.md) |
| **Firmware** | firmware, update, version, M3T | [firmware.md](references/firmware.md) |
| **Specs / Ports** | resolution, refresh, port, spec, what is | [monitor-reference.md](references/monitor-reference.md) |
| **Brightness / Volume** | brightness, contrast, volume, mute, media keys | [ddc-automation.md](references/ddc-automation.md) + [macos-software.md](references/macos-software.md) |

## Step 3: Read Reference Files

Read the relevant reference files based on the classification. Always read at minimum:
- The primary reference file for the category
- [community-intel.md](cache/community-intel.md) (for recent community findings)

For multi-category questions, read all relevant files.

## Step 4: Synthesize Answer

### For Setup Questions

1. Ask how many Macs they want to connect (2 or 3)
2. Walk through wiring step-by-step using the generic labels (Mac 1, Mac 2, Mac 3)
3. Show the ports table for their configuration
4. Explain KVM limitations (only 2 USB upstreams)
5. Recommend cables
6. Explain that they can remap Mac 1/2/3 to their own machines

### For Software Questions

1. Recommend the right tool for their use case
2. Provide installation and configuration steps
3. Include CLI commands where applicable
4. Note compatibility with their macOS version if mentioned

### For DDC Automation Questions

1. Provide the exact m1ddc commands
2. If they mention Karabiner or Hyper key, provide the JSON configuration
3. If they mention Lunar, provide the Lunar hotkey setup
4. Always mention the "active input only" DDC limitation
5. Suggest workarounds for the limitation

### For Troubleshooting Questions

1. Match symptoms to the troubleshooting table
2. Provide the fix steps in order of likelihood
3. If firmware is relevant, mention the current recommended version
4. Check community-intel.md for any recently reported similar issues

### For Firmware Questions

1. State the current recommended firmware version
2. Provide the appropriate update method for their OS
3. Warn about M3T102 (known bad)
4. Include pre-update and post-update checklists

### For Specs / Ports Questions

1. Answer directly from the monitor reference
2. Include relevant tables
3. Note macOS-specific behavior where applicable

## Device Naming Convention

Throughout all answers, use generic labels:

| Label | Role | Port |
|-------|------|------|
| **Mac 1** | Primary / daily driver | TB4 (port 1) |
| **Mac 2** | Secondary | DP (port 2) |
| **Mac 3** | Tertiary | HDMI (port 3) + USB-C (port 7) |

When answering setup questions, explain this convention and tell the user they can remap these labels to match their own machines.

## Response Guidelines

- **Always cite the reference file** you're drawing from
- **Provide exact commands** - users should be able to copy/paste
- **Warn about limitations** - especially the DDC active-input limitation
- **Version-aware** - note macOS Sequoia vs Tahoe differences when relevant
- **Include community intel** - if cache/community-intel.md has relevant recent findings, mention them
- **Be direct** - answer the question first, then provide context
- **Tables for comparisons** - use tables when comparing options or listing ports/specs

## Examples

### Example 1: Setup Question

```text
User: I want to connect two Macs to this monitor

Skill: [Reads multi-computer-setup.md + monitor-reference.md]

Great - 2-computer setup with full KVM for both machines.

**Wiring:**

| Machine | Cable | Port | KVM |
|---------|-------|------|-----|
| Mac 1 | TB4 cable | Port 1 (TB4) | Yes - built-in |
| Mac 2 | DP cable + USB-C cable | Port 2 (DP) + Port 7 (USB-C upstream) | Yes - via port 7 |

Mac 1 gets Thunderbolt 4 - this gives you 5K2K@120Hz,
90W charging, and KVM all through one cable.

Mac 2 needs two cables:
1. DP for video (5K2K@120Hz)
2. USB-C to port 7 for KVM (keyboard/mouse/ethernet switching)

When you switch inputs, your keyboard, mouse, and ethernet
automatically follow.

**Cables needed:**
- 1x Thunderbolt 4 cable (up to 2m passive)
- 1x DisplayPort 1.4 HBR3 cable
- 1x USB-C data cable (any will work for port 7)
```

### Example 2: DDC Automation

```text
User: How do I switch inputs with a keyboard shortcut?

Skill: [Reads ddc-automation.md]

Two main approaches:

**Option 1: m1ddc + Karabiner (if you use Hyper key)**

Install m1ddc:
brew install m1ddc

Add to your Karabiner config:
[provides Hyper+1/2/3 JSON rules]

**Option 2: Lunar hotkeys (simpler, no Karabiner)**

1. Install Lunar (free tier supports this)
2. Lunar > Preferences > Hotkeys > Input Source
3. Assign hotkeys for each input value

**Important**: DDC commands only work from the machine currently
displayed. You press the hotkey on the machine you're switching
AWAY from, not the one you're switching to.
```

### Example 3: Troubleshooting

```text
User: My monitor keeps disconnecting when my Mac wakes from sleep

Skill: [Reads troubleshooting.md + firmware.md + community-intel.md]

This is the most common U4025QW issue - TB4 disconnect during
sleep/wake cycles.

**Fixes (in order of effectiveness):**

1. Update firmware to M3T105 (latest stable - fixes wake issues)
   - Check current: OSD > Menu > Others > Display Info
   - Update via Windows machine or Dell DDPM (Sequoia only)

2. Disable aggressive sleep:
   sudo pmset -a standby 0

3. Try a different TB4 cable (max 2m for passive)

4. Factory reset the monitor OSD:
   Menu > Others > Reset

[If community-intel.md has recent reports, include them]
```
