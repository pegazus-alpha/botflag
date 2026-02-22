const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function connectDB() {
  console.log('✅ Supabase prêt');
}

// ── Charger le contexte complet pour le prompt ──
async function loadBotContext() {
  const [services, knowledge, config] = await Promise.all([
    supabase.from('services').select('*').eq('actif', true),
    supabase.from('knowledge').select('*').eq('actif', true),
    supabase.from('config').select('*'),
  ]);

  // Formater les services
  const servicesText = services.data.map(s => {
    const prix = s.prix_max
      ? `${s.prix_min.toLocaleString()} - ${s.prix_max.toLocaleString()} ${s.unite}`
      : `à partir de ${s.prix_min.toLocaleString()} ${s.unite}`;
    return `- ${s.nom} : ${prix}${s.description ? ' ('+s.description+')' : ''}`;
  }).join('\n');

  // Formater la FAQ
  const faqText = knowledge.data.map(k =>
    `[${k.categorie}] ${k.question ? k.question+' : ' : ''}${k.reponse}`
  ).join('\n');

  // Formater la config
  const configMap = {};
  config.data.forEach(c => configMap[c.cle] = c.valeur);

  return { servicesText, faqText, configMap };
}

// ── Conversations ──
async function logConversation(phone, userMsg, botReply, escalated = false) {
  await supabase.from('conversations')
    .insert({ phone, user_msg: userMsg, bot_reply: botReply, escalated });
}

// ── Clients ──
async function getClient(phone) {
  const { data } = await supabase.from('clients')
    .select('*').eq('phone', phone).single();
  return data;
}

async function upsertClient(phone, nom, extra = {}) {
  await supabase.from('clients')
    .upsert({ phone, nom, ...extra, last_contact: new Date().toISOString() },
             { onConflict: 'phone' });
}

async function setEscalade(phone) {
  await supabase.from('clients')
    .upsert({ phone, escalade: true, dernier_agent: new Date().toISOString() },
             { onConflict: 'phone' });
}

async function setDernierAgent(phone) {
  await supabase.from('clients')
    .upsert({ phone, dernier_agent: new Date().toISOString() },
             { onConflict: 'phone' });
}

module.exports = {
  connectDB, loadBotContext,
  logConversation, getClient, upsertClient,
  setEscalade, setDernierAgent
};