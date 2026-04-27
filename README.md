# Centralized Logging System for Cloudflare Workers

A centralized logging system for Cloudflare Workers built with [Astro](https://astro.build/), [Hono](https://hono.dev/), [Drizzle ORM](https://orm.drizzle.team/), and [shadcn/ui](https://ui.shadcn.com/).

This system uses Cloudflare Workers Tail Consumers to collect real-time logs, exceptions, and telemetry from all your Workers and stores them in a D1 database for easy querying and visualization.

## Features

- 🔥 **Real-time Log Collection**: Automatically capture logs from all your Workers using tail consumers
- 📊 **Global Dashboard**: View error rates and statistics across all Workers
- 🔍 **Worker Explorer**: Drill down into specific Workers to see detailed logs and stack traces
- 📈 **Error Analytics**: Track error rates, exceptions, and performance issues
- 🚀 **OpenAPI Documentation**: Full API documentation with Swagger and Scalar
- ⚡ **Performance**: Uses `ctx.waitUntil()` for non-blocking batch inserts

---

## Getting Started

Before you begin, ensure that you have **Node.js** and **npm** installed.

### Setup

```bash
git clone https://github.com/jmbish04/core-tail
cd core-tail
npm install
```

### Create D1 Database

```bash
# Create a D1 database
npx wrangler d1 create logs-db

# Update wrangler.jsonc with the database ID from the output above
```

### Apply Migrations

```bash
# Apply migrations locally for development
npm run migrate:local

# Or apply to remote for production
npm run migrate:remote
```

### Development

```bash
# Build the Astro frontend
npm run build

# Start the Worker locally
npm run preview
```

Open your browser and go to [http://localhost:8787](http://localhost:8787) to see the app running.

### Deploy

```bash
npm run deploy
```

## Configuring Tail Consumers

To send logs from your other Workers to this centralized logging system, add a tail consumer configuration to each Worker's `wrangler.jsonc`:

```jsonc
{
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2024-04-01",
  "tail_consumers": [
    {
      "service": "central-log-worker",
    },
  ],
}
```

For detailed setup instructions, visit the `/setup` page in the deployed application.

## Pages

- `/dashboard` - Global dashboard showing errors across all Workers
- `/worker/[name]` - Detailed view of logs for a specific Worker
- `/setup` - Step-by-step guide for configuring tail consumers
- `/docs` - OpenAPI documentation (Scalar UI)
- `/swagger` - Swagger UI documentation

## API Endpoints

- `GET /api/logs` - Get filtered worker logs
  - Query params: `workerName`, `outcome`, `limit`, `offset`, `since`
- `GET /api/logs/workers` - Get list of unique worker names
- `GET /api/logs/stats` - Get error rate statistics
- `GET /api/logs/:id` - Get a specific log entry by ID

## Stack

- **Frontend**: Astro + React + Tailwind CSS + shadcn/ui
- **Backend**: Hono (API framework)
- **Database**: Cloudflare D1 + Drizzle ORM
- **Logging**: Cloudflare Workers Tail Consumers
- **Documentation**: OpenAPI 3.1.0 + Scalar + Swagger UI

## Architecture

### Tail Handler

The Worker implements the `tail()` handler to receive trace events from other Workers:

```typescript
async tail(events: TailEvent, env: Bindings, ctx: ExecutionContext) {
  // Process tail events and batch insert into D1
  const db = drizzle(env.DB);

  const logEntries = events.events.map((event: TraceEvent) => ({
    workerName: event.scriptName || 'unknown',
    eventTimestamp: new Date(event.eventTimestamp),
    outcome: event.outcome,
    logs: event.logs ? JSON.stringify(event.logs) : null,
    exceptions: event.exceptions ? JSON.stringify(event.exceptions) : null,
    // ... more fields
  }));

  // Use waitUntil to batch insert without blocking
  ctx.waitUntil(
    db.insert(workerLogs).values(logEntries)
  );
}
```

### Database Schema

The `worker_logs` table stores all log entries:

- `id` - Auto-incrementing primary key
- `worker_name` - Name of the Worker that generated the log
- `event_timestamp` - When the event occurred
- `outcome` - Result: 'ok', 'exception', 'canceled', etc.
- `script_name` - Script name from the trace event
- `logs` - JSON array of log messages
- `exceptions` - JSON array of exception details
- `status_code` - HTTP response status code
- `request_url` - Request URL
- `request_method` - HTTP method

## License

This project is licensed under the [MIT License](LICENSE).
