  const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());
app.use(express.static('.')); // Serve a página index.html

// ==========================================
// CONFIGURAÇÕES DO TELEGRAM
// ==========================================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'SEU_TELEGRAM_TOKEN_AQUI';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'SEU_CHAT_ID_AQUI';

async function sendTelegramMessage(text) {
  if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN.includes('SEU_TELEGRAM')) return;
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem para o Telegram:', error.message);
  }
}

// ==========================================
// MAPEAMENTO FÍSICO DA ROLETA
// ==========================================
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const PAIRS_MAP = {
  "2_5": [2, 5],
  "3_6": [3, 6],
  "0_1": [0, 1],
  "4_8": [4, 8],
  "9_7": [9, 7]
};

let rouletteHistory = [];

function getNeighbors(number, count = 1) {
  const index = WHEEL_ORDER.indexOf(number);
  if (index === -1) return [];
  const neighbors = [];
  const total = WHEEL_ORDER.length;
  for (let i = 1; i <= count; i++) {
    neighbors.push(WHEEL_ORDER[(index - i + total) % total]);
    neighbors.push(WHEEL_ORDER[(index + i) % total]);
  }
  return neighbors;
}

function generatePairBetNumbers(pairKey) {
  const [t1, t2] = PAIRS_MAP[pairKey];
  const betNumbers = new Set();

  for (let num = 0; num <= 36; num++) {
    const terminal = num % 10;
    if (terminal === t1 || terminal === t2) {
      betNumbers.add(num);
      getNeighbors(num, 1).forEach(n => betNumbers.add(n));
    }
  }
  [0, 10, 20, 30].forEach(z => betNumbers.add(z));
  return Array.from(betNumbers).sort((a, b) => a - b);
}

// ==========================================
// LÓGICA DAS ESTRATÉGIAS
// ==========================================
function analyzePairs(history) {
  const window = history.slice(0, 100);
  const results = {};

  Object.keys(PAIRS_MAP).forEach(pairKey => {
    const terminals = PAIRS_MAP[pairKey];
    let triggers = 0;
    let hits = 0;

    for (let i = window.length - 2; i >= 0; i--) {
      const prevTerminal = window[i + 1] % 10;
      if (terminals.includes(prevTerminal)) {
        triggers++;
        const betCoverage = generatePairBetNumbers(pairKey);
        if (betCoverage.includes(window[i])) hits++;
      }
    }
    const winRate = triggers > 0 ? (hits / triggers) * 100 : 0;
    results[pairKey] = { triggers, hits, winRate: parseFloat(winRate.toFixed(1)) };
  });

  const strongestPair = Object.keys(results).reduce((a, b) =>
    results[a].winRate >= results[b].winRate ? a : b
  );

  return { results, strongestPair };
}

function analyzeHotZone(history) {
  const window = history.slice(0, 40);
  const freqMap = {};
  for (let i = 0; i <= 36; i++) freqMap[i] = 0;
  window.forEach(num => freqMap[num]++);

  const hotZoneNumbers = Object.keys(freqMap)
    .map(Number)
    .sort((a, b) => freqMap[b] - freqMap[a])
    .slice(0, 19);

  let consecutiveMisses = 0;
  for (let i = 0; i < history.length; i++) {
    if (!hotZoneNumbers.includes(history[i])) consecutiveMisses++;
    else break;
  }

  let status = "AGUARDAR";
  if (consecutiveMisses >= 2 && consecutiveMisses <= 4) status = "ENTRADA SEGURA";
  else if (consecutiveMisses > 4) status = "ALERTA DE RISCO";

  return { hotZoneNumbers, consecutiveMisses, status };
}

// ==========================================
// ROTAS DO SERVIDOR WEB E TELEGRAM
// ==========================================

// Rota para o frontend ou raspador enviar o novo número sorteado
app.post('/api/number', (req, res) => {
  const { number } = req.body;
  if (typeof number !== 'number' || number < 0 || number > 36) {
    return res.status(400).json({ error: 'Número inválido' });
  }

  rouletteHistory.unshift(number);

  const pairs = analyzePairs(rouletteHistory);
  const hotZone = analyzeHotZone(rouletteHistory);

  // Verifica gatilho no Telegram para o Par Mais Forte
  const lastTerminal = number % 10;
  const bestPair = pairs.strongestPair;
  const activeTerminals = PAIRS_MAP[bestPair];

  if (activeTerminals.includes(lastTerminal)) {
    const betNumbers = generatePairBetNumbers(bestPair);
    const msg = `🎯 <b>SINAL DE ENTRADA - PARES</b>\n\n` +
                `<b>Par Ativado:</b> ${bestPair.replace('_', ' e ')}\n` +
                `<b>Assertividade (100 giros):</b> ${pairs.results[bestPair].winRate}%\n` +
                `<b>Gatilho:</b> Saiu ${number} (Terminal ${lastTerminal})\n\n` +
                `<b>Apostar nos Números (${betNumbers.length} fichas):</b>\n` +
                `${betNumbers.join(', ')}`;
    sendTelegramMessage(msg);
  }

  // Verifica gatilho no Telegram para Zona Quente
  if (hotZone.status === "ENTRADA SEGURA" && hotZone.consecutiveMisses === 2) {
    const sortedHot = hotZone.hotZoneNumbers.sort((a,b)=>a-b);
    const msg = `🔥 <b>SINAL DE ENTRADA - ZONA QUENTE</b>\n\n` +
                `<b>Status:</b> Entrada Segura (${hotZone.consecutiveMisses} falhas seguidas)\n\n` +
                `<b>Coletar 19 Números Quentes:</b>\n` +
                `${sortedHot.join(', ')}`;
    sendTelegramMessage(msg);
  }

  res.json({ success: true, pairs, hotZone, history: rouletteHistory.slice(0, 20) });
});

// Rota de consulta do status atual
app.get('/api/status', (req, res) => {
  res.json({
    history: rouletteHistory.slice(0, 20),
    pairs: rouletteHistory.length > 0 ? analyzePairs(rouletteHistory) : null,
    hotZone: rouletteHistory.length > 0 ? analyzeHotZone(rouletteHistory) : null
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
