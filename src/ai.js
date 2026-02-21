const { SYSTEM_PROMPT } = require('./prompts/systemPrompt');

// Historique global par numéro de téléphone
const conversationHistory = new Map();

async function generateResponse(phoneNumber, userMessage) {
  // Initialiser l'historique si nouveau contact
  if (!conversationHistory.has(phoneNumber)) {
    conversationHistory.set(phoneNumber, []);
  }
  const history = conversationHistory.get(phoneNumber);

  // Ajouter le message du client
  history.push({ role: 'user', content: userMessage });

  // Garder max 10 échanges (5 aller-retour) pour la cohérence
  if (history.length > 10) history.splice(0, 2);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${process.env.OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history  // tout l'historique envoyé à chaque fois
        ],
        stream: false,
        options: {
          temperature: 0.3,  // réduit pour des réponses plus cohérentes
          num_predict: 200,
        }
      })
    });

    const data = await response.json();
    const reply = data.message.content;

    // Sauvegarder la réponse dans l'historique
    history.push({ role: 'assistant', content: reply });

    console.log(`🤖 Réponse pour ${phoneNumber}: ${reply.substring(0, 80)}...`);
    return reply;

  } finally {
    clearTimeout(timeout);
  }
}

// Réinitialiser la conversation d'un client (si besoin)
function resetHistory(phoneNumber) {
  conversationHistory.delete(phoneNumber);
  console.log(`🔄 Historique réinitialisé pour ${phoneNumber}`);
}

module.exports = { generateResponse, resetHistory };
