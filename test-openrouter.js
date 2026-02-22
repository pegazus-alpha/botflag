require('dotenv').config();

async function test() {
  console.log('Modèle :', process.env.OPENROUTER_MODEL);

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
      messages: [{ role: 'user', content: 'Dis bonjour en français' }],
      max_tokens: 100,
    })
  });

  const data = await response.json();
  console.log('Réponse :', data.choices[0].message.content);
}

test().catch(console.error);
 