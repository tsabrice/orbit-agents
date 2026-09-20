# Orbit

A personal workspace for agents across different areas of your life. The first implemented agent, Communauté, supports event planning and communications, with the AWS Student Builder Group at UQAM as its initial use case. Projets personnels and Vie quotidienne are labeled future agents. Propose, approve, execute, log.

Orbit is a working name; domain and trademark availability have not been checked. Existing internal `relais` storage keys, deployment names, and API contracts are retained for compatibility.

## Run locally

Requires Node 22 and npm.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3002. Planning and chat use Backboard only. Configure live credentials before using them. Manual Discord drafts remain available when a destination is configured and require approval before sending. Scripted demos and fallback buttons have been removed; old demo plans are archived and cannot execute.

The seeded date is September 24, 2026 in America/Montreal. All six historical events are synthetic. The personal LinkedIn draft also needs a group-page URL. Fixture links entered in local tests are examples, not real RSVP destinations.

## Checks and recording

```sh
npm test
npm run build
npm run test:browser
# With the local server running:
```

One core test file checks schemas, grounding, approval invalidation, duplicate execution, and uncertain outcomes. One browser smoke checks the live-only interface, provider failures, manual Discord approval gate, and mobile overflow without calling external providers. Chromium defaults to `/usr/bin/chromium`; set `CHROMIUM_PATH` if needed. The test server uses port 3100.

## Configure live services

Copy `.env.example` to `.env` and keep it out of Git. Never paste credentials into chat, a screenshot, or a client build.

1. Set Backboard credentials, supported model/provider, and verified conservative cost settings. Run `npm run setup:backboard` to explicitly create the assistant and upload the voice guide and synthetic history. Setup resumes from `.data/backboard-setup.json`. Wait until both documents are indexed. Set `LIVE_AI_ENABLED=true` and restart. This enables the provider selector; a valid live request is still required to prove the integration.
2. Set Composio account IDs, verified toolkit versions, and target IDs. Discord posting requires the Discord Bot toolkit. Exact account access and pinned schemas must be verified before using real actions. Alternatively configure `DISCORD_WEBHOOK_URL`; it takes precedence over Composio for Discord.
3. Set `SIDE_EFFECTS_ENABLED=true` only when ready to approve real actions. Scripted plans always remain simulated. Missing integrations become draft-only cards. Each real card shows its configured target. Review it before approval.
4. Set `ORGANIZER_TOKEN` for production. Paste it under “Accès organisateur”; it stays in this browser tab's session storage and is sent only in the Authorization header. The server does not use authentication cookies.

The live API adapters are implemented but unverified with real accounts. Paid planning reserves `BACKBOARD_MAX_COST_PER_PLAN` against the process-session `SESSION_COST_LIMIT`. The configured bound must cover the full provider request, including retrieval/provider overhead; it is not an independently measured billing guarantee. Restart resets the session budget. If the model response fails tool-format, schema, or grounding validation, Orbit makes at most one repair request, reserving the configured amount again before that call. Both attempts are validated; no invalid plan is returned. Network failures and exhausted budgets are not retried.

Backboard docs consulted: [messages](https://docs.backboard.io/api-reference/threads/send-message), [tool calls](https://docs.backboard.io/sdk/tool-calls). Composio docs: [tool execution](https://docs.composio.dev/reference/api-reference/tools/postToolsExecuteByToolSlug), [Calendar parameters](https://v3.docs.composio.dev/tools/googlecalendar), [Discord Bot](https://docs.composio.dev/kb/guide/toolkits-discordbot). Reverify pinned tool input/receipt schemas using the connected account before publishing.

## API and safety boundary

- `POST /api/plan`: complete validated proposal; never executes model output.
- `POST /api/plans/:id/ops`: explicit edit, approve, reject, execute, or manual outcome observation.
- `GET /api/plans/:id`: reload authoritative plan.
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

## Visual assets

Orbit uses one generated 3D object family throughout its branding, navigation, agent cards, and action cards. Nine transparent PNG assets live in `public/assets/orbit-3d/`. The shared mapping is in `src/client/Icons.tsx`; generation prompts and material rules are in [the asset guide](docs/design/ORBIT_3D_ASSETS.md). The palette is graphite, warm ivory, muted olive, aluminum, and copper. Tiny utility controls use readable text rather than miniature decorative imagery. These are static images, not a runtime 3D scene.

## Contextual conversation

Choose **Discuter avec mon agent** beside event planning. In Backboard live mode, ask a club question, request one specific draft, or refine the previous reply. Drafts can be copied or explicitly staged with **Préparer pour approbation Discord**. The server loads the selected saved draft, checks conversation revision and Discord limits, then creates one unapproved action card for the configured channel. Publication still requires separate approval. Chat has no automatic publication or Calendar/file-generation tools. The existing plan workflow remains the execution surface.

Five server-side sources are listed in the chat context panel: the voice guide, July club overview, presentation preferences, introductory cloud speaker notes, and a dated context-status document. The three club documents are snapshots copied from the organizer's supplied folder on September 20, 2026. Source conflicts are explicitly flagged, including historical team counts. Personal identity/payment files and PPTX binaries were not ingested. This is not automatic folder synchronization or full visual understanding of the templates.

Requests include these source texts and the current conversation through Backboard. The reply is a validated JSON envelope with text, an optional copy-only draft, and allowlisted source IDs. Source IDs are validated; factual correctness and whether a citation actually supports a claim still require organizer review. Chat prose does not use the plan's typed fact-reference validator because it cannot execute actions.

Conversation files live under `DATA_DIR/chat-<uuid>.json`. Each conversation has up to twelve exchanges and is restored in its browser tab. New conversation clears the tab's active conversation, not the stored audit/history. Follow-up corrections are conversation-local, not permanent preference writes. Chat and plans share the same process-session budget reservation and generation rate limit. Chat does not automatically retry paid requests. Event planning may make one budgeted grounding-repair request. Scripted mode offers a clearly labeled team-message example and a shorter revision, not a general-purpose offline model.

## Direct Discord draft

The **Message Discord** surface accepts organizer-authored text without making an AI call. `POST /api/discord/draft` stages one allowlisted `post_discord` action, using `fact.message` as the user-supplied text and a `manual` provider label. No target can be supplied by the client. Normal validation, reducer, per-action approval, execution switch, audit and receipt handling still apply. Chat also stages selected drafts through `POST /api/chat/:id/discord-draft`, using a saved conversation ID, expected revision and turn index instead of client-supplied draft text. It can be used to review a pasted chat draft or test the configured Discord channel independently of live event-plan generation.

Rejected schema-valid live candidates are captured server-side in `DATA_DIR/last-rejected-plan.json`, including request ID and validation errors. This file can contain draft content; it is not committed or served by the production frontend. The latest passing request does not prove that future model responses will pass.

Live planning requests wait up to 45 seconds by default (`BACKBOARD_PLAN_TIMEOUT_MS`, bounded to 10–60 seconds per model attempt); document-status checks wait up to 10 seconds each. A validation repair may require one additional model attempt. Timeouts are not automatically retried and do not imply that provider billing was cancelled. Discord execution still uses its separate 15-second timeout.

## Verify uncertain executions

New Composio attempts persist the returned log ID, account, tool and exact request in server-only `execution-<key>.json` files. **Vérifier le résultat** reads that specific log, checks its identity and payload, and records a successful provider receipt through the reducer. It never calls an execution tool or enables a retry. Old attempts, webhooks and timeouts without a captured log ID require manual destination checks. Failed or mismatched logs remain unknown.
