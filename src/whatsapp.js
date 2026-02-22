const { default: makeWASocket, useMultiFileAuthState,
        DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { handleMessage } = require('./messageHandler');
const { setDernierAgent, isBotActif, setBotActif } = require('./database');

const AGENT_PHONE = process.env.AGENT_PHONE + '@s.whatsapp.net';

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
      await sock.sendMessage(AGENT_PHONE, {
        text: '🟢 *Bot FLAG TECHNOLOGY en ligne*\n\n*Commandes disponibles :*\n!bot-off — désactiver le bot\n!bot-on — activer le bot\n!bot-status — voir l\'état'
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

    const jid  = msg.key.remoteJid;
    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';

    // Ignorer groupes et statuts
    if (jid.endsWith('@g.us')) return;
    if (jid === 'status@broadcast') return;
    if (jid.endsWith('@broadcast')) return;

    // Messages de l'agent (fromMe = vous écrivez depuis votre téléphone)
    if (msg.key.fromMe) {

      // Détecter les commandes peu importe le JID
      if (text.startsWith('!bot')) {
        console.log(`⌨️ Commande reçue : ${text}`);

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
            text: `État du bot : ${actif ? '🟢 Actif' : '🔴 Désactivé'}\n\n*Commandes :*\n!bot-off — désactiver\n!bot-on — activer\n!bot-status — état`
          });
          return;
        }
        return;
      }

      // Vous écrivez à un client — activer le silence
      const clientPhone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      console.log(`👤 Agent a écrit à ${clientPhone} — silence 10 min`);
      await setDernierAgent(clientPhone);
      return;
    }

    // Message d'un client — traiter normalement
    await handleMessage(sock, msg);
  });
}

module.exports = { connectToWhatsApp };