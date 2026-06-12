import { Loader2, MapPin, Users, Recycle, Droplets, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DiagnosticoMunicipal, Classificacao } from "@/hooks/useMunicipalDiagnostic";

const CLASSIFICACAO_CONFIG: Record<
  Classificacao,
  { label: string; badgeCls: string; cardCls: string }
> = {
  "Inviável": {
    label: "Inviável",
    badgeCls: "bg-destructive/10 text-destructive border-destructive/30",
    cardCls: "border-destructive/30 bg-destructive/5",
  },
  "Marginal": {
    label: "Marginal",
    badgeCls: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    cardCls: "border-amber-500/30 bg-amber-500/5",
  },
  "Viável": {
    label: "Viável",
    badgeCls: "bg-primary/10 text-primary border-primary/30",
    cardCls: "border-primary/30 bg-primary/5",
  },
  "Altamente Viável": {
    label: "Altamente Viável",
    badgeCls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    cardCls: "border-emerald-500/30 bg-emerald-500/5",
  },
};

interface Props {
  diagnostico: DiagnosticoMunicipal | null;
  isLoading: boolean;
  isError?: boolean;
}

export function DiagnosticCard({ diagnostico, isLoading, isError }: Props) {
  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Buscando dados populacionais (IBGE)...
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-start gap-3 py-5 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            Não foi possível obter dados populacionais do IBGE para este município.
            Insira os valores de FORSU e lodo manualmente nos campos abaixo.
          </span>
        </CardContent>
      </Card>
    );
  }

  if (!diagnostico) return null;

  const cfg = CLASSIFICACAO_CONFIG[diagnostico.classificacao];

  return (
    <Card className={cfg.cardCls}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4 text-primary shrink-0" />
            <span>
              {diagnostico.municipio.nome}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — {diagnostico.municipio.uf} ({diagnostico.nomeRegiao})
              </span>
            </span>
          </CardTitle>
          <Badge
            variant="outline"
            className={`shrink-0 text-xs font-semibold ${cfg.badgeCls}`}
          >
            <TrendingUp className="mr-1 size-3" />
            {cfg.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Metric
            icon={Users}
            label="População (Censo 2022)"
            value={diagnostico.populacao.toLocaleString("pt-BR")}
            unit="hab."
          />
          <Metric
            icon={Recycle}
            label="FORSU estimado"
            value={diagnostico.forsu.toLocaleString("pt-BR")}
            unit="t/dia"
          />
          <Metric
            icon={Droplets}
            label="Lodo estimado"
            value={diagnostico.lodo.toLocaleString("pt-BR")}
            unit="t/dia"
          />
          <Metric
            icon={TrendingUp}
            label="Total de resíduos"
            value={diagnostico.totalResiduos.toLocaleString("pt-BR")}
            unit="t/dia"
            highlight
          />
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Estimativas baseadas nos parâmetros regionais do SNIS 2023. Os valores de FORSU e lodo
          foram transferidos automaticamente para os campos de entrada abaixo.
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  highlight,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <div className={`text-lg font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
        <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
