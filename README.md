# Switchboard

A local-first job-switch tracker for software engineers: practice questions, answer scoring, a DSA list, spaced revision, a job pipeline, resume checks and mock-interview guides, with levels SDE 1 to SDE 3.

## Run locally

Needs Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, then fill in **Profile**. Data is saved to `data/switchboard.json`.

For a single-process production build on your own computer: `npm run build && npm start`, then open `http://localhost:8787`.

## Guided DSA practice

The DSA lab has 155 well-known problems grouped by pattern, each linked to LeetCode and to a search of the codestorywithMIK channel. You can add problems from another sheet and save a playlist per pattern.

The **Speak** button turns English, Hinglish or Hindi-mixed speech into text in the message box using the browser’s speech recognition (Chrome, Edge or Safari). The browser may send the audio to its vendor’s servers.

With AI on, opening a problem shows a statement, examples, constraints and test cases written by the AI in its own words. It is created once per problem and saved; verify doubtful cases on LeetCode.

On a session: discuss your approach with the coach (or choose **Teach me story-first** for a five-step lesson), write code in the built-in editor, then submit it for review and ask for hints as needed. The AI reads your code but does not run it; confirm on LeetCode. This project is not affiliated with LeetCode or codestorywithMIK.

## The practice loop

1. Start a workout or pick a DSA problem.
2. Write your answer on the session page.
3. Get AI feedback and a score, or score yourself.
4. Gaps join the revision queue, due after 1, 3, 7, 14 and 30 days.

## Optional setup

Copy `.env.example` to `.env`, fill in what you need and restart.

| Setting          | Effect                                                                         |
| ---------------- | ------------------------------------------------------------------------------ |
| `OPENAI_API_KEY` | Live questions, answer scoring, interviewer guides, resume and LaTeX rewriting |
| `MONGODB_URI`    | Backup copy in MongoDB. The newer of the local and backup copies wins          |
| `JITSI_DOMAIN`   | Video room links for mock interviews                                           |
| `APP_PASSWORD`   | Required for hosting, at least 12 characters                                   |

Without an API key you get a built-in question bank, self-scoring and a rule-based resume checklist. Built-in mode never writes resume content.

## What leaves your computer

With AI enabled, your role, level, experience, stack, the exercise and your answer are sent to OpenAI. A resume review or LaTeX rewrite also sends that document and the job description. With MongoDB enabled, all saved data, including session chats, code, scores and questions, is copied there. A failed copy is retried automatically, and the app shows a warning until it succeeds.

## Hosting

`render.yaml` deploys to Render: choose **New → Blueprint**, then set `APP_PASSWORD` (the server will not start without it) and `MONGODB_URI`. The host's disk is temporary, so without MongoDB your data is lost on restart.

This is a single-user app with one shared password. Mentor links are read-only and can be revoked.

## Develop

```bash
npm test
npm run format
```
