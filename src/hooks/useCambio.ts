import { useQuery } from "@tanstack/react-query";

const FALLBACK = 5.5;

interface AwesomeApiResponse {
  USDBRL: { bid: string };
}

export function useCambio() {
  const { data, isError, isLoading } = useQuery<number>({
    queryKey: ["cambio-usd-brl"],
    queryFn: async () => {
      const resp = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
      if (!resp.ok) throw new Error("Falha ao buscar câmbio");
      const json = (await resp.json()) as AwesomeApiResponse;
      const bid = parseFloat(json.USDBRL.bid);
      if (!Number.isFinite(bid) || bid <= 0) throw new Error("Cotação inválida");
      return bid;
    },
    staleTime: 60 * 60 * 1000, // 1 hora
    throwOnError: false,
    retry: 1,
  });

  return {
    cambio: data ?? FALLBACK,
    isFallback: isLoading || isError || data == null,
  };
}
