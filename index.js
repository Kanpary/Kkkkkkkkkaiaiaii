// Função para gerar análise com Hugging Face (endpoint atualizado e robusto)
async function gerarAnaliseTitanium(contexto) {
  const response = await fetch("https://router.huggingface.co/models/tiiuae/falcon-7b-instruct", {
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

  // Tratar diferentes formatos de resposta
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
