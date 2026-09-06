const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// CONFIGURAÇÃO DO TELEGRAM
const TELEGRAM_TOKEN = '8719989527:AA'; 
const TELEGRAM_CHAT_ID = '-1002569332'; 

// DADOS DE REFERÊNCIA DA ROLETA
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

const PAIRS = [
  { a: 0, b: 1, label: "0 e 1" },
  { a: 2, b: 3, label: "2 e 3" },
  { a: 4, b: 5, label: "4 e 5" },
  { a: 6, b: 7, label: "6 e 7" },
  { a: 8, b: 9, label: "8 e 9" },
  { a: 10, b: 11, label: "10 e 11" },
  { a: 12, b: 13, label: "12 e 13" },
  { a: 14, b: 15, label: "14 e 15" },
  { a: 16, b: 17, label: "16 e 17" },
  { a: 18, b: 19, label: "18 e 19" },
  { a: 20, b: 21, label: "20 e 21" },
  { a: 22, b: 23, label: "22 e 23" },
  { a: 24, b: 25, label: "24 e 25" },
  { a: 26, b: 27, label: "26 e 27" },
  { a: 28, b: 29, label: "28 e 29" },
  { a: 30, b: 31, label: "30 e 31" },
  { a: 32, b: 33, label: "32 e 33" },
  { a: 34, b: 35, label: "34 e 35" }
];

let history = [];

function getNeighbors(num) {
  const idx = WHEEL.indexOf(num);
  if (idx === -1) return [];
  const len = WHEEL.length;
  const prev2 = WHEEL[(idx - 2 + len) % len];
  const prev1 = WHEEL[(idx - 1 + len) % len];
  const next1 = WHEEL[(idx + 1) % len];
  const next2 = WHEEL[(idx + 2) % len];
  return [prev2, prev1, num, next1, next2];
}

function checkPair(n1, n2) {
  for (const pair of PAIRS) {
    if ((n1 === pair.a && n2 === pair.b) || (n1 === pair.b && n2 === pair.a)) {
      return pair;
    }
  }
  return null;
}

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
    console.error('Erro ao enviar Telegram:', err);
  }
}

app.post('/webhook', async (req, res) => {
  const { number } = req.body;
  if (number === undefined) {
    return res.status(400).json({ error: 'Número inválido' });
  }

  history.push(number);
  console.log(`Número recebido: ${number}`);

  if (history.length >= 2) {
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const pair = checkPair(prev, last);

    if (pair) {
      const neighborsLast = getNeighbors(last);
      const neighborsPrev = getNeighbors(prev);

      const message = `🎯 <b>SINAL IDENTIFICADO!</b>\n\n` +
                      `Gatilho: Par <b>${pair.label}</b> (números ${prev} e ${last})\n\n` +
                      `Entrar nos vizinhos de <b>${last}</b>: [${neighborsLast.join(', ')}]\n` +
                      `E vizinhos de <b>${prev}</b>: [${neighborsPrev.join(', ')}]`;

      await sendTelegramMessage(message);
    }
  }

  res.json({ success: true, registered: number, total: history.length });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
        
