import "dotenv/config";
import { Prisma, prisma } from "@repo/database";
import { decryptNotificationConfig, encryptNotificationConfig } from "@repo/notifications";

async function main() {
  if (!process.env.APP_ENCRYPTION_KEY) {
    throw new Error("APP_ENCRYPTION_KEY is required to encrypt notification configurations.");
  }

  const channels = await prisma.notificationChannel.findMany({ select: { id: true, config: true } });
  let converted = 0;
  for (const channel of channels) {
    const config = decryptNotificationConfig(channel.config);
    const encrypted = encryptNotificationConfig(config) as unknown as Prisma.InputJsonValue;
    await prisma.notificationChannel.update({ where: { id: channel.id }, data: { config: encrypted } });
    converted++;
  }
  console.log(`[encryptNotificationConfigs] Encrypted ${converted} notification channel(s).`);
}

main().catch((error) => {
  console.error("[encryptNotificationConfigs] Failed:", error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
