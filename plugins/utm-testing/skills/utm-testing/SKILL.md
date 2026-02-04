---
name: utm-testing
description: >
  Guide for setting up UTM macOS VMs, SSH access, and testing anything on a
  fresh macOS environment. Use when discussing: UTM virtual machines, macOS VM
  testing, fresh macOS environment, clean-slate testing, VM cloning, SSH into
  VM, installer testing, dotfiles testing, Homebrew testing on VM, CI-style
  local testing, or any scenario requiring a disposable macOS environment.
---

# UTM macOS VM Testing

Expert knowledge for creating, configuring, and using UTM macOS VMs as disposable test environments. Clone-based workflow gives you a fresh macOS every time — no snapshots needed.

## Core Workflow

```
Create Base VM → Configure SSH → Clone → Test → Delete Clone → Repeat
```

1. **Create a base VM** once — your golden image (see `references/vm-setup.md`)
2. **Enable SSH** and bake in essentials before cloning (see `references/ssh-access.md`)
3. **Clone** the base VM for each test run — instant on APFS (see `references/clone-workflow.md`)
4. **Test** on the clone — install software, break things, experiment freely
5. **Delete** the clone when done — right-click → Delete in UTM
6. **Re-clone** for the next test — fresh environment every time

## Quick-Reference Checklist

Use this when you need to spin up a test quickly:

- [ ] Base VM exists and is **shut down**
- [ ] SSH is enabled in the base VM (System Settings → General → Sharing → Remote Login)
- [ ] Clone the base VM (UTM → right-click → Clone)
- [ ] Start the clone, get its IP: `ipconfig getifaddr en0`
- [ ] SSH from host: `ssh <user>@<ip>`
- [ ] Run your test (see `references/testing-patterns.md` for common patterns)
- [ ] Delete the clone when done

## Reference Docs

| Doc | What It Covers |
|-----|----------------|
| `references/vm-setup.md` | Creating the base VM, hardware settings, pre-clone checklist |
| `references/ssh-access.md` | SSH connection, PATH issues, common gotchas |
| `references/clone-workflow.md` | Clone-as-snapshot pattern, rules, multiple bases |
| `references/testing-patterns.md` | Shell scripts, git repos, Homebrew, defaults, CI-style |

## Key Principles

- **Never test on the base VM directly** — always clone first
- **Bake essentials into the base** before cloning (SSH, Xcode CLT, optionally Homebrew)
- **Shut down the base before cloning** — APFS CoW corruption risk if both run simultaneously
- **VM IP changes on reboot** (DHCP) — re-check each time
- **Non-login SSH** doesn't source `.zshrc` — use `bash -l -c "command"` or full paths
