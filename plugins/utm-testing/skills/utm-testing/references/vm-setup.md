# Creating the Base VM

Step-by-step guide for creating a UTM macOS VM that serves as your golden image for clone-based testing.

## Create the VM

1. Open UTM → **Create a New Virtual Machine**
2. Select **Virtualize** (not Emulate — native performance on Apple Silicon)
3. Choose **macOS**
4. Download or select an IPSW file
   - Match your host macOS version for best compatibility
   - UTM will offer to download the latest compatible IPSW
5. Configure hardware:
   - **CPU:** 4+ cores (recommended)
   - **RAM:** 8GB+ (minimum 4GB, 8GB comfortable for most testing)
   - **Disk:** 64GB+ (macOS alone uses ~15GB, leave room for software)
6. Name it descriptively: `macOS-Tahoe-Base`, `macOS-Sequoia-Base`, etc.
7. Click **Save** and start the VM

## Complete macOS Setup Assistant

1. Select language and region
2. Skip Apple ID sign-in (not needed for testing)
3. Create a local user account:
   - **Username:** `test` (or whatever you prefer)
   - **Password:** Keep it simple for dev/testing (e.g., `test`)
   - You'll type this password over SSH, so short is fine
4. Skip all optional setup (Siri, analytics, Screen Time, etc.)
5. Complete setup and reach the desktop

## Pre-Clone Checklist (CRITICAL)

Do these **before** your first clone. UTM has no snapshots — the clone IS your baseline. If something isn't working in the base VM, every clone inherits the problem.

### Required

1. **Enable Remote Login (SSH)**
   - System Settings → General → Sharing → Remote Login → **ON**
   - Allow access for: your user account (or All Users for simplicity)

2. **Verify SSH works**
   ```bash
   # Inside the VM, get the IP:
   ipconfig getifaddr en0

   # From your host Mac, test SSH:
   ssh test@<vm-ip>
   ```

### Recommended

3. **Install Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```
   Saves 5-10 minutes on every clone that needs git, clang, or developer tools.

4. **Install Rosetta** (if testing x86 software on Apple Silicon)
   ```bash
   softwareupdate --install-rosetta --agree-to-license
   ```

5. **Install Homebrew** (if most tests will need it)
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Add to PATH:
   ```bash
   echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
   ```

6. **Set up passwordless sudo** (optional, for automated testing)
   ```bash
   sudo visudo
   # Add: test ALL=(ALL) NOPASSWD: ALL
   ```

### Optional

7. **Disable sleep/screen saver** (prevents SSH disconnects during long tests)
   - System Settings → Lock Screen → set all timers to Never
   - Or via CLI: `sudo pmset -a disablesleep 1`

8. **Reduce disk usage** — remove unused apps, disable Spotlight indexing:
   ```bash
   sudo mdutil -a -i off
   ```

## Multiple Base VMs

Create purpose-specific bases if your testing needs vary:

| Base VM | Pre-installed | Use For |
|---------|---------------|---------|
| `macOS-Base-Bare` | SSH only | Installer testing, first-run experience |
| `macOS-Base-Dev` | SSH + Xcode CLT + Homebrew | Dev tool testing, Brewfile validation |
| `macOS-Base-Full` | SSH + Xcode CLT + Homebrew + common tools | Complex setup testing |

## Maintenance

- **Update the base periodically** — macOS updates, Homebrew updates, Xcode CLT updates
- **After updating the base**, delete old clones and create fresh ones
- **Keep the base VM shut down** when not actively configuring it
