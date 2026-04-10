# CloudBox — Production-Grade Cloud Storage 

A full-stack Dropbox-like system built from scratch.

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20, TypeScript, Express, Prisma |
| Frontend | Next.js 14, Tailwind CSS, Zustand, TanStack Query |
| Database | PostgreSQL 16 (Aurora Serverless in prod) |
| Cache | Redis 7 (ElastiCache in prod) |
| Queue | Kafka (MSK in prod) |
| Storage | S3 / MinIO (local dev) |
| Auth | JWT (15m) + rotating refresh tokens |
| Deploy | Docker, Kubernetes (EKS), Terraform, GitHub Actions |

## Quick Start

```bash
# 1. Clone and set up environment
git clone <repo>
cd dropbox
cp .env.example .env

# 2. Start everything
make up

# 3. Run migrations + seed demo users
make migrate
make seed
```

Open [http://localhost:3000](http://localhost:3000)

Demo credentials:
- `alice@example.com` / `Password123!`
- `bob@example.com` / `Password123!`

## Services

| Service | URL |
|---|---|
| App (frontend) | http://localhost:3000 |
| API (backend)  | http://localhost:4000 |
| MinIO console  | http://localhost:9001 |
| Grafana        | http://localhost:3001 |
| Prometheus     | http://localhost:9090 |
| DB Studio      | `make db-studio` |

## Architecture

```
Client → CloudFront → ALB → EKS (backend / frontend)
                               ↓
                    PostgreSQL + Redis + Kafka + S3
```

## Key Features

- **Chunked uploads**: Files split into 10MB parts, uploaded directly to S3 via presigned URLs
- **Resumable**: Lost connection? Resume from last confirmed chunk
- **Versioning**: Last 10 versions kept per file, one-click restore
- **Deduplication**: SHA-256 checksum — same content = one S3 object
- **Real-time sync**: WebSocket + Kafka — changes appear on all devices instantly
- **Sharing**: Public links with optional password + expiry
- **Security**: JWT + refresh token rotation, rate limiting, helmet headers

## Project Structure

```
dropbox/
├── backend/          Node.js API server
│   ├── src/
│   │   ├── modules/  auth, files, folders, shares, sync
│   │   ├── middleware/
│   │   ├── infrastructure/  db, redis, kafka, s3
│   │   └── jobs/     cron housekeeping
│   └── prisma/       schema + migrations
├── frontend/         Next.js app
│   └── src/
│       ├── app/      pages (auth, dashboard, share)
│       ├── components/
│       ├── hooks/    useUpload, useSync
│       └── store/    authStore, uploadStore
├── infra/
│   ├── k8s/          Kubernetes manifests
│   ├── prometheus/   Scrape config
│   └── terraform/    AWS infrastructure (Phase 4)
├── .github/workflows/ CI/CD pipeline
├── docker-compose.yml
└── Makefile
```

## API Reference

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me

POST /api/files/upload/init
POST /api/files/upload/:sessionId/chunk
POST /api/files/upload/:sessionId/complete
GET  /api/files/upload/:sessionId/status
GET  /api/files?folderId=&page=
GET  /api/files/:fileId/download
DEL  /api/files/:fileId
GET  /api/files/:fileId/versions
POST /api/files/:fileId/versions/:versionId/restore

POST /api/folders
GET  /api/folders/:folderId
PATCH /api/folders/:folderId
DEL  /api/folders/:folderId

POST /api/shares
GET  /api/shares/mine
GET  /api/shares/:token/access
DEL  /api/shares/:shareId

WS   /sync  (auth, heartbeat → sync:file:uploaded, sync:file:deleted)
```

## Production Deployment

See [Phase 4 Infrastructure](./infra/) for:
- Terraform AWS setup (VPC, EKS, RDS Aurora, ElastiCache, S3, CloudFront)
- Kubernetes manifests with HPA, PDB, topology spread
- GitHub Actions CI/CD pipeline with multi-arch Docker builds
