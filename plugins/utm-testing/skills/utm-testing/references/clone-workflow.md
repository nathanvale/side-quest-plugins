# Clone-as-Snapshot Pattern

UTM doesn't support snapshots for macOS VMs (Apple Virtualization uses `.img` not `.qcow2`). Instead, use APFS cloning — it's instant and copy-on-write.

## How It Works

1. **Base VM** — your golden image, never run tests on this directly
2. **Clone for testing** — UTM → right-click VM → Clone (instant on APFS)
3. **Test on clone** — install software, break things, experiment freely
4. **Delete clone when done** — right-click → Delete
5. **Re-clone for next test** — fresh environment every time

APFS clone is copy-on-write: the clone takes zero extra disk space initially. Only changed blocks consume additional storage.

## Rules

### Never run base and clone simultaneously

APFS copy-on-write can corrupt if both the base `.img` and its clone are written to at the same time. Always:

1. Shut down the base VM
2. Clone it
3. Only start the clone

### Shut down base before cloning

Don't clone a running or suspended VM. Always shut down cleanly first:

- Inside VM: Apple menu → Shut Down
- Or from host SSH: `ssh test@<ip> 'sudo shutdown -h now'`

### Name clones clearly

Use a naming convention so you know what each clone is for:

- `macOS-Tahoe-Test-2025-06-15` — date-based
- `macOS-Tahoe-Test-dotfiles` — purpose-based
- `macOS-Tahoe-Test-homebrew-v2` — versioned experiments

### Delete clones when done

Clones are disposable. Don't accumulate them — they eventually diverge from the base and consume real disk space.

## Updating the Base

When you improve the base VM (install Xcode CLT, update macOS, add Homebrew):

1. Start the base VM
2. Make your changes
3. Shut it down
4. Delete all existing clones (they're based on the old image)
5. Create fresh clones from the updated base

## Multiple Bases

Create purpose-specific base VMs if your testing needs vary significantly:

| Base | Contents | Use Case |
|------|----------|----------|
| `macOS-Base-Bare` | SSH only | Test installers from scratch, first-run UX |
| `macOS-Base-Dev` | SSH + Xcode CLT + Homebrew | Test dev tool setups, Brewfiles |
| `macOS-Base-Full` | SSH + Xcode CLT + Homebrew + git + node | Test project builds |

## Disk Space

- Base VM: ~20-30GB (macOS + installed tools)
- Clone: ~0 bytes initially (APFS CoW)
- Clone after testing: varies by what you installed (typically 1-10GB of divergence)
- Check space: `du -sh ~/Library/Containers/com.utmapp.UTM/Data/Documents/*.utm`

## Automation Tips

### Quick clone + test cycle from the command line

UTM doesn't have a robust CLI, so cloning is manual (right-click in UTM GUI). But once the clone is running, everything else is scriptable:

```bash
# Wait for VM to boot and get IP (manual step — check UTM GUI)
VM_IP="192.168.64.5"

# Run your test
ssh test@$VM_IP 'bash -l -c "cd ~/repo && ./test.sh"'

# Shut down clone when done
ssh test@$VM_IP 'sudo shutdown -h now'

# Then delete clone in UTM GUI
```

### Scripted multi-step tests

```bash
VM_IP="192.168.64.5"

# Step 1: Copy files
scp -r ./my-project test@$VM_IP:~/

# Step 2: Run setup
ssh test@$VM_IP 'bash -l -c "cd ~/my-project && ./setup.sh"'

# Step 3: Verify
ssh test@$VM_IP 'bash -l -c "cd ~/my-project && ./verify.sh"'
EXIT_CODE=$?

# Step 4: Collect results
scp test@$VM_IP:~/my-project/results.log ./

echo "Test completed with exit code: $EXIT_CODE"
```
