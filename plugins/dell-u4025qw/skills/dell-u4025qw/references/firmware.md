# Firmware

Firmware history, update procedures, and known issues for the Dell U4025QW.

**Dell firmware downloads**: https://www.dell.com/support/product-details/en-au/product/u4025qw-monitor/drivers

## Firmware History

| Version | Date | Key Changes | Recommendation |
|---------|------|-------------|----------------|
| M3T105 | Oct 2025 | OSD auto-switch control, MacBook reboot fix, KVM stability, improved updater | **Install - latest stable** |
| M3T104 | Aug 2025 | Minor stability fixes, PBP improvements | Good |
| M3T103 | Jun 2025 | PBP mode improvements, USB hub stability | Good |
| M3T102 | Apr 2025 | Various fixes | **AVOID - causes flickering** |
| M3T101 | Feb 2025 | Initial release firmware | Outdated |

### Version Notes

**M3T105 (Recommended)** - [Official Dell release notes](https://www.dell.com/support/home/en-us/drivers/driversdetails?driverid=r7c3k):
1. OSD auto-switch control -- users can now choose whether the display auto-switches to DP/HDMI input when the TB4-connected Mac enters sleep mode (Options for Thunderbolt / Options for DP/HDMI settings)
2. MacBook reboot compatibility -- PD firmware patch resolves compatibility issues during MacBook reboots (no more black screen or failed reconnect after restart)
3. USB hub / KVM stability -- fixes signal instability and power fluctuations during KVM switching
4. Firmware update utility improved -- reduces likelihood of update failures

**M3T102 (AVOID)**:
- Known to cause screen flickering on DP connections
- Some users report KVM becoming unresponsive
- If you're on M3T102, update to M3T105 immediately

## Checking Current Firmware

### Via OSD
1. Press joystick to open OSD
2. Joystick up to open Main Menu
3. Navigate to: Others > Display Info
4. Firmware version shown as "Firmware Revision"

### Via Dell DDPM (if installed)
1. Open Dell Display and Peripheral Manager
2. Select the U4025QW
3. Firmware version shown in display info panel

## Update Procedure

### Method 1: Dell Firmware Updater on macOS (Recommended for Tahoe 26.2+)

Direct .pkg installer from Dell. Works on macOS Tahoe 26.2 and later. **Broken on Tahoe 26.0-26.1** (Apple libusb API bug -- see Known Issues below).

1. Download the Mac firmware .pkg from [Dell M3T105 for Mac](https://www.dell.com/support/home/en-us/drivers/driversdetails?driverid=r7c3k)
2. Connect Mac to monitor via **Thunderbolt 4** cable
3. **Quit all DDC apps** (BetterDisplay, Lunar, MonitorControl, m1ddc scripts)
4. Double-click the .pkg file
5. Follow on-screen prompts -- takes approximately **20 minutes**
6. **DO NOT unplug or turn off the monitor during update**
7. Monitor will power cycle when complete

### Method 2: Windows Machine

Fallback if macOS method fails. Use any Windows PC connected to the monitor.

1. Go to dell.com/support
2. Search for "U4025QW"
3. Navigate to: Drivers & Downloads > Firmware
4. Download the latest firmware updater (.exe)
5. Connect Windows machine to monitor via any video input
6. Run the firmware updater
7. Follow on-screen instructions
8. **DO NOT unplug the monitor during update** (20 minutes)
9. Monitor will power cycle when complete

### Method 3: Windows VM (if no Windows machine available)

Use a VM to run the Windows firmware updater:

1. Install Parallels Desktop, VMware Fusion, or UTM
2. Set up a Windows VM
3. Pass through the USB/display connection to the VM (varies by hypervisor)
4. Run the firmware updater inside the VM
5. This method is finicky - the VM needs proper USB passthrough

### Method 4: USB Flash Drive (if available for this model)

Some Dell monitors support USB firmware update:

1. Download firmware from dell.com/support
2. Extract to a FAT32-formatted USB drive
3. Plug USB drive into monitor's downstream USB-A port
4. OSD > Menu > Others > Firmware Update
5. Select the firmware file and confirm

**Note**: Not all firmware versions support this method. Check Dell's instructions.

## Pre-Update Checklist

- [ ] Note your current firmware version (in case you need to report issues)
- [ ] Ensure stable power connection (monitor and computer)
- [ ] Close all applications that use DDC: `killall BetterDisplay Lunar MonitorControl 2>/dev/null`
- [ ] Do not run firmware update during a thunderstorm or power uncertainty
- [ ] Allocate 20-25 minutes for the process

## Post-Update Steps

1. Power cycle the monitor (unplug power, wait 10 seconds, replug)
2. Reset to factory defaults: OSD > Menu > Others > Reset
3. Reconfigure your preferred OSD settings:
   - Color > Preset Modes > Display P3
   - Input Source > Options for Thunderbolt > Off
   - Input Source > Options for DP/HDMI > Off
4. Test DDC commands: `m1ddc get luminance` (should respond)
5. Test all connected machines for video and KVM functionality
6. Test input switching: `m1ddc set input 27` (TB4) and `m1ddc set input 15` (DP)

## Known Issues

### macOS Tahoe Firmware Updater Compatibility

| macOS Version | Firmware Updater | Notes |
|---------------|:----------------:|-------|
| Sequoia 15.x | Works | Via DDPM or .pkg |
| Tahoe 26.0 | **Broken** | Apple libusb API change broke Dell updater |
| Tahoe 26.0.1 | **Broken** | Same libusb issue |
| Tahoe 26.1 | **Broken** | Same libusb issue |
| Tahoe 26.2+ | **Works** | Apple fixed the libusb API. Direct .pkg update works. |

**Root cause**: A change in Apple's libusb API in macOS Tahoe 26.0 broke compatibility with Dell's firmware update tool, causing "The selected firmware is not for this monitor" error. Apple fixed this in Tahoe 26.2.

**Source**: [Dell Community thread](https://www.dell.com/community/en/conversations/monitors/u4025qw-cannot-update-to-firmware-m3t105-via-macos-tahoe-26/68fd1a200227ab24c3d6aa64) - confirmed working on 26.2 by multiple users (Dec 2025).

**Dell official article**: [Dell Monitor Firmware Issue With macOS Tahoe](https://www.dell.com/support/kbdoc/en-us/000394689/dell-monitor-firmware-issue-with-macos-tahoe)

## Rollback

Dell monitors generally do NOT support firmware rollback. Once updated, you cannot go back to a previous version through normal means.

**If an update causes problems**:
1. Contact Dell Support - they may have an engineering firmware for rollback
2. Factory reset the OSD settings (this doesn't change firmware but fixes OSD corruption)
3. Check Dell community forums for others with the same issue
4. Wait for the next firmware release

## Firmware Update Fails

| Symptom | Fix |
|---------|-----|
| "The selected firmware is not for this monitor" | macOS Tahoe 26.0-26.1 bug. Upgrade to Tahoe 26.2+ or use Windows machine |
| "No monitor detected" | Try a different video cable/port. Ensure TB4 connection for Mac updater |
| Update stalls at X% | Wait at least 20 minutes before power cycling |
| DDPM crashes during update | Use .pkg installer directly instead of DDPM |
| Monitor won't turn on after update | Unplug power for 30 seconds, then replug |
| Firmware shows old version after update | Factory reset OSD, then recheck |
