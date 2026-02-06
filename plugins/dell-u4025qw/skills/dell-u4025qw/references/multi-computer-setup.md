# Multi-Computer Setup Guide

How to connect 2 or 3 Macs to a single Dell U4025QW and switch between them.

**Dell KVM setup guide**: https://www.dell.com/support/contents/en-us/article/product-support/self-support-knowledgebase/monitor-screen-video/kvm-setup-guide-dell-monitors

## Device Labels

This guide uses generic labels. Map them to your own machines:

| Label | Role | Typical Use |
|-------|------|-------------|
| **Mac 1** | Primary / daily driver | Gets TB4 for full power + KVM |
| **Mac 2** | Secondary machine | DP for video, headless access |
| **Mac 3** | Tertiary machine | HDMI + USB-C upstream for KVM |

---

## 2-Computer Setup (Full KVM for Both)

Both machines get KVM (keyboard/mouse/peripherals auto-switch with input).

### Wiring

| Machine | Video Cable | Video Port | USB Upstream | KVM | Peripherals |
|---------|-----------|-----------|-------------|-----|-------------|
| Mac 1 | TB4 cable | Port 1 (TB4) | Built-in via TB4 | Yes | Full access |
| Mac 2 or Mac 3 | DP or HDMI cable | Port 2 (DP) or Port 3 (HDMI) | USB-C cable to port 7 | Yes | Full access |

### What You Need

- 1x Thunderbolt 4 cable (for Mac 1)
- 1x DisplayPort or HDMI cable (for the second Mac)
- 1x USB-C cable (for port 7 upstream - gives the second Mac KVM)

### How KVM Works

When you switch video input, the KVM automatically routes all downstream USB peripherals (keyboard, mouse, webcam, etc.) and ethernet to the machine whose upstream port is active.

- **TB4 active** -> peripherals go to Mac 1
- **USB-C port 7 active** -> peripherals go to Mac 2/3

### Switching Methods

1. **Monitor OSD**: Joystick > Input Source > select input (slow, 3-4 button presses)
2. **DDC command**: `m1ddc set input 27` for TB4, `m1ddc set input 15` for DP (instant)
3. **Lunar hotkey**: Assign global hotkey per input in Lunar preferences (instant)
4. **KVM auto-switch**: Monitor can auto-detect when a new upstream connects

---

## 3-Computer Setup (2 KVM + 1 Video-Only)

The monitor only has 2 USB upstream ports (TB4 + USB-C port 7), so only 2 machines can have KVM. The third machine gets video only.

### Wiring

| Machine | Video Cable | Video Port | USB Upstream | KVM | Peripherals |
|---------|-----------|-----------|-------------|-----|-------------|
| Mac 1 (primary laptop) | TB4 cable | Port 1 (TB4) | Built-in via TB4 | Yes | Full access |
| Mac 3 (work laptop) | HDMI cable | Port 3 (HDMI) | USB-C cable to port 7 | Yes | Full access |
| Mac 2 (home server) | DP cable | Port 2 (DP) | None | No | SSH / Screen Sharing |

### Why This Arrangement?

- **Mac 1 gets TB4**: Primary machine gets the best connection (5K2K@120Hz + 90W charging + KVM + ethernet)
- **Mac 3 gets HDMI + USB-C upstream**: Work laptop gets KVM for peripherals. HDMI limits to 60Hz but that's fine for work
- **Mac 2 gets DP (video-only)**: Server/secondary machine uses DP for 120Hz video. No KVM needed because you access it via SSH or Screen Sharing

### Accessing the Video-Only Machine (Mac 2)

Since Mac 2 has no KVM, you control it through:

1. **SSH**: `ssh mac2.local` from any other machine
2. **Screen Sharing**: Built-in macOS VNC (`vnc://mac2.local`)
3. **Apple Remote Desktop**: For full remote management
4. **Apple Universal Control**: If all 3 Macs are on same iCloud + network, drag your cursor between them

### Peripheral Solutions for 3 Macs

**Keyboard (Bluetooth multi-device)**:
- Keychron keyboards support 3 BT profiles (Fn+1/2/3 to switch)
- Logitech MX Keys supports 3 devices (Easy-Switch buttons)
- Apple Magic Keyboard: pair with one Mac, use Universal Control for others

**Mouse/Trackpad**:
- USB trackpad plugged into monitor's downstream USB-A port: KVM routes to active upstream (covers Mac 1 + Mac 3)
- For Mac 2 (video-only): use BT mouse with multi-device pairing, or Apple Universal Control
- Logitech MX Master: 3-device switching via bottom button

**Webcam**:
- USB webcam in monitor downstream port: KVM routes to active upstream
- Only available to Mac 1 and Mac 3 (the KVM machines)

---

## Input Switching Quick Reference

| Target | DDC Value | m1ddc Command | Lunar Command |
|--------|----------|---------------|---------------|
| Mac 1 (TB4) | 27 | `m1ddc set input 27` | `lunar displays dell input 27` |
| Mac 2 (DP) | 15 | `m1ddc set input 15` | `lunar displays dell input 15` |
| Mac 3 (HDMI) | 17 | `m1ddc set input 17` | `lunar displays dell input 17` |

> **Lunar CLI note**: Use `lunar displays` to list your monitors and find the display name. The `lunar displays <name> input <value>` form targets a specific monitor (required for multi-monitor setups). Lunar supports fuzzy matching on the display name. Numeric DDC values work for Dell monitors - the `lgHdmi1` symbolic names are LG-specific.

**Critical DDC limitation**: DDC commands can only be sent from the machine currently displayed on screen. A background machine cannot send DDC commands to the monitor.

This means you can switch AWAY from the active machine, but you cannot switch TO a background machine from that machine itself.

**Workarounds** (in order of convenience):

1. **Monitor OSD button shortcut**: Assign "Input Source" to one of the 3 shortcut buttons below the joystick for quick physical switching
2. **SSH method**: SSH into the currently-displayed machine and run `m1ddc set input <value>` remotely to switch away from it
3. **KVM auto-switch**: Enable KVM auto-detect in the OSD so the monitor switches when a new upstream connection is detected
4. **Hotkey on active machine**: Set up a "switch away" hotkey on each machine so you can press it before walking away

---

## Cable Recommendations

| Cable | Use | Notes |
|-------|-----|-------|
| Thunderbolt 4 (0.8m-2m) | Mac 1 to TB4 port | Must be TB4 rated, not just USB-C |
| DisplayPort 1.4 (HBR3) | Mac 2 to DP port | Needs HBR3 for 5K2K@120Hz |
| HDMI 2.1 (Ultra High Speed) | Mac 3 to HDMI port | HDMI 2.0 cable works but limits to 4K@60Hz |
| USB-C (data) | Mac 3 to port 7 upstream | Any USB-C cable works (data only, 15W) |
