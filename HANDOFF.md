# Agent handoff

Pace is a deployed mobile-first calorie and weight tracker built with Next.js 16, React 19, Tailwind CSS 4, and private Vercel Blob storage. Production: https://addys-health.vercel.app/.

The app supports username-based cloud profiles, food inventory with per-unit calories, daily food logs, weight check-ins, and localStorage remembering the last username. Main files: `app/page.tsx` and `app/api/tracker/[username]/route.ts`.

Important next fix: new usernames can inherit the previous profile's locally cached data because localStorage is not namespaced by username. Ensure missing profiles start clean and isolate each username's cache. `@aditya` is currently empty with a 2,200 kcal goal.

Verify with `npx tsc --noEmit` and `env -u NODE_ENV npm run build -- --webpack`, then push and confirm the Vercel deployment.
