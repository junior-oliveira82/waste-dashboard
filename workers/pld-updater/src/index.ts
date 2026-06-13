export interface Env {
  PLD_CACHE: KVNamespace;
}

const SUBMERCADOS = ["SE", "S", "NE", "N"] as const;
type Submercado = typeof SUBMERCADOS[number];

const CSV_URL = "https://pda-download.ccee.org.br/T09SGpnfRN-2ZaeWfHgrMw/content";

async function fetchPLD(env: Env): Promise<void> {
  const response = await fetch(CSV_URL);
  if (!response.ok) throw new Error(`CCEE CSV fetch failed: ${response.status}`);

  const text = await response.text();
  const lines = text.trim().split("\n");

  // Encontra o cabeçalho para identificar colunas
  const header = lines[0].split(";").map(h => h.trim().toLowerCase().replace(/"/g, ""));
  const colData = header.findIndex(h => h.includes("data") || h.includes("dat"));
  const colSub = header.findIndex(h => h.includes("submercado") || h.includes("sub"));
  const colPld = header.findIndex(h => h.includes("pld") || h.includes("preco") || h.includes("valor"));

  // Agrupa por data e submercado, pega a mais recente
  const mapaPrecos: Record<string, Record<string, number>> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";").map(c => c.trim().replace(/"/g, ""));
    if (cols.length < 3) continue;

    const data = cols[colData] || "";
    const sub = (cols[colSub] || "").toUpperCase();
    const valor = parseFloat((cols[colPld] || "0").replace(",", "."));

    if (!data || !sub || isNaN(valor)) continue;
    if (!mapaPrecos[data]) mapaPrecos[data] = {};
    mapaPrecos[data][sub] = valor;
  }

  // Pega a data mais recente disponível
  const datas = Object.keys(mapaPrecos).sort();
  const dataRecente = datas[datas.length - 1];
  const precos = mapaPrecos[dataRecente] || {};

  const resultado = {
    SE: precos["SE"] || precos["SUDESTE"] || 150,
    S: precos["S"] || precos["SUL"] || 150,
    NE: precos["NE"] || precos["NORDESTE"] || 150,
    N: precos["N"] || precos["NORTE"] || 150,
    data: dataRecente,
    fonte: "CCEE — Dados Abertos",
    atualizadoEm: new Date().toISOString(),
  };

  await env.PLD_CACHE.put("pld_atual", JSON.stringify(resultado), {
    expirationTtl: 86400,
  });
}

export default {
  // Executado pelo Cron às 23h30 UTC (20h30 Brasília)
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await fetchPLD(env);
  },

  // Endpoint GET para o site consumir
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Permite forçar atualização via ?refresh=1
    const url = new URL(request.url);
    if (url.searchParams.get("refresh") === "1") {
      await fetchPLD(env);
    }

    const cached = await env.PLD_CACHE.get("pld_atual");

    if (cached) {
      return new Response(cached, { headers: corsHeaders });
    }

    // Se ainda não tem cache, busca agora
    await fetchPLD(env);
    const novo = await env.PLD_CACHE.get("pld_atual");

    return new Response(novo || JSON.stringify({ SE: 150, S: 150, NE: 150, N: 150, fonte: "fallback" }), {
      headers: corsHeaders,
    });
  },
};
