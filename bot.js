const express = require('express');
const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// CONFIGURAÇÃO DO TELEGRAM
const TELEGRAM_TOKEN = '8719989527:AAFVbj9_GmVnqt8uRb3kpph2rvoqJZIeH-U';
const TELEGRAM_CHAT_ID = '-1002569332722';

// DADOS DE REFERÊNCIA DA ROLETA (Extraídos da sua lógica)
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const PAIRS = [
  { a: 0, b: 1, label: "0 e 1" },
  { a: 2, b: 5, label: "2 e 5" },
  { a: 3, b: 6, label: "3 e 6" },
  { a: 4, b: 8, label: "4 e 8" },
  { a: 7, b: 9, label: "7 e 9" }
];

// HISTÓRICO EM MEMÓRIA (Guarda os últimos números recebidos automaticamente)
let spinsHistory = [];
const MAX_LOOKBACK = 50; // Quantidade de rodadas para analisar por padrão

// --- FUNÇÕES AUXILIARES DA SUA LÓGICA ---
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
  return Array.from(result).sort((a,b) => a-b);
}

function minimalArc(positions) {
  if (positions.length === 0) return { length: 0, start: 0, end: 0 };
  if (positions.length === 1) return { length: 1, start: positions[0], end: positions[0] };
  const sorted = [...new Set(positions)].sort((a,b) => a-b);
  const n = sorted.length;
  let minLen = 37, bestStart = sorted[0], bestEnd = sorted[n-1];
  for (let i = 0; i < n; i++) {
    const start = sorted[i];
    const end = sorted[(i - 1 + n) % n];
    let len = end >= start ? end - start + 1 : (37 - start) + end + 1;
    if (len < minLen) { minLen = len; bestStart = start; bestEnd = end; }
  }
  return { length: minLen, start: bestStart, end: bestEnd };
}

function numbersInArc(startIdx, endIdx) {
  const result = [];
  let i = startIdx;
  while (true) {
    result.push(WHEEL[i]);
    if (i === endIdx) break;
    i = (i + 1) % 37;
  }
  return result;
}

// --- ESTRATÉGIA 1: TERMINAIS + 1 VIZINHO ---
function analyzeEstrategia1(active, ultimo) {
  const termCount = Array(10).fill(0);
  active.forEach(n => termCount[getTerminal(n)]++);
  const lastTerm = getTerminal(ultimo);
  
  let activatedPair = null;
  for (const p of PAIRS) {
    if (p.a === lastTerm || p.b === lastTerm) { activatedPair = p; break; }
  }

  let cobertura = [], pairFreq = 0, pairRank = 5;
  if (activatedPair) {
    const numsA = [], numsB = [];
    for (let i = 0; i <= 36; i++) {
      const t = getTerminal(i);
      if (t === activatedPair.a) numsA.push(i);
      if (t === activatedPair.b) numsB.push(i);
    }
    const set = new Set();
    [...numsA, ...numsB].forEach(num => getNeighbors(num, 1).forEach(x => set.add(x)));
    set.add(0);
    cobertura = Array.from(set).sort((a,b) => a-b);
    pairFreq = termCount[activatedPair.a] + termCount[activatedPair.b];
    const pairStats = PAIRS.map(p => ({ ...p, freq: termCount[p.a] + termCount[p.b] })).sort((a,b) => b.freq - a.freq);
    pairRank = pairStats.findIndex(p => p.label === activatedPair.label) + 1;
  }

  let score = 0, ready = false;
  if (activatedPair) {
    ready = true; score = 55;
    if (pairRank === 1) score += 25; 
    else if (pairRank === 2) score += 15; 
    else if (pairRank === 3) score += 8;
    const maxPair = Math.max(...PAIRS.map(p => termCount[p.a] + termCount[p.b]), 1);
    score += Math.round((pairFreq / maxPair) * 15); 
    score = Math.min(100, score);
  }

  return { ready, score, activatedPair, cobertura, lastTerm };
}

// --- ESTRATÉGIA 2: ZONA QUENTE ---
function analyzeEstrategia2(active, hot) {
  if (hot.length < 2) return { ready: false, score: 5, zoneNumbers: [] };

  const positions = hot.map(n => getIndex(n)).filter(i => i >= 0);
  const arc = minimalArc(positions);
  let zoneStart = (arc.start - 4 + 37) % 37;
  let zoneEnd = (arc.end + 4) % 37;
  const zoneNumbers = numbersInArc(zoneStart, zoneEnd);
  const zoneSet = new Set(zoneNumbers);
  
  let inside = 0;
  active.forEach(n => { if (zoneSet.has(n)) inside++; });
  const pctInside = active.length ? (inside / active.length * 100) : 0;

  const isCompact = arc.length <= 12;
  const isPlayable = isCompact && pctInside >= 35;

  let score = 10;
  if (isCompact) score += 40; 
  else score += Math.min(25, Math.max(0, 20 - (arc.length - 12)));

  if (pctInside >= 50) score += 35; 
  else if (pctInside >= 40) score += 28; 
  else if (pctInside >= 35) score += 20; 

  if (hot.length >= 4 && isCompact) score += 10;
  score = Math.min(100, Math.round(score));

  return { ready: isPlayable, score, zoneNumbers };
}

// --- DISPARADOR DE MENSAGENS PARA O TELEGRAM ---
async function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
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
    console.error("Erro ao enviar mensagem no Telegram:", err);
  }
}

// --- ENDPOINT DO WEBHOOK (Onde chegam os novos números da roleta) ---
app.post('/webhook', async (req, res) => {
  const { number } = req.body; // Aceita { "number": 26 } no JSON do POST

  if (number === undefined || number < 0 || number > 36) {
    return res.status(400).send({ error: "Número inválido." });
  }

  // 1. Atualiza Histórico Automático
  spinsHistory.push(number);
  if (spinsHistory.length > MAX_LOOKBACK) spinsHistory.shift();

  // 2. Coleta Histórico Ativo
  const activeSpins = spinsHistory.slice();
  const count = Array(37).fill(0);
  activeSpins.forEach(n => count[n]++);
  
  const sortedByFreq = [...Array(37).keys()].sort((a,b) => count[b] - count[a]);
  const hot = sortedByFreq.filter(n => count[n] > 0).slice(0, 5);

  // 3. Roda os Algoritmos das Suas Estratégias
  const s1 = analyzeEstrategia1(activeSpins, number);
  const s2 = analyzeEstrategia2(activeSpins, hot);

  // 4. Avalia Oportunidade e Dispara o Sinal Automático
  if (s1.ready && s1.score >= 60 && s1.score >= s2.score) {
    const msg = `🚨 <b>SINAL DETECTADO - TERMINAIS!</b> 🚨\n\n` +
                `<b>Último número:</b> ${number} (Terminal ${s1.lastTerm})\n` +
                `<b>Par Ativado:</b> ${s1.activatedPair.label}\n` +
                `<b>Assertividade:</b> ${s1.score}%\n\n` +
                `🎯 <b>Apostar nos números (${s1.cobertura.length}):</b>\n` +
                `${s1.cobertura.join(' • ')}\n\n` +
                `⚠️ <i>Proteção: Adicione o 0 individualmente!</i>`;
    await sendTelegramMessage(msg);

  } else if (s2.ready && s2.score >= 60 && s2.score > s1.score) {
    const msg = `🚨 <b>SINAL DETECTADO - ZONA QUENTE!</b> 🚨\n\n` +
                `<b>Último número:</b> ${number}\n` +
                `<b>Assertividade:</b> ${s2.score}%\n\n` +
                `🎯 <b>Apostar na Zona (${s2.zoneNumbers.length} números):</b>\n` +
                `${s2.zoneNumbers.join(' • ')}`;
    await sendTelegramMessage(msg);
  }

  res.send({ status: "OK", totalSpins: spinsHistory.length, lastNumber: number });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
