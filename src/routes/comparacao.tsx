import { createFileRoute } from "@tanstack/react-router";
import { useScenario, type RouteResult } from "@/lib/scenario-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Droplets } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/comparacao")({
  head: () => ({ meta: [{ title: "Comparação Tecnológica — WasteToValue" }] }),
  component: Comparacao,
});

function RouteCard({ r, kind }: { r: RouteResult; kind: "A" | "B" }) {
  const Icon = kind === "A" ? Flame : Droplets;
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="uppercase tracking-wider text-[10px]">Rota {kind}</Badge>
          <Icon className="size-5 text-primary" />
        </div>
        <CardTitle className="text-lg">{r.nome}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Metric label={kind === "A" ? "Rendimento de biochar" : "Rendimento de hidrochar"} value={`${(r.rendimentoSolido * 100).toFixed(1)} %`} />
        <Metric label="Eficiência térmica CHP" value={`${(r.eficiencia * 100).toFixed(1)} %`} />
        <Metric label="Energia útil líquida" value={`${(r.energiaLiquidaMWh / 1000).toFixed(2)} GWh/ano`} highlight />
        <Metric label="Receita anual estimada" value={`R$ ${(r.receitaAnual / 1_000_000).toFixed(2)} M`} />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-semibold ${highlight ? "text-primary text-lg" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function Comparacao() {
  const { pirolise, htc } = useScenario();
  const data = [
    { metric: "Energia (GWh/ano)", Pirólise: +(pirolise.energiaLiquidaMWh / 1000).toFixed(2), HTC: +(htc.energiaLiquidaMWh / 1000).toFixed(2) },
    { metric: "Receita (R$ M)", Pirólise: +(pirolise.receitaAnual / 1_000_000).toFixed(2), HTC: +(htc.receitaAnual / 1_000_000).toFixed(2) },
    { metric: "VPL (R$ M)", Pirólise: +(pirolise.vpl / 1_000_000).toFixed(2), HTC: +(htc.vpl / 1_000_000).toFixed(2) },
    { metric: "Rend. char (%)", Pirólise: +(pirolise.rendimentoSolido * 100).toFixed(1), HTC: +(htc.rendimentoSolido * 100).toFixed(1) },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Comparação Tecnológica</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Análise lado a lado das rotas de conversão termoquímica para o cenário configurado.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <RouteCard r={pirolise} kind="A" />
        <RouteCard r={htc} kind="B" />
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Comparativo de desempenho</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 160)" />
                <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.9 0.015 160)" }} />
                <Legend />
                <Bar dataKey="Pirólise" fill="oklch(0.55 0.15 158)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="HTC" fill="oklch(0.7 0.15 130)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}