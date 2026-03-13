import express from 'express';
import { default as makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3100;
const SESSIONS_DIR = process.env.SESSIONS_DIR || '/data/baileys-sessions';
const logger = pino({ level: 'warn' });

// Constants
const MAX_MENTIONS_PARTICIPANTS = 2000;
const METADATA_TIMEOUT_MS = 5000;
const RECONNECT_DELAYS = [5000, 15000, 60000]; // backoff: 5s, 15s, 60s

// Store active sockets
const sessions = new Map();

// Ensure sessions dir exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// ---- Helper: safe groupMetadata with timeout ----
async function safeGroupMetadata(sock, jid) {
  try {
    const metadata = await Promise.race([
      sock.groupMetadata(jid),
      new Promise((_, reject) => setTimeout(() => reject(new Error('metadata_timeout')), METADATA_TIMEOUT_MS)),
    ]);
    return metadata;
  } catch (err) {
    console.log(`[safeGroupMetadata] Failed for ${jid}: ${err.message}`);
    return null;
  }
}

// ---- Helper: add mentions if group is small enough ----
async function addMentionsIfNeeded(sock, jid, msgContent) {
  const metadata = await safeGroupMetadata(sock, jid);
  if (!metadata) {
    console.log(`[mentions] Skipping mentions — metadata unavailable for ${jid}`);
    return;
  }
  if (metadata.participants.length > MAX_MENTIONS_PARTICIPANTS) {
    console.log(`[mentions] Skipping mentions — group has ${metadata.participants.length} participants (limit: ${MAX_MENTIONS_PARTICIPANTS})`);
    return;
  }
  msgContent.mentions = metadata.participants.map(p => p.id);
  console.log(`[mentions] Added ${msgContent.mentions.length} mentions for ${jid}`);
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

  const sock = makeWASocket({
    auth: state,
    logger,
    browser: ['WhatsGrupos', 'Chrome', '145.0.0'],
    version: [2, 3000, 1033893291],
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
  });

  const session = {
    sock,
    qr: null,
    connected: false,
    connecting: true,
    saveCreds,
    reconnectAttempt: 0,
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
      session.reconnectAttempt = 0;
      console.log(`[${instanceName}] Connected`);
    }

    if (connection === 'close') {
      session.connected = false;
      session.connecting = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[${instanceName}] Disconnected. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

      // Terminal errors — stop reconnecting
      const terminalCodes = [401, 405, 406, 440];
      if (!shouldReconnect || terminalCodes.includes(statusCode)) {
        console.log(`[${instanceName}] Terminal error (${statusCode}). Stopping reconnection.`);
        // Delay deletion so polling can read the error
        const errorLabel = `terminal_${statusCode || 'loggedOut'}`;
        session.error = errorLabel;
        setTimeout(() => {
          sessions.delete(instanceName);
        }, 30000);
        // Clean up session files on logout
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        return;
      }

      // Backoff reconnection
      const attempt = session.reconnectAttempt || 0;
      if (attempt >= RECONNECT_DELAYS.length) {
        console.log(`[${instanceName}] Max reconnect attempts reached (${attempt}). Giving up.`);
        session.error = 'max_reconnect_attempts';
        setTimeout(() => {
          sessions.delete(instanceName);
        }, 30000);
        return;
      }

      const delay = RECONNECT_DELAYS[attempt];
      session.reconnectAttempt = attempt + 1;
      console.log(`[${instanceName}] Reconnecting in ${delay / 1000}s (attempt ${attempt + 1}/${RECONNECT_DELAYS.length})...`);

      setTimeout(() => {
        sessions.delete(instanceName);
        createSession(instanceName).catch(err => {
          console.error(`[${instanceName}] Reconnect failed:`, err.message);
        });
      }, delay);
    }
  });

  // Listen for group participant events (join/leave/promote/demote)
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    try {
      const webhookUrl = process.env.SUPABASE_FUNCTIONS_URL || 'http://supabase-kong:8000';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      let groupName = id;
      try {
        const metadata = await safeGroupMetadata(sock, id);
        if (metadata) groupName = metadata.subject || id;
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

    // Force clean old session files (v6→v7 compatibility)
    const sessionDir = path.join(SESSIONS_DIR, instanceName);
    if (fs.existsSync(sessionDir)) {
      console.log(`[create] Cleaning old session dir for ${instanceName}`);
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    session = await createSession(instanceName);
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

    // Polling loop: check every 1s for up to 15s
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (session.qr || session.connected) break;
    }

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
        ...(session.error && { error: session.error }),
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

    const msgOptions = { text };

    if (mentionsEveryOne) {
      await addMentionsIfNeeded(session.sock, jid, msgOptions);
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

    if (mentionsEveryOne) {
      await addMentionsIfNeeded(session.sock, jid, msgContent);
    }

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

    // Detect mimetype from URL extension
    const audioUrl = audio.toLowerCase();
    let mimetype = 'audio/ogg; codecs=opus';
    let ptt = true;

    if (audioUrl.includes('.mp3')) {
      mimetype = 'audio/mpeg';
      ptt = false;
    } else if (audioUrl.includes('.m4a') || audioUrl.includes('.mp4')) {
      mimetype = 'audio/mp4';
      ptt = false;
    } else if (audioUrl.includes('.wav')) {
      mimetype = 'audio/wav';
      ptt = false;
    } else if (audioUrl.includes('.aac')) {
      mimetype = 'audio/aac';
      ptt = false;
    }

    console.log(`[sendAudio] ${jid} mimetype=${mimetype} ptt=${ptt}`);

    // Download audio as buffer to avoid remote fetch issues
    let audioSource;
    try {
      const response = await fetch(audio);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      audioSource = Buffer.from(arrayBuffer);
      console.log(`[sendAudio] Downloaded ${audioSource.length} bytes`);
    } catch (dlErr) {
      console.log(`[sendAudio] Buffer download failed (${dlErr.message}), falling back to URL`);
      audioSource = { url: audio };
    }

    const result = await session.sock.sendMessage(jid, {
      audio: audioSource,
      mimetype,
      ptt,
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

    const contacts = (contact || []).map(c => {
      const cleanNum = (c.phoneNumber || '').replace(/\D/g, '');
      return {
        displayName: c.fullName,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${c.fullName}\nTEL;type=CELL;type=VOICE;waid=${cleanNum}:+${cleanNum}\nEND:VCARD`,
      };
    });

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

// GET /group/inviteCode/:name/:jid
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

// POST /group/inviteCodeBatch/:name
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

// GET /smart-link/:slug
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
  res.json({ status: 'ok', sessions: sessions.size });
});

// ---- Start server ----
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Baileys Server running on port ${PORT}`);
  await restoreSessions();
});
