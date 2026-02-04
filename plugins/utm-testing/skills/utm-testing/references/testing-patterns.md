# Common Testing Workflows

Generic patterns for testing software on UTM macOS VMs. Not coupled to any specific project — adapt these to whatever you're testing.

## Pattern 1: Test a Shell Script / Installer

Copy a local script to the VM and run it:

```bash
# Copy and run:
scp ./install.sh test@<vm-ip>:~/
ssh test@<vm-ip> 'chmod +x ~/install.sh && ~/install.sh'

# Or curl from a remote URL:
ssh test@<vm-ip> 'curl -fsSL https://example.com/install.sh | bash'
```

**Verify:**

```bash
ssh test@<vm-ip> 'echo "Exit code: $?"'
ssh test@<vm-ip> 'which my-tool'  # Check if it installed
```

## Pattern 2: Test a Git Repo's Setup

Clone a repo on the VM and run its setup script:

```bash
# Public repo:
ssh test@<vm-ip> 'git clone https://github.com/user/repo.git ~/repo && cd ~/repo && ./setup.sh'

# Private repo (use HTTPS + token or SSH key):
ssh test@<vm-ip> 'git clone https://<token>@github.com/user/repo.git ~/repo'
```

**With login shell** (if setup needs Homebrew or other PATH-dependent tools):

```bash
ssh test@<vm-ip> 'bash -l -c "git clone https://github.com/user/repo.git ~/repo && cd ~/repo && ./setup.sh"'
```

## Pattern 3: Test Homebrew Packages / Brewfile

```bash
# Install Homebrew first (if not in base VM):
ssh test@<vm-ip> 'NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'

# Add to PATH:
ssh test@<vm-ip> 'echo '\''eval "$(/opt/homebrew/bin/brew shellenv)"'\'' >> ~/.zshrc'

# Install from Brewfile:
scp ./Brewfile test@<vm-ip>:~/
ssh test@<vm-ip> 'bash -l -c "brew bundle --file=~/Brewfile"'

# Verify:
ssh test@<vm-ip> 'bash -l -c "brew bundle check --file=~/Brewfile"'
```

## Pattern 4: Test macOS Defaults / Preferences

```bash
# Copy and run a defaults script:
scp ./defaults.sh test@<vm-ip>:~/
ssh test@<vm-ip> 'chmod +x ~/defaults.sh && ~/defaults.sh'

# Verify a specific setting:
ssh test@<vm-ip> 'defaults read com.apple.dock autohide'
ssh test@<vm-ip> 'defaults read NSGlobalDomain AppleShowAllExtensions'

# Verify pmset settings:
ssh test@<vm-ip> 'pmset -g custom'
```

## Pattern 5: Test Unpushed Changes

Push your branch first, then test on the VM:

```bash
# On your host:
git push origin my-branch

# On the VM:
ssh test@<vm-ip> 'bash -l -c "git clone -b my-branch https://github.com/user/repo.git ~/repo && cd ~/repo && ./install.sh"'
```

Or copy the working directory directly:

```bash
# Sync local directory to VM (excludes .git, node_modules, etc.):
rsync -avz --exclude='.git' --exclude='node_modules' ./ test@<vm-ip>:~/project/
ssh test@<vm-ip> 'bash -l -c "cd ~/project && ./install.sh"'
```

## Pattern 6: Non-Interactive / CI-Style Testing

Chain everything in one SSH command for fully automated testing:

```bash
ssh test@<vm-ip> 'bash -l -c "
  set -euo pipefail
  git clone https://github.com/user/repo.git ~/repo
  cd ~/repo
  ./setup.sh --ci
  ./test.sh
  echo PASSED
"'
```

**Capture exit code:**

```bash
ssh test@<vm-ip> 'bash -l -c "cd ~/repo && ./test.sh"'
echo "Exit code: $?"
```

## Pattern 7: Test a Dotfiles Repo

```bash
# Clone dotfiles and run install:
ssh test@<vm-ip> 'bash -l -c "
  git clone https://github.com/user/dotfiles.git ~/dotfiles
  cd ~/dotfiles
  ./install.sh
"'

# Verify symlinks:
ssh test@<vm-ip> 'ls -la ~/.zshrc ~/.gitconfig ~/.config/'

# Verify shell loads cleanly (no errors):
ssh test@<vm-ip> 'bash -l -c "echo Shell loaded OK"'
```

## Verification Checklist

After running your test, verify the results. Adapt this checklist to your project:

```bash
VM_IP="192.168.64.5"

# Did the script succeed?
ssh test@$VM_IP 'echo "Last exit code: $?"'

# Are expected binaries installed?
ssh test@$VM_IP 'which git node bun brew'

# Are config files in place?
ssh test@$VM_IP 'ls -la ~/.zshrc ~/.gitconfig'

# Are symlinks correct?
ssh test@$VM_IP 'readlink ~/.zshrc'

# Are services running?
ssh test@$VM_IP 'bash -l -c "brew services list"'

# Are macOS defaults applied?
ssh test@$VM_IP 'defaults read com.apple.dock autohide'

# Is the PATH correct in a login shell?
ssh test@$VM_IP 'bash -l -c "echo \$PATH"'
```

## Tips

- **Always use `bash -l -c`** when the command depends on anything in `.zshrc` or `.zprofile`
- **Use `set -euo pipefail`** in multi-line scripts to fail fast on errors
- **Capture output** if you need to analyze it later: `ssh ... 'command' > output.log 2>&1`
- **Use `NONINTERACTIVE=1`** for Homebrew install to skip prompts
- **Check host key warnings** — after deleting and re-cloning, run `ssh-keygen -R <ip>` to clear old keys
