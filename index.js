import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import * as cheerio from 'cheerio';

const token = process.env.TELEGRAM_TOKEN;
const titaniumPrompt = process.env.PROMPT_TITANIUM;
const hfKey = process.env.HF_API_KEY;

const bot = new TelegramBot(token, { polling: true });

let jogosCache = [];
let ultimoFetch = 0;

// Função para buscar jogos ao vivo com cache e headers
async function buscarJogosAoVivo() {
  const agora = Date.now();
  if (jogosCache.length > 0 && (agora - ultimoFetch < 60000)) {
    return jogosCache;
  }

  const url = "https://www.sofascore.com/football/live";
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml"
    }
  });

  const $ = cheerio.load(data);
  const jogos = [];

  $(".event-row").each((i, el) => {
    const home = $(el).find(".cell__content--home").text().trim();
    const away = $(el).find(".cell__content--away").text().trim();
    const placar = $(el).find(".cell__content--score").text().trim();
    const tempo = $(el).find(".cell__content--time").text().trim();
    const link = "https://www.sofascore.com" + $(el).find("a").attr("href");

    if (home && away && link) {
      jogos.push({ home, away, placar, tempo, link });
    }
  });

  ultimoFetch = agora;
  jogosCache = jogos;

  console.log("Jogos encontrados:", jogos.length); // log mínimo
  return jogos;
}

// Função para buscar estatísticas de um jogo específico
async function buscarEstatisticasJogo(urlJogo) {
  const { data } = await axios.get(urlJogo, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml"
    }
  });

  const $ = cheerio.load(data);
  const estatisticas = {};

  $(".stat__row").each((i, el) => {
    const nome = $(el).find(".stat__name").text().trim();
    const home = $(el).find(".stat__home").text().trim();
    const away = $(el).find(".stat__away").text().trim();
    if (nome) {
      estatisticas[nome] = { home, away };
    }
  });

  return estatisticas;
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
  return data[0]?.generated_text || "⚠️ Não foi possível gerar análise.";
}

// Bot Telegram
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text.toLowerCase();

  // Comando inicial: listar jogos
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

  // Comando para analisar jogo específico
  if (texto.startsWith("analisar jogo")) {
    const numero = parseInt(texto.replace("analisar jogo", "").trim());
    if (isNaN(numero) || numero < 1 || numero > jogosCache.length) {
      bot.sendMessage(chatId, "⚠️ Número inválido. Escolha um dos jogos listados.");
      return;
    }

    const jogo = jogosCache[numero - 1];
    const estatisticas = await buscarEstatisticasJogo(jogo.link);

    let contexto = `Jogo: ${jogo.home} vs ${jogo.away}\nPlacar: ${jogo.placar}\nTempo: ${jogo.tempo}\n\nEstatísticas:\n`;
    for (const [nome, valores] of Object.entries(estatisticas)) {
      contexto += `${nome}: ${valores.home} - ${valores.away}\n`;
    }

    const respostaIA = await gerarAnaliseTitanium(contexto);
    bot.sendMessage(chatId, respostaIA);
  }
});
