require('dotenv').config();
const express = require('express');
const { connectToWhatsApp } = require('./src/whatsapp');
const { connectDB } = require('./src/database');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

async function start() {
  await connectDB();
  await connectToWhatsApp();
  app.listen(process.env.PORT || 3000, () => {
    console.log(`🚀 Serveur démarré sur le port ${process.env.PORT || 3000}`);
  });
}

start();
