export function deriveDataHealthStatus(params: {
  hasFailedJob: boolean;
  hasDateMismatch: boolean;
  missingPriceCount: number;
  missingScoreCount: number;
  missingTechCount: number;
}) {
  if (params.hasFailedJob) return "failed";
  if (
    params.hasDateMismatch ||
    params.missingPriceCount > 0 ||
    params.missingScoreCount > 0 ||
    params.missingTechCount > 0
  ) {
    return "delayed";
  }
  return "ok";
}
