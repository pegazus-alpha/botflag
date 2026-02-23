const { generateResponse } = require('./ai');
const {
  logConversation, getClient, upsertClient,
  setEscalade, setDernierAgent, resetHistory,
  isBotActif, saveLesson
} = require('./database');

const AGENT_JID   = process.env.AGENT_PHONE + '@s.whatsapp.net';
const SILENCE_MIN = 10;

function extractPhone(jid) {
  return jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
}

function extractName(msg) {
  return msg.pushName || 'Inconnu';
}

async function isSilent(phone) {
  const { data, error } = await require('./database').supabase
    .from('clients')
    .select('dernier_agent, escalade')
    .eq('phone', phone)
    .single();

  console.log(`🔍 isSilent [${phone}]:`, data, error?.message);

  if (!data?.dernier_agent) return false;

  const diff = (new Date() - new Date(data.dernier_agent)) / 1000 / 60;
  console.log(`⏱️ Silence depuis : ${diff.toFixed(1)} min`);

  return diff < SILENCE_MIN;
}

async function handleMessage(sock, msg) {
  const jid         = msg.key.remoteJid;
  const clientPhone = extractPhone(jid);
  const clientName  = extractName(msg);

  const userText = msg.message?.conversation ||
                   msg.message?.extendedTextMessage?.text || '';

  if (!userText.trim()) return;

  console.log(`📨 [${clientName} +${clientPhone}]: ${userText}`);

  // Vérifier si le bot est actif
  const actif = await isBotActif();
  if (!actif) {
    console.log('🔴 Bot désactivé — message ignoré');
    return;
  }

  await upsertClient(clientPhone, clientName);

  // Mode silence actif ?
  if (await isSilent(clientPhone)) {
    console.log(`🔇 Silence actif pour ${clientName}`);
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

    // Apprentissage automatique toutes les 5 interactions
    await apprendreDeConversation(clientPhone, clientName, userText, aiReply);

  } catch (error) {
    console.error('Erreur:', error.message);
    await sock.sendMessage(jid, {
      text: '🙏 Je vais faire en sorte qu\'un de nos conseillers vous contacte très prochainement.'
    });
    await escaladeToHuman(sock, clientPhone, clientName, userText);
    await setEscalade(clientPhone);
  }
}

async function escaladeToHuman(sock, clientPhone, clientName, lastMessage) {
  const client = await getClient(clientPhone) || {};
  const typeClient   = client.type_client || 'prospect';
  const firstContact = client.first_contact
    ? new Date(client.first_contact).toLocaleDateString('fr-FR')
    : 'aujourd\'hui';

  const message =
    `🚨 *ESCALADE CLIENT — ACTION REQUISE*\n\n` +
    `👤 *Nom*        : ${clientName}\n` +
    `📞 *Numéro*     : +${clientPhone}\n` +
    `🏷️ *Type*       : ${typeClient}\n` +
    `📅 *1er contact*: ${firstContact}\n\n` +
    `💬 *Dernier message* :\n"${lastMessage}"\n\n` +
    `⚡ Le bot est désormais silencieux.\n` +
    `Répondez directement à ce client sur WhatsApp.`;

  await sock.sendMessage(AGENT_JID, { text: message });
  console.log(`🔔 Escalade — ${clientName} (+${clientPhone})`);
}

// Apprentissage automatique
async function apprendreDeConversation(phone, nom, userMsg, botReply) {
  try {
    const insight = await analyserEchange(userMsg, botReply);
    if (insight) {
      await saveLesson(phone, `${nom}: "${userMsg}"`, insight);
      console.log(`🧠 Apprentissage sauvegardé pour ${nom}`);
    }
  } catch (e) {
    // Silencieux — l'apprentissage ne doit pas bloquer le bot
  }
}

async function analyserEchange(userMsg, botReply) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://flagtechnology.cm',
      'X-Title': 'FLAG TECHNOLOGY Bot'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL,
      messages: [{
        role: 'user',
        content: `Analyse cet échange commercial et donne UNE leçon courte (max 2 phrases) pour mieux convertir ce type de prospect à l'avenir. Si aucune leçon utile, réponds NULL.

Client : "${userMsg}"
Bot : "${botReply}"

Leçon :`
      }],
      max_tokens: 100,
      temperature: 0.3,
    })
  });

  const data = await response.json();
  const insight = data.choices?.[0]?.message?.content?.trim();
  return insight === 'NULL' || !insight ? null : insight;
}

module.exports = { handleMessage };