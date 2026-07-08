
SHELL := /usr/bin/env bash
COMPOSE_DEV := docker compose -f server_2/docker-compose.yml -f server_2/docker-compose.dev.yml
COMPOSE_PROD := docker compose -f deploy/docker-compose.prod.yml

.DEFAULT_GOAL := help

.PHONY: help dev-up dev-up-backend dev-down dev-reset seed monitor health logs \
        prod-up prod-down prod-cert prod-deploy prod-health prod-backup \
        prod-rollback prod-seed prod-smoke prod-logs \
        build test-backend test-frontend test-e2e

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

dev-up: ## Boot backend stack + frontend dev server (:3100)
	./ops/dev-start.sh

dev-up-backend: ## Boot backend stack only (no frontend)
	./ops/dev-start.sh --no-frontend

dev-down: ## Stop the dev stack (KEEP data volumes)
	./ops/dev-stop.sh

dev-reset: ## Stop the dev stack AND drop data volumes (clean slate)
	./ops/dev-stop.sh --volumes

seed: ## Provision the 4 demo accounts + demo restaurant (stack must be up)
	./ops/seed-demo.sh

monitor: ## Read-only health snapshot (containers, RS, Redis, queues, outbox)
	./ops/monitor.sh

health: ## Pass/fail readiness probe (exits non-zero on failure)
	./ops/healthcheck.sh

logs: ## Tail all dev-stack logs (make logs SVC=api for one service)
	./ops/logs.sh $(SVC)

prod-cert: ## Generate a local self-signed TLS cert for the HTTPS edge
	./deploy/nginx/gen-cert.sh

prod-up: ## Build + start the same-origin production stack (deploy/)
	$(COMPOSE_PROD) up -d --build

prod-down: ## Stop the production stack (add ARGS=-v to drop volumes)
	$(COMPOSE_PROD) down $(ARGS)

prod-deploy: ## One-command prod bring-up (preflight → build → wait-for-health)
	./deploy/deploy.sh

prod-health: ## Prod pass/fail readiness probe against the deploy-* stack + HTTPS edge
	./deploy/healthcheck.sh

prod-backup: ## Dump Mongo to deploy/backups/flavorstack-<UTC>.gz (prunes to last N)
	./deploy/backup.sh

prod-rollback: ## Restore the latest (or NAMED) backup + redeploy (add ARGS=--yes to skip prompt)
	./deploy/rollback.sh $(ARGS)

prod-seed: ## Seed the 4 demo accounts against the prod HTTPS edge (deploy-mongo-1)
	MONGO_CONTAINER=deploy-mongo-1 API_BASE=https://localhost CURL_INSECURE=1 ./ops/seed-demo.sh

prod-smoke: ## Run the prod-smoke Playwright lane (cookies/refresh/WSS through nginx)
	cd my-app && E2E_MONGO_CONTAINER=deploy-mongo-1 npm run test:e2e:prod-smoke

prod-logs: ## Tail production-stack logs (make prod-logs SVC=api for one service)
	$(COMPOSE_PROD) logs -f --tail=100 $(SVC)

build: ## Compile the backend (server_2 tsc build)
	cd server_2 && npm run build

test-backend: ## Run backend unit tests (jest --runInBand)
	cd server_2 && npm test

test-frontend: ## Run frontend unit tests (vitest)
	cd my-app && npm test

test-e2e: ## Run the Playwright E2E suite (needs a seeded dev stack)
	cd my-app && npm run test:e2e
