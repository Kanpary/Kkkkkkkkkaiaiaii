import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import * as cheerio from 'cheerio';

const token = process.env.TELEGRAM_TOKEN;
const titaniumPrompt = process.env.PROMPT_TITANIUM;
const hfKey = process.env.HF_API_KEY;

const bot = new TelegramBot(token, { polling: true });

let jogosCache = [];
let ultimoFetch = 0;

// Buscar jogos ao vivo no Flashscore
async function buscarJogosAoVivo() {
  const agora = Date.now();
  if (jogosCache.length > 0 && (agora - ultimoFetch < 60000)) {
    return jogosCache;
  }

  const url = "https://www.flashscore.com.br/";
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept-Language": "pt-BR,pt;q=0.9",
      "Accept": "text/html,application/xhtml+xml"
    }
  });

  const $ = cheerio.load(data);
  const jogos = [];

  $(".event__match").each((i, el) => {
    const home = $(el).find(".event__participant--home").text().trim();
    const away = $(el).find(".event__participant--away").text().trim();
    const placar = $(el).find(".event__scores").text().trim();
    const tempo = $(el).find(".event__stage--block").text().trim();

    if (home && away) {
      jogos.push({ home, away, placar, tempo });
    }
  });

  ultimoFetch = agora;
  jogosCache = jogos;

  console.log("Jogos encontrados:", jogos.length);
  return jogos;
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

    if (jogos.length === 0) {
      bot.sendMessage(chatId, "⏸️ Nenhum jogo em andamento no momento.");
      return;
    }

    let lista = "Jogos em andamento:\n\n";
    jogos.forEach((jogo, i) => {
      lista += `(${i+1}) ${jogo.home} vs ${jogo.away}\nPlacar: ${jogo.placar}\nTempo: ${jogo.tempo}\n\n`;
    });

    bot.sendMessage(chatId, lista);
    bot.sendMessage(chatId, "Digite 'analisar jogo X' para ver estatísticas detalhadas (ex: analisar jogo 2).");
  }

  if (texto.startsWith("analisar jogo")) {
    const numero = parseInt(texto.replace("analisar jogo", "").trim());
    if (isNaN(numero) || numero < 1 || numero > jogosCache.length) {
      bot.sendMessage(chatId, "⚠️ Número inválido. Escolha um dos jogos listados.");
      return;
    }

    const jogo = jogosCache[numero - 1];

    let contexto = `Jogo: ${jogo.home} vs ${jogo.away}\nPlacar: ${jogo.placar}\nTempo: ${jogo.tempo}`;
    const respostaIA = await gerarAnaliseTitanium(contexto);

    bot.sendMessage(chatId, respostaIA);
  }
});
