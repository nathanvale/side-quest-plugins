---
name: program-security-scan
description: >
  Security scanning program (stub). Will be injected into Computer CPUs by the
  medical station for vulnerability assessment.
status: stub
---

# Program: Security Scan (Not Yet Operational)

This program is under development. The medical station will load it when operational.

## Rough Spec

**Expected inputs:**
```json
{
  "path": "src/",
  "doc_type": "scan",
  "file_manifest": [{"name": "api.ts", "size": 3072}, ...],
  "scan_scope": "dependencies|code|config|all",
  "plain": false,
  "budget": {"max_files": 40, "max_lines_per_file": 500}
}
```

**Expected outputs:**
- Vulnerabilities grouped by OWASP category
- Severity ratings (critical, high, medium, low)
- Affected file paths with line references
- Remediation suggestions
- Dependency vulnerability cross-reference (if package.json present)

**Analysis approach:**
1. Read configuration files first (package.json, tsconfig, env patterns)
2. Scan for common vulnerability patterns (injection, XSS, auth issues)
3. Check dependency versions against known vulnerability patterns
4. Cross-reference with OWASP Top 10 categories
5. Generate structured vulnerability report
