import pldConfig from "@/data/pld-config.json";

interface PLDResult {
  pld: number;
  dataReferencia: string;
  fonte: string;
  isFallback: false;
}

type SubmercadoKey = "SUDESTE_CENTRO_OESTE" | "SUL" | "NORDESTE" | "NORTE";

function toConfigKey(submercado: string): SubmercadoKey {
  switch (submercado) {
    case "S":  return "SUL";
    case "NE": return "NORDESTE";
    case "N":  return "NORTE";
    default:   return "SUDESTE_CENTRO_OESTE"; // SE e CO
  }
}

export function usePLD(submercado: string): PLDResult {
  const key = toConfigKey(submercado);
  return {
    pld: pldConfig[key],
    dataReferencia: pldConfig.dataReferencia,
    fonte: pldConfig.fonte,
    isFallback: false,
  };
}
