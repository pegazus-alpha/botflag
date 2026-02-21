const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function connectDB() {
  // Supabase ne nécessite pas de connexion explicite
  console.log('✅ Supabase prêt');
}

async function logConversation(phone, userMsg, botReply, escalated = false) {
  const { error } = await supabase
    .from('conversations')
    .insert({ phone, user_msg: userMsg, bot_reply: botReply, escalated });

  if (error) console.error('Erreur Supabase:', error.message);
}

async function upsertClient(phone, data) {
  const { error } = await supabase
    .from('clients')
    .upsert({ phone, ...data }, { onConflict: 'phone' });

  if (error) console.error('Erreur Supabase client:', error.message);
}

module.exports = { connectDB, logConversation, upsertClient };