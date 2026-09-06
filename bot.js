const express = require('express');
const https = require('https');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// CONFIGURAÇÃO DO TELEGRAM
const TELEGRAM_TOKEN = '8719989527:AA'; 
const TELEGRAM_CHAT_ID = '-1002569332'; 

// DADOS DE REFERÊNCIA DA ROLETA (Immersive Roulette)
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

// SEUS NÚMEROS DE ESTRATÉGIA E SEUS PARCEIROS
const STRATEGY_PAIRS = {
  2: 5,
  5: 2,
  3: 6,
  6: 3,
  0: 1,
  1: 0,
  4: 8,
  8: 4,
  7: 9,
  9: 7
};

let history = [];

// FUNÇÃO PARA CALCULAR VIZINHOS NA ROLETA
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

function sendTelegramMessage(text) {
  const data = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text: text,
    parse_mode: 'HTML'
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  const req = https.request(options, (res) => {
    res.on('data', () => {});
  });

  req.on('error', (e) => {
    console.error('Erro Telegram:', e);
  });

  req.write(data);
  req.end();
}

app.post('/webhook', (req, res) => {
  const { number } = req.body;
  if (number === undefined) {
    return res.status(400).json({ error: 'Número inválido' });
  }

  history.push(number);
  console.log(`Número recebido: ${number}`);

  // VERIFICA SE O NÚMERO DIGITADO É UM NÚMERO CHAVE / GATILHO
  if (STRATEGY_PAIRS[number] !== undefined) {
    const partner = STRATEGY_PAIRS[number];
    const neighbors = getNeighbors(number);
    const partnerNeighbors = getNeighbors(partner);

    const message = `🎯 <b>SINAL IDENTIFICADO!</b>\n\n` +
                    `Gatilho: Número <b>${number}</b>\n` +
                    `Estratégia Par: <b>${number} e ${partner}</b>\n\n` +
                    `📍 <b>Apostar nos Vizinhos de ${number}:</b>\n[${neighbors.join(', ')}]\n\n` +
                    `📍 <b>Vizinhos do Par (${partner}):</b>\n[${partnerNeighbors.join(', ')}]`;

    sendTelegramMessage(message);
  }

  res.json({ success: true, registered: number, total: history.length });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
