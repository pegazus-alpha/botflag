const { generateResponse, resetHistory } = require('./ai');
const {
  logConversation, getClient,
  upsertClient, setEscalade
} = require('./database');

const AGENT_JID   = process.env.AGENT_PHONE + '@s.whatsapp.net';
const SILENCE_MIN = 10; // minutes de silence après intervention agent

function extractPhone(jid) {
  return jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
}

function extractName(msg) {
  return msg.pushName || 'Inconnu';
}

// Vérifier si le bot doit rester silencieux
async function isSilent(phone) {
  const client = await getClient(phone);
  if (!client) return false;
  if (!client.escalade && !client.dernier_agent) return false;

  const dernierAgent = new Date(client.dernier_agent);
  const maintenant   = new Date();
  const diffMinutes  = (maintenant - dernierAgent) / 1000 / 60;

  return diffMinutes < SILENCE_MIN;
}

async function handleMessage(sock, msg) {
  const jid         = msg.key.remoteJid;
  const clientPhone = extractPhone(jid);
  const clientName  = extractName(msg);

  const userText = msg.message?.conversation ||
                   msg.message?.extendedTextMessage?.text || '';

  if (!userText.trim()) return;

  console.log(`📨 [${clientName} +${clientPhone}]: ${userText}`);

  // Mettre à jour le client en base
  await upsertClient(clientPhone, clientName);

  // Vérifier le mode silence
  if (await isSilent(clientPhone)) {
    console.log(`🔇 Silence actif pour ${clientName} — bot muet`);
    return;
  }

  await sock.sendPresenceUpdate('composing', jid);

  try {
    const aiReply = await generateResponse(jid, userText);

    if (aiReply.includes('[ESCALADE_HUMAIN]')) {
      const cleanReply = aiReply.replace('[ESCALADE_HUMAIN]', '').trim();
      await sock.sendMessage(jid, { text: cleanReply });
      await escaladeToHuman(sock, clientPhone, clientName, userText);
      await setEscalade(clientPhone);
      resetHistory(jid);
    } else {
      await sock.sendMessage(jid, { text: aiReply });
    }

    await logConversation(clientPhone, userText, aiReply);

  } catch (error) {
    console.error('Erreur:', error.message);
    await sock.sendMessage(jid, {
      text: 'Désolé, une difficulté technique est survenue. Un agent va vous contacter.'
    });
    await escaladeToHuman(sock, clientPhone, clientName, userText);
    await setEscalade(clientPhone);
  }
}

async function escaladeToHuman(sock, clientPhone, clientName, lastMessage) {
  const client = await getClient(clientPhone) || {};

  const typeClient = client.type_client || 'prospect';
  const firstContact = client.first_contact
    ? new Date(client.first_contact).toLocaleDateString('fr-FR')
    : 'aujourd\'hui';

  const message =
    `🚨 *ESCALADE CLIENT — ACTION REQUISE*\n\n` +
    `👤 *Nom*       : ${clientName}\n` +
    `📞 *Numéro*    : +${clientPhone}\n` +
    `🏷️ *Type*      : ${typeClient}\n` +
    `📅 *1er contact*: ${firstContact}\n\n` +
    `💬 *Dernier message* :\n"${lastMessage}"\n\n` +
    `⚡ Le bot est désormais silencieux.\n` +
    `Répondez directement à ce client sur WhatsApp.`;

  await sock.sendMessage(AGENT_JID, { text: message });
  console.log(`🔔 Escalade — ${clientName} (+${clientPhone})`);
}

module.exports = { handleMessage };
