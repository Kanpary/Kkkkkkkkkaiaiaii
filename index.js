import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_TOKEN;
const titaniumPrompt = process.env.PROMPT_TITANIUM;
const apiKey = process.env.FOOTBALL_API_KEY;
const hfKey = process.env.HF_API_KEY;

const bot = new TelegramBot(token, { polling: true });

// Função para buscar jogos ao vivo
async function buscarJogosAoVivo() {
  const url = "https://v3.football.api-sports.io/fixtures?live=all";
  const response = await fetch(url, { headers: { "x-apisports-key": apiKey } });
  const data = await response.json();

  if (!data.response || data.response.length === 0) {
    console.log("Nenhum jogo retornado pela API:", data);
    return null;
  }

  // Logar todos os jogos para debug
  console.log("Jogos retornados:", data.response.map(j => ({
    home: j.teams.home.name,
    away: j.teams.away.name,
    status: j.fixture.status.short,
    statusLong: j.fixture.status.long
  })));

  // Não filtrar demais: pegar o primeiro jogo que não esteja encerrado
  const jogosEmAndamento = data.response.filter(jogo =>
    jogo.fixture.status.short !== "FT" && jogo.fixture.status.short !== "CANC"
  );

  if (jogosEmAndamento.length === 0) return null;
  return jogosEmAndamento[0];
}

// Função para gerar análise com Hugging Face
async function gerarAnaliseTitanium(contexto) {
  const response = await fetch("https://router.huggingface.co/models/mistralai/Mistral-7B-Instruct", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${hfKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: `${titaniumPrompt}\n\n${contexto}`
    })
  });

  const data = await response.json();

  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text;
  } else if (data?.outputs && typeof data.outputs[0] === "string") {
    return data.outputs[0];
  } else if (data.error) {
    return `❌ Erro da IA: ${data.error}`;
  } else {
    return "⚠️ Não foi possível gerar análise.";
  }
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text.toLowerCase();

  if (texto.includes("entradas") || texto.includes("/start")) {
    const jogo = await buscarJogosAoVivo();

    if (!jogo) {
      bot.sendMessage(chatId, "⏸️ Nenhum jogo em andamento no momento.");
      return;
    }

    const home = jogo.teams.home.name;
    const away = jogo.teams.away.name;
    const placar = `${jogo.goals.home} - ${jogo.goals.away}`;
    const tempo = jogo.fixture.status.elapsed || "N/D";
    const status = jogo.fixture.status.long;

    const contexto = `
Jogo: ${home} vs ${away}
Placar atual: ${placar}
Minuto: ${tempo}
Status: ${status}
`;

    const respostaIA = await gerarAnaliseTitanium(contexto);
    bot.sendMessage(chatId, respostaIA);
  }
});
