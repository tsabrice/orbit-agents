# Relais: Product Requirements Document

## Executive summary

Relais turns one event idea into up to ten reviewable action cards for the AWS Student Builder Group at UQAM. **The AI proposes, the organizer decides.** The loop is **propose, approve, execute, log**.

Tonight's deliverable is a phone-responsive web app with editable drafts, individual approvals, Calendar and Discord execution, a JSON audit log, and an offline scripted demo. Backboard supplies one complete plan through a tool call and retrieves the voice guide and seeded history through Documents. A persistent mode badge distinguishes live generation from scripted output and simulated actions.

Build the offline loop first, start authorization alongside it, and deploy by 02:45. Treat September 20, 2026, 08:00 EDT as the submission cutoff; the official cutoff requires verification. Create the Devpost entry at the start and submit the complete entry before the buffer. This document specifies the build; it does not claim integrations or sponsor eligibility are verified.

## Problem and users

The primary user is Brice, organizer of the AWS Student Builder Group at UQAM. He coordinates event planning and communications with a five-role core team: Director of Events, Director of Marketing, two Technical Leads, and Event Coordinator. Relais reduces repeated writing and coordination while keeping publication decisions with him. Other clubs are deferred.

Dated club notes record a Monday 16:00–18:00 preference. Seed it as a labeled fixture preference, not a Backboard Memory write. Explicit event input wins: a Thursday request receives an inline note, not a confirmation modal. Planned events and organizer preferences are not evidence of completed events or attendance. Program qualification thresholds and reporting-deadline enforcement are outside scope.

## Goals and non-goals

**Goals:** demonstrate one sentence becoming channel-ready drafts; approve and execute two real actions when integrations work; copy other drafts; answer a history question with citations; complete an honest live or degraded demo, deployment, recording, and submission.

**Non-goals tonight:** a production agent platform, unattended scheduling, multi-club accounts, Discord control, semantic fact verification, guaranteed exactly-once delivery, or comprehensive crash recovery. No social publishing APIs beyond Discord, voice, or 3D. Safety gates remain required even when integrations are cut.

## The job (jobs to be done)

1. Turn one sentence into a plan in the club's voice.
2. Review, edit, approve, or reject each card.
3. Create a Calendar event and post a Discord announcement after approval.
4. Copy Meetup, LinkedIn, Instagram, and volunteer DM drafts for manual use.
5. Ask for a suggestion grounded in labeled history fixtures.
6. See a static follow-up preview: reminder 48 hours before; thank-you and recap after. Nothing is scheduled in P0.

## Demo script (90 seconds)

| Time | Demonstration |
|---|---|
| 0–12s | Enter “Workshop: deploy a static site on AWS with Terraform, next Thursday 6 PM, room to confirm, beginners welcome.” Show the mode badge. |
| 12–30s | Eight cards appear: Calendar, Discord, Meetup, club LinkedIn, personal LinkedIn, Instagram, and two role-based DMs. Show inclusive French and first-person personal LinkedIn. |
| 30–45s | Fill `[ROOM]`, `[END_TIME]`, and `[RSVP_URL]` with preflight-confirmed demo values. Show the nonblocking note: “Saved preference: Mondays 16:00 (source: September notes). Keeping Thursday as requested.” |
| 45–62s | Approve Calendar and Discord separately. Show the visible event and message, or clearly labeled simulated receipts in offline mode. |
| 62–70s | Reject Instagram; show the audit decision and no external action. |
| 70–82s | Ask “When should the next one be?” Show two cited history IDs and the synthetic-data label. |
| 82–90s | Open the timestamped audit drawer. |

Freeze the scripted reference clock at September 19, 2026. Resolve next Thursday to September 24, 18:00 in `America/Montreal`; verify runtime timezone support during setup. Live mode uses the actual request clock. Preflight destinations, credentials, RSVP link, and event duration. No invented location or link goes public. Offline means the local Node process and browser run without external network, not that the deployed website works without connectivity.

## Scope (P0 / P1 / Deferred)

**P0:** three fixture prompts and mock provider; typed plans and reducer; phone-responsive cards; edit/approve/reject/copy; simple persistent idempotency set plus in-process execution lock; append-only JSON audit log; Calendar and Discord executors; Backboard Tools and Documents; six synthetic history fixtures and cited ask; visible mode labels; single organizer bearer token; deployment; one Vitest core file and one offline Playwright smoke test.

At the integration cut line, use a Discord webhook if needed and make unavailable Calendar execution a draft preview. Disclose the missing live executor. This ships a degraded demo, not a passing two-executor claim. If Backboard cannot produce a validated live plan or retrieve documents by its cut line, ship scripted mode and omit unsupported Backboard evidence.

**P1, after submission:** `/relais plan …` in Discord, returning a summary, separate approval buttons for the two real actions, and a full-plan web link; durable follow-up scheduling; separately approved Gmail drafts, never email sending; AI revision proposals; reviewed attendance import; optional Backboard Memory and Thinking. Model routing remains optional. Each enabled feature needs its own validated operations and approval scope.

**Deferred:** autonomous actions, LinkedIn/Meetup/Instagram API posting, multi-club roles, voice, 3D, and MongoDB Atlas.

**Hardening, after the demo:** session authentication and associated CSRF protection if cookies are adopted; crash-safe multi-record persistence and execution reservations; provider-assisted reconciliation; crash-injection/restart tests; distributed spans; expanded browser/adversarial coverage; Discord adapter tests before that P1 surface launches. No hardening item may displace the demo-critical path.

## Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| FR-01 | Must | Accept an event sentence and optional structured facts; show unresolved fields as needs input. |
| FR-02 | Must | Receive one complete `propose_plan` payload of 1–10 allowlisted actions; normalize and validate the entire candidate atomically. Preserve the previous plan on failure. |
| FR-03 | Must | Use one reducer for proposal, edit, approve, reject, execute, and fail. Model output may only propose. |
| FR-04 | Must | Bind approval to the action payload hash and destination. Edits invalidate only affected actions; unresolved executable facts block execution approval. Draft review/copy never publishes. |
| FR-05 | Must | Execute only approved real actions, serialize duplicate attempts, and reuse results for the same idempotency key. |
| FR-06 | Must | Provide draft-only copy buttons and append proposal, edit, decision, execution, and failure records to the audit log. |
| FR-07 | Must | Apply the voice contract, placeholder checks, exact Meetup terms suffix, and zero em dashes. |
| FR-08 | Must | Use Backboard Tools plus Documents for live plans; offer explicit scripted fallback on timeout/invalid output. Display a persistent LIVE / SCRIPTED header badge and separate execution-mode label. |
| FR-09 | Must | Answer history questions with at least two valid fixture IDs and an explicit synthetic-data label. |
| FR-10 | Must | Keep all agent/provider/executor logic server-side. P0 web controls the agent; Discord only receives approved announcements. |
| FR-11 | Should | P1 Discord command and buttons call the same services, reducer, and approval gate as the web app. |

**Voice contract, installed as the system prompt and a Document:** “AWS Student Builder Group at UQAM”; “Apprendre · Construire · Connecter.”; “Aucune expérience requise.” French by default, English for explicitly anglophone or AWS-facing audiences. Keep common technical terms in English. Use inclusive writing naturally, including étudiant·es and débutant·es. Be concise, human, benefit-first, scannable, with one CTA and light emoji. Never invent names, logistics, links, speakers, or attendance. Missing facts become placeholders.

Personal LinkedIn: first person, why it matters, group-page tag and RSVP link, no “I'm excited to announce”. Club LinkedIn: on/nous, student-led community voice. Discord: short tease, essentials, Meetup link, never the full Meetup description. Instagram: short, natural, few hashtags. DMs: greeting, “J'espère que tu vas bien !”, context, one clear ask, what it involves, workload reassurance without invented estimates, and a collaborative question such as “Est-ce que ça te tenterait ?”.

Meetup: Hook; why useful; 🎯 Au programme; 👥 Pour qui ?; optional 💡 Quoi apporter ?; 📅 Détails; registration CTA. Append this exact literal last:

> En t'inscrivant, tu certifies avoir lu et accepté les conditions d'utilisation des événements AWS (https://aws.amazon.com/events/terms/).

## Non-functional requirements

| ID | P0 requirement |
|---|---|
| NFR-01 | No external action without approval of its current payload and target. Draft types never enter an executor. |
| NFR-02 | Planning timeout target 20 seconds; execution timeout 15 seconds. Timeout is not proof of remote cancellation. |
| NFR-03 | All three scripted prompts and the full offline smoke flow work without network. |
| NFR-04 | One Node process, JSON files on disk, append-only audit records, and bounded in-process duplicate prevention. Crash recovery is explicitly limited. |
| NFR-05 | Phone-responsive, readable cards with keyboard-operable controls and text statuses. |
| NFR-06 | Server-only secrets, bearer-token access, HTTPS for authenticated public use, and no credentials in logs or recordings. |
| NFR-07 | Simple request IDs and sanitized console errors; configurable request limit, bounded calls/tokens, session cost cap, and `SIDE_EFFECTS_ENABLED` kill switch. Verified prices/configuration are required before paid live calls. No distributed tracing tonight. |

## Architecture

The agent lives server-side only in one Node process on Vultr, holding all secrets, authoritative state, logs, and provider calls. React/Vite surfaces are thin adapters over `plan / approve / execute / ask`. P0 uses the phone-responsive web app. Discord is an output destination; its P1 control surface cannot bypass the shared reducer or approval gate.

Flow: web → Node services → framework-free TypeScript schemas/reducer → Backboard or mock → complete validated plan → user decision → executor → audit. Use JSON for plan snapshots, history, and the idempotency set; JSONL for the audit log. No database migration tonight.

Reuse from `../HeroForge-AI`: `server/backboard.ts`, setup script/config, React scaffold, `TutorSentence.tsx` if useful, Vitest and Playwright configuration, demo-recording script, and Devpost template. Adapt adapter transport/error handling, not the previous project's teaching or 3D logic. Keep the OpenAI adapter as reference only; no direct OpenAI calls are planned.

Register **one** Backboard tool, `propose_plan({actions, followupPreview})`. Its actions are wire proposals, never domain objects with approval fields. Accept exactly one complete call; do not assemble partial plans across calls. Upload the approved voice guide and synthetic history during explicit setup, verify indexing, and capture retrieval evidence. This setup step needs no additional approval UI. Tools and Documents are P0; Memory, Thinking, and routing do not enter tonight's critical path.

## Versioned data contracts

| Contract | Minimum fields |
|---|---|
| `PlanV1` | `version:1`, `id`, `revision`, `requestId`, `provider`, reference clock, timezone, fact map, 1–10 actions, static follow-up preview. |
| `ActionV1` | `version:1`, `id`, allowlisted type, payload, destination, derived capability (`real` or `draft`), `needsInput`, status, payload hash, optional approval `{actor, at, payloadHash, destination}`. |
| `ExecutionRecordV1` | `version:1`, request/plan/action IDs, idempotency key, provider, timestamps, outcome, optional external ID/URL, sanitized error, optional manual-resolution decision. |
| `HistoryEventV1` | `version:1`, `id`, title, date/timezone, format, nullable attendance, source, source date, `synthetic`. Never use a planned event as observed attendance. |

Wire schema uses bounded strings, enums, typed fact references, and no model-authored IDs, approval state, or execution intent. The server creates domain metadata. Normalize is pure, total, and deterministic for fixed context, returning a value or errors. Accept already-normalized values unchanged so normalization is idempotent. Strict versions reject unsupported inputs; additive optional changes keep the version, breaking changes require a migration/version bump.

**P0 grounding check:** tokenize `{{fact.key}}` references before scanning all prose fields. Reject bare digits, URL forms, and @mentions outside references. Every reference resolves to an organizer-confirmed fact or renders a visible placeholder with `needsInput`. Append the Meetup terms literal server-side after scanning, rather than allowing the model to supply its URL. Typed timestamps and configured destination fields have their own schema checks. Technical names containing digits, such as EC2, must also use registered references. Reject literal model-authored placeholders that evade reference resolution.

This is a deterministic format check, not semantic fact verification. It does not detect spelled-out invented claims or prove that an organizer-supplied fact is correct. The prompt and organizer review cover those limits; do not claim otherwise. Changing a shared fact rerenders dependent cards and invalidates their approvals through changed hashes. Review fixture drafts manually for voice.

## Action vocabulary and approval model

| Operation | Payload and behavior |
|---|---|
| `create_calendar_event` | `{title,start,end,location,description}`; confirmed times, end after start, configured Calendar target. Explicit approval executes when capability is real; fallback capability is draft-only. |
| `post_discord` | `{channel,text}`; configured channel enum, approved exact text and target. Composio or webhook transport is server-selected. |
| `draft_meetup` | `{title,sections:{hook,whyUseful,programme,audience,bring?,details,registrationCTA}}`; server appends terms. Review/copy only. |
| `draft_linkedin_club`, `draft_linkedin_personal`, `draft_instagram` | `{text}`; review/copy only. |
| `draft_dm` | `{recipientRole,text}`; configured role, review/copy only. |
| `suggest` | Read-only question; validated answer plus history IDs. Not an executable card. |
| `schedule_followup` | P1 `{when,template,boundPayload,target}`; explicit approval covers the exact future effect. Changed content requires renewed approval. |

Reducer operations are `propose`, `edit`, `approve`, `reject`, `execute`, `fail`. Execution includes start/result phases. Only authenticated UI operations approve; only the server executor records results. `approve` on a real action authorizes immediate execution of the reviewed snapshot. Draft approval records review only.

Use **per-action hash binding**, including the resolved payload, target, and execution capability. Send the expected hash with decisions and reject stale hashes. A change to another card does not clear this card's approval. Plan revision remains for display and replacement ordering, not a global approval invalidator. Already executing/executed cards cannot be edited. Copy is an explicit clipboard action. The plan request authorizes local proposal/audit storage, not publication.

## Provider and request lifecycle

Use `idle → planning(seq) → plan_ready → executing(actionId) → plan_ready/done`, with visible failed/stale outcomes. Keep the previous plan while planning; only the latest request sequence may replace it. One execution at a time is sufficient tonight.

Routes: `POST /api/plan`, `POST /api/plans/:id/ops`, `GET /api/plans/:id`, `POST /api/ask`, and `GET /api/log`. Operations are validated discriminated unions, not free text. Reload executable payloads from server state; never execute a submitted replacement body.

Timeout/invalid output preserves the current plan and offers “Use scripted demo”. Selecting it creates an isolated scripted plan; it never silently switches an uncertain live execution. Header badge describes plan origin, LIVE or SCRIPTED; a separate label describes REAL or SIMULATED execution. Scripted plans use mock executors in P0. Real executor smoke scripts use explicit reviewed approvals.

Three offline fixture prompts cover Terraform, cloud introduction, and certification study. Unknown offline input offers the examples. Ask validates cited IDs against local history; citations alone do not prove semantic correctness, so fixture answers are reviewed.

## Security and reliability

Use one server-side `ORGANIZER_TOKEN`. Paste it into the client once; send it in the Authorization bearer header on protected API calls. Session storage is sufficient for the demo and reduces persistence on shared devices. Never embed it in a URL, bundle, or recording. Use same-origin requests, no authentication cookies, no permissive CORS, and escaped text rendering. Cookie-based CSRF machinery is not required for this bearer-only design; token theft remains a risk.

Use Caddy or an equivalent TLS front end when certificate setup works. Do not send the token or operate live actions over public HTTP. If TLS is blocked, expose a token-free, synthetic, read-only preview on HTTP and keep authenticated execution local or through a secure connection. Record the deployment limitation. Domain registration and provider capabilities/pricing require verification.

Execution uses a hash of action ID and approved payload/target, an in-process in-flight set, and a JSON set/map of successful keys and receipts. Reserve in memory before awaiting the provider; repeated clicks return in-flight status or the saved result. Append the approval/attempt before dispatch; an immediate log-write failure stops dispatch rather than hiding an unlogged side effect. No crash-atomic multi-file transaction or automatic post-restart retry is promised.

A timeout after dispatch is **unknown**, never automatically retried. Show “I checked, it posted” to record a manual success and “I checked, it didn't” to record an observation. The second button alone cannot prove that a delayed request will not still complete. Re-enable live retry only after a confirmed terminal failure or provider evidence that makes retry safe; otherwise finish the demo in an isolated scripted plan. Log manual resolutions explicitly rather than fabricating provider receipts. After a restart, never automatically execute saved pending actions.

## Sponsor strategy with evidence required

Track eligibility, judging rules, prizes, and availability require verification against official 2026 sources. Claim demonstrated usage only.

| Track | Tonight's evidence | Cut boundary |
|---|---|---|
| Backboard Tools | One complete `propose_plan` call, validated cards, redacted trace. | No claim if only mocked. |
| Backboard Documents | Voice guide and synthetic history uploaded/indexed; retrieval IDs or equivalent verified evidence. | Upload alone does not prove retrieval. |
| Backboard Memory / Thinking / routing | Not used in P0. | P1 only; no breadth claim for unused features. |
| Composio | Visible Calendar event and Discord message with receipts proving their transport. | Webhook Discord is not Composio Discord evidence. |
| Rox | Executed actions and clearly labeled synthetic history. | No claim of messy real attendance ingestion; import is P1. |
| MLH Vultr / GoDaddy Registry | Working VM deployment; resolving registered domain if completed. | Claim only completed integrations. |
| MongoDB Atlas | Not used. | JSON storage does not qualify as Atlas use. |

No hardware, Cloudflare, or direct OpenAI track claim is planned. Do not spend build time maximizing sponsor count.

## Hour-by-hour plan with cut lines

The clock below assumes a 22:45 start on September 19, EDT. If already later, compress optional work, not the final buffer or approval checks. Authorization runs alongside local coding; no additional agents are required.

| Clock | Deliverable | Exit test / cut line |
|---|---|---|
| 22:45–23:45 | Create Devpost title/tagline entry; verify cutoff; initialize Git; copy assets; schemas, reducer, grounding checks, idempotency; start Composio authorization. | Fixture normalizes to eight valid actions; core Vitest file passes. |
| 23:45–00:45 | Mock provider, cards, edit/approve/reject, audit drawer. | Full offline browser loop. |
| 00:45–01:45 | Wire Calendar and Discord behind approval check. | One event, one message; double click creates one. At 01:45 stop integration debugging: webhook and Calendar draft fallback if needed. |
| 01:45–02:45 | Deploy skeleton to Vultr; token gate; TLS/domain; phone smoke. | Live URL works. If TLS blocked, public synthetic preview only; authenticated execution stays secure/local. |
| 02:45–03:45 | Backboard Tools and Documents; timeout fallback; mode labels. Upload initial history fixture file now. | Valid real plan and retrieval evidence. At 03:45 retain scripted mode for anything unverified. |
| 03:45–04:45 | Complete six history fixtures, cited ask, nonblocking Monday note. Re-upload history only if changed. | Answer cites two existing IDs, synthetic label visible. |
| 04:45–05:45 | One offline Playwright smoke; review fixture voice; core tests and minimal secret check. | Two test files green; no new features. |
| 05:45–06:45 | Record live/degraded and offline takes; finish Devpost using existing template. | Complete entry submitted, receipt verified. |
| 06:45–08:00 | Upload/submission verification and critical-fix buffer. | Nothing new enters scope. |

Commit at each hour boundary. Begin VM/domain prerequisites early if waiting on provisioning; the scheduled deployment hour is not the first access check. Capture a usable offline recording before attempting optional improvements.

## Acceptance criteria as verifications

Six gates define automated green. They live in **one Vitest core file and one Playwright offline smoke file**, not six suites. Live receipts and deployment checks are brief manual release checks.

| ID | Verification | Passing evidence |
|---|---|---|
| AC-01 | Vitest: normalize fixtures, unknown type/target, too many actions, idempotent normalization. | Atomic valid plan or errors; Terraform fixture has eight actions. |
| AC-02 | Vitest: reducer/executor stub, unapproved/rejected/draft actions, changed hash, duplicate click. | No forbidden calls; stale affected action rejected; unchanged other card stays approved; duplicate key calls once. |
| AC-05 | Core test plus offline smoke: timeout/invalid plan and scripted selection. | Existing plan preserved; explicit fallback with persistent mode labels. |
| AC-06 | Vitest: bare digits/URL/mention, unresolved reference, shared-fact edit. | Invalid prose rejected; unknowns flagged; affected hashes change; exact terms literal allowed only by renderer. No semantic-verification claim. |
| AC-08 | Vitest format checks plus manual fixture review. | Exact Meetup suffix, zero em dashes, French/channel voice, first-person personal LinkedIn. |
| AC-10 | One Playwright smoke with external network disabled. | Input, edits, simulated approvals, rejection, two cited history IDs, and audit all work. |
| Release checks | Manual live executor double-click check, phone flow, scan built assets for configured secret values, Devpost receipt. | Real receipts when available; degraded paths disclosed; no bundled secrets; submitted entry. |

Restart/replay, crash injection, exhaustive API/adversarial tests, and P1 Discord adapter tests are hardening, not tonight's green gate.

## Risks and mitigations

Overbuilding: hold the P0 list and stop at cut lines. OAuth delay: build mock first. Model format failure: retain the last valid plan and explicit scripted fallback. Regex limits: disclose them, constrain factual fields, and require organizer review. Missing RSVP/room/end time: preflight confirmed values; never invent public details. Remote uncertainty: block blind retries and use scripted mode to finish the demonstration. Synthetic history: label every suggestion and avoid claiming actual club attendance. Stale preferences: inline note only. Fatigue: hourly commits, known-good recording, and no new features in the buffer.

## Decisions still requiring evidence

- Official submission cutoff and sponsor eligibility/rules; verify at the start, not during recording.
- Composio authorization, exact tool schemas, allowlisted targets, receipts, limits, and retry semantics.
- Backboard complete-plan tool behavior, document indexing/retrieval evidence, available model, prices, credits, and conservative session cost cap.
- Confirmed demo room, end time, RSVP URL, group tag, role labels, and actual timezone support.
- Vultr access, TLS path, domain availability/cost, and actual remaining build time.

Historical notes inform fixture context only. No private memory paths, credentials, program-policy enforcement, or unverified attendance claims belong in the public demo.
