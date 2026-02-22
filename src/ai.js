const { loadBotContext } = require('./database');

const conversationHistory = new Map();

async function generateResponse(phoneNumber, userMessage) {
  // Charger le contexte depuis Supabase
  const { servicesText, faqText, configMap } = await loadBotContext();

  const SYSTEM_PROMPT = `Tu es l'assistant commercial de FLAG TECHNOLOGY, agence digitale à Douala, Cameroun.
TON SEUL OBJECTIF : convertir le prospect en client. Ne discute pas, qualifie et propose.

SERVICES ET TARIFS :
${servicesText}

CONNAISSANCES :
${faqText}

LIEN AUDIT GRATUIT : ${configMap.audit_url}
Propose systématiquement cet audit comme première étape.

RÈGLES STRICTES :
- Maximum 3 phrases par réponse
- Ne jamais inventer de prix ou délais
- Toujours orienter vers l'audit ou un rendez-vous
- Si le client hésite : proposer l'audit gratuit
- Si demande complexe ou client mécontent : [ESCALADE_HUMAIN]
- Répondre dans la langue du client`;

  if (!conversationHistory.has(phoneNumber)) {
    conversationHistory.set(phoneNumber, []);
  }
  const history = conversationHistory.get(phoneNumber);
  history.push({ role: 'user', content: userMessage });
  if (history.length > 10) history.splice(0, 2);

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
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history
      ],
      max_tokens: 1024,
      temperature: 0.3,
    })
  });

  const data = await response.json();

  if (!data.choices?.[0]) {
    console.error('Réponse OpenRouter invalide:', JSON.stringify(data));
    throw new Error('Réponse invalide');
  }

  const reply = data.choices[0].message.content;
  history.push({ role: 'assistant', content: reply });
  return reply;
}

function resetHistory(phoneNumber) {
  conversationHistory.delete(phoneNumber);
}

module.exports = { generateResponse, resetHistory };