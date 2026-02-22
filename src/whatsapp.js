const { default: makeWASocket, useMultiFileAuthState,
        DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { handleMessage } = require('./messageHandler');
const { setDernierAgent, isBotActif, setBotActif } = require('./database');

const AGENT_PHONE = process.env.AGENT_PHONE + '@s.whatsapp.net';

// Commandes disponibles
const COMMANDES = `
*Commandes disponibles :*
!bot-off — désactiver le bot
!bot-on  — activer le bot
!bot-status — voir l'état du bot
`;

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
      // Notifier l'agent que le bot est en ligne
      await sock.sendMessage(AGENT_PHONE, {
        text: '🟢 *Bot FLAG TECHNOLOGY en ligne*\n\nTapez !bot-off pour désactiver ou !bot-status pour voir l\'état.'
      });
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

    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';

    // Messages de L'AGENT (fromMe = vous écrivez depuis votre téléphone)
    if (msg.key.fromMe) {
      // Commandes de contrôle — envoyées à vous-même (chat "Message vous-même")
      if (jid === AGENT_PHONE) {
        if (text === '!bot-off') {
          await setBotActif(false);
          await sock.sendMessage(AGENT_PHONE, { text: '🔴 Bot désactivé. Tapez !bot-on pour réactiver.' });
          return;
        }
        if (text === '!bot-on') {
          await setBotActif(true);
          await sock.sendMessage(AGENT_PHONE, { text: '🟢 Bot activé.' });
          return;
        }
        if (text === '!bot-status') {
          const actif = await isBotActif();
          await sock.sendMessage(AGENT_PHONE, {
            text: `État du bot : ${actif ? '🟢 Actif' : '🔴 Désactivé'}\n${COMMANDES}`
          });
          return;
        }
      }

      // Vous écrivez à un client — activer le silence
      const clientPhone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      console.log(`👤 Agent a écrit à ${clientPhone} — silence 10 min`);
      await setDernierAgent(clientPhone);
      return;
    }

    // Message d'un client
    await handleMessage(sock, msg);
  });
}

module.exports = { connectToWhatsApp };