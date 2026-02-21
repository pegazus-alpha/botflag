const { default: makeWASocket, useMultiFileAuthState,
        DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { handleMessage } = require('./messageHandler');

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
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
    if (!msg.message || msg.key.fromMe) return;

    // Ignorer les groupes — les JID de groupe contiennent @g.us
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    if (isGroup) return;

    await handleMessage(sock, msg);
  });
}

module.exports = { connectToWhatsApp };