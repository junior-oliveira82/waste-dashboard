import pldConfig from "@/data/pld-config.json";

interface PLDResult {
  pld: number;
  dataReferencia: string;
  fonte: string;
  isFallback: false;
}

type SubmercadoKey = "SE" | "S" | "NE" | "N";

export function usePLD(submercado: string): PLDResult {
  const key = (["SE", "S", "NE", "N"].includes(submercado)
    ? submercado
    : "SE") as SubmercadoKey;

  return {
    pld: pldConfig[key],
    dataReferencia: pldConfig.dataReferencia,
    fonte: pldConfig.fonte,
    isFallback: false,
  };
}
