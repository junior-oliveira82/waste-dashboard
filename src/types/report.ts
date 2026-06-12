import type { Inputs, RouteResult, MunicipioSelecionado } from "@/lib/scenario-store";
import type { Classificacao } from "@/hooks/useMunicipalDiagnostic";

export interface MonteCarloSummary {
  probPositivo: number; // 0–1
  vplMedio: number;     // R$ milhões
}

export interface TEAReportData {
  // Dados municipais (null se nenhum município foi selecionado)
  municipio: MunicipioSelecionado | null;
  populacao: number | null;
  forsuEstimada: number | null;
  lodoEstimado: number | null;
  totalResiduos: number | null;
  classificacao: Classificacao | null;

  // Parâmetros de entrada da TEA
  inputs: Inputs;

  // Resultados TEA por rota
  pirolise: RouteResult;
  htc: RouteResult;

  // Resumo Monte Carlo por rota
  monteCarloPirolise: MonteCarloSummary;
  monteCarloHTC: MonteCarloSummary;

  // Metadado de geração
  dataGeracao: Date;
}
