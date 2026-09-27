/** Text color that reads well on a brand color. */
export function inkOn(color: string | null | undefined) {
  switch ((color ?? "").toLowerCase()) {
    case "#3a2420":
    case "#5b4659":
      return "#f5ead8";
    case "#a0673f":
    case "#8a9a62":
    case "#d9607a":
      return "#ffffff";
    default:
      return "#3a2420";
  }
}

export const PLUM = "#5b4659";
