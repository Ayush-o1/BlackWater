# SignalOps Demo Scenarios

These scripted scenarios are designed for live interviews or portfolio recordings to demonstrate the deeply integrated, real-time nature of the SignalOps architecture.

## Preparation
1. Run `npm run dev` in both the backend and frontend directories.
2. Open two browser windows side-by-side.
   - **Window A (Admin Dashboard)**: Navigate to `http://localhost:5173/login` and sign in with `admin@acme.com` / `password123`.
   - **Window B (Public Page)**: Navigate to `http://localhost:5173/status/<OrgID>` (Get your OrgID from the dashboard URL or the seed output).

---

## Scenario A: The Real-Time Outage (Core Architecture Demo)
**Goal:** Prove the system's WebSocket layer and Status State Machine function seamlessly without manual browser refreshes.

1. **In Window A (Admin)**: Navigate to **Services**. Point out that the "Authentication Service" is currently `OPERATIONAL`.
2. **In Window B (Public)**: Point out that the Hero Banner says "Degraded Performance" (because of the existing seeded incident), but "Authentication Service" is listed as green.
3. **In Window A (Admin)**: Navigate to **Incidents** and click **Declare Incident**.
   - **Title**: Authentication Token Generation Failing
   - **Severity**: `CRITICAL`
   - **Service**: Select "Authentication Service".
   - Click **Declare Incident**.
4. **IMMEDIATELY Look at Window B (Public)**:
   - Notice that the screen *instantly* updates without a refresh.
   - The hero banner shifts from yellow "Degraded" to a massive red "Major Outage".
   - The "Authentication Service" row instantly turns red.
   - The new Active Incident appears at the top of the list.

**Talking Point:** *“SignalOps uses a Prisma-driven State Machine that intercepts the incident declaration, calculates the new global service health deterministically, and broadcasts a WebSocket packet. The React frontend natively intercepts this socket event and executes a TanStack Query invalidation, causing an instant DOM repaint.”*

---

## Scenario B: Public vs. Internal Communication (Data Sanitization)
**Goal:** Demonstrate the Air-Gapped DTO layer.

1. **In Window A (Admin)**: Click into the newly created Incident details.
2. **In Window B (Public)**: Click into the Incident details.
3. **In Window A (Admin)**: Post an **Internal Note**: `"The Redis cluster handling JWTs just OOM'd. I'm SSHing in now."`
4. **Notice Window B**: Absolutely nothing changes. The public user cannot see this internal engineering note.
5. **In Window A (Admin)**: Post a **Public Update**: `"We have identified the root cause preventing logins and are applying a fix."`
6. **Notice Window B**: The timeline instantly appends the public update.

**Talking Point:** *“This proves the architectural boundary I built in Phase 7. The DTO layer acts as an absolute gatekeeper, completely preventing internal user IDs and private engineering communications from leaking to unauthenticated API requests.”*

---

## Scenario C: Incident Resolution & Healing
**Goal:** Show the automated service healing mechanism.

1. **In Window A (Admin)**: Click **Acknowledge**, then click **Resolve Incident**.
2. **Notice Window B (Public)**:
   - The incident is marked Resolved.
   - The overall Organization health re-calculates back to its previous state, seamlessly healing the application.
