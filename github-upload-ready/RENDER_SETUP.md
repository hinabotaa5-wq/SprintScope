# Render setup

This project uses:
- `deploy-go/` for static frontend hosting (e.g. Netlify)
- `backend-go/` for Go API hosting (Render web service)

## 1) Create Render service

1. Push this repository to GitHub.
2. In Render, create a new **Web Service** from the repo.
3. Render will detect `render.yaml` automatically.
4. Set these environment variables in Render:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CLOUDINARY_CLOUD_NAME` (default can be `doipeut1j`)
   - `CLOUDINARY_UPLOAD_PRESET` (default can be `sprint_preset`)
   - `ALLOWED_ORIGINS` (comma-separated; include your Netlify URL)

## 2) Confirm API is live

After deploy, open:
- `https://<your-render-service>.onrender.com/healthz`

Expected response:
- `{"status":"ok"}`

## 3) Connect Netlify frontend to Render API

Frontend code reads `window.SPRINT_API_BASE`, otherwise defaults to `http://localhost:8080`.

Before scripts load in your HTML pages, inject:

```html
<script>
  window.SPRINT_API_BASE = "https://<your-render-service>.onrender.com";
</script>
```

At minimum, add this to:
- `deploy-go/index.html`
- `deploy-go/account.html`
- `deploy-go/board/index.html`
- `deploy-go/question-box/pages/questioner.html`
- `deploy-go/question-box/pages/questioner_hub.html`
- `deploy-go/question-box/pages/coach.html`
- `deploy-go/question-box/pages/qb_top.html` (if it loads auth/client scripts)

## 4) CORS reminder

Set `ALLOWED_ORIGINS` in Render to your Netlify domain(s), for example:

`https://your-site.netlify.app,https://preview-site.netlify.app`
