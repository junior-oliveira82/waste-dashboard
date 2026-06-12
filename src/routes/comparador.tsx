import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import snisRegional from "@/data/snis-regional.json";
import {
  computeRoute,
  DEFAULT,
  type MunicipioSelecionado,
  type RouteResult,
} from "@/lib/scenario-store";
import {
  calcularDiagnostico,
  fetchPopulacao,
  type IbgeMunicipio,
  type DiagnosticoMunicipal,
  type Classificacao,
} from "@/hooks/useMunicipalDiagnostic";
import { MunicipalSearch } from "@/components/MunicipalSearch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, MapPin, Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/comparador")({
  head: () => ({ meta: [{ title: "Comparador de Municípios — WasteToValue" }] }),
  component: Comparador,
});

// ── Utility: returns the route with higher VPL ──────────────────────────────

export function melhorRota(
  pirolise: RouteResult,
  htc: RouteResult,
): "pirolise" | "htc" {
  return pirolise.vpl >= htc.vpl ? "pirolise" : "htc";
}

// ── Semantic color per viability classification ─────────────────────────────

function classifStyle(c: Classificacao): string {
  if (c === "Altamente Viável")
    return "bg-green-100 text-green-800 border border-green-300";
  if (c === "Viável")
    return "bg-teal-50 text-teal-700 border border-teal-300";
  if (c === "Marginal")
    return "bg-yellow-50 text-yellow-700 border border-yellow-300";
  return "bg-red-50 text-red-700 border border-red-300";
}

// ── Per-slot hook: fully local state, no global store mutation ───────────────

type RegiaoSigla = keyof typeof snisRegional;

function useComparadorSlot() {
  const [municipio, setMunicipio] = useState<MunicipioSelecionado | null>(null);

  const {
    data: populacao,
    isLoading: isLoadingPop,
    isError: isErrorPop,
  } = useQuery<number>({
    queryKey: ["ibge-populacao", municipio?.id],
    enabled: !!municipio,
    queryFn: () => fetchPopulacao(municipio!.id),
    staleTime: Infinity,
    throwOnError: false,
    retry: 1,
  });

  const diagnostico = useMemo<DiagnosticoMunicipal | null>(() => {
    if (!municipio || !populacao || populacao <= 0) return null;
    try {
      return calcularDiagnostico(municipio, populacao);
    } catch {
      return null;
    }
  }, [municipio, populacao]);

  const tea = useMemo(() => {
    if (!diagnostico) return null;
    const inputs = { ...DEFAULT, forsu: diagnostico.forsu, lodo: diagnostico.lodo };
    const p = computeRoute(inputs, "pirolise");
    const h = computeRoute(inputs, "htc");
    return { pirolise: p, htc: h, melhor: melhorRota(p, h) };
  }, [diagnostico]);

  const selecionar = useCallback((m: IbgeMunicipio) => {
    const sigla = m.microrregiao?.mesorregiao?.UF?.regiao?.sigla ?? "";
    const regiao: RegiaoSigla =
      sigla in snisRegional ? (sigla as RegiaoSigla) : "SE";
    setMunicipio({
      id: m.id,
      nome: m.nome,
      uf: m.microrregiao?.mesorregiao?.UF?.sigla ?? "—",
      regiao,
    });
  }, []);

  const limpar = useCallback(() => setMunicipio(null), []);

  return {
    municipio,
    isLoading: !!municipio && isLoadingPop,
    isError: !!municipio && !isLoadingPop && isErrorPop,
    diagnostico,
    tea,
    selecionar,
    limpar,
  };
}

type SlotState = ReturnType<typeof useComparadorSlot>;

// ── Metric row ───────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-xs font-medium tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── TEA panel for one route ──────────────────────────────────────────────────

function RoutePanel({
  result,
  label,
  isBest,
}: {
  result: RouteResult;
  label: string;
  isBest: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-0.5 transition-colors ${
        isBest
          ? "border-green-500/60 bg-green-50/40"
          : "border-border/50 bg-muted/20"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
        {isBest && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800 border border-green-300">
            melhor rota
          </span>
        )}
      </div>
      <MetricRow
        label="VPL (10a, 12%)"
        value={`R$ ${(result.vpl / 1_000_000).toFixed(1)} M`}
        highlight={result.vpl >= 0}
      />
      <MetricRow label="TIR" value={`${(result.tir * 100).toFixed(1)} %`} />
      <MetricRow
        label="Payback"
        value={result.payback < 50 ? `${result.payback.toFixed(1)} anos` : "Inviável"}
      />
      <MetricRow
        label="Rec. energia/ano"
        value={`R$ ${(result.receitaEnergia / 1_000_000).toFixed(2)} M`}
      />
      <MetricRow
        label="Rec. gate fee/ano"
        value={`R$ ${(result.receitaGate / 1_000_000).toFixed(2)} M`}
      />
      <MetricRow
        label="Rec. carbono/ano"
        value={`R$ ${(result.receitaCarbono / 1_000_000).toFixed(2)} M`}
      />
    </div>
  );
}

// ── Column card ──────────────────────────────────────────────────────────────

function SlotCard({
  slot,
  municipios,
  isLoadingMunicipios,
}: {
  slot: SlotState;
  municipios: IbgeMunicipio[];
  isLoadingMunicipios: boolean;
}) {
  const { municipio, isLoading, isError, diagnostico, tea, selecionar, limpar } =
    slot;

  if (!municipio) {
    return (
      <Card className="border-dashed border-border/60 flex flex-col items-center justify-center min-h-[220px] p-6 gap-4">
        <MapPin className="size-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground text-center leading-snug">
          Selecione um município para comparar
        </p>
        <div className="w-full">
          <MunicipalSearch
            municipios={municipios}
            isLoading={isLoadingMunicipios}
            selecionado={null}
            onSelect={selecionar}
            onClear={limpar}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      {/* ── cabeçalho do slot ── */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight truncate">
            {municipio.nome}
          </div>
          <div className="text-xs text-muted-foreground">{municipio.uf}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 -mr-1 -mt-1 text-muted-foreground hover:text-foreground"
          onClick={limpar}
          aria-label="Remover município"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* ── carregando ── */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-6">
            <Loader2 className="size-4 animate-spin" /> Carregando dados...
          </div>
        )}

        {/* ── erro ── */}
        {isError && (
          <div className="flex items-center gap-2 text-destructive text-xs py-2">
            <AlertTriangle className="size-4 shrink-0" />
            Erro ao buscar dados populacionais.
          </div>
        )}

        {/* ── dados carregados ── */}
        {!isLoading && diagnostico && (
          <>
            {/* população + badge */}
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-lg font-semibold tabular-nums leading-tight">
                  {diagnostico.populacao.toLocaleString("pt-BR")}
                </div>
                <div className="text-[10px] text-muted-foreground">habitantes</div>
              </div>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${classifStyle(diagnostico.classificacao)}`}
              >
                {diagnostico.classificacao}
              </span>
            </div>

            {/* resíduos */}
            <div className="rounded-md bg-muted/40 px-3 py-2 space-y-0">
              <MetricRow
                label="FORSU estimada"
                value={`${diagnostico.forsu} t/dia`}
              />
              <MetricRow
                label="Lodo estimado"
                value={`${diagnostico.lodo} t/dia`}
              />
              <MetricRow
                label="Massa total"
                value={`${diagnostico.totalResiduos} t/dia`}
                highlight
              />
            </div>

            {/* resultados TEA */}
            {tea && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Análise TEA — parâmetros padrão
                </p>
                <RoutePanel
                  result={tea.pirolise}
                  label="Pirólise Lenta"
                  isBest={tea.melhor === "pirolise"}
                />
                <RoutePanel
                  result={tea.htc}
                  label="HTC (Carbonização Hidrotérmica)"
                  isBest={tea.melhor === "htc"}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

function Comparador() {
  const { data: municipios = [], isLoading: isLoadingMunicipios } =
    useQuery<IbgeMunicipio[]>({
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

  // 3 slots independentes — estado completamente local
  const slot0 = useComparadorSlot();
  const slot1 = useComparadorSlot();
  const slot2 = useComparadorSlot();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Comparador de Municípios
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare até 3 municípios lado a lado. FORSU e lodo estimados via SNIS
          2023; resultados TEA calculados com parâmetros padrão.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {([slot0, slot1, slot2] as SlotState[]).map((slot, idx) => (
          <SlotCard
            key={idx}
            slot={slot}
            municipios={municipios}
            isLoadingMunicipios={isLoadingMunicipios}
          />
        ))}
      </div>
    </div>
  );
}
