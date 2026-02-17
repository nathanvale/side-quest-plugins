---
name: api-contracts
description: >
  Knowledge skill for API contracts and endpoint patterns. Injected into
  Builder and Validator agents during engage to enforce consistent API
  design, error handling, and request/response schemas. Not user-invocable.
user-invocable: false
---

# Knowledge: API Contracts

This knowledge skill provides context about API design patterns and contracts. Injected into Builder (Scotty) and Validator (McCoy) agents during engage.

## Endpoint Patterns

### Route Structure

```typescript
// Routes follow RESTful conventions
GET    /api/{resource}          -- List resources
GET    /api/{resource}/:id      -- Get single resource
POST   /api/{resource}          -- Create resource
PUT    /api/{resource}/:id      -- Update resource (full replace)
PATCH  /api/{resource}/:id      -- Update resource (partial)
DELETE /api/{resource}/:id      -- Delete resource
```

### Handler Shape

```typescript
export const handleGetResource = async (req: Request): Promise<Response> => {
  // 1. Parse and validate input
  const params = validateParams(req);

  // 2. Execute business logic
  const result = await service.getResource(params.id);

  // 3. Return structured response
  return Response.json({ data: result });
};
```

## Error Format

All API errors follow a consistent shape:

```typescript
interface ApiError {
  error: {
    code: string;        // Machine-readable: 'NOT_FOUND', 'VALIDATION_ERROR'
    message: string;     // Human-readable description
    details?: unknown;   // Additional context (validation errors, etc.)
  };
}
```

### Error Response Examples

```json
// 400 - Validation error
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": { "field": "name", "issue": "required" } } }

// 404 - Not found
{ "error": { "code": "NOT_FOUND", "message": "Resource not found" } }

// 500 - Internal error
{ "error": { "code": "INTERNAL_ERROR", "message": "An unexpected error occurred" } }
```

### Error Codes

| HTTP Status | Error Code | When to Use |
|-------------|-----------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid input, missing required fields |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Authenticated but not authorized |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Resource already exists, version conflict |
| 422 | `UNPROCESSABLE` | Valid syntax but semantic error |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

## Request/Response Schemas

### Validation at the Boundary

- Validate ALL user input at the API boundary -- never trust incoming data
- Use `validateRequired`, `validateJson` from core utilities
- Parse, then validate, then use typed data internally

### Response Envelope

```typescript
// Success response
{ "data": T }

// List response
{ "data": T[], "meta": { "total": number, "page": number, "limit": number } }

// Error response
{ "error": { "code": string, "message": string } }
```

## Auth Patterns

- Bearer token in `Authorization` header
- Validate token before processing request
- Return 401 for missing/invalid token, 403 for insufficient permissions
- Never log tokens or include them in error details

## What Builders Need

- Follow RESTful route conventions
- Use the standard error format for all error responses
- Validate input at the boundary using core utilities
- Wrap responses in the standard envelope (`{ data }` or `{ error }`)
- Handle all error paths explicitly -- do not let unhandled errors leak

## What Validators Should Flag

- Non-standard error formats (missing `code` or `message`)
- Missing input validation at API boundary
- Inconsistent response envelopes
- Leaking internal errors (stack traces) to clients
- Missing auth checks on protected endpoints
- Using raw status codes without error body
- Logging sensitive data (tokens, passwords, PII)
