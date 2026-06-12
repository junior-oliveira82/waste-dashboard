import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import snisRegional from "@/data/snis-regional.json";
import { useScenario, type MunicipioSelecionado } from "@/lib/scenario-store";

type RegiaoSigla = keyof typeof snisRegional;

export interface IbgeMunicipio {
  id: number;
  nome: string;
  microrregiao: {
    id: number;
    nome: string;
    mesorregiao: {
      id: number;
      nome: string;
      UF: {
        id: number;
        sigla: string;
        nome: string;
        regiao: { id: number; sigla: string; nome: string };
      };
    };
  };
}

export type Classificacao = "Inviável" | "Marginal" | "Viável" | "Altamente Viável";

export interface DiagnosticoMunicipal {
  municipio: MunicipioSelecionado;
  populacao: number;
  forsu: number;
  lodo: number;
  totalResiduos: number;
  classificacao: Classificacao;
  nomeRegiao: string;
}

export function classificar(total: number): Classificacao {
  if (total < 20) return "Inviável";
  if (total < 50) return "Marginal";
  if (total < 150) return "Viável";
  return "Altamente Viável";
}

export function calcularDiagnostico(municipio: MunicipioSelecionado, populacao: number): DiagnosticoMunicipal {
  const params = snisRegional[municipio.regiao];
  const forsu =
    (populacao * params.geracaoRSUPerCapita * params.indiceColetaRSU * params.fracaoOrganicaRSU) / 1000;
  const lodo = (populacao * params.atendimentoEsgoto * params.geracaoLodoKgHabAno) / (365 * 1000);
  const totalResiduos = forsu + lodo;
  return {
    municipio,
    populacao,
    forsu: Math.round(forsu * 10) / 10,
    lodo: Math.round(lodo * 10) / 10,
    totalResiduos: Math.round(totalResiduos * 10) / 10,
    classificacao: classificar(totalResiduos),
    nomeRegiao: params.nome,
  };
}

// Extrai população de uma resposta IBGE SIDRA v3, tolerando variações de formato.
function extrairPop(data: unknown, chaveAno: string): number {
  if (!Array.isArray(data) || data.length === 0) return 0;
  const resultados = (data[0] as Record<string, unknown>)?.resultados;
  if (!Array.isArray(resultados)) return 0;
  for (const res of resultados) {
    const series = (res as Record<string, unknown>)?.series;
    if (!Array.isArray(series) || series.length === 0) continue;
    const serie = (series[0] as Record<string, unknown>)?.serie;
    if (!serie || typeof serie !== "object") continue;
    const valor = (serie as Record<string, string>)[chaveAno];
    const pop = parseInt(String(valor ?? ""), 10);
    if (Number.isFinite(pop) && pop > 0) return pop;
  }
  return 0;
}

export async function fetchPopulacao(id: number): Promise<number> {
  // Tentativa 1 — Censo 2022 (agregado 4709, variável 93)
  try {
    const url1 = `https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2022/variaveis/93?localidades=N6[${id}]`;
    const r1 = await fetch(url1);
    if (r1.ok) {
      const pop = extrairPop(await r1.json(), "2022");
      if (pop > 0) return pop;
    }
  } catch {
    // segue para fallback
  }

  // Tentativa 2 — Estimativas 2021 (agregado 6579, variável 9324)
  try {
    const url2 = `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/2021/variaveis/9324?localidades=N6[${id}]`;
    const r2 = await fetch(url2);
    if (r2.ok) {
      const pop = extrairPop(await r2.json(), "2021");
      if (pop > 0) return pop;
    }
  } catch {
    // segue para erro
  }

  throw new Error("Dados populacionais não encontrados para este município.");
}

export function useMunicipalDiagnostic() {
  // Estado persiste no ScenarioProvider (sobrevive à navegação entre rotas)
  const { municipio: municipioSelecionado, setMunicipio } = useScenario();

  const { data: municipios = [], isLoading: isLoadingMunicipios } = useQuery<IbgeMunicipio[]>({
    queryKey: ["ibge-municipios"],
    queryFn: async () => {
      const resp = await fetch(
        "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome",
      );
      if (!resp.ok) throw new Error("Falha ao buscar municípios IBGE");
      return resp.json() as Promise<IbgeMunicipio[]>;
    },
    staleTime: Infinity,
    throwOnError: false,
  });

  const {
    data: populacao,
    isLoading: isLoadingPop,
    isError: isPopError,
  } = useQuery<number>({
    queryKey: ["ibge-populacao", municipioSelecionado?.id],
    enabled: !!municipioSelecionado,
    queryFn: () => fetchPopulacao(municipioSelecionado!.id),
    staleTime: Infinity,
    throwOnError: false,
    retry: 1,
  });

  // useMemo garante referência estável: só muda quando municipioSelecionado ou
  // populacao mudam de fato. Sem isso, qualquer re-render do ScenarioProvider
  // (ex: setInput) criaria um novo objeto diagnostico, disparando o useEffect
  // em index.tsx novamente → loop infinito → "Maximum update depth exceeded".
  const diagnostico = useMemo<DiagnosticoMunicipal | null>(() => {
    try {
      if (municipioSelecionado && populacao && populacao > 0) {
        return calcularDiagnostico(municipioSelecionado, populacao);
      }
      return null;
    } catch {
      return null;
    }
  }, [municipioSelecionado, populacao]);

  const selecionar = useCallback(
    (m: IbgeMunicipio) => {
      try {
        const sigla = m.microrregiao?.mesorregiao?.UF?.regiao?.sigla ?? "";
        const regiao: RegiaoSigla = sigla in snisRegional ? (sigla as RegiaoSigla) : "SE";
        setMunicipio({
          id: m.id,
          nome: m.nome,
          uf: m.microrregiao?.mesorregiao?.UF?.sigla ?? "—",
          regiao,
        });
      } catch {
        // estrutura inesperada da API — ignora silenciosamente
      }
    },
    [setMunicipio],
  );

  const limpar = useCallback(() => setMunicipio(null), [setMunicipio]);

  return {
    municipios,
    isLoadingMunicipios,
    municipioSelecionado,
    isLoadingPop,
    isPopError,
    diagnostico,
    selecionar,
    limpar,
  };
}
