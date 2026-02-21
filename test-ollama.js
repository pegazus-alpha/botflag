require('dotenv').config();

async function test() {
  console.log('Host utilisé :', process.env.OLLAMA_HOST);
  console.log('Modèle :', process.env.OLLAMA_MODEL);

  const response = await fetch(`${process.env.OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL,
      messages: [{ role: 'user', content: 'Dis bonjour en français' }],
      stream: false
    })
  });

  const data = await response.json();
  console.log('Réponse phi3:mini :', data.message.content);
}

test().catch(console.error);