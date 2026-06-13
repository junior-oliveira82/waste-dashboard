import { useQuery } from "@tanstack/react-query";

const FALLBACK_USD = 8.0;

interface CarbonmarkProject {
  price?: unknown;
  lowestPrice?: unknown;
}

export function useCarbonPrice() {
  const { data, isError, isLoading } = useQuery<number>({
    queryKey: ["carbonmark-br-price"],
    queryFn: async () => {
      const resp = await fetch(
        "https://api.carbonmark.com/carbonProjects?country=Brazil",
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_CARBONMARK_API_KEY}`,
          },
        },
      );
      if (!resp.ok) throw new Error("Falha ao buscar preço do carbono na Carbonmark");
      const json = (await resp.json()) as CarbonmarkProject[];
      if (!Array.isArray(json) || json.length === 0)
        throw new Error("Resposta inválida da Carbonmark");

      const prices: number[] = [];
      for (const project of json) {
        const raw = project.price ?? project.lowestPrice;
        const val = typeof raw === "string" ? parseFloat(raw) : Number(raw);
        if (Number.isFinite(val) && val > 0) prices.push(val);
      }
      if (prices.length === 0) throw new Error("Nenhum preço válido retornado");
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    },
    staleTime: 60 * 60 * 1000, // 1 hora
    throwOnError: false,
    retry: 1,
  });

  return {
    precoMedioUSD: data ?? FALLBACK_USD,
    isFallback: isLoading || isError || data == null,
  };
}
