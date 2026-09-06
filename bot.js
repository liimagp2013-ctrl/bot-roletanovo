const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// CONFIGURAÇÃO DO TELEGRAM (Mantido o seu Token e Chat ID)
const TELEGRAM_TOKEN = '8719989527:AA'; 
const TELEGRAM_CHAT_ID = '-1002569332'; 

let history = [];

// FUNÇÃO PARA ENVIAR MENSAGEM NO TELEGRAM
async function sendTelegramMessage(text) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.error('Erro ao enviar para Telegram:', err);
  }
}

// ROTA DO WEBHOOK
app.post('/webhook', async (req, res) => {
  const { number } = req.body;
  if (number === undefined) {
    return res.status(400).json({ error: 'Número inválido' });
  }

  history.push(number);
  console.log(`Número recebido: ${number}`);

  // Dispara mensagem no Telegram a cada número digitado
  const msg = `🎰 <b>Immersive Roulette</b>\n\nNovo número registrado: <b>${number}</b>\nHistórico recente: [${history.slice(-5).join(', ')}]`;
  await sendTelegramMessage(msg);

  res.json({ success: true, registered: number });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
