# SSH Access & Gotchas

How to connect to your UTM macOS VM over SSH, and the problems you'll hit.

## Finding the VM IP

Inside the VM, run:

```bash
ipconfig getifaddr en0
```

This returns the VM's IP on the shared network (typically `192.168.64.x`).

**Note:** The IP can change on reboot (DHCP). Always re-check after restarting the VM.

## Connecting

```bash
# Interactive session:
ssh test@192.168.64.5

# Single command (non-login shell — .zshrc is NOT sourced):
ssh test@192.168.64.5 'whoami'

# Login shell (sources .zshrc — needed for Homebrew, custom PATH, etc.):
ssh test@192.168.64.5 'bash -l -c "brew --version"'
```

## Common Gotchas

### `brew` not found over SSH

**Problem:** Running `ssh test@<ip> 'brew install something'` fails with `brew: command not found`.

**Why:** SSH single-command mode runs a non-login shell. `.zshrc` is not sourced, so Homebrew's PATH isn't set.

**Fix — any of these:**

```bash
# Option 1: Use full path
ssh test@<ip> '/opt/homebrew/bin/brew install something'

# Option 2: Login shell
ssh test@<ip> 'bash -l -c "brew install something"'

# Option 3: Inline eval
ssh test@<ip> 'eval "$(/opt/homebrew/bin/brew shellenv)" && brew install something'
```

### Too many authentication failures

**Problem:** `Received disconnect from <ip>: Too many authentication failures`

**Why:** SSH tries all loaded keys from `ssh-agent` before the right one. If you have many keys, it exhausts the allowed attempts.

**Fix:**

```bash
ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 test@<ip>
```

Or add to `~/.ssh/config`:

```
Host test-vm
    HostName 192.168.64.5
    User test
    IdentitiesOnly yes
    IdentityFile ~/.ssh/id_ed25519
```

### Permission denied (publickey, password)

**Problem:** `Permission denied` when connecting.

**Possible causes:**
- Wrong username — UTM macOS VMs use whatever you set during Setup Assistant
- Remote Login not enabled — check System Settings → General → Sharing → Remote Login
- Password auth disabled — check `/etc/ssh/sshd_config` for `PasswordAuthentication yes`

### Xcode dialog pops up over SSH

**Problem:** `xcode-select --install` or similar commands trigger a GUI dialog inside the VM, which you can't interact with over SSH.

**Fix:** Install Xcode CLT in the base VM **before cloning** — do it interactively in the VM GUI. Then every clone has it pre-installed.

### Non-login shell doesn't have your PATH

**Problem:** Commands that work interactively in the VM fail when run via `ssh user@ip "command"`.

**Why:** SSH single-command mode runs a non-login, non-interactive shell. Only `/etc/profile` and `~/.ssh/environment` are sourced (if enabled). Your `.zshrc`, `.zprofile`, `.bashrc` are NOT sourced.

**Fix:**

```bash
# Wrap in login shell:
ssh test@<ip> 'bash -l -c "your-command-here"'

# Or use full paths:
ssh test@<ip> '/usr/local/bin/my-tool --version'
```

### Host key changes after clone deletion

**Problem:** `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!` when connecting to a new clone at the same IP.

**Fix:**

```bash
ssh-keygen -R 192.168.64.5
```

Then connect again. This is expected — each clone gets a unique host key but may reuse the same DHCP IP.

## SSH Config Shortcut

Add to `~/.ssh/config` for convenience:

```
Host test-vm
    HostName 192.168.64.5
    User test
    IdentitiesOnly yes
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
```

**`StrictHostKeyChecking no` + `/dev/null`:** Suppresses host key warnings. Only use this for disposable test VMs — never for production.

## File Transfer

```bash
# Copy file to VM:
scp ./script.sh test@<ip>:~/

# Copy directory to VM:
scp -r ./my-project test@<ip>:~/

# Copy file from VM:
scp test@<ip>:~/output.log ./
```

## Port Forwarding (Optional)

Forward a port from the VM to your host (e.g., test a web server running in the VM):

```bash
ssh -L 8080:localhost:8080 test@<ip>
```

Then access `http://localhost:8080` on your host to reach the VM's port 8080.
