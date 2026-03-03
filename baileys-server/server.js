const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3100;
const SESSIONS_DIR = process.env.SESSIONS_DIR || '/data/baileys-sessions';
const BAILEYS_API_KEY = process.env.BAILEYS_API_KEY || '';
const logger = pino({ level: 'warn' });

// ---- API Key authentication middleware ----
app.use((req, res, next) => {
  // Allow health-check without auth
  if (req.method === 'GET' && req.path === '/') return next();

  if (!BAILEYS_API_KEY) return next(); // No key configured = open (backward compat)

  const provided = req.headers['apikey'] || req.headers['x-api-key'];
  if (provided !== BAILEYS_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing API key' });
  }
  next();
});

// ---- Webhook dispatcher ----
async function dispatchWebhooks(event, payload) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_FUNCTIONS_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    // Fetch active webhook configs that listen to this event
    const res = await fetch(
      `${supabaseUrl}/rest/v1/webhook_configs?is_active=eq.true&events=cs.{${event}}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const configs = await res.json();
    if (!Array.isArray(configs) || configs.length === 0) return;

    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });

    for (const cfg of configs) {
      const headers = { 'Content-Type': 'application/json' };
      if (cfg.secret) {
        headers['X-Webhook-Secret'] = cfg.secret;
      }
      fetch(cfg.webhook_url, { method: 'POST', headers, body }).catch(err => {
        console.error(`[webhook] Failed to dispatch ${event} to ${cfg.webhook_url}:`, err.message);
      });
    }

    console.log(`[webhook] Dispatched ${event} to ${configs.length} endpoint(s)`);
  } catch (err) {
    console.error(`[webhook] Error fetching configs for ${event}:`, err.message);
  }
}

// Store active sockets
const sessions = new Map();

// Ensure sessions dir exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// ---- Helper: get or create session ----
async function getSession(instanceName) {
  if (sessions.has(instanceName)) {
    return sessions.get(instanceName);
  }
  return null;
}

async function createSession(instanceName) {
  const sessionDir = path.join(SESSIONS_DIR, instanceName);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
  });

  const session = {
    sock,
    qr: null,
    connected: false,
    connecting: true,
    saveCreds,
  };

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      session.qr = qr;
      session.connecting = true;
      console.log(`[${instanceName}] QR code generated`);
    }

    if (connection === 'open') {
      session.connected = true;
      session.connecting = false;
      session.qr = null;
      console.log(`[${instanceName}] Connected`);
      // Dispatch webhook for connection.update
      dispatchWebhooks('connection.update', { instanceName, state: 'open' });
    }

    if (connection === 'close') {
      session.connected = false;
      session.connecting = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[${instanceName}] Disconnected. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);
      // Dispatch webhook for connection.update
      dispatchWebhooks('connection.update', { instanceName, state: 'close', statusCode, willReconnect: shouldReconnect });

      if (shouldReconnect) {
        setTimeout(() => {
          console.log(`[${instanceName}] Attempting reconnect...`);
          sessions.delete(instanceName);
          createSession(instanceName).catch(console.error);
        }, 3000);
      } else {
        sessions.delete(instanceName);
        // Clean up session files on logout
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
      }
    }
  });

  // Listen for group participant events (join/leave/promote/demote)
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    try {
      const webhookUrl = process.env.SUPABASE_FUNCTIONS_URL || 'http://supabase-kong:8000';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      // Try to get group name
      let groupName = id;
      try {
        const metadata = await sock.groupMetadata(id);
        groupName = metadata.subject || id;
      } catch {}

      await fetch(`${webhookUrl}/functions/v1/group-events-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          groupId: id,
          groupName,
          participants,
          action,
          instanceName,
        }),
      });

      console.log(`[${instanceName}] group-participants.update: ${action} ${participants.length} in ${groupName}`);
    } catch (err) {
      console.error(`[${instanceName}] group-participants.update webhook error:`, err.message);
    }
  });

  // Listen for incoming messages and dispatch via webhook
  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    if (type !== 'notify') return;
    for (const msg of msgs) {
      if (msg.key.fromMe) continue; // ignore own messages
      try {
        const from = msg.key.remoteJid;
        const isGroup = from?.endsWith('@g.us') || false;
        const participant = msg.key.participant || null;
        let messageType = 'unknown';
        let content = '';

        if (msg.message?.conversation) {
          messageType = 'text';
          content = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
          messageType = 'text';
          content = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage) {
          messageType = 'image';
          content = msg.message.imageMessage.caption || '';
        } else if (msg.message?.videoMessage) {
          messageType = 'video';
          content = msg.message.videoMessage.caption || '';
        } else if (msg.message?.audioMessage) {
          messageType = 'audio';
        } else if (msg.message?.documentMessage) {
          messageType = 'document';
          content = msg.message.documentMessage.fileName || '';
        } else if (msg.message?.stickerMessage) {
          messageType = 'sticker';
        }

        dispatchWebhooks('message.received', {
          instanceName,
          from,
          participant,
          messageType,
          content,
          timestamp: msg.messageTimestamp,
          isGroup,
          messageId: msg.key.id,
        });
      } catch (err) {
        console.error(`[${instanceName}] messages.upsert webhook error:`, err.message);
      }
    }
  });

  sessions.set(instanceName, session);
  return session;
}

// ---- Restore existing sessions on startup ----
async function restoreSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return;
  const dirs = fs.readdirSync(SESSIONS_DIR).filter(d =>
    fs.statSync(path.join(SESSIONS_DIR, d)).isDirectory()
  );
  for (const name of dirs) {
    try {
      console.log(`[startup] Restoring session: ${name}`);
      await createSession(name);
    } catch (e) {
      console.error(`[startup] Failed to restore ${name}:`, e.message);
    }
  }
}

// ============================================================
// ENDPOINTS (Evolution API compatible)
// ============================================================

// POST /instance/create
app.post('/instance/create', async (req, res) => {
  try {
    const { instanceName } = req.body;
    if (!instanceName) return res.status(400).json({ error: 'instanceName required' });

    let session = await getSession(instanceName);
    if (session) {
      return res.json({ instance: { instanceName, status: session.connected ? 'open' : 'connecting' } });
    }

    session = await createSession(instanceName);

    // Wait a bit for QR to be generated
    await new Promise(r => setTimeout(r, 3000));

    const result = { instance: { instanceName, status: 'connecting' } };
    if (session.qr) {
      result.qrcode = { base64: await QRCode.toDataURL(session.qr) };
    }

    res.json(result);
  } catch (e) {
    console.error('[create]', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /instance/connect/:name
app.get('/instance/connect/:name', async (req, res) => {
  try {
    const name = req.params.name;
    let session = await getSession(name);

    if (!session) {
      session = await createSession(name);
      await new Promise(r => setTimeout(r, 3000));
    }

    if (session.connected) {
      return res.json({ instance: { state: 'open' } });
    }

    if (session.qr) {
      const base64 = await QRCode.toDataURL(session.qr);
      return res.json({ base64, code: session.qr });
    }

    // Wait for QR
    await new Promise(r => setTimeout(r, 5000));
    if (session.qr) {
      const base64 = await QRCode.toDataURL(session.qr);
      return res.json({ base64, code: session.qr });
    }

    res.json({ instance: { state: session.connected ? 'open' : 'connecting' } });
  } catch (e) {
    console.error('[connect]', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /instance/connectionState/:name
app.get('/instance/connectionState/:name', async (req, res) => {
  try {
    const session = await getSession(req.params.name);
    if (!session) {
      return res.json({ instance: { state: 'close' } });
    }
    res.json({
      instance: {
        state: session.connected ? 'open' : (session.connecting ? 'connecting' : 'close'),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /instance/delete/:name
app.delete('/instance/delete/:name', async (req, res) => {
  try {
    const name = req.params.name;
    const session = await getSession(name);
    if (session) {
      try { await session.sock.logout(); } catch (_) {}
      try { session.sock.end(); } catch (_) {}
      sessions.delete(name);
    }
    const sessionDir = path.join(SESSIONS_DIR, name);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    res.json({ status: 'deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /instance/fetchInstances
app.get('/instance/fetchInstances', async (req, res) => {
  try {
    const instances = [];
    for (const [name, session] of sessions) {
      instances.push({
        instance: {
          instanceName: name,
          status: session.connected ? 'open' : (session.connecting ? 'connecting' : 'close'),
        },
      });
    }
    res.json(instances);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /group/fetchAllGroups/:name
app.get('/group/fetchAllGroups/:name', async (req, res) => {
  try {
    const session = await getSession(req.params.name);
    if (!session || !session.connected) {
      return res.status(400).json({ error: 'Instance not connected' });
    }

    const groups = await session.sock.groupFetchAllParticipating();
    const result = Object.values(groups).map(g => ({
      id: g.id,
      subject: g.subject,
      subjectOwner: g.subjectOwner,
      subjectTime: g.subjectTime,
      size: g.participants?.length || 0,
      creation: g.creation,
      owner: g.owner,
      desc: g.desc,
      descId: g.descId,
      restrict: g.restrict,
      announce: g.announce,
    }));

    res.json(result);
  } catch (e) {
    console.error('[fetchGroups]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /message/sendText/:name
app.post('/message/sendText/:name', async (req, res) => {
  try {
    const session = await getSession(req.params.name);
    if (!session || !session.connected) {
      return res.status(400).json({ error: 'Instance not connected' });
    }

    const { number, text, mentionsEveryOne } = req.body;
    const jid = number.includes('@') ? number : `${number}@g.us`;

    console.log(`[sendText] mentionsEveryOne=${mentionsEveryOne}, jid=${jid}`);

    const msgOptions = { text };

    if (mentionsEveryOne) {
      try {
        const metadata = await session.sock.groupMetadata(jid);
        msgOptions.mentions = metadata.participants.map(p => p.id);
        console.log(`[sendText] Mentions added: ${msgOptions.mentions.length} participants`);
      } catch (mentionErr) {
        console.error(`[sendText] Failed to fetch group metadata for mentions:`, mentionErr.message);
      }
    }

    const result = await session.sock.sendMessage(jid, msgOptions);
    res.json({ key: result.key, status: 'PENDING' });
  } catch (e) {
    console.error('[sendText]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /message/sendMedia/:name
app.post('/message/sendMedia/:name', async (req, res) => {
  try {
    const session = await getSession(req.params.name);
    if (!session || !session.connected) {
      return res.status(400).json({ error: 'Instance not connected' });
    }

    const { number, mediatype, media, caption, fileName, mentionsEveryOne } = req.body;
    const jid = number.includes('@') ? number : `${number}@g.us`;

    console.log(`[sendMedia] mentionsEveryOne=${mentionsEveryOne}, jid=${jid}, mediatype=${mediatype}`);

    let msgContent;
    if (mediatype === 'image') {
      msgContent = { image: { url: media }, caption: caption || '' };
    } else if (mediatype === 'video') {
      msgContent = { video: { url: media }, caption: caption || '' };
    } else if (mediatype === 'document') {
      msgContent = { document: { url: media }, fileName: fileName || 'file', caption: caption || '' };
    } else {
      return res.status(400).json({ error: `Unsupported media type: ${mediatype}` });
    }

    // Adicionar menções se solicitado
    if (mentionsEveryOne) {
      try {
        const metadata = await session.sock.groupMetadata(jid);
        msgContent.mentions = metadata.participants.map(p => p.id);
        console.log(`[sendMedia] Mentions added: ${msgContent.mentions.length} participants`);
      } catch (mentionErr) {
        console.error(`[sendMedia] Failed to fetch group metadata for mentions:`, mentionErr.message);
      }
    }

    console.log(`[sendMedia] Sending with mentions: ${!!msgContent.mentions}`);

    const result = await session.sock.sendMessage(jid, msgContent);
    res.json({ key: result.key, status: 'PENDING' });
  } catch (e) {
    console.error('[sendMedia]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /message/sendWhatsAppAudio/:name
app.post('/message/sendWhatsAppAudio/:name', async (req, res) => {
  try {
    const session = await getSession(req.params.name);
    if (!session || !session.connected) {
      return res.status(400).json({ error: 'Instance not connected' });
    }

    const { number, audio } = req.body;
    const jid = number.includes('@') ? number : `${number}@g.us`;

    const result = await session.sock.sendMessage(jid, {
      audio: { url: audio },
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
    });

    res.json({ key: result.key, status: 'PENDING' });
  } catch (e) {
    console.error('[sendAudio]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /message/sendSticker/:name
app.post('/message/sendSticker/:name', async (req, res) => {
  try {
    const session = await getSession(req.params.name);
    if (!session || !session.connected) {
      return res.status(400).json({ error: 'Instance not connected' });
    }

    const { number, sticker } = req.body;
    const jid = number.includes('@') ? number : `${number}@g.us`;

    const result = await session.sock.sendMessage(jid, {
      sticker: { url: sticker },
    });

    res.json({ key: result.key, status: 'PENDING' });
  } catch (e) {
    console.error('[sendSticker]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /message/sendLocation/:name
app.post('/message/sendLocation/:name', async (req, res) => {
  try {
    const session = await getSession(req.params.name);
    if (!session || !session.connected) {
      return res.status(400).json({ error: 'Instance not connected' });
    }

    const { number, name, address, latitude, longitude } = req.body;
    const jid = number.includes('@') ? number : `${number}@g.us`;

    const result = await session.sock.sendMessage(jid, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name: name || '',
        address: address || '',
      },
    });

    res.json({ key: result.key, status: 'PENDING' });
  } catch (e) {
    console.error('[sendLocation]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /message/sendContact/:name
app.post('/message/sendContact/:name', async (req, res) => {
  try {
    const session = await getSession(req.params.name);
    if (!session || !session.connected) {
      return res.status(400).json({ error: 'Instance not connected' });
    }

    const { number, contact } = req.body;
    const jid = number.includes('@') ? number : `${number}@g.us`;

    const contacts = (contact || []).map(c => ({
      displayName: c.fullName,
      vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${c.fullName}\nTEL;type=CELL:${c.phoneNumber}\nEND:VCARD`,
    }));

    const result = await session.sock.sendMessage(jid, { contacts: { displayName: contacts[0]?.displayName || '', contacts } });
    res.json({ key: result.key, status: 'PENDING' });
  } catch (e) {
    console.error('[sendContact]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /message/sendPoll/:name
app.post('/message/sendPoll/:name', async (req, res) => {
  try {
    const session = await getSession(req.params.name);
    if (!session || !session.connected) {
      return res.status(400).json({ error: 'Instance not connected' });
    }

    const { number, name: pollName, values, selectableCount } = req.body;
    const jid = number.includes('@') ? number : `${number}@g.us`;

    const result = await session.sock.sendMessage(jid, {
      poll: {
        name: pollName,
        values: values || [],
        selectableCount: selectableCount || 1,
      },
    });

    res.json({ key: result.key, status: 'PENDING' });
  } catch (e) {
    console.error('[sendPoll]', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /group/inviteCode/:name/:jid - Get invite code for a single group
app.get('/group/inviteCode/:name/:jid', async (req, res) => {
  try {
    const session = await getSession(req.params.name);
    if (!session || !session.connected) {
      return res.status(400).json({ error: 'Instance not connected' });
    }

    const jid = decodeURIComponent(req.params.jid);
    try {
      const code = await session.sock.groupInviteCode(jid);
      res.json({ invite_url: `https://chat.whatsapp.com/${code}` });
    } catch (err) {
      console.log(`[inviteCode] Failed for ${jid}: ${err.message}`);
      res.json({ invite_url: null });
    }
  } catch (e) {
    console.error('[inviteCode]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /group/inviteCodeBatch/:name - Get invite codes for multiple groups
app.post('/group/inviteCodeBatch/:name', async (req, res) => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  try {
    const session = await getSession(req.params.name);
    if (!session || !session.connected) {
      return res.status(400).json({ error: 'Instance not connected' });
    }

    const { jids } = req.body;
    if (!Array.isArray(jids)) {
      return res.status(400).json({ error: 'jids must be an array' });
    }

    const result = {};
    const errors = {};

    // First pass with 500ms delay between calls
    for (const jid of jids) {
      try {
        const code = await session.sock.groupInviteCode(jid);
        result[jid] = `https://chat.whatsapp.com/${code}`;
      } catch (err) {
        console.log(`[inviteCodeBatch] Failed for ${jid}: ${err.message}`);
        errors[jid] = err.message;
        result[jid] = null;
      }
      await sleep(500);
    }

    // Retry failed ones after 2s pause
    const failedJids = Object.keys(errors);
    if (failedJids.length > 0) {
      console.log(`[inviteCodeBatch] Retrying ${failedJids.length} failed groups after 2s...`);
      await sleep(2000);
      for (const jid of failedJids) {
        try {
          const code = await session.sock.groupInviteCode(jid);
          result[jid] = `https://chat.whatsapp.com/${code}`;
          delete errors[jid];
          console.log(`[inviteCodeBatch] Retry success for ${jid}`);
        } catch (err) {
          console.log(`[inviteCodeBatch] Retry failed for ${jid}: ${err.message}`);
          errors[jid] = err.message;
        }
        await sleep(500);
      }
    }

    res.json({ results: result, errors: Object.keys(errors).length > 0 ? errors : undefined });
  } catch (e) {
    console.error('[inviteCodeBatch]', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /smart-link/:slug - Smart link resolver (returns group invite URL as plain text)
app.get('/smart-link/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!slug) {
      return res.status(400).type('text/plain').send('slug is required');
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_FUNCTIONS_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[smart-link] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return res.status(500).type('text/plain').send('Server misconfigured');
    }

    // 1. Fetch smart link by slug
    const slRes = await fetch(
      `${supabaseUrl}/rest/v1/campaign_smart_links?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const smartLinks = await slRes.json();
    if (!smartLinks || smartLinks.length === 0) {
      return res.status(404).type('text/plain').send('Link not found or inactive');
    }

    const smartLink = smartLinks[0];
    const groupLinks = (smartLink.group_links || []).sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );

    if (!groupLinks.length) {
      return res.status(404).type('text/plain').send('No groups configured');
    }

    const groupIds = groupLinks.map(g => g.group_id);

    // 2. Fetch latest group_stats for these groups
    const groupIdsFilter = groupIds.map(id => `"${id}"`).join(',');
    const statsRes = await fetch(
      `${supabaseUrl}/rest/v1/group_stats?group_id=in.(${groupIdsFilter})&order=snapshot_date.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const stats = await statsRes.json();

    const memberCounts = {};
    const inviteUrls = {};
    if (Array.isArray(stats)) {
      for (const s of stats) {
        if (!(s.group_id in memberCounts)) {
          memberCounts[s.group_id] = s.member_count;
          inviteUrls[s.group_id] = s.invite_url || null;
        }
      }
    }

    // 3. Select group by position + capacity
    const maxMembers = smartLink.max_members_per_group;
    let redirectUrl = null;

    for (const gl of groupLinks) {
      const u = inviteUrls[gl.group_id];
      if (!u) continue;
      const count = memberCounts[gl.group_id] ?? 0;
      if (count < maxMembers) {
        redirectUrl = u;
        break;
      }
    }

    // Fallback: last group with a URL
    if (!redirectUrl) {
      for (let i = groupLinks.length - 1; i >= 0; i--) {
        const u = inviteUrls[groupLinks[i].group_id];
        if (u) {
          redirectUrl = u;
          break;
        }
      }
    }

    if (!redirectUrl) {
      return res.status(404).type('text/plain').send('No available groups with invite links');
    }

    console.log(`[smart-link] slug=${slug} -> ${redirectUrl}`);
    res.type('text/plain').send(redirectUrl);
  } catch (e) {
    console.error('[smart-link]', e);
    res.status(500).type('text/plain').send('Internal server error');
  }
});

// Health check
app.get('/health', (req, res) => {
  let baileysVersion = 'unknown';
  try {
    const pkg = require('@whiskeysockets/baileys/package.json');
    baileysVersion = pkg.version;
  } catch (_) {}
  res.json({ status: 'ok', sessions: sessions.size, baileysVersion });
});

// ---- Start server ----
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Baileys Server running on port ${PORT}`);
  await restoreSessions();
});
