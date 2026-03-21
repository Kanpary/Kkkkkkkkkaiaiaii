import TelegramBot from 'node-telegram-bot-api';
import puppeteer from 'puppeteer';

const token = process.env.TELEGRAM_TOKEN;
const titaniumPrompt = process.env.PROMPT_TITANIUM;
const hfKey = process.env.HF_API_KEY;

const bot = new TelegramBot(token, { polling: true });

let jogosCache = []; // guardar lista de jogos para referência

// Função para buscar jogos ao vivo no Sofascore
async function buscarJogosAoVivo() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://www.sofascore.com/football/live", { waitUntil: "networkidle2" });

  const jogos = await page.evaluate(() => {
    const partidas = [];
    document.querySelectorAll(".event-row").forEach(row => {
      const home = row.querySelector(".cell__content--home")?.innerText || "";
      const away = row.querySelector(".cell__content--away")?.innerText || "";
      const placar = row.querySelector(".cell__content--score")?.innerText || "";
      const tempo = row.querySelector(".cell__content--time")?.innerText || "";
      const link = row.querySelector("a")?.href || "";
      if (home && away && link) {
        partidas.push({ home, away, placar, tempo, link });
      }
    });
    return partidas;
  });

  await browser.close();
  return jogos;
}

// Função para buscar estatísticas de um jogo específico
async function buscarEstatisticasJogo(urlJogo) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(urlJogo, { waitUntil: "networkidle2" });

  const estatisticas = await page.evaluate(() => {
    const stats = {};
    document.querySelectorAll(".stat__row").forEach(row => {
      const nome = row.querySelector(".stat__name")?.innerText;
      const home = row.querySelector(".stat__home")?.innerText;
      const away = row.querySelector(".stat__away")?.innerText;
      if (nome) {
        stats[nome] = { home, away };
      }
    });
    return stats;
  });

  await browser.close();
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

  // Comando inicial: listar jogos
  if (texto.includes("entradas") || texto.includes("/start")) {
    const jogos = await buscarJogosAoVivo();

    if (jogos.length === 0) {
      bot.sendMessage(chatId, "⏸️ Nenhum jogo em andamento no momento.");
      return;
    }

    jogosCache = jogos; // salvar lista para referência

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
