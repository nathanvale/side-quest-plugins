# Troubleshooting

Common issues with the Dell U4025QW on macOS, with causes and fixes.

**Official Dell troubleshooting guide**: https://www.dell.com/support/kbdoc/en-us/000223142/dell-ultrasharp-40-curved-u4025qw-monitor-usage-and-troubleshooting-guide

## Quick Reference Table

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| TB4 random disconnects | macOS sleep/wake bug | Firmware M3T105+, disable standby with pmset |
| Screen flashing/flickering | Bad DP cable or firmware | Try different DP cable, lower to 60Hz, update firmware |
| Volume keys grayed out | No DDC audio routing | Install BetterDisplay or MonitorControl |
| HiDPI text blurry | Wrong scaling mode | BetterDisplay: virtual 3840x1620 (2x rendering) |
| 90W charging not 140W | Apple silicon PD limit | Normal - Apple caps at 90W regardless of EPR support |
| Firmware updater broken | Dell DDPM + Tahoe | Use Windows machine or VM for firmware updates |
| KVM not switching | Wrong USB upstream config | Verify USB-C cable is in port 7 (not a downstream port) |
| Ethernet not working | No active USB upstream | TB4 or USB-C port 7 must be connected |
| PBP resolution wrong | macOS scaling confusion | Set each PBP partition scaling manually |
| Color looks off | Wrong ICC profile | Download Dell ICC from support site |
| m1ddc not responding | DDC after sleep issue | Wait 2-3 seconds after wake, or power-cycle monitor |
| 120Hz not available | Wrong cable or HDMI | Use TB4 or DP for 120Hz. HDMI caps at 60Hz |

---

## Detailed Troubleshooting

### TB4 Random Disconnects

**Symptoms**: Monitor goes black for 1-2 seconds then reconnects. May happen during sleep/wake cycles or randomly during use.

**Causes**:
- macOS aggressive power management (standby and deep sleep)
- Firmware bugs (pre-M3T105)
- Bad or too-long TB4 cable

**Fixes**:
1. Update monitor firmware to M3T105 or later (see firmware.md)
2. Disable aggressive sleep/standby:
   ```bash
   sudo pmset -a standby 0
   sudo pmset -a autopoweroff 0
   ```
3. Try a shorter/different TB4 cable (max 2m for passive)
4. Reset monitor to factory defaults: OSD > Menu > Others > Reset

---

### Screen Flickering

**Symptoms**: Screen flashes, flickers, or has horizontal tearing. More common at 120Hz.

**Causes**:
- DisplayPort cable not rated for HBR3
- Firmware M3T102 (known bad version)
- Loose cable connection

**Fixes**:
1. Avoid firmware M3T102 (known to cause flickering)
2. Try a certified DP 1.4 HBR3 cable (VESA certified preferred)
3. Temporarily lower to 60Hz: System Settings > Displays > Refresh Rate
4. Switch from DP to TB4 if possible (TB4 has better signal integrity)

---

### macOS Volume Keys Grayed Out

**Symptoms**: F10 (mute), F11 (volume down), F12 (volume up) are grayed out or do nothing.

**Cause**: macOS doesn't natively support DDC audio control for external monitors.

**Fix**: Install one of these (they route volume keys to DDC commands):
- **MonitorControl** (free, open source) - simplest fix
- **BetterDisplay** (has volume control built in)

---

### HiDPI / Blurry Text

**Symptoms**: Text looks fuzzy or too large/small. macOS treats the 5K2K panel as non-Retina.

**Cause**: macOS doesn't automatically enable HiDPI for the 5120x2160 resolution.

**Fix (Preferred - BetterDisplay Pro flexible scaling)**:
1. Install **BetterDisplay** (Pro required for flexible scaling)
2. Settings > Displays > select U4025QW
3. Enable "Edit the default system configuration of this display model"
4. Enable "Enable flexible scaling"
5. Apply > admin password > **reboot**
6. Use resolution slider to target **3840x1620 HiDPI**

**Fix (Fallback - virtual screen mirroring)**:
1. Install **BetterDisplay**
2. Create virtual display at **3840x1620**
3. Mirror virtual display to the real U4025QW
4. Caveat: DRM content (Netflix, etc.) won't work with virtual displays

**M4/M4 Pro users**: 3840x1620 HiDPI may only be available at 120Hz or with VRR enabled due to an Apple hardware limitation. See macos-software.md for details and workarounds.

**Why 3840x1620?** At this virtual resolution, macOS renders at 2x DPI (each virtual pixel = 1.33 physical pixels). This gives sharp text with more usable screen space than true 2560x1080 (which would be exact 2x of native but wastes the panel).

---

### KVM Not Switching Peripherals

**Symptoms**: Video input changes but keyboard/mouse stay on the previous machine.

**Causes**:
- USB-C cable plugged into wrong port (downstream instead of upstream port 7)
- KVM disabled in monitor OSD
- Third machine on DP (no USB upstream possible via DP)

**Fixes**:
1. Verify cable is in **port 7** (USB-C upstream), not a downstream USB-C port
2. Check OSD: Menu > KVM > USB-C Charging > make sure upstream is configured
3. DP-connected machines CANNOT have KVM - they need a separate USB-C upstream cable to port 7, but that port is shared. Only 2 machines get KVM.

---

### Ethernet Not Working

**Symptoms**: No network connection through monitor's ethernet port.

**Cause**: Ethernet requires an active USB upstream connection (TB4 or USB-C port 7).

**Fix**:
1. Ensure TB4 or USB-C upstream cable is connected
2. Check System Settings > Network - should show "Thunderbolt Bridge" or similar adapter
3. If missing, try unplugging and replugging the TB4/USB-C cable
4. Ethernet follows KVM - it goes to whichever upstream is currently active

---

### Firmware Update Fails on macOS

**Symptoms**: Dell DDPM shows "unable to update" or "The selected firmware is not for this monitor" error.

**Cause**: Dell's firmware updater was broken on macOS Tahoe 26.0-26.1 due to an Apple libusb API change. Fixed in Tahoe 26.2+.

**Fix**:
1. **Tahoe 26.2+**: Use the .pkg firmware installer from Dell (download from dell.com/support, search U4025QW). Works directly.
2. **Tahoe 26.0-26.1**: Use a **Windows machine** or upgrade macOS to 26.2+
3. **Sequoia 15.x**: DDPM or .pkg installer generally works
4. See firmware.md for detailed update procedure and pre/post-update checklists

---

### DDC Commands Not Working After Sleep

**Symptoms**: `m1ddc set luminance 70` returns an error or does nothing after waking the Mac.

**Cause**: DDC/CI takes a few seconds to re-initialize after monitor wakes from standby.

**Fix**:
1. Wait 2-3 seconds after wake before sending DDC commands
2. Use the wait script:
   ```bash
   for i in $(seq 1 10); do
     m1ddc get luminance > /dev/null 2>&1 && break
     sleep 1
   done
   ```
3. Update firmware to M3T105+ (improves DDC wake reliability)
4. Last resort: power-cycle the monitor (unplug power, wait 10s, replug)

---

### 120Hz Not Available

**Symptoms**: System Settings > Displays only shows 60Hz option.

**Causes**:
- Using HDMI (capped at 60Hz for 5K2K)
- DP cable not rated for HBR3
- macOS defaulting to lower refresh rate

**Fix**:
1. **HDMI**: 60Hz is the maximum for 5K2K over HDMI 2.1. Switch to TB4 or DP for 120Hz.
2. **DP**: Use a VESA-certified DP 1.4 HBR3 cable. Cheap cables may not support full bandwidth.
3. **TB4**: Should auto-negotiate 120Hz. If not, try: System Settings > Displays > hold Option key and click "Scaled" to see all resolutions.

---

### Color Profile Issues

**Symptoms**: Colors look washed out, too warm, or don't match other displays.

**Fix**:
1. Download the Dell ICC profile from dell.com/support (search U4025QW > Drivers & Downloads)
2. Install: System Settings > Displays > Color Profile > Other > select the .icc file
3. Or use the built-in profiles: "Dell U4025QW" should appear if the display is properly detected
4. For color-critical work, calibrate with a hardware colorimeter (i1Display, SpyderX)
