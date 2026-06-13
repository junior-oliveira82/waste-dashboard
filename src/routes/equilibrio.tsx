import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  useScenario,
  computeRoute,
  type Inputs,
  type RouteResult,
} from "@/lib/scenario-store";
import { useCambio } from "@/hooks/useCambio";
import { useCarbonPrice } from "@/hooks/useCarbonPrice";
import { usePLD } from "@/hooks/usePLD";
import { getSubmercado, getSubmercadoNome } from "@/utils/submercado";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip as UiTooltip,
  TooltipContent as UiTooltipContent,
  TooltipProvider as UiTooltipProvider,
  TooltipTrigger as UiTooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingUp, AlertTriangle, Zap, Truck, Leaf } from "lucide-react";
import { IconInfoCircle, IconMapPin } from "@tabler/icons-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/equilibrio")({
  head: () => ({
    meta: [{ title: "Ponto de Equilíbrio — WasteToValue" }],
  }),
  component: Equilibrio,
});

// ── Constantes ───────────────────────────────────────────────────────────────

const TAXA = 0.12;
const N_ANOS = 10;
const FATOR_VPL = (1 - Math.pow(1 + TAXA, -N_ANOS)) / TAXA; // ≈ 5.6502

// 7 pontos de gate fee para a análise de sensibilidade
const GATE_POINTS = [0, 80, 160, 250, 330, 415, 500];

// ── Lógica de ponto de equilíbrio (função pura) ──────────────────────────────

interface BreakEven {
  current: RouteResult;
  gateFeeMin: number;      // R$/t
  precoEnergiaMin: number; // R$/MWh
  precoCarbonoMinR: number; // R$/tCO2eq
}

function calcBreakEven(
  kind: "pirolise" | "htc",
  inputs: Inputs,
  precoEnergia: number,
  precoCarbonoR: number,
): BreakEven {
  // Resultado com os valores dos sliders (gateFee vem do store intacto)
  const current = computeRoute(
    { ...inputs, precoEnergia, precoCarbono: precoCarbonoR },
    kind,
  );

  // Receita total necessária para VPL = 0
  const receitaNeeded = current.capex / FATOR_VPL + current.opexAnual;

  // Gate fee mínimo: fixer energia e carbono nos sliders, resolver gateFee
  const gateFeeMin =
    current.massaAnual > 0
      ? (receitaNeeded - current.receitaEnergia - current.receitaCarbono) /
        current.massaAnual
      : Infinity;

  // Energia mínima: fixar gateFee do store e carbono do slider, resolver precoEnergia
  const precoEnergiaMin =
    current.energiaLiquidaMWh > 0
      ? (receitaNeeded - current.receitaGate - current.receitaCarbono) /
        current.energiaLiquidaMWh
      : Infinity;

  // Carbono mínimo: fixar energia do slider e gateFee do store, resolver precoCarbono
  const precoCarbonoMinR =
    current.co2Evitado > 0
      ? (receitaNeeded - current.receitaEnergia - current.receitaGate) /
        current.co2Evitado
      : Infinity;

  return { current, gateFeeMin, precoEnergiaMin, precoCarbonoMinR };
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function VplCard({ label, vpl }: { label: string; vpl: number }) {
  const positive = vpl >= 0;
  return (
    <Card className="border-border/60">
      <CardContent className="pt-5 space-y-1">
        <div className="flex items-center gap-1.5 text-sm uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="size-3.5" /> {label}
        </div>
        <div
          className={`text-3xl font-semibold tabular-nums ${positive ? "text-primary" : "text-destructive"}`}
        >
          R$ {(vpl / 1_000_000).toFixed(1)} M
        </div>
        <div className="text-xs text-muted-foreground">VPL 10 anos, 12%</div>
      </CardContent>
    </Card>
  );
}

function BreakEvenCard({
  icon: Icon,
  label,
  value,
  unit,
  extra,
}: {
  icon: typeof Zap;
  label: string;
  value: number;
  unit: string;
  extra?: string;
}) {
  const viable = value <= 0;
  const infeasible = !isFinite(value) || value > 99999;

  return (
    <Card
      className={`border-border/60 ${viable ? "bg-green-50/50 border-green-300/60" : ""}`}
    >
      <CardContent className="pt-4 pb-4 space-y-1">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <Icon className="size-3 text-primary" /> {label}
        </div>
        {infeasible ? (
          <div className="text-base font-medium text-destructive">
            Inviável neste cenário
          </div>
        ) : viable ? (
          <div className="text-base font-medium text-green-700">
            Lucrativo sem esta fonte
          </div>
        ) : (
          <div className="text-2xl font-semibold tabular-nums text-foreground">
            {value.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {unit}
            </span>
          </div>
        )}
        {extra && !viable && !infeasible && (
          <div className="text-xs text-muted-foreground">{extra}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ContribRow({
  label,
  icon: Icon,
  pct,
  value,
  color,
}: {
  label: string;
  icon: typeof Zap;
  pct: number;
  value: string;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="size-3 text-primary" /> {label}
        </span>
        <span className="font-medium tabular-nums text-foreground">
          {value}{" "}
          <span className="text-muted-foreground font-normal">
            ({pct.toFixed(1)}%)
          </span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

function Equilibrio() {
  const { inputs, municipio } = useScenario();
  const { cambio, isFallback } = useCambio();
  const { precoMedioUSD } = useCarbonPrice();

  // PLD — leitura estática do pld-config.json via submercado do município
  const submercado = getSubmercado(municipio?.regiao ?? "SE");
  const { pld, dataReferencia } = usePLD(submercado);

  const [rota, setRota] = useState<"pirolise" | "htc">("pirolise");

  // Sliders: inicializam com valores do scenario-store global
  const [precoEnergia, setPrecoEnergia] = useState(inputs.precoEnergia);
  const [precoCarbonoUSD, setPrecoCarbonoUSD] = useState(() =>
    Math.max(5, Math.min(150, Math.round(inputs.precoCarbono / 5.5))),
  );

  const precoCarbonoR = precoCarbonoUSD * cambio;

  // Cálculo principal com os valores dos sliders
  const { current, gateFeeMin, precoEnergiaMin, precoCarbonoMinR } = useMemo(
    () => calcBreakEven(rota, inputs, precoEnergia, precoCarbonoR),
    [rota, inputs, precoEnergia, precoCarbonoR],
  );

  // VPL de ambas as rotas (para os dois cards no topo direito)
  const [piroliseVPL, htcVPL] = useMemo(() => {
    const sliderInputs = { ...inputs, precoEnergia, precoCarbono: precoCarbonoR };
    return [
      computeRoute(sliderInputs, "pirolise").vpl,
      computeRoute(sliderInputs, "htc").vpl,
    ];
  }, [inputs, precoEnergia, precoCarbonoR]);

  // Dados para o gráfico de sensibilidade do gate fee
  const gateData = useMemo(
    () =>
      GATE_POINTS.map((gf) => ({
        label: `R$${gf}`,
        vpl: +(
          computeRoute(
            { ...inputs, precoEnergia, precoCarbono: precoCarbonoR, gateFee: gf },
            rota,
          ).vpl / 1_000_000
        ).toFixed(2),
      })),
    [inputs, precoEnergia, precoCarbonoR, rota],
  );

  // Contribuição percentual de cada fonte
  const total = current.receitaAnual || 1;
  const energiaPct = (current.receitaEnergia / total) * 100;
  const gatePct = (current.receitaGate / total) * 100;
  const carbonoPct = (current.receitaCarbono / total) * 100;

  const fmtM = (v: number) =>
    `R$ ${(v / 1_000_000).toFixed(2)} M`;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <header className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">
          Ponto de Equilíbrio
        </h1>

        {/* Badge dinâmico — município + submercado + PLD */}
        {municipio && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
            <IconMapPin className="size-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">
                {municipio.nome} — {municipio.uf}
              </span>
              {" · "}Submercado {getSubmercadoNome(submercado)}
              {" · "}PLD referência:{" "}
              <span className="font-medium text-foreground tabular-nums">
                R$ {pld.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/MWh
              </span>
            </span>
            <UiTooltipProvider>
              <UiTooltip>
                <UiTooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Sobre o PLD"
                  >
                    <IconInfoCircle className="size-3.5" />
                  </button>
                </UiTooltipTrigger>
                <UiTooltipContent side="bottom" className="max-w-72 text-xs leading-snug">
                  PLD (Preço de Liquidação das Diferenças) do submercado correspondente
                  ao município selecionado. Fonte: CCEE — Dados Abertos. Referência:{" "}
                  {dataReferencia}. Atualizado mensalmente.
                </UiTooltipContent>
              </UiTooltip>
            </UiTooltipProvider>
          </div>
        )}
      </header>

      {/* Layout duas colunas */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        {/* ── Coluna esquerda: controles ── */}
        <div className="space-y-5">
          {/* Título + seletor de rota */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold leading-snug">
                Simulador de ponto de equilíbrio — três fontes de receita
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Seletor de rota */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={rota === "pirolise" ? "default" : "outline"}
                  onClick={() => setRota("pirolise")}
                  className="flex-1"
                >
                  Pirólise Lenta
                </Button>
                <Button
                  size="sm"
                  variant={rota === "htc" ? "default" : "outline"}
                  onClick={() => setRota("htc")}
                  className="flex-1"
                >
                  HTC
                </Button>
              </div>

              {/* Slider energia */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-base font-medium">
                    <Zap className="size-3.5 text-primary" /> Preço da Energia
                  </label>
                  <span className="text-base font-semibold tabular-nums">
                    R$ {precoEnergia}{" "}
                    <span className="text-sm text-muted-foreground font-normal">
                      /MWh
                    </span>
                  </span>
                </div>
                <Slider
                  value={[precoEnergia]}
                  min={100}
                  max={800}
                  step={5}
                  onValueChange={([v]) => setPrecoEnergia(v!)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>R$ 100</span>
                  <span>R$ 800</span>
                </div>
              </div>

              {/* Slider carbono (USD) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-base font-medium">
                    <Leaf className="size-3.5 text-primary" /> Preço do Carbono
                  </label>
                  <span className="text-base font-semibold tabular-nums">
                    USD {precoCarbonoUSD}{" "}
                    <span className="text-sm text-muted-foreground font-normal">
                      /tCO₂eq
                    </span>
                  </span>
                </div>
                <Slider
                  value={[precoCarbonoUSD]}
                  min={5}
                  max={150}
                  step={1}
                  onValueChange={([v]) => setPrecoCarbonoUSD(v!)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>USD 5</span>
                  <span>USD 150</span>
                </div>
                {/* Cotação em tempo real */}
                <div
                  className={`rounded-md px-3 py-2 space-y-0.5 text-sm ${
                    isFallback
                      ? "bg-yellow-50 border border-yellow-200"
                      : "bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      USD 1 = R$ {cambio.toFixed(2)}{" "}
                      {isFallback ? (
                        <span className="text-yellow-700">
                          (cotação indisponível — usando fallback)
                        </span>
                      ) : (
                        <span>(Banco Central — hoje)</span>
                      )}
                    </span>
                  </div>
                  <div className="font-medium text-foreground">
                    ≈ R${" "}
                    {precoCarbonoR.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    /tCO₂eq
                  </div>
                </div>

                {/* Preço médio de mercado — Carbonmark */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>
                    Mercado de carbono (MCO2):{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      USD {precoMedioUSD.toFixed(2)}/tCO₂eq ≈ R${" "}
                      {(precoMedioUSD * cambio).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </span>
                  <UiTooltipProvider>
                    <UiTooltip>
                      <UiTooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Sobre o preço de mercado"
                        >
                          <IconInfoCircle className="size-3.5" />
                        </button>
                      </UiTooltipTrigger>
                      <UiTooltipContent
                        side="top"
                        className="max-w-72 text-xs leading-snug"
                      >
                        MCO2 (Moss Carbon Credit) é o principal índice de crédito de
                        carbono brasileiro, listado na Carbonmark (carbonmark.com).
                        Atualizado a cada hora. Conversão USD/BRL via Banco Central
                        do Brasil.
                      </UiTooltipContent>
                    </UiTooltip>
                  </UiTooltipProvider>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards de resultado — ponto de equilíbrio */}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium px-0.5">
              Mínimos para VPL = 0 ({rota === "pirolise" ? "Pirólise" : "HTC"})
            </p>
            <BreakEvenCard
              icon={Truck}
              label="Gate fee mínimo"
              value={gateFeeMin}
              unit="R$/t"
              extra={`Energia R$ ${precoEnergia}/MWh · Carbono USD ${precoCarbonoUSD}/tCO₂eq fixos`}
            />
            <BreakEvenCard
              icon={Zap}
              label="Energia mínima"
              value={precoEnergiaMin}
              unit="R$/MWh"
              extra={`Gate fee R$ ${inputs.gateFee}/t (store) · Carbono USD ${precoCarbonoUSD}/tCO₂eq fixos`}
            />
            <BreakEvenCard
              icon={Leaf}
              label="Carbono mínimo"
              value={precoCarbonoMinR / cambio}
              unit="USD/tCO₂eq"
              extra={`≈ R$ ${precoCarbonoMinR > 0 ? precoCarbonoMinR.toFixed(2) : "—"}/tCO₂eq · Energia e gate fee fixos`}
            />
          </div>

        </div>

        {/* ── Coluna direita: resultados e gráficos ── */}
        <div className="space-y-5">
          {/* VPL atual — ambas as rotas */}
          <div className="grid grid-cols-2 gap-3">
            <VplCard label="Pirólise Lenta" vpl={piroliseVPL} />
            <VplCard label="HTC" vpl={htcVPL} />
          </div>

          {/* Gráfico de sensibilidade: VPL × gate fee */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Sensibilidade do VPL ao gate fee —{" "}
                {rota === "pirolise" ? "Pirólise" : "HTC"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Energia R$ {precoEnergia}/MWh · Carbono USD {precoCarbonoUSD}/tCO₂eq
                fixos
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={gateData}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.9 0.015 160)"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "Gate fee (R$/t)",
                        position: "insideBottom",
                        offset: -2,
                        fontSize: 12,
                        fill: "oklch(0.55 0 0)",
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v: number) => `${v.toFixed(0)} M`}
                      label={{
                        value: "VPL (R$ M)",
                        angle: -90,
                        position: "insideLeft",
                        fontSize: 12,
                        fill: "oklch(0.55 0 0)",
                      }}
                    />
                    <Tooltip
                      formatter={(v) => [
                        `R$ ${Number(v).toFixed(2)} M`,
                        "VPL",
                      ]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid oklch(0.9 0.015 160)",
                        fontSize: 13,
                      }}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="oklch(0.6 0.22 25)"
                      strokeDasharray="4 4"
                      label={{
                        value: "VPL = 0",
                        position: "right",
                        fill: "oklch(0.6 0.22 25)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="vpl"
                      fill="oklch(0.55 0.15 158)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Contribuição percentual das fontes de receita */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Mix de receita — cenário atual
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Receita total: {fmtM(current.receitaAnual)}/ano
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ContribRow
                icon={Zap}
                label="Energia elétrica"
                pct={energiaPct}
                value={fmtM(current.receitaEnergia)}
                color="bg-blue-500"
              />
              <ContribRow
                icon={Truck}
                label="Gate fee (recepção)"
                pct={gatePct}
                value={fmtM(current.receitaGate)}
                color="bg-orange-400"
              />
              <ContribRow
                icon={Leaf}
                label="Créditos de carbono"
                pct={carbonoPct}
                value={fmtM(current.receitaCarbono)}
                color="bg-emerald-500"
              />

              {/* Aviso se cotação é fallback */}
              {isFallback && (
                <div className="flex items-start gap-2 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  <span>
                    Cotação USD/BRL indisponível — usando fallback R$ 5,50.
                    Verifique sua conexão.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
