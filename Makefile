.PHONY: help up down logs migrate seed install build clean

help:   ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

up:     ## Start all services (infra + app)
	cp -n .env.example .env 2>/dev/null || true
	docker compose up -d
	@echo ""
	@echo "  Frontend  → http://localhost:3000"
	@echo "  Backend   → http://localhost:4000"
	@echo "  MinIO     → http://localhost:9001  (minioadmin / minioadmin)"
	@echo "  Grafana   → http://localhost:3001  (admin / admin)"
	@echo "  Prometheus→ http://localhost:9090"
	@echo ""

down:   ## Stop all services
	docker compose down

logs:   ## Stream backend logs
	docker compose logs -f backend

migrate: ## Run database migrations
	docker compose exec backend npx prisma migrate dev

seed:   ## Seed database with demo data
	docker compose exec backend npx tsx prisma/seed.ts

install: ## Install all npm dependencies locally
	cd backend  && npm install
	cd frontend && npm install

build:  ## Build production Docker images
	docker compose build

db-studio: ## Open Prisma Studio (DB GUI)
	docker compose exec backend npx prisma studio

clean:  ## Remove all containers and volumes (DESTRUCTIVE)
	docker compose down -v --remove-orphans

reset:  ## Full reset: clean + up + migrate + seed
	$(MAKE) clean
	$(MAKE) up
	sleep 10
	$(MAKE) migrate
	$(MAKE) seed
