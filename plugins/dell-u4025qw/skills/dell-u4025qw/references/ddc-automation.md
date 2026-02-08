# DDC Automation

Automate monitor control (input switching, brightness, volume) via DDC/CI commands using m1ddc, Karabiner-Elements, and shell scripts.

## m1ddc (Recommended CLI Tool)

**Install**: `brew install m1ddc`
**Repo**: github.com/waydabber/m1ddc

m1ddc sends DDC/CI commands directly to the monitor over the display cable. Works on Apple Silicon Macs (M1-M4).

### Input Switching

```bash
m1ddc set input 27   # Switch to Thunderbolt/USB-C (Mac 1)
m1ddc set input 15   # Switch to DisplayPort (Mac 2)
m1ddc set input 17   # Switch to HDMI (Mac 3)
```

### Brightness and Contrast

```bash
m1ddc set luminance 70    # 0-100
m1ddc set contrast 75      # 0-100
m1ddc get luminance       # Read current value
```

### Volume

```bash
m1ddc set volume 50        # 0-100
m1ddc set mute 1           # Mute
m1ddc set mute 2           # Unmute
```

### Display Info

```bash
m1ddc display list         # List connected displays
m1ddc get input            # Current input source
```

---

## Karabiner-Elements Integration

Use Karabiner to bind keyboard shortcuts to m1ddc commands. This is ideal if you already use Karabiner for keyboard customization (e.g., Hyper key).

### Input Switching via Hyper Key

Add these rules to your Karabiner `karabiner.json` (or a complex modifications file):

```json
{
  "description": "Hyper+1 = Switch monitor to TB4 input (Mac 1)",
  "manipulators": [{
    "type": "basic",
    "from": {
      "key_code": "1",
      "modifiers": {
        "mandatory": ["left_control", "left_option", "left_command", "left_shift"]
      }
    },
    "to": [{
      "shell_command": "/opt/homebrew/bin/m1ddc set input 27"
    }]
  }]
}
```

```json
{
  "description": "Hyper+2 = Switch monitor to DP input (Mac 2)",
  "manipulators": [{
    "type": "basic",
    "from": {
      "key_code": "2",
      "modifiers": {
        "mandatory": ["left_control", "left_option", "left_command", "left_shift"]
      }
    },
    "to": [{
      "shell_command": "/opt/homebrew/bin/m1ddc set input 15"
    }]
  }]
}
```

```json
{
  "description": "Hyper+3 = Switch monitor to HDMI input (Mac 3)",
  "manipulators": [{
    "type": "basic",
    "from": {
      "key_code": "3",
      "modifiers": {
        "mandatory": ["left_control", "left_option", "left_command", "left_shift"]
      }
    },
    "to": [{
      "shell_command": "/opt/homebrew/bin/m1ddc set input 17"
    }]
  }]
}
```

### Brightness Control via Hyper Key

```json
{
  "description": "Hyper+F1 = Decrease brightness by 10",
  "manipulators": [{
    "type": "basic",
    "from": {
      "key_code": "f1",
      "modifiers": {
        "mandatory": ["left_control", "left_option", "left_command", "left_shift"]
      }
    },
    "to": [{
      "shell_command": "/opt/homebrew/bin/m1ddc chg luminance -10"
    }]
  }]
}
```

```json
{
  "description": "Hyper+F2 = Increase brightness by 10",
  "manipulators": [{
    "type": "basic",
    "from": {
      "key_code": "f2",
      "modifiers": {
        "mandatory": ["left_control", "left_option", "left_command", "left_shift"]
      }
    },
    "to": [{
      "shell_command": "/opt/homebrew/bin/m1ddc chg luminance 10"
    }]
  }]
}
```

---

## Important DDC Limitations

### 1. Commands Only Work From Active Input

DDC commands can ONLY be sent from the machine that is currently displayed on the monitor. If Mac 1 is displayed, Mac 2 cannot send DDC commands.

**Impact**: You can't switch TO your machine from the background. You can only switch AWAY from your machine (to another input).

**Workarounds**:
- Set up a "switch to me" hotkey on EACH machine. Press it before walking away.
- Use monitor OSD buttons for switching when the target machine isn't active.
- SSH into the active machine and run the m1ddc command remotely.

### 2. DDC Over Different Cable Types

| Cable | DDC Support | Notes |
|-------|:-----------:|-------|
| Thunderbolt 4 | Yes | Best DDC support |
| DisplayPort 1.4 | Yes | Reliable DDC |
| HDMI 2.1 | Yes | Some HDMI cables have DDC issues - use high quality |
| USB-C (port 7) | No | Data only, no display signal = no DDC |

### 3. Sleep/Wake DDC Issues

- After macOS sleep/wake, DDC may not respond for a few seconds
- Some users report DDC failing entirely after sleep until monitor is power-cycled
- Firmware M3T105+ improves sleep/wake DDC reliability
- Workaround: Add a 2-second delay in scripts after wake

---

## Alternative: Lunar Hotkeys (No Karabiner Needed)

If you don't use Karabiner, Lunar provides built-in hotkey support for input switching:

1. Open Lunar > Preferences > Hotkeys
2. Scroll to "Input Source" section
3. Click the hotkey field for each input value
4. Press your desired key combination
5. Works globally, but only affects the currently active input (see limitation below)

Lunar hotkeys use DDC internally, so they have the same "active input only" limitation. The keybind registers from any app, but the DDC command only succeeds if your machine is the monitor's active input.

---

## Shell Script Examples

> **PATH note**: If running these scripts from launchd, cron, or other non-interactive contexts, use the full path `/opt/homebrew/bin/m1ddc` instead of `m1ddc`, since Homebrew's bin directory may not be in PATH.

### Toggle Between Two Inputs

```bash
#!/bin/bash
# toggle-input.sh - Toggle between TB4 and DP
current=$(m1ddc get input)
if [ "$current" = "27" ]; then
  m1ddc set input 15
  echo "Switched to DisplayPort"
else
  m1ddc set input 27
  echo "Switched to Thunderbolt"
fi
```

### Night Mode (Reduce Brightness + Warm)

```bash
#!/bin/bash
# night-mode.sh
m1ddc set luminance 30
m1ddc set contrast 50
echo "Night mode enabled"
```

### Day Mode (Full Brightness)

```bash
#!/bin/bash
# day-mode.sh
m1ddc set luminance 80
m1ddc set contrast 75
echo "Day mode enabled"
```

### Wake Check (Wait for DDC)

```bash
#!/bin/bash
# wait-for-ddc.sh - Wait until DDC responds after wake
for i in $(seq 1 10); do
  if m1ddc get luminance > /dev/null 2>&1; then
    echo "DDC ready"
    exit 0
  fi
  sleep 1
done
echo "DDC not responding after 10 seconds"
exit 1
```
