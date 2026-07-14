import { prisma } from "@repo/database";

export async function cleanupAiData() {
  const conversationCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const analysisCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await prisma.aiConversation.deleteMany({ where: { lastActiveAt: { lt: conversationCutoff } } });
  await prisma.aiUsageEvent.deleteMany({ where: { createdAt: { lt: conversationCutoff } } });
  await prisma.aiStockAnalysis.deleteMany({ where: { createdAt: { lt: analysisCutoff }, conversations: { none: {} } } });
}
