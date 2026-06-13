import type { jsPDF } from "jspdf";
import type { TEAReportData } from "@/types/report";

// ─── helpers ────────────────────────────────────────────────────────────────

const GREEN  = "#10b981";
const DARK   = "#111827";
const GRAY   = "#6b7280";
const LGREEN = "#f0fdf4";

function n2(v: number, d = 2) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtM(v: number)   { return `R$ ${n2(v / 1_000_000)} M`; }
function fmtPct(v: number) { return `${n2(v * 100, 1)}%`; }

// jspdf-autotable v5 returns void and stores result in doc.lastAutoTable
function tableEndY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

// ─── main export ────────────────────────────────────────────────────────────

export async function generateTEAReport(data: TEAReportData): Promise<void> {
  if (typeof window === 'undefined') return;
  const { jsPDF: JsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  const doc  = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW   = doc.internal.pageSize.getWidth();
  const PH   = doc.internal.pageSize.getHeight();
  const M    = 15;
  const CW   = PW - 2 * M;

  const dt       = data.dataGeracao;
  const dateDisp = `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
  const dateFile  = `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,"0")}${String(dt.getDate()).padStart(2,"0")}`;

  const nomeMun = data.municipio?.nome ?? "Município não selecionado";
  const uf      = data.municipio?.uf   ?? "—";
  const i       = data.inputs;
  const p       = data.pirolise;
  const h       = data.htc;
  const mcp     = data.monteCarloPirolise;
  const mch     = data.monteCarloHTC;

  // ── SEÇÃO A — Cabeçalho ─────────────────────────────────────────────────

  doc.setFillColor(GREEN);
  doc.rect(0, 0, PW, 30, "F");

  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("WasteToValue TEA Suite", M, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Relatório de Análise Tecno-Econômica (TEA) — Resíduos Sólidos e Lodo de Esgoto", M, 21);
  doc.text(`Gerado em: ${dateDisp}`, PW - M, 21, { align: "right" });

  let y = 38;

  doc.setTextColor(DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`${nomeMun} — ${uf}`, M, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(GRAY);

  const popDisp   = data.populacao    ? `${data.populacao.toLocaleString("pt-BR")} hab.` : "Não informada";
  const totalDisp = data.totalResiduos ? `${n2(data.totalResiduos)} t/dia`               : "—";
  const classDisp = data.classificacao ?? "Não calculada";

  doc.text(
    `População: ${popDisp}   |   Resíduos totais: ${totalDisp}   |   Classificação: ${classDisp}`,
    M, y
  );
  y += 4;
  doc.setDrawColor("#e5e7eb");
  doc.line(M, y, PW - M, y);
  y += 7;

  // ── SEÇÃO B — Parâmetros de entrada ─────────────────────────────────────

  doc.setTextColor(GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("1. Parâmetros de Entrada", M, y);
  y += 2;

  const NOTA_ENERGIA: Record<string, string> = {
    acl: "Mercado Livre — referência PLD médio CCEE, piso R$ 147/MWh",
    ppa: "Contrato bilateral de longo prazo — fontes incentivadas",
    acr: "Tarifa regulada — Leilões de Energia Nova ANEEL (A-4/A-6)",
  };

  const notaEnergia = NOTA_ENERGIA[data.modeloComercializacao ?? "ppa"] ?? "Contrato bilateral de longo prazo — fontes incentivadas";

  const paramRows: [string, string, string][] = [
    ["FORSU processada",               `${n2(i.forsu)} t/dia`,                      "SNIS 2023: geração per capita × índice coleta × fração orgânica"],
    ["Lodo de esgoto",                 `${n2(i.lodo)} t/dia`,                       "SNIS 2023: geração lodo per capita × atendimento de esgoto"],
    ["Umidade da biomassa",            `${n2(i.umidade, 0)} %`,                     "Valor típico para FORSU úmida"],
    ["Teor de cinzas",                 `${n2(i.cinzas, 0)} %`,                      "Base seca"],
    ["PCI (base úmida)",               `${n2(i.pci)} MJ/kg`,                        "Poder calorífico inferior"],
    ["Preço da energia",               `R$ ${n2(i.precoEnergia, 0)}/MWh`,           notaEnergia],
    ["Gate fee",                       `R$ ${n2(i.gateFee, 0)}/t`,                  "Referência mercado nacional"],
    ["Preço do carbono",               `R$ ${n2(i.precoCarbono, 0)}/tCO2eq`,        "Mercado voluntário de carbono"],
    ["Efic. elétrica — Pirólise",      `${n2(i.eficienciaPirolise, 0)} %`,          "CHP com óleo de pirólise"],
    ["Energia/t — Pirólise",           `${n2(i.energiaPorToneladaPirolise, 2)} MWh/t`, "Rendimento energético típico"],
    ["Efic. elétrica — HTC",           `${n2(i.eficienciaHTC, 0)} %`,               "CHP com hidrochar"],
    ["Energia/t — HTC",                `${n2(i.energiaPorToneladaHTC, 2)} MWh/t`,   "Rendimento energético típico"],
  ];

  autoTable(doc, {
    startY: y + 2,
    head: [["Parâmetro", "Valor", "Fonte / Nota"]],
    body: paramRows,
    margin: { left: M, right: M },
    headStyles:         { fillColor: GREEN, textColor: "#ffffff", fontSize: 7.5, fontStyle: "bold" },
    bodyStyles:         { fontSize: 7,    textColor: DARK },
    alternateRowStyles: { fillColor: LGREEN },
    columnStyles:       { 0: { cellWidth: 56 }, 1: { cellWidth: 30 }, 2: { cellWidth: CW - 86 } },
    theme: "grid",
  });

  // ── SEÇÃO C — Memória de cálculo ─────────────────────────────────────────

  y = tableEndY(doc) + 8;
  if (y > 248) { doc.addPage(); y = 15; }

  doc.setTextColor(GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("2. Memória de Cálculo", M, y);
  y += 6;

  const massaDiaria = i.forsu + i.lodo;
  const massaAnual  = massaDiaria * 330;

  const calcBlocks: { label: string; lines: string[] }[] = [
    {
      label: "Massa processada",
      lines: [
        `m_diária = FORSU + Lodo = ${n2(i.forsu)} + ${n2(i.lodo)} = ${n2(massaDiaria)} t/dia`,
        `m_anual  = m_diária × 330 dias operacionais = ${n2(massaAnual, 0)} t/ano`,
      ],
    },
    {
      label: "FORSU estimada — SNIS 2023",
      lines: [
        "FORSU (t/dia) = Pop × GPC × ICR × FOR / 1 000",
        "  GPC: geração per capita (kg/hab.dia)  |  ICR: índice de coleta  |  FOR: fração orgânica",
      ],
    },
    {
      label: "Lodo de esgoto estimado — SNIS 2023",
      lines: [
        "Lodo (t/dia) = Pop × GL × AE / (1 000 × 365)",
        "  GL: geração de lodo (kg/hab.ano)  |  AE: atendimento de esgoto (0–1)",
      ],
    },
    {
      label: "VPL (10 anos, TMA 12 %)",
      lines: [
        "VPL = Fluxo x [(1 - (1 + 0,12)^(-10)) / 0,12] - CAPEX",
        "Fluxo = Receita Anual - OPEX Anual",
      ],
    },
    {
      label: "TIR (aproximação analítica)",
      lines: ["TIR aprox. = max(-50 %, Fluxo / CAPEX - 2 %)"],
    },
    {
      label: "Monte Carlo (500 iterações)",
      lines: [
        "Distribui uniformemente: Preço Energia +/-30 %  |  Gate Fee +/-25 %  |  Carbono +/-40 %",
        "Prob(VPL > 0) = contagem de iterações com VPL positivo / 500",
      ],
    },
  ];

  for (const block of calcBlocks) {
    if (y > 265) { doc.addPage(); y = 15; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(DARK);
    doc.text(`${block.label}:`, M, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(GRAY);
    for (const line of block.lines) {
      const wrapped = doc.splitTextToSize(line, CW - 4);
      doc.text(wrapped, M + 3, y);
      y += (wrapped as string[]).length * 4;
      if (y > 268) { doc.addPage(); y = 15; }
    }
    y += 3;
  }

  // ── SEÇÃO D — Tabela comparativa ─────────────────────────────────────────

  if (y > 220) { doc.addPage(); y = 15; }

  doc.setTextColor(GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("3. Tabela Comparativa — Pirolise Lenta vs HTC", M, y);
  y += 2;

  const cmpRows: [string, string, string][] = [
    ["Massa processada (t/ano)",       n2(p.massaAnual, 0),        n2(h.massaAnual, 0)],
    ["Energia gerada (MWh/ano)",       n2(p.energiaLiquidaMWh, 0), n2(h.energiaLiquidaMWh, 0)],
    ["CO2 evitado (tCO2eq/ano)",       n2(p.co2Evitado, 0),        n2(h.co2Evitado, 0)],
    ["Receita — Energia",              fmtM(p.receitaEnergia),     fmtM(h.receitaEnergia)],
    ["Receita — Gate Fee",             fmtM(p.receitaGate),        fmtM(h.receitaGate)],
    ["Receita — Carbono",              fmtM(p.receitaCarbono),     fmtM(h.receitaCarbono)],
    ["Receita Total (R$/ano)",         fmtM(p.receitaAnual),       fmtM(h.receitaAnual)],
    ["CAPEX",                          fmtM(p.capex),              fmtM(h.capex)],
    ["OPEX Anual",                     fmtM(p.opexAnual),          fmtM(h.opexAnual)],
    ["VPL (10 anos, 12 %)",            fmtM(p.vpl),                fmtM(h.vpl)],
    ["TIR",                            fmtPct(p.tir),              fmtPct(h.tir)],
    ["Payback (anos)",
      p.payback < 50 ? n2(p.payback, 1) : "Inviável",
      h.payback < 50 ? n2(h.payback, 1) : "Inviável"],
    ["Monte Carlo — Prob(VPL > 0)",    `${n2(mcp.probPositivo * 100, 1)} %`, `${n2(mch.probPositivo * 100, 1)} %`],
    ["Monte Carlo — VPL médio",        `R$ ${n2(mcp.vplMedio, 1)} M`,        `R$ ${n2(mch.vplMedio, 1)} M`],
  ];

  autoTable(doc, {
    startY: y + 2,
    head: [["Indicador", "Pirolise Lenta", "HTC (Carbonização Hidrotérmica)"]],
    body: cmpRows,
    margin: { left: M, right: M },
    headStyles:         { fillColor: GREEN, textColor: "#ffffff", fontSize: 7.5, fontStyle: "bold" },
    bodyStyles:         { fontSize: 7.5, textColor: DARK },
    alternateRowStyles: { fillColor: LGREEN },
    columnStyles:       { 0: { cellWidth: 80 }, 1: { cellWidth: 42 }, 2: { cellWidth: CW - 122 } },
    theme: "grid",
  });

  // ── SEÇÃO E — Classificação de viabilidade ───────────────────────────────

  y = tableEndY(doc) + 8;
  if (y > 230) { doc.addPage(); y = 15; }

  doc.setTextColor(GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("4. Classificação de Viabilidade Municipal", M, y);
  y += 2;

  const classifRows: [string, string, string][] = [
    ["Inviável",         "< 20 t/dia",     data.classificacao === "Inviável"         ? "< municipio atual" : ""],
    ["Marginal",         "20 - 50 t/dia",  data.classificacao === "Marginal"         ? "< municipio atual" : ""],
    ["Viável",           "50 - 150 t/dia", data.classificacao === "Viável"           ? "< municipio atual" : ""],
    ["Altamente Viável", "> 150 t/dia",    data.classificacao === "Altamente Viável" ? "< municipio atual" : ""],
  ];

  autoTable(doc, {
    startY: y + 2,
    head: [["Classificação", "Faixa de Resíduos", "Status"]],
    body: classifRows,
    margin: { left: M, right: M },
    headStyles:         { fillColor: GREEN, textColor: "#ffffff", fontSize: 7.5, fontStyle: "bold" },
    bodyStyles:         { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: LGREEN },
    columnStyles:       { 0: { cellWidth: 50 }, 1: { cellWidth: 45 }, 2: { cellWidth: CW - 95 } },
    theme: "grid",
    didParseCell: (hook) => {
      if (hook.column.index === 2 && hook.cell.text[0]) {
        hook.cell.styles.textColor = GREEN;
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });

  // ── SEÇÃO F — Limitações e referências ───────────────────────────────────

  y = tableEndY(doc) + 8;
  if (y > 220) { doc.addPage(); y = 15; }

  doc.setTextColor(GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("5. Limitações Metodológicas", M, y);
  y += 6;

  doc.setTextColor(DARK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  const textBlocks: { bold?: boolean; text: string }[] = [
    { bold: true,  text: "Limitações:" },
    { text: "• Parâmetros SNIS 2023 são médias regionais — municípios atípicos podem apresentar desvios significativos." },
    { text: "• O modelo financeiro é simplificado (fluxo de caixa uniforme, 10 anos, 12 % a.a.). Não contempla depreciação, tributos, estrutura de capital ou reescalonamento de dívida." },
    { text: "• A simulação Monte Carlo varia apenas as 3 fontes de receita. Incertezas de CAPEX, OPEX e volume de resíduos não são modeladas nesta versão." },
    { text: "• Dados populacionais obtidos da API IBGE (Censo 2022 ou Estimativas 2021) e podem não refletir crescimento recente." },
    { text: "• Este relatório é de caráter orientativo e não substitui estudos de viabilidade técnica detalhada." },
  ];

  for (const block of textBlocks) {
    if (y > 272) { doc.addPage(); y = 15; }
    if (block.bold) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(DARK);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(block.text.startsWith("•") ? DARK : GRAY);
    }
    const line = block.text || " ";
    const wrapped = doc.splitTextToSize(line, CW) as string[];
    doc.text(wrapped, M, y);
    y += wrapped.length * 4 + 0.5;
  }

  // ── Rodapé em todas as páginas ───────────────────────────────────────────

  const total = doc.getNumberOfPages();
  for (let pg = 1; pg <= total; pg++) {
    doc.setPage(pg);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(GRAY);
    doc.text(
      `WasteToValue TEA Suite  |  Gerado em ${dateDisp}  |  Página ${pg} de ${total}`,
      PW / 2,
      PH - 7,
      { align: "center" }
    );
  }

  // ── Nome do arquivo e download ───────────────────────────────────────────

  const slug = (data.municipio?.nome ?? "municipio")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");

  doc.save(`WasteToValue_TEA_${slug}_${dateFile}.pdf`);
}
