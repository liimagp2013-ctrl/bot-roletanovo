const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(bodyParser.json());

// Suas credenciais do Telegram
const TELEGRAM_TOKEN = 8719989527:AAEybvppfDxoJzVY0W12Co4LwWBPznBzock // Insira o token completo fornecido pelo BotFather caso tenha alterado
const CHAT_ID = '-1002569332722';
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// Estrutura e Estratégias da Roleta
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

const PAIRS = [
    { a: 0, b: 1, label: "0 e 1" },
    { a: 2, b: 5, label: "2 e 5" },
    { a: 3, b: 6, label: "3 e 6" },
    { a: 4, b: 7, label: "4 e 7" },
    { a: 8, b: 11, label: "8 e 11" },
    { a: 9, b: 12, label: "9 e 12" },
    { a: 10, b: 13, label: "10 e 13" },
    { a: 14, b: 17, label: "14 e 17" },
    { a: 15, b: 18, label: "15 e 18" },
    { a: 16, b: 19, label: "16 e 19" },
    { a: 20, b: 23, label: "20 e 23" },
    { a: 21, b: 24, label: "21 e 24" },
    { a: 22, b: 25, label: "22 e 25" },
    { a: 26, b: 29, label: "26 e 29" },
    { a: 27, b: 30, label: "27 e 30" },
    { a: 28, b: 31, label: "28 e 31" },
    { a: 32, b: 35, label: "32 e 35" },
    { a: 33, b: 36, label: "33 e 36" }
];

// Função para buscar vizinhos na roleta
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

// Rota POST configurada para o Webhook (/webhook)
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

// Rota para checar se o servidor está online no navegador
app.get('/', (req, res) => {
    res.send('Servidor do Bot de Roleta está online e ativo!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
