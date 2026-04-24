# GitHub Upload Guide

このファイルは「GitHub に上げてよいもの / 上げないもの」の整理用です。

## Upload OK (recommended)

- `backend-go/*.go`
- `backend-go/go.mod`
- `backend-go/go.sum`
- `backend-go/API_MIGRATION_INVENTORY.md`
- `render.yaml`
- `RENDER_SETUP.md`
- `deploy-go/**`
- `board/**`
- `question-box/**`
- `supabase-client.js`
- `api-client.js`
- `account.html`
- `scripts/cloudinary-cleanup.js`
- `.github/workflows/cloudinary_cleanup.yml`

## Do NOT upload

- `backend-go/.env`
- `backend-go/backend-go` (built binary)
- any file containing secrets/tokens/credentials

## Security note

If any keys were exposed, rotate them first:

- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Then update Render environment variables with the rotated values.
