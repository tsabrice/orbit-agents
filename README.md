# Relais

A French-first club operations app for the AWS Student Builder Group at UQAM. Propose, approve, execute, log.

## Run locally

Requires Node 22 and npm.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3002. With no `.env`, the app uses deterministic scripted plans, simulated receipts, and local-only access. Use one of the three example prompts. Fill the event's end time, room, and RSVP link, confirm the facts, then approve Calendar and Discord. Both display simulated receipts. No network or credentials are required for this flow.

The seeded date is September 24, 2026 in America/Montreal. All six historical events are synthetic. The personal LinkedIn draft also needs a group-page URL. Fixture links entered in local tests are examples, not real RSVP destinations.

## Checks and recording

```sh
npm test
npm run build
npm run test:browser
# With the local server running:
npm run record:demo
```

One core test file checks schemas, grounding, approval invalidation, duplicate execution, and uncertain outcomes. One browser smoke runs the full offline flow, captures desktop/mobile screenshots, and checks mobile overflow. Chromium defaults to `/usr/bin/chromium`; set `CHROMIUM_PATH` if needed. The test server uses port 3100. The recording script produces `.data/demo/relais-scripted.webm`, explicitly simulated, not a live sponsor demonstration.

## Configure live services

Copy `.env.example` to `.env` and keep it out of Git. Never paste credentials into chat, a screenshot, or a client build.

1. Set Backboard credentials, supported model/provider, and verified conservative cost settings. Run `npm run setup:backboard` to explicitly create the assistant and upload the voice guide and synthetic history. Setup resumes from `.data/backboard-setup.json`. Wait until both documents are indexed. Set `LIVE_AI_ENABLED=true` and restart. This enables the provider selector; a valid live request is still required to prove the integration.
2. Set Composio account IDs, verified toolkit versions, and target IDs. Discord posting requires the Discord Bot toolkit. Exact account access and pinned schemas must be verified before using real actions. Alternatively configure `DISCORD_WEBHOOK_URL`; it takes precedence over Composio for Discord.
3. Set `SIDE_EFFECTS_ENABLED=true` only when ready to approve real actions. Scripted plans always remain simulated. Missing integrations become draft-only cards. Each real card shows its configured target. Review it before approval.
4. Set `ORGANIZER_TOKEN` for production. Paste it under “Accès organisateur”; it stays in this browser tab's session storage and is sent only in the Authorization header. The server does not use authentication cookies.

The live API adapters are implemented but unverified with real accounts. Paid planning reserves `BACKBOARD_MAX_COST_PER_PLAN` against the process-session `SESSION_COST_LIMIT`. The configured bound must cover the full provider request, including retrieval/provider overhead; it is not an independently measured billing guarantee. Restart resets the session budget. No hidden second model call is made after tool staging.

Backboard docs consulted: [messages](https://docs.backboard.io/api-reference/threads/send-message), [tool calls](https://docs.backboard.io/sdk/tool-calls). Composio docs: [tool execution](https://docs.composio.dev/reference/api-reference/tools/postToolsExecuteByToolSlug), [Calendar parameters](https://v3.docs.composio.dev/tools/googlecalendar), [Discord Bot](https://docs.composio.dev/kb/guide/toolkits-discordbot). Reverify pinned tool input/receipt schemas using the connected account before publishing.

## API and safety boundary

- `POST /api/plan`: complete validated proposal; never executes model output.
- `POST /api/plans/:id/ops`: explicit edit, approve, reject, execute, or manual outcome observation.
- `GET /api/plans/:id`: reload authoritative plan.
- `POST /api/ask`: reviewed deterministic history suggestions, explicitly labeled scripted.
- `GET /api/log`: latest audit records.

Approval compares exact canonical payload/target/capability snapshots, avoiding fingerprint collisions. The compact execution key is SHA-256 of action ID plus snapshot. A JSON receipt map and in-process lock suppress duplicate clicks. Normalization rejects unknown types/targets, bare numeric facts, links/mentions, and unknown references. It does not perform semantic fact verification. React renders copy as text. Discord mentions are disabled in the transport.

Data lives in `.data` (or `DATA_DIR`): plans, receipt map, audit JSONL, and setup metadata. There is no exactly-once guarantee across process crashes. Incomplete executions become unknown after restart; they are never automatically resent. Manual confirmation is labeled as such. “Nothing visible” records an observation but does not authorize an unsafe retry.

## Deploy to Vultr

Deployment files are prepared; no VM or domain has been configured by this project yet.

- Install Node 22, Caddy, and a dedicated `relais` service user on the VM.
- Place the application at `/opt/relais`; install dependencies and run `npm run build` there. Keep dev dependencies installed because `tsx` launches the TypeScript server.
- Create `/opt/relais/.data`, owned by the service user. Create `.env` with a strong organizer token and selected integration settings, readable only by that user.
- Install `deploy/relais.service`, adjusting paths if needed. The Node process binds to loopback.
- Configure `deploy/Caddyfile` with `RELAIS_DOMAIN` and point DNS to the VM. Expose HTTPS via Caddy, not the Node port. Caddy's trusted loopback proxy supplies the HTTPS signal required by the production API.
- Verify the phone flow over HTTPS before approving a real action. If TLS/domain setup fails, retain local execution. Never expose the bearer token over public HTTP.

## Remaining external work

Backboard/Composio account verification, real execution receipts, Vultr/domain deployment, and actual Devpost submission require the user's credentials/access. The draft in `docs/DEVPOST_DRAFT.md` deliberately distinguishes implemented code from demonstrated sponsor usage.
