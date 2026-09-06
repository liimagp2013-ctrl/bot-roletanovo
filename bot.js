const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(bodyParser.json());

// Suas credenciais do Telegram
const TELEGRAM_TOKEN = '8719989527:AAFVbj9_GmVnqt8uRb3kpph2rvoqJZIeH-U';
const CHAT_ID = '-1002569332722';
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const PAIRS = [
  { a: 0, b: 1, label: "0 e 1" },
  { a: 2, b: 5, label: "2 e 5" },
  { a: 3, b: 6, label: "3 e 6" },
  { a: 4, b: 8, label: "4 e 8" },
  { a: 7, b: 9, label: "7 e 9" }
];

let spins = [];

function getIndex(n) { return WHEEL.indexOf(n); }
function getTerminal(n) { return n % 10; }

function getNeighbors(n, count) {
  const idx = getIndex(n);
  if (idx === -1) return [n];
  const result = new Set([n]);
  for (let i = 1; i <= count; i++) {
    result.add(WHEEL[(idx - i + 37) % 37]);
    result.add(WHEEL[(idx + i) % 37]);
  }
  return Array.from(result).sort((a, b) => a - b);
}

function analisarEstrategiaTerminais(active) {
  if (active.length < 8) return { ready: false };

  const ultimo = active[active.length - 1];
  const lastTerm = getTerminal(ultimo);
  
  const termCount = Array(10).fill(0);
  active.forEach(n => termCount[getTerminal(n)]++);

  let activatedPair = null;
  for (const p of PAIRS) {
    if (p.a === lastTerm || p.b === lastTerm) { activatedPair = p; break; }
  }

  if (!activatedPair) return { ready: false };

  const numsA = [], numsB = [];
  for (let i = 0; i <= 36; i++) {
    const t = getTerminal(i);
    if (t === activatedPair.a) numsA.push(i);
    if (t === activatedPair.b) numsB.push(i);
  }

  const set = new Set();
  [...numsA, ...numsB].forEach(num => getNeighbors(num, 1).forEach(x => set.add(x)));
  set.add(0);
  const cobertura = Array.from(set).sort((a, b) => a - b);

  const pairFreq = termCount[activatedPair.a] + termCount[activatedPair.b];
  const pairStats = PAIRS.map(p => ({ ...p, freq: termCount[p.a] + termCount[p.b] }))
                        .sort((a, b) => b.freq - a.freq);
  const pairRank = pairStats.findIndex(p => p.label === activatedPair.label) + 1;

  let score = 55;
  if (pairRank === 1) score += 25;
  else if (pairRank === 2) score += 15;
  else if (pairRank === 3) score += 8;

  const maxPair = Math.max(...PAIRS.map(p => termCount[p.a] + termCount[p.b]), 1);
  score += Math.round((pairFreq / maxPair) * 15);
  score = Math.min(100, score);

  return {
    ready: score >= 60,
    score,
    pairLabel: activatedPair.label,
    cobertura,
    ultimo
  };
}

app.post('/api/resultado', (req, res) => {
  const { numero } = req.body;

  if (typeof numero === 'number' && numero >= 0 && numero <= 36) {
    spins.push(numero);
    if (spins.length > 50) spins.shift();

    const analise = analisarEstrategiaTerminais(spins);
    if (analise.ready) {
      enviarSinalTelegram(analise);
    }

    return res.status(200).json({ status: 'sucesso', processado: numero });
  }

  res.status(400).json({ status: 'erro', mensagem: 'Número inválido' });
});

async function enviarSinalTelegram(dados) {
  const mensagem = `
🚨 **SINAL CONFIRMADO - BIEL ROLETA VIP** 🚨

🎯 **Entrada:** Terminais Par ${dados.pairLabel}
🎰 **Gatilho:** ${dados.ultimo}
📊 **Assertividade:** ${dados.score}%

🔹 **Apostar nos Números:**
\`${dados.cobertura.join(' • ')}\`

⚠️ **Importante:** Proteja no **0**!
  `;

  try {
    await bot.sendMessage(CHAT_ID, mensagem, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
