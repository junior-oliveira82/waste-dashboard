import { Link, useRouterState } from "@tanstack/react-router";
import { Leaf, Sliders, GitCompare, LineChart } from "lucide-react";

const items = [
  { to: "/", label: "Entrada de Dados", icon: Sliders },
  { to: "/comparacao", label: "Comparação Tecnológica", icon: GitCompare },
  { to: "/financeiro", label: "Análise Financeira (TEA)", icon: LineChart },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="px-5 py-6 flex items-center gap-2 border-b border-sidebar-border">
        <div className="size-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center">
          <Leaf className="size-5" />
        </div>
        <div>
          <div className="font-semibold tracking-tight">WasteToValue</div>
          <div className="text-[11px] text-sidebar-foreground/60 uppercase tracking-wider">TEA Suite</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "hover:bg-sidebar-accent text-sidebar-foreground/80"
              }`}
            >
              <Icon className="size-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}