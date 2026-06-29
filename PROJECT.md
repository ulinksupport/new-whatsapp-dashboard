# Non-Medical Tourism WhatsApp Dashboard

## Project Overview

Browser-based WhatsApp ops dashboard for **Ulink Non-Medical Tourism** — a human-agent-only CRM dashboard for managing WhatsApp conversations with tourism customers via a Singapore phone number. Unlike the Singlife dashboard (which uses AI agents), **all conversations are handled by human agents** and every new conversation pushes to Zoho Desk via email.

**Repo:** `github.com/ulinksupport/new-whatsapp-dashboard`
**Local:** `C:\Users\devin\Documents\claude-projects\new-whatsapp-dashboard`
**Deploy target:** Vercel (like Singlife's `wahtsappdashboard.vercel.app`)

---

## Architecture

```
Customer WhatsApp ─→ Meta API ─→ Cloudflare Worker ─→ n8n Quick Flow ─→ Supabase + Gmail (Zoho Desk)
                                      │                                        ↑
                                      │ (statuses only)                        │
                                      └─→ Supabase PATCH                Dashboard (human agent)
                                                                           │
                                                                     n8n Human Reply ─→ Meta API ─→ Customer
```

### Components

| Component | Location | Status |
|---|---|---|
| Dashboard | `index.html` (single file, 232KB) | Working — needs cleanup |
| Vercel Meta proxy | `api/meta.js` | Working |
| Cloudflare Worker | `non-medical-tourism/cloudflare-worker.js` | Written — deployment unconfirmed |
| Supabase | `omfoglaixddbbihdwtrd` (shared with Singlife) | 8 tables created |
| n8n workflows | 6 workflows on `ulink.app.n8n.cloud` | 2 active, 4 inactive |

---

## Credentials / IDs

| What | Value |
|---|---|
| Meta WABA ID | `1316765403488123` (shared with Singlife) |
| Phone Number ID (SG) | `1194263793769742` |
| Supabase project | `omfoglaixddbbihdwtrd` |
| Supabase URL | `https://omfoglaixddbbihdwtrd.supabase.co` |
| n8n cloud | `https://ulink.app.n8n.cloud` |
| Meta Token | Stored in dashboard localStorage |

---

## n8n Workflows

| ID | Name | Active | Webhook Path | Purpose |
|---|---|---|---|---|
| `oUQ6zX6y444zVEcw` | Quick WhatsApp Flow | **YES** | (receives from Cloudflare Worker) | Main inbound: extract msg → load/create conv → save msg → email ops |
| `QRLpJEmIeSKkeEQQ` | Human Reply Webhook | **YES** | `/webhook/human-reply` | Dashboard human replies → send via WA → save to Supabase |
| `wWcLFROCJOUs5d60` | Takeover Webhook | NO | `/webhook/takeover` | Toggle human/AI mode on conversation |
| `YKvwUujn7jvpC4ae` | Dashboard → Outbound New Chat | NO | `/webhook/outbound-new-chat` | Log outbound template sends to Supabase |
| `0BtJfToYh5MFC6Ch` | WhatsApp Chats Monthly Export | NO | webhook + schedule | Monthly backup to OneDrive/Google Sheets |
| `VqXO4GmJzeSfWLUL` | WA Audit - Custom Date Export | NO | webhook | On-demand date-range ZIP export |

---

## Supabase Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `nonmedical_conversations` | One row per WhatsApp session | session_id, phone_number, customer_name, branch, route, status, agent_name, bot_enabled |
| `nonmedical_messages` | All messages (in+out) | conversation_id, session_id, role, content, wamid, media_url/type/filename, agent_name |
| `nonmedical_cases` | CRM case records | member_name, member_phone, member_email, policy_ref, status, notes |
| `nonmedical_case_threads` | Case ↔ contact linkage | case_id (FK), zoho_ticket_id, zoho_subject, wa_id |
| `nonmedical_template_sends` | Template send tracking | phone_number, template_name, send_status, meta_message_id, timestamps |
| `nonmedical_inbound_log` | Raw inbound webhook log | phone, message_text, raw_payload, n8n_status |
| `nonmedical_outbound_log` | Outbound status tracking | recipient_phone, wamid, status, error fields |
| `nonmedical_n8n_chat_histories` | n8n chat context history | session_id, message (jsonb) |

---

## Dashboard Features (current state)

### Working
- Config panel (Supabase, n8n, Meta credentials via localStorage)
- Login screen
- Conversation list with search, brand filters, status filters
- Chat view with message bubbles, media rendering, date separators
- Human reply (text + media) via n8n webhook
- Template management (CRUD via Meta API)
- Send template to existing chat
- New chat via template (outbound)
- Human/AI mode toggle
- Close chat with ops email
- Analytics overlay (conversation stats, template stats, token usage)
- Monthly export to OneDrive
- Custom date range audit export
- Missed message detection + notification
- Agent name tracking per message

### Needs Work (see Gap Analysis below)
- AI mode toggle irrelevant (no AI)
- No Zoho Desk ticket creation
- Brand filters show Travel/Shield (Singlife legacy)
- Token/AI cost analytics section irrelevant
- Follow-up scheduling not implemented
- CRM case management not connected to UI

---

## Singlife vs Non-Medical Tourism Comparison

| Feature | Singlife | Non-Medical Tourism |
|---|---|---|
| AI Agent | GPT-4.1/5.2 auto-reply | **None — all human** |
| Inbound routing | AI handles → escalate to human | **Direct to human agent** |
| Zoho integration | Email escalation only on route change | **Every new convo → Zoho Desk ticket** |
| CRM template sender | Zoho CRM triggers n8n → WA template | Planned (same pattern) |
| Follow-ups | Not implemented | **Required** |
| Case management | Not implemented | Tables exist, UI needed |
| Phone number | Multiple IDs (Travel/Shield) | Single SG number `1194263793769742` |
| Dashboard | `wahtsappdashboard.vercel.app` | New Vercel project (TBD) |

---

## Key Difference: No AI

Since there's no AI agent, the flow is simpler:

1. Customer sends WhatsApp message
2. Cloudflare Worker forwards to n8n
3. n8n saves to Supabase + emails ops (creates Zoho Desk ticket)
4. Human agent sees conversation in dashboard
5. Human agent replies via dashboard → n8n → WhatsApp
6. Follow-up reminders scheduled by agent

The `bot_enabled` / `route` fields still exist for conversation state management (human active / closed / escalated) but there's no AI-to-human handoff — every conversation starts in human mode.
