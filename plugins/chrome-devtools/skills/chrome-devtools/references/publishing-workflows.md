# Publishing Workflows

Browser automation workflows for npm and GitHub setup tasks. Each workflow uses Chrome DevTools MCP tools to drive Chrome with remote debugging.

---

## General Patterns

### Auth Detection

Before any workflow, check login state:

1. `navigate_page` to the target site root (e.g., `https://www.npmjs.com`)
2. `take_snapshot`
3. Look for indicators:
   - **Logged in**: Username/avatar in snapshot, profile menu items
   - **Not logged in**: "Sign In", "Log in", "Sign Up" text present
4. If not logged in: Tell the user to log in manually in the debug profile, then `wait_for` authenticated state

### 1Password Vault Storage

When secrets are created (npm tokens, API keys), offer to store them in 1Password via the `op` CLI. This avoids clipboard exposure and creates an audit trail.

**Detection**: Check if `op` is available before offering:
```bash
op --version 2>/dev/null
```

**Vault**: `API Credentials` -- the sole vault. No resolution logic needed.

**Auth**: `OP_SERVICE_ACCOUNT_TOKEN` is set in the shell environment (sourced from `~/code/dotfiles/.env`). All `op` commands run non-interactively -- no Touch ID prompts, fully automatable.

**Store a secret**:
```bash
op item create \
  --category=api_credential \
  --title="<TITLE>" \
  --vault="API Credentials" \
  "credential=<SECRET_VALUE>" \
  "type=<TYPE>" \
  "expires=<EXPIRY_DATE>"
```

**Retrieve a secret**:
```bash
op read "op://API Credentials/<ITEM>/<FIELD>"
```

**Check for existing items** (before creating duplicates):
```bash
op item list --vault="API Credentials" --format=json | grep -i "<SEARCH_TERM>"
```

**Conventions**:
- **Title format**: `<service> - <purpose>` (e.g., "npm - github-actions-publish token")
- **Tags**: Add relevant tags (e.g., `npm`, `ci-cd`, `github-actions`)
- **Notes field**: Include context -- which repo, what scope, when it expires
- **Expiry tracking**: Set the expiry date so 1Password can warn before it lapses

**Graceful degradation**: If `op` is not installed, `OP_SERVICE_ACCOUNT_TOKEN` is not set, or the user declines, fall back to manual copy + `gh secret set`.

---

## Workflows

### npm-create-token

**Task**: Create a granular access token on npmjs.com
**Why browser**: No CLI equivalent for granular token creation with custom scopes.

**Variables needed**:
- `TOKEN_NAME` -- descriptive name (e.g., "github-actions-publish")
- `EXPIRY` -- token expiry period (default: 90 days)
- `PACKAGE_SCOPE` -- package or scope to grant access to
- `PERMISSIONS` -- Read and Write (for publishing)

**Steps**:

1. **Navigate** to token creation page
   ```
   navigate_page -> https://www.npmjs.com/settings/<username>/tokens/granular-access-tokens/new
   wait_for -> text "Generate a granular access token"
   ```

2. **Verify auth** -- `take_snapshot`, confirm no login redirect

3. **Fill token name**
   ```
   take_snapshot -> find textbox with label "Token name" or "Name"
   fill -> TOKEN_NAME value
   ```

4. **Set expiry**
   ```
   take_snapshot -> find dropdown/select near "Expiration"
   click -> expiry option (90 days recommended)
   ```

5. **Configure package scope**
   ```
   take_snapshot -> find "Packages and scopes" section
   select -> "Only select packages and scopes"
   fill -> PACKAGE_SCOPE in the package/scope input
   ```

6. **Set permissions**
   ```
   take_snapshot -> find permissions section
   select -> "Read and Write" for the package scope
   ```

7. **Screenshot BEFORE generating** (for verification -- NEVER after)
   ```
   take_screenshot -> capture the filled form for verification
   ```

8. **Generate token**
   ```
   take_snapshot -> find button with text "Generate token" or "Generate Token"
   click -> the generate button
   wait_for -> token value display (text starting with "npm_")
   ```

9. **Extract token value** (text only -- NO screenshots)
   ```
   take_snapshot -> find the token value (starts with "npm_")
   ```
   - Display only first 8 characters: `npm_1234abcd...`
   - **CRITICAL**: Warn user this token is shown only once

10. **Store the token** (offer in priority order)
    1. **1Password** (if `op` available): Store with expiry tracking
       ```bash
       op item create --category=api_credential \
         --title="npm - TOKEN_NAME" \
         --vault="API Credentials" \
         "credential=<token_value>" \
         "type=granular_access_token" \
         "scope=PACKAGE_SCOPE" \
         "expires=<90 days from now>"
       ```
    2. **GitHub secret**: Pipe to `gh secret set NPM_TOKEN` for CI usage
       ```bash
       echo "<token_value>" | gh secret set NPM_TOKEN --repo <OWNER>/<REPO>
       ```
    3. **Manual**: Tell user to copy and store it themselves

    Offer all applicable options -- the user may want both vault storage AND the GitHub secret set.

**Verification**: Token value starts with `npm_` and is stored successfully.

---

### npm-oidc-setup

**Task**: Configure OpenID Connect trusted publishing for a package
**Why browser**: OIDC trusted publisher setup has no CLI equivalent.

**Variables needed**:
- `PACKAGE_NAME` -- npm package name
- `GITHUB_ORG_OR_USER` -- GitHub org or username
- `GITHUB_REPO` -- repository name
- `WORKFLOW_FILE` -- workflow filename (default: `publish.yml`)

**Steps**:

1. **Navigate** to package access page
   ```
   navigate_page -> https://www.npmjs.com/package/<PACKAGE_NAME>/access
   wait_for -> text "Publishing access" or "Access"
   ```

2. **Verify auth** -- `take_snapshot`, confirm logged in as package owner

3. **Find trusted publisher section**
   ```
   take_snapshot -> find "Trusted Publisher" or "GitHub Actions" section
   ```
   - If not visible, fall back to manual instructions

4. **Select GitHub Actions**
   ```
   click -> "GitHub Actions" option or "Configure trusted publisher"
   wait_for -> form fields for GitHub org/repo/workflow
   ```

5. **Fill GitHub details**
   ```
   take_snapshot -> find form fields
   fill -> GITHUB_ORG_OR_USER in org/username field
   fill -> GITHUB_REPO in repository field
   fill -> WORKFLOW_FILE in workflow filename field
   ```

6. **Submit**
   ```
   take_snapshot -> find button "Set up connection" or "Save" or "Configure"
   click -> the submit button
   wait_for -> success confirmation
   ```

7. **Verify**
   ```
   take_screenshot -> capture confirmation
   take_snapshot -> confirm trusted publisher is now listed
   ```

**Verification**: Page shows the GitHub repository as a trusted publisher.

---

### npm-view-access

**Task**: View current access configuration for a package
**Why browser**: Quick visual audit of publishing method, trusted publishers, 2FA requirements.

**Variables needed**:
- `PACKAGE_NAME` -- npm package name

**Steps**:

1. **Navigate**
   ```
   navigate_page -> https://www.npmjs.com/package/<PACKAGE_NAME>/access
   wait_for -> page load
   ```

2. **Capture state**
   ```
   take_snapshot -> full accessibility tree
   take_screenshot -> visual record
   ```

3. **Report** the following from the snapshot:
   - Current publishing method (token, OIDC, or both)
   - Trusted publisher configuration (if any)
   - 2FA requirements
   - Team/user access list

---

### github-set-secret

**Task**: Set a repository secret
**Preferred method**: CLI (`gh secret set`), with optional 1Password sourcing

**CLI method** (preferred):
```bash
# Direct value:
echo "<SECRET_VALUE>" | gh secret set <SECRET_NAME> --repo <OWNER>/<REPO>

# From 1Password (if op available and secret is vaulted):
op read "op://API Credentials/<ITEM>/credential" | gh secret set <SECRET_NAME> --repo <OWNER>/<REPO>
```

When `op` is available, check if the secret already exists in the vault before asking the user to provide it manually.

**Browser fallback** (when `gh` unavailable):

1. `navigate_page` -> `https://github.com/<OWNER>/<REPO>/settings/secrets/actions`
2. `wait_for` -> text "Actions secrets" or "Repository secrets"
3. `take_snapshot` -> find "New repository secret" button, `click` it
4. `fill` -> SECRET_NAME in "Name" field
5. `fill` -> SECRET_VALUE in "Secret" / "Value" field
6. `take_snapshot` -> find "Add secret" button, `click` it
7. `take_snapshot` -> confirm secret appears in the list

---

### github-branch-protection

**Task**: Configure branch protection rules
**Preferred method**: CLI (`gh api`)

**CLI method** (preferred):
```bash
gh api repos/<OWNER>/<REPO>/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["pr-quality"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}'
```

**Browser fallback** (when `gh` unavailable):

1. `navigate_page` -> `https://github.com/<OWNER>/<REPO>/settings/branches`
2. `take_snapshot` -> find existing rule or "Add branch protection rule"
3. Fill branch name pattern, enable required status checks, enable PR reviews
4. `click` save button
5. `take_screenshot` -> visual confirmation

---

## Edge Cases

### 2FA Prompts

npm and GitHub may prompt for 2FA during sensitive operations:

1. `take_snapshot` -- detect 2FA prompt (text like "Two-factor authentication", "Verify", "Enter code")
2. Tell the user: _"A 2FA prompt appeared. Please enter your code in the browser, then tell me when you're done."_
3. `wait_for` the 2FA form to disappear
4. Resume the workflow

### Secret Screenshot Safety

```
CRITICAL: After clicking "Generate token" or any action that reveals a secret:
- NEVER call take_screenshot -- the token would be persisted as an image
- Use take_snapshot (text only) to extract the token value
- Display only first 8 characters to the user: npm_1234abcd...
- Immediately offer storage (1Password -> gh secret set -> manual copy)
```

### UI Changes

npm and GitHub periodically update their UI. The snapshot-first approach handles this:

- Element finding uses **text content and roles**, not CSS selectors or coordinates
- If expected text isn't found, search for **alternative labels** (e.g., "Generate" vs "Create", "Save" vs "Submit")
- If no matching element is found after alternatives, fall back to manual instructions with a screenshot of what's currently on screen

### Not Logged In

If a login page is detected at any point during a workflow:

1. `take_screenshot` -- show the user what's on screen
2. Instruct: _"You need to log in to [site] in the debug Chrome profile. Please log in, then tell me when you're ready."_
3. `wait_for` -- wait for the authenticated page to load
4. Re-run `take_snapshot` to verify login succeeded
5. Resume the workflow from the interrupted step
