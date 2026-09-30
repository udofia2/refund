# WORKNOON Refund System

AI-powered customer support refund system: processes e-commerce refund requests against a configurable policy engine with LLM-assisted request understanding and response generation.

## Prerequisites

- Docker
- Docker Compose

## Run

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000 (docs at http://localhost:8000/docs)

## Configuration

Copy `.env.example` to `.env` and set your LLM provider credentials (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`). Without an API key the app falls back to a deterministic mock provider.

> Full documentation (architecture, AI integration, assumptions) arrives in Task 9.
