import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

const token = process.env.TELEGRAM_TOKEN;
const apiKey = process.env.API_FUTEBOL_KEY; // sua chave da API-Futebol
const titaniumPrompt = process.env.PROMPT_TITANIUM;
const hfKey = process.env.HF_API_KEY;

const bot = new TelegramBot(token, { polling: true });

// Buscar jogos ao vivo via API-Futebol
async function buscarJogosAoVivo() {
  try {
    const { data } = await axios.get("https://api.api-futebol.com.br/v1/ao-vivo", {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    return data;
  } catch (err) {
    console.error("Erro ao buscar jogos:", err.message);
    return [];
  }
}

// Gerar análise com Hugging Face
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
  return data[0]?.generated_text || "⚠️ Não foi possível gerar análise.";
}

// Bot Telegram
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text.toLowerCase();

  if (texto.includes("entradas") || texto.includes("/start")) {
    const jogos = await buscarJogosAoVivo();

    if (!jogos || jogos.length === 0) {
      bot.sendMessage(chatId, "⏸️ Nenhum jogo em andamento no momento.");
      return;
    }

    let lista = "Jogos em andamento:\n\n";
    jogos.forEach((jogo, i) => {
      lista += `(${i+1}) ${jogo.time_mandante.nome_popular} vs ${jogo.time_visitante.nome_popular}\nPlacar: ${jogo.placar_mandante} - ${jogo.placar_visitante}\nCampeonato: ${jogo.campeonato.nome}\n\n`;
    });

    bot.sendMessage(chatId, lista);
    bot.sendMessage(chatId, "Digite 'analisar jogo X' para ver estatísticas detalhadas (ex: analisar jogo 2).");
  }

  if (texto.startsWith("analisar jogo")) {
    const numero = parseInt(texto.replace("analisar jogo", "").trim());
    const jogos = await buscarJogosAoVivo();

    if (isNaN(numero) || numero < 1 || numero > jogos.length) {
      bot.sendMessage(chatId, "⚠️ Número inválido. Escolha um dos jogos listados.");
      return;
    }

    const jogo = jogos[numero - 1];
    let contexto = `Jogo: ${jogo.time_mandante.nome_popular} vs ${jogo.time_visitante.nome_popular}\nPlacar: ${jogo.placar_mandante} - ${jogo.placar_visitante}\nCampeonato: ${jogo.campeonato.nome}`;
    const respostaIA = await gerarAnaliseTitanium(contexto);

    bot.sendMessage(chatId, respostaIA);
  }
});
