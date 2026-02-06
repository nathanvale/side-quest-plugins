# Dell UltraSharp U4025QW - Monitor Reference

## Overview

- **Panel**: 39.7" (40") curved IPS Black
- **Resolution**: 5120x2160 (5K2K / WUHD)
- **Refresh Rate**: 120Hz (TB4/DP), 60Hz (HDMI)
- **Color**: 98% DCI-P3, 100% sRGB, Delta E < 2
- **HDR**: VESA DisplayHDR 400
- **Curvature**: 2500R
- **Dell model code**: U4025QW

## Ports

| # | Port | Location | Max Resolution | Power Delivery | USB Upstream |
|---|------|----------|---------------|----------------|-------------|
| 1 | Thunderbolt 4 (USB-C) | Rear left | 5K2K @ 120Hz | 140W EPR (90W to Mac) | Yes |
| 2 | DisplayPort 1.4 | Rear | 5K2K @ 120Hz | None | No |
| 3 | HDMI 2.1 | Rear | 5K2K @ 60Hz | None | No |
| 7 | USB-C upstream | Rear | N/A (data only) | 15W | Yes |

**Why 90W not 140W?** Apple silicon Macs cap PD negotiation at 90W even though the monitor supports 140W EPR. This is normal - Apple firmware limitation.

## DDC/CI Input Values (VCP 0x60)

These are the hex/decimal values used by m1ddc, Lunar, BetterDisplay for input switching:

| Input | Decimal | Hex | Notes |
|-------|---------|-----|-------|
| Thunderbolt / USB-C | 27 | 0x1b | Port 1 |
| DisplayPort | 15 | 0x0f | Port 2 |
| HDMI | 17 | 0x11 | Port 3 |

## KVM (Built-in)

- **USB upstream sources**: 2 only - TB4 (port 1) and USB-C upstream (port 7)
- **Auto-switch**: KVM can auto-switch when it detects a new upstream connection
- **Peripherals routed**: All downstream USB ports + 2.5GbE ethernet
- **DP-connected machines get NO KVM** - DP has no USB upstream capability

## Downstream Ports (for peripherals)

| Port | Type | Notes |
|------|------|-------|
| 5x USB-A 3.2 | Downstream | For keyboard, mouse, webcam, etc. |
| 1x USB-C 3.2 | Downstream | 15W charging (phone, etc.) |

All downstream ports are routed through KVM to whichever upstream source is active.

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

## OSD Navigation

- **Joystick**: Rear right side - press to open menu, tilt to navigate
- **Shortcut buttons**: 3 buttons below joystick, assignable to:
  - Input source
  - Brightness/Contrast
  - PBP/PIP toggle
  - KVM switch
  - Display Info

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
