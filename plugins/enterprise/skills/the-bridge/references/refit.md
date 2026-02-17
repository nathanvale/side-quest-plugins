# Refit Assignment -- Flag Reference

Flag parsing reference for `/enterprise:refit` command. The Bridge reads this, then hands off to the engineering station.

## Flag Parsing

Parse `$ARGUMENTS` to extract:

- **PATH**: First positional argument. File or directory to analyze. Optional -- prompt if missing.
- **FOCUS**: `--focus complexity|duplication|coupling|all`. Default: `all`.
- **DEEP**: `--deep` flag present? Boolean. Default: false. Larger analysis budget.
- **PLAIN**: `--plain` flag present? Boolean. Default: false. Drop all character voice.
- **YES**: `--yes` flag present? Boolean. Default: false. Skip confirmation.

Store parsed values: `PATH`, `FOCUS`, `DEEP`, `PLAIN`, `YES`

Flags that were explicitly passed are **locked** -- do not ask about them.

### Flag Validation

After parsing, check for issues:
- `--focus` with invalid value (not `complexity`, `duplication`, `coupling`, or `all`): error -- "Captain, '{value}' is not a recognized refactoring focus. Valid options: `complexity`, `duplication`, `coupling`, `all`."
- PATH does not exist: error -- "Captain, the specified path `{path}` does not exist. I recommend verifying the path."
- Unknown flags: warn and ignore -- "Captain, the flag `{flag}` is not recognized. Proceeding without it."
