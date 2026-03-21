import TelegramBot from 'node-telegram-bot-api';

// Variáveis de ambiente do Railway
const token = process.env.TELEGRAM_TOKEN;
const titaniumPrompt = process.env.PROMPT_TITANIUM;
const apiKey = process.env.FOOTBALL_API_KEY; // chave da API-Football

console.log("Bot iniciado com token:", token ? "OK" : "FALHA");

const bot = new TelegramBot(token, { polling: true });

// Função para buscar jogos ao vivo em andamento
async function buscarJogosAoVivo() {
  try {
    const url = "https://v3.football.api-sports.io/fixtures?live=all";
    const response = await fetch(url, {
      headers: { "x-apisports-key": apiKey }
    });
    const data = await response.json();

    if (!data.response || data.response.length === 0) {
      return "⚠️ Nenhum jogo ao vivo encontrado no momento.";
    }

    // Filtrar apenas jogos em andamento (1H ou 2H)
    const jogosEmAndamento = data.response.filter(jogo =>
      jogo.fixture.status.short === "1H" || jogo.fixture.status.short === "2H"
    );

    if (jogosEmAndamento.length === 0) {
      return "⏸️ No momento não há jogos em andamento (apenas intervalo ou encerrados).";
    }

    // Pegar o primeiro jogo em andamento
    const jogo = jogosEmAndamento[0];
    const home = jogo.teams.home.name;
    const away = jogo.teams.away.name;
    const placar = `${jogo.goals.home} - ${jogo.goals.away}`;
    const tempo = jogo.fixture.status.elapsed;

    return `📌 Jogo ao vivo (Brasília): ${home} vs ${away}
⏱️ Minuto: ${tempo}
🔢 Placar atual: ${placar}`;
  } catch (err) {
    console.error("Erro ao buscar jogos:", err);
    return "❌ Erro ao buscar jogos ao vivo.";
  }
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text.toLowerCase();

  if (texto.includes("entradas") || texto.includes("/start")) {
    const infoJogo = await buscarJogosAoVivo();

    // Aqui você pode integrar com OpenAI usando titaniumPrompt
    // Por enquanto, vamos simular a análise:
    const respostaIA = `
${infoJogo}

🥇 Placar Exato Principal: 2-1 | Probabilidade: 68% | Justificativa: pressão ofensiva alta
🔄 Alternativo 1: 1-1 | Probabilidade: 20%
🔄 Alternativo 2: 3-1 | Probabilidade: 12%
📊 Distribuição: principais resultados concentrados em 1-1, 2-1, 3-1
📈 Convergência: 92% | Assertividade: 70% | Risco: Médio
`;

    bot.sendMessage(chatId, respostaIA);
  }
});
