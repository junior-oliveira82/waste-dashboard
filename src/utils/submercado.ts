/** Mapeia a sigla de região do IBGE/SNIS para o código de submercado CCEE. */
export function getSubmercado(regiao: string): string {
  switch (regiao) {
    case "S":  return "S";
    case "SE": return "SE";
    case "CO": return "SE";
    case "NE": return "NE";
    case "N":  return "N";
    default:   return "SE";
  }
}

/** Retorna o nome legível do submercado CCEE. */
export function getSubmercadoNome(sub: string): string {
  switch (sub) {
    case "S":  return "Sul";
    case "SE": return "Sudeste";
    case "NE": return "Nordeste";
    case "N":  return "Norte";
    default:   return sub;
  }
}
