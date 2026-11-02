export const QUEUE = "operations";

export const JOBS = {
  announcements: "announcements.dispatch",
  reminders: "reminders.scan",
  auditCheckpoint: "audit.checkpoint",
  auditVerify: "audit.verify",
  forecast: "forecast.refresh",
  embeddings: "embeddings.refresh",
} as const;

export const WORKER_HEARTBEAT_KEY = "worker:heartbeat";

export const streamsFor = (scope: { userId: string; officeId: string | null }) =>
  scope.officeId
    ? [`events:user:${scope.userId}`, `events:office:${scope.officeId}`]
    : [`events:user:${scope.userId}`, "events:platform"];
