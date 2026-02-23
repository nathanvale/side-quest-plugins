---
name: {{SKILL_NAME}}
description: >
  {{DESCRIPTION}}
allowed-tools: {{MCP_TOOLS}}
{{OPTIONAL_FIELDS}}
---

# {{TITLE}}

{{PREAMBLE}}

## MCP Server Requirements

This skill requires the following MCP server(s):
{{MCP_REQUIREMENTS}}

## Workflow

### Step 1: {{STEP_1_NAME}}

{{STEP_1_BODY}}

### Step 2: {{STEP_2_NAME}}

{{STEP_2_BODY}}

### Step 3: {{STEP_3_NAME}}

{{STEP_3_BODY}}

{{ADDITIONAL_STEPS}}

## Error Handling

### Connection Failures

If the MCP server is unreachable:
1. Check the server is running (`/mcp-manager:list` to verify status)
2. Restart the server if needed
3. Report the error clearly -- do not retry silently

### Authentication Errors

If the MCP server returns auth errors:
1. Check API keys/tokens are configured
2. Verify permissions for the requested operation
3. Guide the user to the server's configuration

### Rate Limits

If the MCP server returns rate limit errors:
1. Report the limit to the user
2. Suggest waiting or reducing batch size
3. Do not retry automatically without user consent

## Examples

{{EXAMPLES}}

## References

- MCP documentation: modelcontextprotocol.io
{{ADDITIONAL_REFERENCES}}
