const { generateResponse } = require('./ai');
const { logConversation } = require('./database');

const AGENT_PHONE = process.env.AGENT_PHONE + '@s.whatsapp.net';

async function handleMessage(sock, msg) {
  const phoneNumber = msg.key.remoteJid;
  const userText = msg.message?.conversation ||
                   msg.message?.extendedTextMessage?.text || '';

  if (!userText.trim()) return;

  console.log(`📨 Message de ${phoneNumber}: ${userText}`);

  await sock.sendPresenceUpdate('composing', phoneNumber);

  try {
    const aiReply = await generateResponse(phoneNumber, userText);

    if (aiReply.includes('[ESCALADE_HUMAIN]')) {
      const cleanReply = aiReply.replace('[ESCALADE_HUMAIN]', '').trim();
      await sock.sendMessage(phoneNumber, { text: cleanReply });
      await escalateToHuman(sock, phoneNumber, userText);
    } else {
      await sock.sendMessage(phoneNumber, { text: aiReply });
    }

    await logConversation(phoneNumber, userText, aiReply);

  } catch (error) {
    console.error('Erreur:', error);
    await sock.sendMessage(phoneNumber, {
      text: 'Désolé, je rencontre une difficulté technique. Un agent va vous contacter.'
    });
    await escalateToHuman(sock, phoneNumber, userText);
  }
}

async function escalateToHuman(sock, clientPhone, lastMessage) {
  await sock.sendMessage(AGENT_PHONE, {
    text: `⚠️ ESCALADE REQUISE\nClient: ${clientPhone}\nDernier message: ${lastMessage}\nVeuillez prendre en charge ce client.`
  });
  console.log(`🔔 Escalade envoyée pour ${clientPhone}`);
}

module.exports = { handleMessage };