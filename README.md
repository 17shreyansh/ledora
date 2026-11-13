<p align="center"><img src="brand/ledora-logo.svg" width="96" alt="Ledora"></p>

# Ledora

One script on a website; one place to see visitors, talk to them, capture and manage leads, and
know when the site is down. This repository is the Ledora platform: API, background workers,
customer app and shared contracts.

> **Status:** Phase 1 (foundation) — accounts, organizations, team roles and the customer app
> shell. See [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) for exactly what works and
> [`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md) for what comes next.

## Repository

| Path | What |
| --- | --- |
| `packages/shared` | Zod schemas, DTO types, roles/permissions, slug rules — the API contract |
| `server` | Express 5 + Mongoose API (`src/server.ts`) and BullMQ worker (`src/worker.ts`) |
| `apps/web` | Customer app — React, Vite, MUI, TanStack Query |
| `brand` | Official logo (do not modify) |
| `docs` | Architecture, schema, API, security, deployment, testing, decisions |

## Local development

Requirements: Node.js ≥ 20.11 (22 recommended), Docker (for MongoDB/Redis).

```bash
docker run -d --name ledora-mongo -p 27017:27017 mongo:7.0 --replSet rs0 --bind_ip_all
```

```bash
docker exec ledora-mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

```bash
docker run -d --name ledora-redis -p 6379:6379 redis:7
```

```bash
cp .env.example .env   # then set AUTH_SECRET (≥ 32 chars)
npm install
npm run build -w @ledora/shared
```

Run each in its own terminal:

```bash
npm run dev:server
```

```bash
npm run dev:worker
```

```bash
npm run dev:web
```

The app is on http://localhost:5173, the API on http://localhost:4000. With `MAIL_TRANSPORT=log`
the worker prints verification and invitation links to its log instead of sending email.

## Quality gates

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Tests run against real MongoDB and Redis — see [`docs/TESTING.md`](docs/TESTING.md).

## Documentation

[Product](docs/PRODUCT_OVERVIEW.md) · [Architecture](docs/ARCHITECTURE.md) ·
[Database](docs/DATABASE_SCHEMA.md) · [API](docs/API_REFERENCE.md) · [Security](docs/SECURITY.md) ·
[Environment](docs/ENVIRONMENT_VARIABLES.md) · [Deployment](docs/DEPLOYMENT.md) ·
[Testing](docs/TESTING.md) · [SDK](docs/SDK_INTEGRATION.md) · [Roadmap](docs/DEVELOPMENT_ROADMAP.md) ·
[Decisions](docs/DECISIONS.md) · [Phase 0 audit](docs/PHASE0_AUDIT.md) ·
[Known issues](KNOWN_ISSUES.md)
