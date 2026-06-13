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

export function useCarbonPrice() {
  const { data, isError, isLoading } = useQuery<number>({
    queryKey: ["carbonmark-br-price"],
    queryFn: async () => {
      const resp = await fetch(
        "https://api.carbonmark.com/carbonProjects?country=Brazil",
        { headers: { Accept: "application/json" } },
      );
      if (!resp.ok) throw new Error(`Carbonmark respondeu ${resp.status}`);
      const data = (await resp.json()) as CarbonmarkProject[];

      // Log temporário para inspecionar o formato real da resposta
      console.log("Carbonmark sample:", JSON.stringify(data[0], null, 2));

      if (!Array.isArray(data) || data.length === 0)
        throw new Error("Resposta inválida da Carbonmark");

      const prices = data.map(extractPrice).filter((v): v is number => v !== null);
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
