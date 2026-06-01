# ClientSuccess MCP Server

An [MCP](https://modelcontextprotocol.io/) server for [ClientSuccess](https://www.clientsuccess.com/) — the customer success platform. Provides AI assistants with read, write, and analysis tools covering your full ClientSuccess portfolio.

## Features

- **8 consolidated tools** covering clients, contacts, health scores, interactions, tasks, contracts, renewals, and portfolio intelligence
- **Concise/detailed response modes** — reduce token usage on large lists
- **Configurable segment filtering** — split your portfolio by product, region, or any custom field
- **Tool annotations** — read/write/destructive hints for safe AI autonomy
- **Structured logging** — JSON to stderr, level-controlled
- **Auto-authentication** — username/password login with token caching and auto-refresh

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your ClientSuccess credentials
npm run build
npm start
```

## Installation (Claude Desktop / MCPB)

1. Build the `.mcpb` package: `npm run build:mcpb`
2. Install in Claude Desktop (drag or double-click the `.mcpb` file)
3. Enter your credentials when prompted

## Tools

| Tool | Mode | Description |
|------|------|-------------|
| `list_data` | read | List/search clients, contacts, interactions, tasks, renewals, products |
| `get_data` | read | Full details for a client, contact, interaction, task, contracts, score, or pulse history |
| `create_data` | write | Create contacts, tasks, interactions, or pulse/health entries |
| `update_data` | write | Update clients, contacts, tasks, interactions. Complete tasks. |
| `delete_data` | destructive | Delete interactions (irreversible) |
| `analyze_portfolio` | read | Executive summary, health distribution, CSM book, at-risk, neglected, churn, missing tasks |
| `analyze_client` | read | Full 360° view: profile + contacts + interactions + contracts + pulse |
| `lookup_reference` | read | Statuses, segments, employees, custom field definitions, interaction types |

## Configuration

### Required

| Variable | Description |
|---|---|
| `CS_USERNAME` | Your ClientSuccess login email |
| `CS_PASSWORD` | Your ClientSuccess password |

### Optional

| Variable | Description | Example |
|---|---|---|
| `CS_LOG_LEVEL` | Log verbosity: debug, info, warn, error | `warn` |
| `CS_SEGMENT_FIELD` | Custom field key for client segmentation | `system__cs` |
| `CS_SEGMENT_VALUES` | JSON map of segment names → field values | `{"ProductA": "", "ProductB": "productb"}` |
| `CS_RENEWAL_DATE_FIELD` | Custom field key holding renewal date | `Next_Renewal_Date__cs` |

### Segment filtering

If your ClientSuccess account manages multiple products or business units, you can configure segment-based filtering:

1. Set `CS_SEGMENT_FIELD` to the custom field key that distinguishes your segments
2. Set `CS_SEGMENT_VALUES` to a JSON object mapping friendly names to field values
3. Use `segment_filter` parameter in list/analysis tools to scope queries

Empty string (`""`) in segment values matches clients where the field is null or empty.

## Development

```bash
npm install            # Install dependencies
npm run build          # Compile TypeScript → dist/
npm run typecheck      # Type check without emitting
npm start              # Run the compiled server
npm run build:mcpb     # Compile + package as .mcpb
```

## Architecture

```
src/
├── index.ts                       # Server bootstrap, 8 tools, central error handling
├── api/
│   ├── client.ts                  # CSClient class (auth, retry, cache, timeout)
│   └── types.ts                   # TypeScript types
├── tools/
│   ├── dispatchers/               # Tool schemas + routing (thin layer)
│   └── handlers/                  # Pure handler functions (business logic)
│       └── analysis/              # Portfolio intelligence handlers
└── utils/                         # Logger, cache, errors, formatters, constants
```

### Design principles

- **Dispatchers are thin** — route by data_type, define schemas, nothing else
- **Handlers are pure** — receive client + args, return toolResult(). No MCP SDK dependency.
- **One API client** — all HTTP in a single class with auth, retry, cache, timeout
- **Central error handling** — typed errors caught in index.ts, mapped to user-friendly messages
- **No company-specific logic** — all customisation via environment variables

## Using with a skill/steering file

For richer AI behaviour (workflow rules, pre-call checklists, domain context), pair this MCP with a skill or steering file in your AI assistant's configuration. The MCP is a generic API bridge; the skill makes it smart for your specific use case.

## License

MIT — see [LICENSE](LICENSE).
