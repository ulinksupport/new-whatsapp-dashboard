# Gap Analysis & Implementation Checklist

## Status Legend
- [ ] Not started
- [~] In progress / partially done
- [x] Complete

---

## Phase 1: CRITICAL — Must complete before go-live

### 1.1 Zoho Desk Integration
**Confirmed:** Every inbound message emails `ops@ulinkassist.com` (which auto-creates Zoho Desk tickets).

- [x] **Email address confirmed** — `ops@ulinkassist.com` creates Zoho Desk tickets
- [x] **Every message triggers email** — n8n Quick Flow already emails ops@ for EVERY text message + image/document (two Gmail nodes: `Notify Ops Nonmedical Text` + `Notify Ops Image Document`)
- [~] **Zoho ticket threading** — Current email subjects: `[Non-Medical Tourism WhatsApp] New message from {name}`. Zoho Desk may create a separate ticket per message if it can't thread by subject. **TODO:** Consider adding a consistent conversation identifier (e.g. session_id or phone) to the subject for Zoho to thread subsequent messages into the same ticket.
- [ ] **Store Zoho ticket reference** — Optional: when Zoho creates a ticket, store the ticket ID in `nonmedical_case_threads.zoho_ticket_id` for cross-reference. (Can be manual entry for now.)

### 1.2 Activate Inactive n8n Workflows
- [x] **Activate Takeover Webhook** (`wWcLFROCJOUs5d60`) — Activated 2026-06-29
- [x] **Activate Outbound New Chat** (`YKvwUujn7jvpC4ae`) — Activated 2026-06-29
- [x] **Activate Monthly Export** (`0BtJfToYh5MFC6Ch`) — Activated 2026-06-29
- [x] **Activate Custom Date Export** (`VqXO4GmJzeSfWLUL`) — Activated 2026-06-29
- [ ] **Test Takeover Webhook** — Verify it correctly PATCHes `nonmedical_conversations.route` in Supabase
- [ ] **Test Outbound New Chat** — Verify it upserts conversation + logs message correctly

### 1.3 Cloudflare Worker
- [x] **Worker deployed** — Confirmed via Cloudflare dashboard (env vars: N8N_WEBHOOK_URL, SUPABASE_KEY, SUPABASE_URL, VERIFY_TOKEN)
- [x] **BUG FIXED: Wrong table name** — Worker was PATCHing `/rest/v1/messages` (Singlife table) instead of `/rest/v1/nonmedical_messages`. Fixed in local file. **ACTION NEEDED: Redeploy the worker with the updated code** (line 120: `messages` → `nonmedical_messages`)
- [ ] **Verify Meta webhook callback** — Confirm Meta App webhook points to this Worker URL
- [ ] **Test end-to-end** — Send WhatsApp message → Worker → n8n → Supabase → Dashboard

### 1.4 Vercel Deployment
- [ ] **Create Vercel project** for `new-whatsapp-dashboard` repo
- [ ] **Connect GitHub repo** `ulinksupport/new-whatsapp-dashboard`
- [ ] **Verify `/api/meta` proxy works** (Vercel serverless function)
- [ ] **Set custom domain** (optional)

---

## Phase 2: Dashboard Cleanup — DONE

### 2.1 Remove AI-related UI/Logic
- [x] **AI mode toggle hidden** — No longer visible in chat header
- [x] **Reply bar always unlocked** — No longer requires "human mode" to reply (only locked when 24hr window expired or chat closed)
- [x] **Human mode notice hidden** — No misleading "bot is paused" message
- [x] **Token/AI cost tracking section hidden** — Not relevant for human-only dashboard
- [x] **Bot message prefix removed** — Preview no longer shows "Bot:" prefix

### 2.2 Brand Filters Fixed
- [x] **Removed Singlife/Ulink brand buttons** — Only "All" remains
- [x] **Removed AI filter button** — Only relevant filters: All, Unread, Active, Human, Escalated, Inactive
- [x] **Analytics: removed Ulink/Singlife labels** — Stats show "Total Chats" only, pie chart shows "Non-Medical Tourism"
- [x] **Analytics: removed "Bot Msgs" stat** — Only "Customer Msgs" and "Agent Msgs"

### 2.3 Phone Number Config Fixed
- [x] **Single phone number field** — Replaced "Singlife Travel" / "Ulink" dual inputs with single "Phone Number ID (SG)" field
- [x] **`getPhoneNumberId()` simplified** — Returns the single configured phone number ID

### 2.4 New Chat Fixed
- [x] **Branch selector hidden** — Default "nonmedical", no dropdown
- [x] **Removed "Singlife Travel" / "Ulink" options**

---

## Phase 3: CRM & Follow-up System

### 3.1 Follow-up Scheduling (NEW FEATURE)
- [ ] **Add columns to `nonmedical_conversations`:**
  ```sql
  ALTER TABLE nonmedical_conversations ADD COLUMN follow_up_at TIMESTAMPTZ DEFAULT NULL;
  ALTER TABLE nonmedical_conversations ADD COLUMN follow_up_note TEXT DEFAULT NULL;
  ```
- [ ] **Dashboard UI: "Set Follow-up" button** in chat header
- [ ] **Dashboard UI: Follow-up filter** in sidebar
- [ ] **Dashboard UI: Follow-up badge** on conversation item
- [ ] **n8n Follow-up Reminder workflow** (NEW)

### 3.2 Case Management UI
- [ ] **Case creation from dashboard** — Link conversation to `nonmedical_cases`
- [ ] **Case panel** — View/edit case details
- [ ] **Case status workflow** — Open → In Progress → Resolved → Closed

### 3.3 Zoho CRM → WhatsApp Template Sender (NEW WORKFLOW)
- [ ] **Create n8n workflow** — Receives POST from Zoho CRM
- [ ] **Send WhatsApp template** via Meta API
- [ ] **Log to `nonmedical_template_sends`**
- [ ] **Track reply status**

---

## Phase 4: Export & Backup

- [x] **Monthly Export activated** — Workflow `0BtJfToYh5MFC6Ch` now active
- [x] **Custom Date Export activated** — Workflow `VqXO4GmJzeSfWLUL` now active
- [ ] **Verify OneDrive credentials** — May need separate folder from Singlife
- [ ] **Test monthly export** — Trigger manually
- [ ] **Test custom date export** — Select date range in dashboard

---

## Phase 5: Known Issues & Flags

### 5.1 Media Download URL (POTENTIAL ISSUE)
The `Download WhatsApp Media` node in the Quick Flow references `$json.messages[0].image.url`, but Meta's webhook payload for images only includes `image.id` (not `url`). The node may need to first call `GET /{media_id}` to get the download URL. **If media messages are failing silently, this is likely the cause.** Need to test with an actual image send.

### 5.2 Zoho Desk Ticket Threading
Current email subject `[Non-Medical Tourism WhatsApp] New message from {name/phone}` — if the customer name varies between messages (or phone is used for some), Zoho Desk may create separate tickets for the same customer. Consider standardizing the subject to include the phone number consistently for better threading.

### 5.3 Close Chat Workflow
The dashboard calls `n8nWebhookUrl('human-close-chat')` — but there's no dedicated "human-close-chat" n8n workflow listed in the Non-Medical Tourism set. This may be handled by the main Quick Flow or may be missing. **Test: close a chat from the dashboard and verify the webhook responds.**

### 5.4 Export OneDrive Folder
User confirmed: separate OneDrive folder from Singlife for exports. The Monthly Export workflow may need its folder path updated.

---

## Phase 6: Security & Production Readiness

- [ ] **Verify Supabase RLS policies** on nonmedical_* tables
- [ ] **No credentials in GitHub** — All via localStorage / env vars (confirmed)
- [ ] **Meta token rotation plan**
- [ ] **Login password** — Currently `admin123` (line 2953 of index.html) — **CHANGE BEFORE PRODUCTION**

---

## Priority Order

1. **Phase 1.3** — Redeploy Cloudflare Worker (table name bug fix)
2. **Phase 1.4** — Deploy to Vercel
3. **Phase 1.2** — Test the activated workflows end-to-end
4. **Phase 5** — Test media downloads and close-chat
5. **Phase 3** — Follow-ups and case management
6. **Phase 4** — Test exports, configure OneDrive folder
7. **Phase 6** — Production security (change login password!)
