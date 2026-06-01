# Contributing

Thanks for your interest in contributing to the ClientSuccess MCP server.

## Getting started

```bash
git clone https://github.com/your-org/clientsuccess-mcp.git
cd clientsuccess-mcp
npm install
cp .env.example .env
# Edit .env with your ClientSuccess credentials
npm run build
npm start
```

## Development workflow

1. Make changes in `src/`
2. Run `npm run build` to compile TypeScript
3. Run `npm run typecheck` for type checking without emitting
4. Test manually with `npm start` (requires credentials in `.env`)

## Architecture

- **Dispatchers** (`src/tools/dispatchers/`) — Tool definitions, input schemas, routing. Keep these thin.
- **Handlers** (`src/tools/handlers/`) — Pure business logic. No MCP SDK dependency. Easy to test.
- **API client** (`src/api/client.ts`) — All HTTP interaction. Auth, retry, caching, pagination.
- **Utils** (`src/utils/`) — Shared utilities. Logging, formatting, error types, constants.

## Adding a new data_type to an existing tool

1. Write the handler function in the appropriate handlers file
2. Add it to the dispatcher's handler map
3. Update the tool description to document the new data_type
4. Rebuild and test

## Adding a new tool

1. Create a new dispatcher in `src/tools/dispatchers/`
2. Register it in `src/index.ts` in the `registerTools()` function
3. Set the appropriate `mode` ('write' or 'destructive' for non-read tools)
4. Update `manifest.json` with the new tool entry

## Code style

- TypeScript strict mode
- Pure handler functions (no side effects beyond API calls)
- Consistent error handling via `ApiError` / `ValidationError`
- Use `toolResult()` / `toolError()` for all responses

## Pull requests

- Keep PRs focused on a single change
- Include a description of what the change does and why
- Ensure `npm run typecheck` passes
