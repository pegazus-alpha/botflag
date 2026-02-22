const { default: makeWASocket, useMultiFileAuthState,
        DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { handleMessage } = require('./messageHandler');
const { setDernierAgent } = require('./database');

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    shouldIgnoreJid: jid => jid === 'status@broadcast',
  });

  sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
    if (qr) {
      console.log('Scannez ce QR code avec WhatsApp :');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log('✅ Bot connecté à WhatsApp !');
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode
                              !== DisconnectReason.loggedOut;
      if (shouldReconnect) connectToWhatsApp();
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const jid = msg.key.remoteJid;

    // Ignorer groupes et statuts
    if (jid.endsWith('@g.us')) return;
    if (jid === 'status@broadcast') return;
    if (jid.endsWith('@broadcast')) return;

    // Si c'est VOUS (l'agent) qui écrivez — mettre le silence
    if (msg.key.fromMe) {
      const clientPhone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      console.log(`👤 Agent a écrit à ${clientPhone} — silence activé 10 min`);
      await setDernierAgent(clientPhone);
      return;
    }

    // Sinon c'est un message client — traiter normalement
    await handleMessage(sock, msg);
  });
}

module.exports = { connectToWhatsApp };