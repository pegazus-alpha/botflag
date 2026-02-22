const { SYSTEM_PROMPT } = require('./prompts/systemPrompt');

const conversationHistory = new Map();

async function generateResponse(phoneNumber, userMessage) {
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
      max_tokens: 300,
      temperature: 0.3,
    })
  });

  const data = await response.json();

  if (!data.choices || !data.choices[0]) {
    console.error('Réponse OpenRouter invalide:', JSON.stringify(data));
    throw new Error('Réponse invalide de OpenRouter');
  }

  const reply = data.choices[0].message.content;
  history.push({ role: 'assistant', content: reply });

  console.log(`🤖 [${phoneNumber}]: ${reply.substring(0, 80)}...`);
  return reply;
}

function resetHistory(phoneNumber) {
  conversationHistory.delete(phoneNumber);
}

module.exports = { generateResponse, resetHistory };