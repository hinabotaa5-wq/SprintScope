.PHONY: dev

dev:
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from .env.example"; fi
	set -a && . ./.env && set +a && go run .
