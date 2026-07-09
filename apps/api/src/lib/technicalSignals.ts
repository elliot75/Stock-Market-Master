export function getMacdSignal(tech: {
  macdDif: unknown;
  macdHist: unknown;
}): string {
  const dif = Number(tech.macdDif || 0);
  const hist = Number(tech.macdHist || 0);
  if (!Number.isFinite(dif) || !Number.isFinite(hist)) return "中性";

  if (dif > 0 && hist > 0) return "多頭擴張";
  if (dif > 0 && hist < 0) return "多頭縮減";
  if (dif < 0 && hist < 0) return "空頭擴張";
  if (dif < 0 && hist > 0) return "空頭縮減";
  return "中性";
}
