import {
  prisma,
  type NotificationChannelType,
} from "@repo/database";
import { sendNotification } from "@repo/notifications";

export async function dispatchAlertNotifications(params: {
  eventId: string;
  userId: string;
  message: string;
}) {
  const channels = await prisma.notificationChannel.findMany({
    where: { userId: params.userId, isActive: true },
  });

  for (const channel of channels) {
    let result: Awaited<ReturnType<typeof sendNotification>>;
    try {
      result = await sendNotification(channel, params.message);
    } catch (error) {
      result = {
        ok: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    await prisma.alertDeliveryAttempt.create({
      data: {
        eventId: params.eventId,
        channelId: channel.id,
        channelType: channel.type as NotificationChannelType,
        status: result.ok ? "SENT" : "FAILED",
        errorMessage: result.errorMessage,
        responseJson: result.responseJson == null ? undefined : result.responseJson,
      },
    });
  }
}
