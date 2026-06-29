# n8n Workflow Reference — Non-Medical Tourism

## 1. Quick WhatsApp Flow (MAIN INBOUND)
- **ID:** `oUQ6zX6y444zVEcw`
- **Status:** ACTIVE
- **Trigger:** Webhook (receives forwarded payloads from Cloudflare Worker)
- **Webhook URL:** `https://ulink.app.n8n.cloud/webhook/31543cd8-a839-47c9-b08a-a241785d7df0`

### Pipeline:
```
WA Inbound Webhook
  → WhatsApp Trigger (Code: validates entry[0].changes[0].value)
  → Message Exists? (If: checks messages array)
  → Extract Nonmedical Input (Code: extracts _from, _session_id, _name, _text, _type, _wamid, _media_id, _media_filename)
  → Is Image or Document? (If: checks _type == 'image' || 'document')
    ├── YES (Image/Doc path):
    │   → Send Image Document Ack (WhatsApp: "We received your image/document")
    │   → Download WhatsApp Media → Upload Nonmedical Media (Supabase Storage)
    │   → Load Nonmedical Media Conversation → Media Conversation Exists?
    │     ├── YES → Update Existing Media Conversation
    │     └── NO  → Create New Media Conversation
    │   → Save Nonmedical Media Message
    │   → Notify Ops Image Document (Gmail: ops@ulinkassist.com)
    │
    └── NO (Text path):
        → Load Nonmedical Conversation → Conversation Exists?
          ├── YES → Update Existing Nonmedical Conversation
          └── NO  → Create New Nonmedical Conversation
        → Save Nonmedical Text Message
        → Notify Ops Nonmedical Text (Gmail: ops@ulinkassist.com)
```

### Session ID pattern: `{phone_number}_nonmedical` (e.g., `6591234567_nonmedical`)

### Gmail notification:
- To: `ops@ulinkassist.com`
- Subject: `[Non-Medical Tourism WhatsApp] New message from {name/phone}`
- Body: Customer name, phone, message text

---

## 2. Human Reply Webhook
- **ID:** `QRLpJEmIeSKkeEQQ`
- **Status:** ACTIVE
- **Webhook path:** `/webhook/human-reply`

### Pipeline:
```
Webhook (POST from dashboard)
  → Prepare (Code: extracts session_id, phone, message, media fields, agent_name)
  → Is Template? (If: checks template_name exists)
    ├── YES → Send WhatsApp Template (HTTP: POST to Meta)
    └── NO  → Is Media? (If: checks media_url exists)
              ├── YES → Send WhatsApp Media (HTTP: POST to Meta)
              └── NO  → Send WhatsApp Text (WhatsApp node)
  → Build Supabase Record (Code: prepares message row)
  → Create Message Row (Supabase INSERT)
  → Update Conversation Row (Supabase PATCH: last_message, updated_at)
  → Respond to Webhook (returns wamid to dashboard)
```

---

## 3. Takeover Webhook
- **ID:** `wWcLFROCJOUs5d60`
- **Status:** INACTIVE ⚠️
- **Webhook path:** `/webhook/takeover`

### Pipeline:
```
Webhook (POST: { session_id, action: 'human'|'ai', agent_name })
  → Map Route (Code: maps action to route value + extracts agent_name)
  → Update Supabase Route (HTTP: PATCH nonmedical_conversations.route + agent_name)
  → Respond to Webhook
```

**Note:** Since there's no AI, the "ai" action effectively means "available/unassigned" and "human" means "agent actively handling."

---

## 4. Dashboard → Outbound New Chat
- **ID:** `YKvwUujn7jvpC4ae`
- **Status:** INACTIVE ⚠️
- **Webhook path:** `/webhook/outbound-new-chat`

### Pipeline:
```
Receive New Chat Request (POST: { phone_number, branch, template_name, template_params })
  → Validate & Prepare (Code: builds session_id, validates input)
  → Upsert Conversation (HTTP: POST/PATCH nonmedical_conversations)
  → Log Message to Supabase (HTTP: POST nonmedical_messages with template content)
  → Respond to Dashboard (returns { success: true, session_id })
```

---

## 5. WhatsApp Chats Monthly Export
- **ID:** `0BtJfToYh5MFC6Ch`
- **Status:** INACTIVE ⚠️
- **Triggers:** Webhook (manual) + Schedule Trigger (monthly)

### Pipeline:
```
Webhook / Schedule Trigger
  → HTTP Request (fetch all conversations + messages from Supabase)
  → Code (The Bridge) (formats data for export)
  → Code in JavaScript (prepares per-chat rows)
  → Split Out (split conversations into individual items)
  → OneDrive Create Folder (creates monthly folder)
  → Convert to File (XLSX) → Upload a file (OneDrive)
  → Append or update row in sheet (Google Sheets backup)
```

---

## 6. WA Audit - Custom Date Export
- **ID:** `VqXO4GmJzeSfWLUL`
- **Status:** INACTIVE ⚠️
- **Webhook path:** (receives from dashboard "Custom Export" button)

### Pipeline:
```
Webhook (POST: { from_date, to_date })
  → Validate Selected Date
  → Prepare XLSX Rows + Prepare Media Rows (parallel)
  → Download Media File → Apply Media ZIP Paths
  → Prepare Full Transcript Sessions → Get Full Transcript Messages → Build Full Transcript TXT Files
  → Merge Audit Assets (+ TXT transcripts)
  → Build Audit ZIP Contents → Create Singlife WA Audit ZIP → Return Audit ZIP
```

---

## Workflows Still Needed

### 7. Zoho Desk Ticket Creator (TO BUILD)
- **Trigger:** Called from Quick WhatsApp Flow on NEW conversation creation
- **Action:** Email Zoho Desk inbox to auto-create ticket
- **Stores:** Zoho ticket reference in `nonmedical_case_threads`

### 8. Follow-up Reminder (TO BUILD)
- **Trigger:** Schedule (every 15 min or hourly)
- **Action:** Check `nonmedical_conversations.follow_up_at <= NOW()` → email reminder to ops

### 9. Zoho CRM → WhatsApp Template Sender (TO BUILD)
- **Trigger:** Webhook (POST from Zoho CRM automation)
- **Action:** Send WhatsApp template + log to `nonmedical_template_sends`
- **Model after:** Singlife's `Zoho CRM → WhatsApp Template Sender + schedule CRM check`
