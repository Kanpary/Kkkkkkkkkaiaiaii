import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_TOKEN;
const titaniumPrompt = process.env.PROMPT_TITANIUM;
const apiKey = process.env.FOOTBALL_API_KEY;
const hfKey = process.env.HF_API_KEY;

const bot = new TelegramBot(token, { polling: true });

let ultimoFetch = 0;
let cacheJogos = [];

// Função para obter a data atual em formato YYYY-MM-DD
function dataHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Buscar jogos do dia com cache
async function buscarJogosDoDia() {
  const agora = Date.now();
  if (cacheJogos.length > 0 && (agora - ultimoFetch < 60000)) {
    return cacheJogos; // usa cache se foi buscado há menos de 1 min
  }

  const url = `https://v3.football.api-sports.io/fixtures?date=${dataHoje()}`;
  const response = await fetch(url, { headers: { "x-apisports-key": apiKey } });
  const data = await response.json();

  ultimoFetch = agora;
  cacheJogos = data.response || [];

  // Status que indicam jogo em andamento
  const statusValidos = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"];

  const jogosEmAndamento = cacheJogos.filter(jogo =>
    statusValidos.includes(jogo.fixture.status.short)
  );

  return jogosEmAndamento;
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
    const jogos = await buscarJogosDoDia();

    if (jogos.length === 0) {
      bot.sendMessage(chatId, "⏸️ Nenhum jogo em andamento no momento.");
      return;
    }

    // Montar contexto com todos os jogos
    let contexto = "Lista de jogos em andamento hoje:\n\n";
    jogos.forEach((jogo, i) => {
      const home = jogo.teams.home.name;
      const away = jogo.teams.away.name;
      const placar = `${jogo.goals.home} - ${jogo.goals.away}`;
      const tempo = jogo.fixture.status.elapsed || "N/D";
      const status = jogo.fixture.status.long;

      contexto += `(${i+1}) ${home} vs ${away}\nPlacar: ${placar}\nMinuto: ${tempo}\nStatus: ${status}\n\n`;
    });

    // Primeiro mostra a lista para o usuário
    bot.sendMessage(chatId, contexto);

    // Depois passa todos os jogos para a IA escolher o mais relevante
    const respostaIA = await gerarAnaliseTitanium(contexto);
    bot.sendMessage(chatId, respostaIA);
  }
});
