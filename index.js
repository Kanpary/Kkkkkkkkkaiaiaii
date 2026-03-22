import axios from "axios";
import * as cheerio from "cheerio";

async function buscarJogosFlashscore() {
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

  console.log("Jogos encontrados:", jogos.length);
  return jogos;
}

// Teste
buscarJogosFlashscore().then(console.log);
