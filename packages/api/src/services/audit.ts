import { db } from "../db/connection";
import { auditEvents } from "../db/schema";

export async function logAudit(params: {
  readonly organizationId: string;
  readonly actorUserId: string;
  readonly actorEmail: string;
  readonly action: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      actorEmail: params.actorEmail,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata ?? {},
    });
  } catch (error) {
    // Log and continue — audit failures must not block the main operation
    console.error("[audit] Failed to write audit event:", error);
  }
}
