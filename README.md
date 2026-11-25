# Switchboard

A local-first job-switch operating system for backend engineers: AI-coach workouts, DSA practice, skill readiness, revision queue, job pipeline, and resume/LinkedIn improvement actions.

It includes an SDE 1/2/3 interview map that covers the broader backend interview surface—not one language stack: DSA, coding/test quality, APIs and data, concurrency, system design, distributed systems, OS/networking/security, reliability/observability, and behavioral/leadership.

## Run locally

```bash
npm install
npm run server
```

In another terminal:

```bash
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). Local data is saved to `data/switchboard.json` by the API.

## MongoDB backup

Copy `.env.example` to `.env`, then set `MONGODB_URI` to a MongoDB Atlas connection string. The API writes every complete state update locally first, then upserts a backup copy to MongoDB. In a hosted deployment, MongoDB becomes the durable backup because the web host's local filesystem is ephemeral.

## Free deployment

The included `render.yaml` is ready for Render. Push this folder to GitHub, create an Atlas Free cluster, then in Render choose **New → Blueprint** and select the repository. Add `MONGODB_URI` as a secret environment variable. The free service may take about a minute to wake after 15 minutes idle.

For a personal project, Vercel Hobby plus Atlas is another free option, but the current Express server would need a serverless-function adapter. Render is the direct, zero-code-change route.

## Interview sharing and video

The UI contains a consent-first interview studio and private sharing controls. Before exposing it beyond yourself, add authentication (for example, Auth.js/Clerk), server-enforced resource permissions, and an audited invitation flow. A real multi-person video room also needs a configured video provider (Daily, Twilio Video, or a self-hosted Jitsi deployment); provider credentials and the user's consent should be required before creating or recording a room. Those are intentionally not hardwired into a personal tracker without your chosen provider/account.

## Enable live AI coaching

Set `OPENAI_API_KEY` in `.env` and restart the API. The key stays on the server, and `/api/coach` generates the one-at-a-time exercise or interviewer-only question pack. Configure `JITSI_DOMAIN` with a private Jitsi deployment to receive a live-room URL only after explicit consent.
