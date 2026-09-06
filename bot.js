const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(bodyParser.json());

// Credenciais do Telegram
const TELEGRAM_TOKEN = '8719989527:AAEybvppfDxoJzVY0W12Co4LwWBPznBzock';
const CHAT_ID = '-1002569332722';
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// Estrutura e Estratégia da Roleta
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

function getNeighbors(number, qty = 2) {
    const idx = WHEEL.indexOf(number);
    if (idx === -1) return [];
    let neighbors = [];
    for (let i = 1; i <= qty; i++) {
        neighbors.push(WHEEL[(idx - i + WHEEL.length) % WHEEL.length]);
        neighbors.push(WHEEL[(idx + i) % WHEEL.length]);
    }
    return neighbors;
}

// Rota do Webhook (/webhook)
app.post('/webhook', (req, res) => {
    const { number } = req.body;
    console.log("Número recebido:", number);

    if (number !== undefined) {
        const num = Number(number);
        const neighbors = getNeighbors(num, 2);
        
        const message = `🎰 *Sinal da Roleta*\n\n` +
                        `Número Sorteado: *${num}*\n` +
                        `Vizinhos recomendados: *${neighbors.join(', ')}*`;

        bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' })
            .then(() => console.log('Sinal enviado com sucesso ao Telegram!'))
            .catch(err => console.error('Erro ao enviar mensagem:', err.message));
    }

    res.status(200).send('OK');
});

// Rota principal para checar status
app.get('/', (req, res) => {
    res.send('Servidor do Bot de Roleta está online e ativo!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
