# OBS-5 Server Lifecycle and DevOps Review -- Pass 2 (Skeptic)

**Reviewer lens:** Scope creep, over-engineering, YAGNI violations, "what can we cut?"

---

## 1. Verdict

**REQUEST CHANGES**

OBS-5 has seven sub-stages. Two of them (5d, 5e) should not ship in v1. One (5g) is a separate concern masquerading as a DevOps task. One (5a) is a deployment convenience that you do not need until the server has proven its value in foreground mode. The plan as written adds HITL architecture, a full LCARS CSS system, and a cross-repo migration to a stage nominally about "server lifecycle and DevOps." The OBS-4 Skeptic review cut 10 files and 4 days by pushing back on infrastructure for infrastructure's sake. The same discipline applies here.

The defensible v1 for OBS-5 is: 5c (static serving -- one code change), a stripped 5b (five just recipes), and that is it. Everything else defers.

---

## 2. Strengths

- **5c is exactly right.** Static file serving as a fallback in `Bun.serve()` is a one-screen change that unblocks the entire "single URL" deployment story. No new files. No new dependencies. The SPA fallback pattern is correct.
- **The justfile design is solid.** Symlinked plist, dotenv-load, idempotent start/stop -- these are professional defaults. The problem is the scope, not the quality.
- **Dependency graph is honest.** The plan correctly sequences 5c before 5a, and defers 5d until everything is stable. The author understands the ordering even if they have not drawn the right conclusion about what to cut.
- **Risk mitigation for 5g is thoughtful.** Dual cache path reads during migration, re-export shims, and explicit changeset versioning are the right moves. The plan would be good if it belonged here.

---

## 3. Critical Issues (must fix)

### C1: Stage 5d (HITL) is not a v1 DevOps task -- it is a v2 feature

HITL is a 12-step bidirectional WebSocket architecture with: an ephemeral server on a random OS-assigned port, a `pendingFutures` map with Promise resolution, a 300-second timeout, a new `POST /events/:id/respond` route, new EventStore methods (`findById`, `updateHitlStatus`), two new Vue components (`HitlBanner.vue`, `useHITLNotifications.ts`), and a countdown timer in the dashboard.

For context, OBS-1's WS protocol is "one event = one frame, read-only." Stage 5d adds client-to-server messages, bidirectional routing, and ephemeral infrastructure. That is not a DevOps sub-stage -- that is a new feature domain.

More critically: HITL depends on `SubagentStart` and `SubagentStop` events (the "permission_request" hook type). OBS-1 PR1 defers all 14 `ClaudeHookEvent` types to PR2. OBS-2 v1 defers SubagentStart/SubagentStop to v2. There are no HITL events in the v1 event stream. Stage 5d will build infrastructure with nothing to trigger it.

OBS-4 review cut EngagePipeline for exactly this reason: "Zero events to feed the pipeline." The same logic applies here.

**Action:** Remove Stage 5d from OBS-5 entirely. Create a backlog item "OBS-5d: HITL permission UI (v2)" blocked on OBS-2 v2 SubagentStart/Stop shipping.

### C2: Stage 5e (LCARS CSS) directly contradicts the accepted OBS-4 design decision

OBS-4's Skeptic review (pass 2, I1) recommended cutting the full LCARS CSS system in favor of a two-tier design token system. That recommendation was accepted. The accepted OBS-4 plan now ships with Tailwind v4 `@theme` tokens in `globals.css` and explicitly defers "LCARS structural elements (elbows, end-caps, left bar)" to v1.1.

OBS-5 Stage 5e re-specifies 30+ raw CSS custom properties in a separate `lcars.css` file using a `.theme-lcars` class and a `useThemes.ts` composable to toggle between themes. This contradicts the accepted architecture in three ways:

1. OBS-4 uses a two-tier token system in `globals.css`. Stage 5e defines its own raw variable set with no tier separation.
2. OBS-4 deferred decorative LCARS shapes to v1.1. Stage 5e re-introduces `.lcars-elbow`, `.lcars-cap-left`, `.lcars-bar` for v1.
3. OBS-4 uses Tailwind v4 `@theme` as the design system layer. Stage 5e introduces a parallel CSS custom property system that would conflict.

Stage 5e is not "deferred design" -- it is design that was already decided and cut in a prior review. Implementing it would create a two-system conflict inside the same `packages/client/` directory.

**Action:** Delete Stage 5e from OBS-5. The design system is fully specified in OBS-4's `globals.css` plan. If Antonio font and decorative LCARS shapes are desired, they belong in a "v1.1 OBS-4 polish" ticket, not OBS-5.

### C3: Stage 5g is a separate migration task, not a DevOps sub-stage

The dependency graph shows `5g` as the final step after everything else is stable and `@side-quest/observability` is published and tested. That is correct -- but it means 5g is a PR in the `@side-quest/git` repo, owned by OBS-1 (which is the extraction that creates `@side-quest/observability`). The migration checklist (add dependency, update imports, rename fields, delete `src/events/`, run validation, create changeset) is an OBS-1 cleanup task, not a Server Lifecycle task.

Putting 5g in OBS-5 creates a sequencing trap: OBS-5 cannot "complete" until `@side-quest/git` is migrated, but `@side-quest/git` migration is blocked on OBS-5 being published. The plan acknowledges this ("only safe after observability published + tested") but does not acknowledge that this makes 5g's placement in OBS-5 circular.

**Action:** Remove 5g from OBS-5. Create "OBS-1 PR3: Migrate @side-quest/git" as a separate tracking item, blocked on OBS-1 publish. Add a note that the dual-path emitter in OBS-1 PR1 already handles the migration window.

---

## 4. Important Observations (should fix)

### I1: Stage 5a (launchd) is a deployment nicety, not a v1 requirement

Launchd auto-start answers the question: "Do I want the server to survive a reboot without me?" For a dev tool being evaluated for the first time, the answer is: prove it first, then automate.

The plan's own dependency graph says 5c is the unblocking step. 5a adds launchd symlink management, log directory creation, and PID-based lifecycle coordination on top of a server that you have not yet run in anger. If `bun dev` in a terminal covers all development and debugging needs -- and it does, because `dev` recipe is already in the justfile -- launchd can wait until the system is stable enough that you actually care about it restarting on its own.

The launchd plist hardcodes absolute paths to Nathan's home directory. This is a one-person tool, so it is not wrong, but it means 5a has zero portability value as a demonstration of best practice.

**Recommendation:** Defer Stage 5a to v1.1, after at least one week of running the server in foreground `just dev` mode. If you find yourself repeatedly re-launching it after reboots, implement launchd then. Not before.

### I2: The justfile has 15 recipes. A v1 justfile needs 5

If Stage 5a (launchd) defers, the following recipes become dead weight in v1: `start`, `stop`, `restart`, `logs`, `logs-err`, `install`, `uninstall`. That is seven of the fifteen recipes -- all of them wrap launchd operations.

The v1 justfile recipes that add real value without 5a:

| Recipe | Value |
|--------|-------|
| `dev` | Foreground server with env vars |
| `build` | Build client + server |
| `build-client` | Client only (for iteration) |
| `test` | Run test suite |
| `health` | Smoke-test the running server |
| `test-event` | Send a valid event end-to-end |
| `db-reset` | Clear JSONL files during debugging |

That is 7 recipes, all useful without launchd. The launchd-dependent 8 (`start`, `stop`, `restart`, `logs`, `logs-err`, `install`, `uninstall`, and `typecheck`/`validate` overlap with `bun run validate`) defer to v1.1 with Stage 5a.

### I3: CORS headers are already in OBS-1, not OBS-5's job to re-specify

Stage 5c defines a `corsHeaders` block and an OPTIONS handler. OBS-1 PR1 (section 2.4, "Operational additions") already specifies identical CORS headers with the same wildcard origin, same methods, and an OPTIONS preflight handler returning `204`. This is duplicated specification for the same server.

**Action:** Remove the CORS section from Stage 5c. Reference OBS-1 PR1 as the source of truth. Verify the existing CORS implementation covers the dashboard's needs.

### I4: Static file serving route guard is too broad

The Stage 5c fetch handler condition is:

```typescript
if (url.pathname === '/' || !url.pathname.startsWith('/api'))
```

This means any path that is not prefixed `/api` -- including `/health`, `/events`, `/ws` -- falls into static file serving. The server then does an async `file.exists()` check before falling back. For WebSocket upgrade requests to `/ws` this introduces a file system check before the upgrade path, which is harmless but wasteful and a potential source of routing confusion.

A tighter guard: serve static files only for paths that look like asset requests or the root:

```typescript
const isApiRoute = url.pathname.startsWith('/events')
  || url.pathname === '/health'
  || url.pathname === '/ws'

if (!isApiRoute) {
  // static file serving
}
```

Or, more robustly, move static serving to a final `else` branch after all explicit route matches have been exhausted (which is what the comment "after all API routes" implies -- the implementation just doesn't quite do it).

---

## 5. Nice-to-Haves

- **N1: `just dev` could print the dashboard URL after startup.** A single `echo "Dashboard: http://127.0.0.1:${server_port}"` after the server starts reduces the "wait, what port?" friction for new sessions.

- **N2: `db-reset` scoping.** Currently `db-reset` uses a wildcard glob (`*/events.jsonl`) which deletes all app stores. For a multi-app setup this could be destructive. A `db-reset-all` vs `db-reset APP=side-quest-git` split would be safer.

- **N3: `health` recipe exit code.** The health recipe uses `&&` to print "Server: UP" but exits 0 either way (the `|| echo` swallows the curl exit code). If you ever want `just health` to fail CI, change to a two-command approach or check the HTTP status code explicitly.

---

## 6. Summary of Recommended Cuts

| Item | Files / time saved | Defer to |
|------|-------------------|----------|
| Stage 5d (HITL) | 3 files (hitl-server.ts, HitlBanner.vue, useHITLNotifications.ts) + 1 new route + 2 EventStore methods -- estimated 3 days | OBS-5d v2, blocked on OBS-2 v2 SubagentStart/Stop |
| Stage 5e (LCARS CSS) | 4 files (lcars.css, themes.css, font import, useThemes.ts) + 0.5 days | OBS-4 v1.1 polish ticket (separate from OBS-5) |
| Stage 5g (@side-quest/git migration) | 0 new files, but removes a separate-repo PR (~0.5 days tracking overhead + migration risk) | OBS-1 PR3, separate ticket |
| Stage 5a (launchd) | 1 file (plist) + 8 justfile recipes -- ~0.5 days | v1.1 after foreground mode proves value |
| CORS re-specification in 5c | 0 files -- spec cleanup only | Delete, reference OBS-1 PR1 |
| **Total** | **~4 days + 8 files** from a 7-sub-stage plan | |

**v1 OBS-5 should be:** 5c (static serving, ~1 hour) + stripped 5b (7 justfile recipes, ~1 hour). Estimated: half a day, one commit.

---

## 7. Questions for the Author

1. **Has `just dev` (foreground server) been tried?** If you can run `just dev`, open `http://127.0.0.1:7483`, and have the dashboard load, launchd has zero additional value for day-1 usage. What is the actual scenario that requires auto-restart?

2. **Stage 5d architecture uses `ephemeral WS server on random port` -- but the hook process is short-lived (it runs, emits, exits).** How does the hook process stay alive long enough to receive the HITL response over the WebSocket? Is there an implicit assumption that the hook process blocks on the Promise for up to 300 seconds? If so, what does Claude Code do during that wait?

3. **The justfile `test-event` recipe sends a `hook.notification` event.** OBS-1 PR1 only defines `CliEventType | HookEventType` -- `hook.notification` is a `ClaudeHookEvent` (PR2). Will this test event be accepted by the v1 server's ingress validator, or will it return a 400?

4. **Stage 5e defines `--officer-scotty`, `--officer-mccoy`, etc. as CSS variables.** These officer colors are not in OBS-4's two-tier token system. If they were meant to map to the `--color-event-*` semantic tokens, why define them separately? If they were meant to power `OfficerPanel.vue`, that component was cut in OBS-4. What consumes these variables?

5. **Stage 5g says "delete `src/events/` directory" -- 12 files.** OBS-1 PR1 already includes re-export shims in `@side-quest/git` for backward compatibility. If you re-export everything from `@side-quest/observability`, does it matter when the source files are deleted? Could 5g stay on `@side-quest/git`'s own roadmap indefinitely, with re-exports covering consumers, and never become an OBS-5 concern?
