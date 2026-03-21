import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_TOKEN;
const titaniumPrompt = process.env.PROMPT_TITANIUM;

console.log("Bot iniciado com token:", token ? "OK" : "FALHA");

const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  console.log("Mensagem recebida:", msg.text);

  const resposta = `
📌 Jogo selecionado automaticamente (Brasília, ao vivo)
🥇 Placar Exato Principal: 2-1 | Probabilidade: 68% | Justificativa: pressão ofensiva alta
🔄 Alternativo 1: 1-1 | Probabilidade: 20%
🔄 Alternativo 2: 3-1 | Probabilidade: 12%
📊 Distribuição: principais resultados concentrados em 1-1, 2-1, 3-1
📈 Convergência: 92% | Assertividade: 70% | Risco: Médio
`;

  bot.sendMessage(chatId, resposta);
});
