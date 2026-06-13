import { useQuery } from "@tanstack/react-query";

const FALLBACK_USD = 8.0;

interface CarbonmarkListing {
  singleUnitPrice?: unknown;
}

interface CarbonmarkProject {
  price?: unknown;
  listings?: CarbonmarkListing[];
  minSupplyPrice?: unknown;
}

function extractPrice(project: CarbonmarkProject): number | null {
  const candidates = [
    project.price,
    project.listings?.[0]?.singleUnitPrice,
    project.minSupplyPrice,
  ];
  for (const raw of candidates) {
    if (raw == null) continue;
    const val = typeof raw === "string" ? parseFloat(raw) : Number(raw);
    if (Number.isFinite(val) && val > 0) return val;
  }
  return null;
}

function resolveProjectsArray(data: unknown): CarbonmarkProject[] | null {
  if (Array.isArray(data)) return data as CarbonmarkProject[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["items", "projects", "data", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as CarbonmarkProject[];
    }
  }
  return null;
}

export function useCarbonPrice() {
  const { data, isError, isLoading } = useQuery<number>({
    queryKey: ["carbonmark-br-price"],
    queryFn: async () => {
      const resp = await fetch(
        "https://api.carbonmark.com/carbonProjects?country=Brazil",
        { headers: { Accept: "application/json" } },
      );
      if (!resp.ok) throw new Error(`Carbonmark respondeu ${resp.status}`);
      const raw = await resp.json();

      // Logs temporários de diagnóstico
      console.log("Carbonmark status:", resp.status);
      console.log("Carbonmark raw response:", JSON.stringify(raw).substring(0, 1000));

      const projects = resolveProjectsArray(raw);
      if (!projects || projects.length === 0)
        throw new Error("Resposta inválida da Carbonmark");

      const prices = projects.map(extractPrice).filter((v): v is number => v !== null);
      if (prices.length === 0) throw new Error("Nenhum preço válido retornado");
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    },
    staleTime: 60 * 60 * 1000,
    throwOnError: false,
    retry: 1,
  });

  return {
    precoMedioUSD: data ?? FALLBACK_USD,
    isFallback: isLoading || isError || data == null,
  };
}
