# Dell UltraSharp U4025QW - Monitor Reference

## Overview

- **Panel**: 39.7" (40") curved IPS Black
- **Resolution**: 5120x2160 (5K2K / WUHD)
- **Refresh Rate**: 120Hz (TB4/DP), 60Hz (HDMI)
- **Color**: 98% DCI-P3, 100% sRGB, Delta E < 2
- **HDR**: VESA DisplayHDR 400
- **Curvature**: 2500R
- **Dell model code**: U4025QW

## Video & Upstream Ports

| Physical # | Port | Max Resolution | Power Delivery | USB Upstream |
|------------|------|---------------|----------------|-------------|
| 6 | Thunderbolt 4 (USB-C) upstream | 5K2K @ 120Hz | 140W EPR (90W to Mac) | Yes |
| 4 | DisplayPort 1.4 | 5K2K @ 120Hz | None | No |
| 3 | HDMI 2.1 | 5K2K @ 60Hz | None | No |
| 7 | USB-C upstream | N/A (data only) | 15W | Yes |
| 5 | Thunderbolt 4 downstream | Daisy-chain out | None | No |

> **Note**: Physical port numbers match the labels printed on the monitor's bottom panel. See [Bottom View diagram (page 16)](https://www.manualslib.com/manual/3407628/Dell-Thunderbolt-U4025qw.html?page=16) for the layout.

**Why 90W not 140W?** Apple silicon Macs cap PD negotiation at 90W even though the monitor supports 140W EPR. This is normal - Apple firmware limitation.

## DDC/CI Input Values (VCP 0x60)

These are the hex/decimal values used by m1ddc, Lunar, BetterDisplay for input switching:

| Input | Decimal | Hex | Physical Port # |
|-------|---------|-----|-----------------|
| Thunderbolt / USB-C | 27 | 0x1b | Port 6 (TB4 upstream) |
| DisplayPort | 15 | 0x0f | Port 4 |
| HDMI | 17 | 0x11 | Port 3 |

## KVM (Built-in)

- **USB upstream sources**: 2 only - TB4 (physical port 6) and USB-C upstream (physical port 7)
- **Auto-switch**: KVM can auto-switch when it detects a new upstream connection
- **Peripherals routed**: All downstream USB ports + 2.5GbE ethernet
- **DP-connected machines get NO KVM** - DP has no USB upstream capability

## Physical Port Layout (Bottom View)

Looking at the bottom of the monitor (cable routing area), labels are numbered left-to-right. Labels 13-14 are on the back panel above the bottom ports.

**Bottom edge (left to right):**

| Label | Name | Type | Notes |
|-------|------|------|-------|
| 1 | Security lock slot | Kensington | Anti-theft |
| 2 | Power connector | DC in | Dell power adapter |
| 3 | HDMI 2.1 | Video in | 5K2K @ 60Hz |
| 4 | DisplayPort 1.4 | Video in | 5K2K @ 120Hz (HBR3) |
| 5 | Thunderbolt 4 (downstream) | TB4 out | Daisy-chain to second monitor (15W, remove rubber plug) |
| 6 | Thunderbolt 4 (upstream) | TB4 in | **Primary input** -- 140W EPR (90W to Mac), video + KVM + ethernet |
| 7 | USB Type-C upstream | USB-C in | **Second KVM upstream** -- data only, USB 3.2 Gen2 (remove rubber plug) |
| 8 | USB Type-A 3.2 | Downstream | Peripherals (KVM-switched) |
| 9 | USB Type-A 3.2 | Downstream | Peripherals (KVM-switched) |
| 10 | Audio line-out | 3.5mm | Speaker output (HDMI/DP audio). NOT a headphone jack. |
| 11 | USB Type-A 3.2 | Downstream | Peripherals (KVM-switched) |
| 12 | RJ-45 Ethernet | 2.5GbE | Requires USB-C or TB4 upstream connected to host |

**Back panel (above the bottom ports):**

| Label | Name | Notes |
|-------|------|-------|
| 13 | Stand lock | M3 x 8mm screw hole to lock stand (screw not included) |
| 14 | Built-in speakers | One on each side of the back panel |

**Port Diagram References (visual):**

- [Bottom View (page 16)](https://www.manualslib.com/manual/3407628/Dell-Thunderbolt-U4025qw.html?page=16) -- shows numbered port layout with diagram
- [Bottom View labels continued (page 17)](https://www.manualslib.com/manual/3407628/Dell-Thunderbolt-U4025qw.html?page=17) -- labels 6-10 descriptions
- [Bottom View labels continued (page 18)](https://www.manualslib.com/manual/3407628/Dell-Thunderbolt-U4025qw.html?page=18) -- labels 12-14 descriptions
- [Back View (page 15)](https://www.manualslib.com/manual/3407628/Dell-Thunderbolt-U4025qw.html?page=15) -- rear panel overview (separate numbering for VESA, stand, joystick)

> **Full manual available locally**: `references/dell-u4025qw-user-guide.pdf` (107 pages). See `references/manual-page-index.md` for a page-number lookup table.

> **Tip**: When plugging in cables, flip the monitor up or use a mirror/phone camera to see the port numbers printed on the bottom panel. The numbering runs left-to-right when facing the back of the monitor. Labels 6 and 7 (the USB-C ports) have rubber plugs that must be removed before use.

## Downstream Ports (for peripherals)

| Label(s) | Port | Notes |
|----------|------|-------|
| 8, 9, 11 | 3x USB-A 3.2 Gen2 | For keyboard, mouse, webcam, etc. |
| 10 | Audio line-out | 3.5mm speaker output (not headphones) |

All downstream USB ports are routed through KVM to whichever upstream source is active.

> **Note**: The Dell spec sheet lists 5x USB-A + 1x USB-C downstream, but some ports may be on the back panel rather than the bottom edge. The bottom view diagram shows labels 8, 9, 11 as USB-A downstream in the cable routing area.

## Network

- **2.5GbE Ethernet** (RJ-45)
- Shared via active USB upstream (TB4 or USB-C port 7)
- If no USB upstream is connected, ethernet does not work
- macOS sees it as a Thunderbolt Ethernet adapter

## PBP / PIP Modes

- **PBP (Picture-by-Picture)**: Side-by-side split, each source gets half the screen
- **PIP (Picture-in-Picture)**: Small overlay window from second source
- PBP resolution: Each half is 2560x2160
- macOS may need manual scaling adjustments in PBP mode

## Color Presets & macOS Configuration

### Recommended: Display P3

For general use and photo editing on macOS, use **Display P3** -- it provides the full DCI-P3 gamut but calibrated for standard desktop viewing (D65 white point at 6500K, sRGB-like gamma ~2.2).

**Monitor OSD setup:**
1. Joystick > Menu > Color > Preset Modes > **Display P3**

**macOS setup:**
1. System Settings > Displays > select the Dell U4025QW
2. Set color profile to: **DELL U4025QW Color Profile, D6500, Display P3_V2**

### Why Not Other Presets?

| Preset | White Point | Gamma | Use Case |
|--------|-----------|-------|----------|
| **Display P3** (recommended) | D65 (6500K) | ~2.2 | General use, photo editing, development |
| **DCI-P3** | ~6300K | 2.6 | Cinema projection only -- too dark/warm for desk use |
| **Standard** | Varies | Varies | Dell default -- looks washed out compared to MacBook display |
| **sRGB** | D65 (6500K) | 2.2 | Use only if editing strictly for web/sRGB output |

### Key Facts

- Dell U4025QW covers **99% of DCI-P3 / Display P3**, factory calibrated to **Delta E < 2**
- Display P3 and DCI-P3 have **identical color primaries** (same gamut) -- only white point and gamma differ
- Apple Silicon Macs natively use Display P3 -- matching the monitor preset ensures consistency
- For print work, edit in Display P3 and convert to Adobe RGB or printer ICC profile on export

### Known Issues

- **macOS Tahoe < 26.1**: Colors via Thunderbolt could appear slightly off in Display P3 mode. Fixed in macOS Tahoe 26.1+. Workaround for older versions: connect via HDMI for accurate color.
- **Non-color-managed apps**: Wide gamut mode can make sRGB content look oversaturated. Use sRGB preset or ensure apps are color-managed.

### Sources

- [Dell Community: U4025QW MacBook Pro color calibration issues](https://www.dell.com/community/en/conversations/monitors/u4025qw-macbook-pro-color-calibration-issues/6855610d640393598d4bfe7a)
- [FM Forums: Display-P3 vs DCI-P3 for Photo Editing on Dell U4025QW](https://www.fredmiranda.com/forum/topic/1893163/0)

---

## OSD Navigation

- **Joystick**: Rear panel, bottom-left when facing the back -- press to open Menu Launcher, tilt to navigate
- **Menu Launcher icons**: On-screen ring that appears when joystick is pressed. Toggle joystick left/right to select shortcut icons:
  - **Menu** -- opens full OSD
  - **Input Source** -- choose between TB4, DP, HDMI
  - **Display Info** -- show current input/resolution info
  - **Preset Modes** -- switch color presets
  - **Brightness/Contrast** -- quick brightness adjustment
  - **Auto Brightness** -- toggle ambient light sensor
  - **Exit** -- close the Menu Launcher
- Toggle joystick **up** to open the Main Menu directly
- Toggle joystick **down** to exit
- **No physical shortcut buttons** -- all shortcuts are on-screen via the Menu Launcher

## Power Consumption

- Typical: ~45W
- Max (HDR): ~250W
- Standby: < 0.3W

## Official Dell Documentation

| Document | Description | URL |
|----------|-------------|-----|
| Manuals & Documents (AU) | User's Guide, Quick Start Guide downloads | https://www.dell.com/support/product-details/en-au/product/u4025qw-monitor/resources/manuals |
| Usage & Troubleshooting Guide | Dell KB article covering setup, OSD, KVM, firmware | https://www.dell.com/support/kbdoc/en-us/000223142/dell-ultrasharp-40-curved-u4025qw-monitor-usage-and-troubleshooting-guide |
| KVM Setup Guide | Dell's generic KVM guide (covers U4025QW) | https://www.dell.com/support/contents/en-us/article/product-support/self-support-knowledgebase/monitor-screen-video/kvm-setup-guide-dell-monitors |
| Support Articles | Firmware advisories, known issues, KB articles | https://www.dell.com/support/product-details/en-us/product/u4025qw-monitor/resources/articles |
| Drivers & Downloads | Firmware, DDPM, ICC profiles | https://www.dell.com/support/product-details/en-au/product/u4025qw-monitor/drivers |
| Product Datasheet (PDF) | Marketing specs sheet | https://www.delltechnologies.com/asset/en-us/products/electronics-and-accessories/technical-support/dell-ultrasharp-40-curved-thunderbolt-hub-monitor-u4025qw-cvaa-datasheet.pdf |
| Port Diagram - Back View | ManualsLib page 15 - rear panel overview | https://www.manualslib.com/manual/3407628/Dell-Thunderbolt-U4025qw.html?page=15 |
| Port Diagram - Bottom View | ManualsLib pages 16-18 - numbered port layout + descriptions | https://www.manualslib.com/manual/3407628/Dell-Thunderbolt-U4025qw.html?page=16 |
