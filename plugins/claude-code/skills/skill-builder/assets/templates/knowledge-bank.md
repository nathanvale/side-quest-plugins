---
name: {{SKILL_NAME}}
description: >
  {{DESCRIPTION}}
allowed-tools: Read, Glob, Grep
{{OPTIONAL_FIELDS}}---

# {{TITLE}}

{{PREAMBLE}}

## Step 1: Classify the Question

Parse the user's question into one or more intent categories.

| Intent | Trigger Signals | Reference File |
|--------|----------------|----------------|
{{CLASSIFICATION_ROWS}}

## Step 2: Read Reference Files

Read the relevant reference file(s) based on the classification. For multi-intent questions, read all relevant files.

## Step 3: Synthesize Answer

### Response Structure

1. **Direct answer** -- one-line answer, no preamble
2. **Supporting detail** -- from reference files, with examples
3. **Verify step** -- how to confirm it works
4. **Common failure** -- what goes wrong and how to fix
5. **Source** -- reference file cited

{{ADDITIONAL_GUIDELINES}}

## Examples

{{EXAMPLES}}
