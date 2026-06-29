// ─────────────────────────────────────────────────────────────────────────────
//  Cloudflare Worker — Non-Medical Tourism WhatsApp Webhook Router
//
//  Handles Meta WhatsApp webhook events:
//    GET  → webhook verification (hub.challenge)
//    POST whatsapp_business_account, value.statuses[]   → PATCH messages in Supabase (no n8n)
//    POST whatsapp_business_account, value.messages[]   → forward to N8N_WEBHOOK_URL
//
//  Only processes messages for phone_number_id 1194263793769742.
//
//  Environment variables (set in Cloudflare dashboard → Workers → Settings → Variables):
//    VERIFY_TOKEN     — any string you choose, must match Meta App dashboard
//    SUPABASE_URL     — (same as Singlife dashboard Supabase URL)
//    SUPABASE_KEY     — Supabase service role key
//    N8N_WEBHOOK_URL  — https://ulink.app.n8n.cloud/webhook/31543cd8-a839-47c9-b08a-a241785d7df0
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(req, env, ctx) {

    // ── Webhook verification (GET from Meta during setup) ─────────
    if (req.method === 'GET') {
      const url       = new URL(req.url);
      const mode      = url.searchParams.get('hub.mode');
      const token     = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token === env.VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }
      return new Response('Forbidden', { status: 403 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response('ok', { status: 200 });
    }

    ctx.waitUntil(routeWebhook(body, env));

    return new Response('ok', { status: 200 });
  },
};

async function routeWebhook(body, env) {
  console.log(`[Worker] object=${body?.object}`);

  if (body?.object !== 'whatsapp_business_account') return;

  const value = body?.entry?.[0]?.changes?.[0]?.value;
  if (!value) { console.log('[Worker] No value in entry'); return; }

  const hasStatuses = Array.isArray(value.statuses) && value.statuses.length;
  const hasMessages = Array.isArray(value.messages) && value.messages.length;
  console.log(`[Worker] statuses=${hasStatuses}, messages=${hasMessages}, phone_number_id=${value.metadata?.phone_number_id}`);

  const tasks = [];

  // Status receipts (sent/delivered/read/failed) → Supabase only
  if (hasStatuses) {
    for (const status of value.statuses) {
      tasks.push(handleStatus(status, env));
    }
  }

  // Inbound messages → forward to n8n (only for our phone number ID)
  if (hasMessages) {
    const phoneNumberId = value.metadata?.phone_number_id ?? '';
    if (phoneNumberId !== '1194263793769742') {
      console.log(`[Worker] Ignoring message for unknown phone_number_id: ${phoneNumberId}`);
      return;
    }

    console.log(`[Worker] Forwarding to n8n: ${env.N8N_WEBHOOK_URL}`);
    const forwardBody = { object: 'whatsapp_business_account', entry: [{ changes: [{ value }] }] };
    tasks.push(
      fetch(env.N8N_WEBHOOK_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(forwardBody),
      }).then(r => console.log(`[Worker] n8n responded: ${r.status}`))
        .catch(e => console.error('[Worker] n8n forward failed:', e.message))
    );
  }

  await Promise.allSettled(tasks);
}

async function handleStatus(status, env) {
  const { id, status: state, timestamp } = status;
  if (!id) return;

  const now   = new Date(Number(timestamp) * 1000).toISOString();
  const patch = {};

  switch (state) {
    case 'sent':
      patch.status = 'sent';
      break;
    case 'delivered':
      patch.status       = 'delivered';
      patch.delivered_at = now;
      break;
    case 'read':
      patch.status  = 'read';
      patch.read_at = now;
      break;
    case 'failed':
      patch.status = 'failed';
      break;
    default:
      return;
  }

  const url = `${env.SUPABASE_URL}/rest/v1/nonmedical_messages?wamid=eq.${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    method:  'PATCH',
    headers: {
      'apikey':        env.SUPABASE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    console.error(`[Worker] Supabase PATCH failed for wamid ${id}: ${res.status} — ${await res.text()}`);
  }
}
