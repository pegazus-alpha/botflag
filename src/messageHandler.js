const { generateResponse } = require('./ai');
const { logConversation } = require('./database');

const AGENT_PHONE = process.env.AGENT_PHONE + '@s.whatsapp.net';

// Extraire le numéro propre depuis le JID (ex: 237612345678@s.whatsapp.net)
function extractPhone(jid) {
  return jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
}

// Extraire le nom du contact (affiché dans WhatsApp)
function extractName(msg) {
  return msg.pushName || 'Inconnu';
}

async function handleMessage(sock, msg) {
  const phoneNumber = msg.key.remoteJid;
  const clientPhone = extractPhone(phoneNumber);
  const clientName  = extractName(msg);

  const userText = msg.message?.conversation ||
                   msg.message?.extendedTextMessage?.text || '';

  if (!userText.trim()) return;

  console.log(`📨 [${clientName} - +${clientPhone}]: ${userText}`);

  await sock.sendPresenceUpdate('composing', phoneNumber);

  try {
    const aiReply = await generateResponse(phoneNumber, userText);

    if (aiReply.includes('[ESCALADE_HUMAIN]')) {
      const cleanReply = aiReply.replace('[ESCALADE_HUMAIN]', '').trim();
      await sock.sendMessage(phoneNumber, { text: cleanReply });
      await escaladeToHuman(sock, clientPhone, clientName, userText);
    } else {
      await sock.sendMessage(phoneNumber, { text: aiReply });
    }

    await logConversation(phoneNumber, userText, aiReply);

  } catch (error) {
    console.error('Erreur:', error);
    await sock.sendMessage(phoneNumber, {
      text: 'Désolé, je rencontre une difficulté technique. Un agent va vous contacter.'
    });
    await escaladeToHuman(sock, clientPhone, clientName, userText);
  }
}

async function escaladeToHuman(sock, clientPhone, clientName, lastMessage) {
  const message =
    `⚠️ ESCALADE REQUISE\n` +
    `👤 Nom    : ${clientName}\n` +
    `📞 Numéro : +${clientPhone}\n` +
    `💬 Dernier message : "${lastMessage}"\n\n` +
    `Veuillez prendre en charge ce client.`;

  await sock.sendMessage(AGENT_PHONE, { text: message });
  console.log(`🔔 Escalade envoyée — ${clientName} (+${clientPhone})`);
}

module.exports = { handleMessage };