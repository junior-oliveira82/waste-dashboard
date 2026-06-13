import { useQuery } from "@tanstack/react-query";

const FALLBACK_USD = 8.0;

interface CarbonmarkProduct {
  id?: unknown;
  price?: unknown;
}

interface CarbonPriceResult {
  price: number;
  source: "mco2" | "index";
}

function toValidPrice(raw: unknown): number | null {
  if (raw == null) return null;
  const val = typeof raw === "string" ? parseFloat(raw) : Number(raw);
  return Number.isFinite(val) && val > 0 ? val : null;
}

export function useCarbonPrice() {
  const { data, isError, isLoading } = useQuery<CarbonPriceResult>({
    queryKey: ["carbonmark-products-price"],
    queryFn: async () => {
      const resp = await fetch(
        "https://api.carbonmark.com/products",
        { headers: { Accept: "application/json" } },
      );
      if (!resp.ok) throw new Error(`Carbonmark respondeu ${resp.status}`);
      const raw = await resp.json();

      // Logs temporários de diagnóstico
      console.log("Carbonmark status:", resp.status);
      console.log("Carbonmark raw response:", JSON.stringify(raw).substring(0, 1000));

      const products = Array.isArray(raw) ? (raw as CarbonmarkProduct[]) : null;
      if (!products || products.length === 0)
        throw new Error("Resposta inválida da Carbonmark /products");

      // Tenta MCO2 (Moss Carbon Credit — índice de carbono brasileiro) primeiro
      const mco2 = products.find(
        (p) => typeof p.id === "string" && p.id.toLowerCase() === "mco2",
      );
      if (mco2) {
        const price = toValidPrice(mco2.price);
        if (price !== null) return { price, source: "mco2" as const };
      }

      // Fallback: média de todos os produtos com preço válido
      const prices = products
        .map((p) => toValidPrice(p.price))
        .filter((v): v is number => v !== null);
      if (prices.length === 0) throw new Error("Nenhum preço válido retornado");
      return {
        price: prices.reduce((a, b) => a + b, 0) / prices.length,
        source: "index" as const,
      };
    },
    staleTime: 60 * 60 * 1000,
    throwOnError: false,
    retry: 1,
  });

  return {
    precoMedioUSD: data?.price ?? FALLBACK_USD,
    carbonSource: data?.source ?? null,
    isFallback: isLoading || isError || data == null,
  };
}
