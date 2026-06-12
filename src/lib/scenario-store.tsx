import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type RegiaoSigla = "N" | "NE" | "CO" | "SE" | "S";

export interface MunicipioSelecionado {
  id: number;
  nome: string;
  uf: string;
  regiao: RegiaoSigla;
}

export type Inputs = {
  forsu: number;
  lodo: number;
  umidade: number;
  cinzas: number;
  pci: number;
  precoEnergia: number;
  gateFee: number;
  precoCarbono: number;
  eficienciaPirolise: number;
  energiaPorToneladaPirolise: number;
  eficienciaHTC: number;
  energiaPorToneladaHTC: number;
};

const DEFAULT: Inputs = {
  forsu: 80,
  lodo: 20,
  umidade: 60,
  cinzas: 15,
  pci: 14,
  precoEnergia: 320,
  gateFee: 180,
  precoCarbono: 180,
  eficienciaPirolise: 20,
  energiaPorToneladaPirolise: 0.45,
  eficienciaHTC: 25,
  energiaPorToneladaHTC: 0.60,
};

export type RouteResult = {
  nome: string;
  rendimentoSolido: number; // % char yield
  eficiencia: number; // % CHP
  energiaLiquidaMWh: number; // MWh/ano
  massaAnual: number; // t/ano
  co2Evitado: number; // tCO2eq/ano
  receitaEnergia: number;
  receitaGate: number;
  receitaCarbono: number;
  receitaAnual: number; // R$
  capex: number;
  opexAnual: number;
  vpl: number;
  tir: number;
  payback: number;
};

function computeRoute(i: Inputs, kind: "pirolise" | "htc"): RouteResult {
  const massaDiaria = i.forsu + i.lodo; // t/dia
  const massaAnual = massaDiaria * 330; // t/ano

  const isP = kind === "pirolise";
  const rendimentoSolido = isP ? 0.32 : 0.55; // char yield base
  const eficiencia = isP ? i.eficienciaPirolise / 100 : i.eficienciaHTC / 100;
  const energiaLiquidaMWh = massaAnual * (isP ? i.energiaPorToneladaPirolise : i.energiaPorToneladaHTC);

  const cargaCO2 = isP ? 1.1 : 0.9; // tCO2eq evitada por t resíduo
  const co2Evitado = massaAnual * cargaCO2;
  // As três (e únicas) fontes de receita do projeto:
  const receitaEnergia = energiaLiquidaMWh * i.precoEnergia;
  const receitaGate = massaAnual * i.gateFee;
  const receitaCarbono = co2Evitado * i.precoCarbono;
  const receitaAnual = receitaEnergia + receitaGate + receitaCarbono;

  const capex = isP ? 28_000_000 : 22_000_000;
  const opexAnual = isP ? 4_500_000 : 3_800_000;
  const fluxo = receitaAnual - opexAnual;

  // VPL simplificado, 10 anos, taxa 12%
  const taxa = 0.12;
  const n = 10;
  const fator = (1 - Math.pow(1 + taxa, -n)) / taxa;
  const vpl = fluxo * fator - capex;

  // TIR aproximada
  const tir = fluxo > 0 ? Math.max(-0.5, fluxo / capex - 0.02) : -0.1;
  const payback = fluxo > 0 ? capex / fluxo : 99;

  return {
    nome: isP ? "Pirólise Lenta" : "Carbonização Hidrotérmica (HTC)",
    rendimentoSolido,
    eficiencia,
    energiaLiquidaMWh,
    massaAnual,
    co2Evitado,
    receitaEnergia,
    receitaGate,
    receitaCarbono,
    receitaAnual,
    capex,
    opexAnual,
    vpl,
    tir,
    payback,
  };
}

type Ctx = {
  inputs: Inputs;
  setInput: <K extends keyof Inputs>(k: K, v: Inputs[K]) => void;
  reset: () => void;
  pirolise: RouteResult;
  htc: RouteResult;
  municipio: MunicipioSelecionado | null;
  setMunicipio: (m: MunicipioSelecionado | null) => void;
};

const ScenarioCtx = createContext<Ctx | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT);
  const [municipio, setMunicipio] = useState<MunicipioSelecionado | null>(null);
  const value = useMemo<Ctx>(() => ({
    inputs,
    setInput: (k, v) => setInputs((p) => ({ ...p, [k]: v })),
    reset: () => setInputs(DEFAULT),
    pirolise: computeRoute(inputs, "pirolise"),
    htc: computeRoute(inputs, "htc"),
    municipio,
    setMunicipio,
  }), [inputs, municipio]);
  return <ScenarioCtx.Provider value={value}>{children}</ScenarioCtx.Provider>;
}

export function useScenario() {
  const c = useContext(ScenarioCtx);
  if (!c) throw new Error("useScenario must be used within ScenarioProvider");
  return c;
}

// Monte Carlo VPL simulation
export function runMonteCarlo(base: Inputs, kind: "pirolise" | "htc", n = 500) {
  const pts: { iter: number; vpl: number; precoEnergia: number }[] = [];
  let positivos = 0;
  for (let k = 0; k < n; k++) {
    const variacao = (mu: number, pct: number) =>
      mu * (1 + (Math.random() - 0.5) * 2 * pct);
    const sample: Inputs = {
      ...base,
      precoEnergia: variacao(base.precoEnergia, 0.3),
      gateFee: variacao(base.gateFee, 0.25),
      precoCarbono: variacao(base.precoCarbono, 0.4),
    };
    const r = computeRoute(sample, kind);
    if (r.vpl > 0) positivos++;
    pts.push({ iter: k, vpl: r.vpl / 1_000_000, precoEnergia: sample.precoEnergia });
  }
  return { pts, probPositivo: positivos / n };
}