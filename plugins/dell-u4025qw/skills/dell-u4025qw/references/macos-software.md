# macOS Software for the U4025QW

Software tools for controlling brightness, volume, input switching, and HiDPI scaling on macOS.

## BetterDisplay (Recommended for HiDPI)

**Cost**: Pro $22 / Free tier available
**Website**: betterdisplay.pro

### Key Features

- **HiDPI scaling**: Creates a virtual display at 3840x1620 for pixel-perfect 2x rendering on the 5K2K panel. This is the main reason to use BetterDisplay.
- **DDC brightness/contrast/volume**: Controls the monitor's OSD values directly (fixes macOS grayed-out volume slider)
- **Input switching**: DDC-based input switching (Pro feature)
- **Flexible scaling**: Any resolution at any refresh rate

### CLI (betterdisplaycli)

```bash
# Brightness (0-100)
betterdisplaycli set -brightness=70

# Volume
betterdisplaycli set -volume=50

# Input switching (Pro)
betterdisplaycli set -inputSource=27   # TB4
betterdisplaycli set -inputSource=15   # DP
betterdisplaycli set -inputSource=17   # HDMI
```

### HiDPI Setup

1. Open BetterDisplay > Displays
2. Create a virtual screen: **3840x1620** (a 1.33x scale of native 5120x2160)
3. Set as mirrored display of the real U4025QW
4. Text will be sharp - macOS treats it as a Retina-scaled display

**Why 3840x1620?** The native 5120x2160 panel at 2x scaling means macOS renders at half the pixels (2560x1080) then upscales. 3840x1620 gives a balanced middle ground - more screen space than true 2x but still sharp.

---

## Lunar (Recommended for Input Switching)

**Cost**: Free tier has input switching / Pro $23 for advanced features
**Website**: lunar.fyi

### Key Features

- **DDC brightness sync**: Matches brightness to ambient light or other displays
- **Input switching via hotkeys**: Assign global keyboard shortcuts per input (FREE tier)
- **Apple Shortcuts integration**: Automate via Shortcuts app
- **Sub-zero dimming**: Software dimming below DDC minimum

### CLI

```bash
# Switch inputs
lunar set input 27    # TB4
lunar set input 15    # DP
lunar set input 17    # HDMI

# Brightness
lunar set brightness 70

# List displays
lunar displays
```

### Hotkey Setup (Free)

1. Lunar > Preferences > Hotkeys
2. Under "Input Source" section
3. Assign hotkeys per input value (27 = TB4, 15 = DP, 17 = HDMI)
4. Works globally - no Karabiner needed for basic switching

---

## MonitorControl (Free, Open Source)

**Cost**: Free
**Website**: github.com/MonitorControl/MonitorControl

### Key Features

- **Keyboard brightness/volume**: Makes macOS media keys (F1/F2 for brightness, F10-F12 for volume) control the external monitor via DDC
- **Lightweight**: Does one thing well - routes media keys to DDC
- **No input switching**: Not a feature of MonitorControl

### When to Use

Install MonitorControl if you just want brightness and volume keys to work on the U4025QW without any complex setup. It complements BetterDisplay or Lunar (they don't conflict).

---

## Dell Display and Peripheral Manager (DDPM)

**Cost**: Free (official Dell tool)
**Website**: dell.com/support (search U4025QW drivers)

### Key Features

- **Easy Arrange**: Window snapping zones (Dell's version of window management)
- **Firmware updates**: Can update monitor firmware (when it works)
- **KVM configuration**: Configure KVM switching behavior
- **Input source management**: Switch inputs via the app

### Known Issues

- **BROKEN on macOS Tahoe (26.x)**: Firmware updater and some features non-functional
- **Sequoia (15.x)**: Generally works but can be flaky
- **Resource heavy**: Uses more resources than necessary for what it does

### Recommendation

Only install DDPM if you need:
1. Firmware updates (and you're not on Tahoe)
2. Easy Arrange window snapping
3. Dell-specific KVM configuration UI

For everything else, BetterDisplay + Lunar + MonitorControl are superior.

---

## Software Comparison

| Feature | BetterDisplay | Lunar | MonitorControl | Dell DDPM |
|---------|:------------:|:-----:|:--------------:|:---------:|
| HiDPI scaling | Yes | No | No | No |
| DDC brightness | Yes | Yes | Yes | Yes |
| DDC volume | Yes | Yes | Yes | No |
| Input switching | Pro ($22) | Free | No | Yes |
| Keyboard hotkeys | Limited | Yes | Yes (media keys) | No |
| CLI automation | Yes | Yes | No | No |
| Apple Shortcuts | No | Yes | No | No |
| Firmware update | No | No | No | Yes* |
| Window management | No | No | No | Yes |
| Open source | No | No | Yes | No |

*DDPM firmware update is broken on macOS Tahoe

## Recommended Stack

For most users controlling the U4025QW from macOS:

1. **BetterDisplay** (Pro) - HiDPI scaling + DDC control + input switching
2. **MonitorControl** (Free) - Makes media keys work for brightness/volume
3. **m1ddc** (Free CLI) - Scriptable DDC commands for automation

Or if you prefer free:

1. **Lunar** (Free) - Input switching hotkeys + brightness
2. **MonitorControl** (Free) - Media key support
3. **m1ddc** (Free CLI) - Automation
