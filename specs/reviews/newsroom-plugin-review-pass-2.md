1. **Verdict**  
REQUEST CHANGES

2. **Strengths**
- CLI-first can be cost-efficient if it reduces downstream web scraping volume.
- Lazy-loaded references are the right mechanism for controlling token spend.
- Per-topic reporter isolation makes marginal costs predictable.
- Reusing existing newsroom flow avoids creating a larger prompt surface for v1.

3. **Critical issues (must fix)**
- **Default dispatch likely overpays prompt tax.** If `mode-playbook` (Phase 2) and `wire-protocol` (Phase 5) are unconditional reads, a simple no-mode/no-wire dispatch still loads **5 of 7 refs**, pushing desk preload from ~`5,098` to ~`6.2k–6.5k` tokens before research.
- **No hard budget guardrails by mode/topic.** Current design can drift to ~`18k–27k` tokens for a 3-topic run (higher in `deep`). Add enforced caps: `max_topics`, `max_sources/topic`, `max_cli_rows`, `max_output_tokens`.
- **Parallel fanout duplicates static reporter cost.** 3 topics pay reporter bootstrap 3x (~`3,900` tokens) before doing work. A shared/hybrid strategy can save ~`2.0k–2.6k` tokens for 3-topic runs.
- **Wire bookkeeping can become a growing context tax.** Metadata per wire is modest (~`90–150` tokens), but `TaskList` returning all prior wires scales linearly. At 10 wires, each `TaskList` is ~`1.2k–1.8k` tokens; repeated calls can waste ~`5k–10k`/session.

4. **Important observations**
- **Minimal vs maximal file load:**  
  - Likely simple dispatch load: **5/7 files** (core 3 + mode + wire).  
  - Maximal flow: **7/7 files**.  
  - Estimated desk-context delta (simple vs maximal): ~`1.4k–2.7k` tokens.
- **`cli-quick-ref` inline vs runtime Read:** since reporter always runs CLI, inline/preloaded is usually cheaper than runtime read (same content tokens, less read/tool overhead).
- **Background vs foreground Task dispatch:** major cost is similar (both isolated contexts). Background adds polling overhead (`TaskOutput`) roughly `200–600` tokens/topic.
- **CLI vs web-only:** CLI compact (`800–1,600` tokens/topic) is only a win if it displaces web ingestion. Without truncation/top-K filtering, it can become net bloat.
- **Morgue ROI:** if lookup costs `300–700` tokens and rerun costs `4k–6k`, break-even hit rate is roughly `6–15%` (index-first lookup required).

5. **Nice-to-haves**
- Add per-dispatch token telemetry by phase (desk load, reporter bootstrap, CLI ingest, web ingest, synthesis, wire ops).
- Define mode-specific budgets (`recon`, `monitor`, `community`, `verify`, `deep`) instead of one shared budget.
- Keep full wire payload out of Task metadata/list views; store summary only and archive full body elsewhere.
- Add wire TTL/pruning plus filtered/paginated `wire-check`.

6. **Questions for the author**
- What is the hard cap on topics per `/newsroom:dispatch` in v1?
- Are `mode-playbook` and `wire-protocol` reads conditional for no-flag dispatches?
- What are explicit token budgets per mode (input + output)?
- How many `TaskList` calls happen in a standard dispatch/wire-check flow?
- Is morgue lookup index-first, with full read only on cache hit?
- Nathan, what weekly/monthly invocation volume should we use for cost projections?