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
const logger = pino({ level: 'warn' });

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
    }

    if (connection === 'close') {
      session.connected = false;
      session.connecting = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[${instanceName}] Disconnected. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', sessions: sessions.size });
});

// ---- Start server ----
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Baileys Server running on port ${PORT}`);
  await restoreSessions();
});
