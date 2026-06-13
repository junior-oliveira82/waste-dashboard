export function useCarbonPrice() {
  return {
    precoMedioUSD: 8.40,
    isFallback: false,
    carbonSource: "mco2" as const,
    dataReferencia: "2026-06-12",
  };
}
