# Deployment

Status: **reference design**. Phase 1 has been run locally and in tests only; no production
environment exists yet. Commands below are the intended procedure and must be validated on the
first real deployment.

## Topology

- Cloudflare (DNS, TLS edge, WAF, caching for `cdn.`) → Nginx (TLS, `X-Request-Id`, body limits,
  proxy to PM2) → API processes (PM2 cluster) and worker processes (PM2 fork) on the same or
  separate hosts.
- MongoDB Atlas (replica set, continuous backup) and managed Redis (persistence on, `noeviction`
  policy — BullMQ requires it).

## Build

```bash
npm ci
npm run build          # shared → server → web
```

Artifacts: `server/dist/` (API + worker), `apps/web/dist/` (static, served by Nginx or object storage + CDN).

## Release steps

1. Set environment variables (see `ENVIRONMENT_VARIABLES.md`); `NODE_ENV=production`, `MAIL_TRANSPORT=smtp`.
2. Build indexes **before** routing traffic (production does not auto-build at boot):
   `npm run db:indexes -w @ledora/server` (additive; never drops indexes).
3. Start/reload: `pm2 startOrReload ecosystem.config.cjs` (repo root) with two apps:
   `ledora-api` (`server/dist/server.js`, `exec_mode: cluster`, `instances: max`) and
   `ledora-worker` (`server/dist/worker.js`, `instances: 2`). PM2 sends SIGINT/SIGTERM; both
   processes shut down gracefully.
4. Health: load balancer liveness → `GET /healthz`, readiness → `GET /readyz` (do not expose
   `/readyz` publicly; restrict in Nginx to internal networks).

## Nginx essentials

```nginx
server {
  server_name api.ledora.com;
  client_max_body_size 1m;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-Id $request_id;
  }
  location = /readyz { allow 10.0.0.0/8; deny all; proxy_pass http://127.0.0.1:4000; }
}
```

## Backups and recovery

- Atlas continuous backup with point-in-time restore; **monthly restore drill** into a scratch
  cluster, verified by running the integration suite's read checks against it (procedure to be
  written in Phase 10).
- Redis holds only queues, rate-limit counters and cooldowns; losing it delays emails but loses
  no business data (jobs are re-creatable by re-requesting).
