import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useScenario, type Inputs } from "@/lib/scenario-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Leaf, Coins, Recycle, Zap, MapPin } from "lucide-react";
import { useMunicipalDiagnostic } from "@/hooks/useMunicipalDiagnostic";
import { MunicipalSearch } from "@/components/MunicipalSearch";
import { DiagnosticCard } from "@/components/DiagnosticCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrada de Dados — WasteToValue TEA" },
      { name: "description", content: "Configure os parâmetros de resíduos e premissas econômicas para análise de viabilidade." },
    ],
  }),
  component: Index,
});

function Field({ label, name, unit, step = 1 }: { label: string; name: keyof Inputs; unit: string; step?: number }) {
  const { inputs, setInput } = useScenario();
  return (
    <div className="space-y-2">
      <Label className="text-lg font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step={step}
          value={inputs[name]}
          onChange={(e) => setInput(name, parseFloat(e.target.value) || 0)}
          className="pr-20 h-10 text-3xl font-medium"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function Index() {
  const { reset, pirolise, htc, setInput } = useScenario();
  const { municipios, isLoadingMunicipios, municipioSelecionado, isLoadingPop, isPopError, diagnostico, selecionar, limpar } =
    useMunicipalDiagnostic();

  useEffect(() => {
    if (!diagnostico) return;
    setInput("forsu", diagnostico.forsu);
    setInput("lodo", diagnostico.lodo);
    // setInput não está nas deps para evitar loop: ela muda a cada render do
    // ScenarioProvider, mas diagnostico só muda quando o município é alterado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostico]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Entrada de Dados</h1>
          <p className="text-xl text-muted-foreground mt-1">
            Configure os parâmetros do cenário base. Resultados recalculam automaticamente.
          </p>
        </div>
        <Button variant="outline" size="lg" className="text-lg h-12 px-6" onClick={reset}>
          Restaurar padrão
        </Button>
      </header>

      {/* ── Módulo 1 — Diagnóstico Municipal ── */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <MapPin className="size-5 text-primary" /> Diagnóstico Municipal (SNIS 2023 + IBGE)
          </CardTitle>
          <p className="text-lg text-muted-foreground mt-1">
            Selecione um município para estimar automaticamente FORSU e lodo com base nos parâmetros
            regionais do SNIS 2023 e na população do Censo 2022.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <MunicipalSearch
            municipios={municipios}
            isLoading={isLoadingMunicipios}
            selecionado={municipioSelecionado}
            onSelect={selecionar}
            onClear={limpar}
          />
          <DiagnosticCard
            diagnostico={diagnostico}
            isLoading={!!municipioSelecionado && isLoadingPop}
            isError={!!municipioSelecionado && !isLoadingPop && isPopError}
          />
        </CardContent>
      </Card>

      {/* ── Campos de entrada originais ── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Recycle className="size-5 text-primary" /> Resíduos
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-5">
            <Field label="Massa de FORSU" name="forsu" unit="t/dia" />
            <Field label="Massa de Lodo de Esgoto" name="lodo" unit="t/dia" />
            <Field label="Umidade" name="umidade" unit="%" />
            <Field label="Teor de Cinzas" name="cinzas" unit="%" />
            <div className="col-span-2">
              <Field label="PCI estimado" name="pci" unit="GJ/t" step={0.1} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Coins className="size-5 text-primary" /> Premissas Econômicas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-5">
            <Field label="Preço da Energia" name="precoEnergia" unit="R$/MWh" />
            <Field label="Tarifa de Recepção (Gate Fee)" name="gateFee" unit="R$/t" />
            <Field label="Preço do Crédito de Carbono" name="precoCarbono" unit="R$/tCO2eq" />
          </CardContent>
        </Card>

        <Card className="border-border/60 md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Zap className="size-5 text-primary" /> Parâmetros Técnico-Energéticos das Rotas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <Field label="Eficiência Elétrica — Pirólise" name="eficienciaPirolise" unit="%" />
            <Field label="Energia / t — Pirólise" name="energiaPorToneladaPirolise" unit="MWh/t" step={0.01} />
            <Field label="Eficiência Elétrica — HTC" name="eficienciaHTC" unit="%" />
            <Field label="Energia / t — HTC" name="energiaPorToneladaHTC" unit="MWh/t" step={0.01} />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Leaf className="size-5 text-primary" /> Resumo do cenário
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4 text-xl">
          <div className="space-y-1">
            <div className="text-muted-foreground">Pirólise Lenta — energia líquida</div>
            <div className="text-4xl font-semibold text-foreground">
              {(pirolise.energiaLiquidaMWh / 1000).toFixed(1)} GWh/ano
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">HTC — energia líquida</div>
            <div className="text-4xl font-semibold text-foreground">
              {(htc.energiaLiquidaMWh / 1000).toFixed(1)} GWh/ano
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
