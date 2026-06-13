export function useCarbonPrice() {
  return {
    precoMedioUSD: 4.75,
    isFallback: false,
    carbonSource: "mco2" as const,
    dataReferencia: "2026-06-12",
  };
}
