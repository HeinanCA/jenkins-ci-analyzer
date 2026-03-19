import { z } from 'zod/v4';

export const JenkinsBuildSchema = z
  .object({
    number: z.number(),
    result: z.nullable(z.string()),
    timestamp: z.number(),
    duration: z.number(),
    estimatedDuration: z.number(),
  })
  .passthrough();

export const JenkinsJobSchema = z
  .object({
    name: z.string(),
    url: z.string(),
    color: z.string(),
    _class: z.string().optional(),
    lastBuild: JenkinsBuildSchema.nullable().optional(),
    lastSuccessfulBuild: z
      .object({ number: z.number(), timestamp: z.number() })
      .passthrough()
      .nullable()
      .optional(),
    lastFailedBuild: z
      .object({ number: z.number(), timestamp: z.number() })
      .passthrough()
      .nullable()
      .optional(),
    healthReport: z
      .array(
        z.object({ description: z.string(), score: z.number() }).passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const JenkinsJobsResponseSchema = z
  .object({
    jobs: z.array(JenkinsJobSchema).default([]),
  })
  .passthrough();

export const JenkinsBuildHistorySchema = z
  .object({
    builds: z.array(JenkinsBuildSchema).default([]),
  })
  .passthrough();

const JenkinsExecutorSchema = z
  .object({
    currentExecutable: z
      .object({
        url: z.string().optional(),
        fullDisplayName: z.string().optional(),
        timestamp: z.number().optional(),
        duration: z.number().optional(),
        estimatedDuration: z.number().optional(),
      })
      .passthrough()
      .nullable()
      .optional()
      .default(null),
  })
  .passthrough();

export const JenkinsAgentSchema = z
  .object({
    displayName: z.string(),
    description: z.nullable(z.string()).optional(),
    idle: z.boolean(),
    offline: z.boolean(),
    temporarilyOffline: z.boolean().optional().default(false),
    offlineCauseReason: z.nullable(z.string()).optional(),
    numExecutors: z.number(),
    executors: z.array(JenkinsExecutorSchema).default([]),
  })
  .passthrough();

export const JenkinsComputerSetSchema = z
  .object({
    computer: z.array(JenkinsAgentSchema).default([]),
  })
  .passthrough();

export const JenkinsQueueItemSchema = z
  .object({
    id: z.number(),
    task: z.object({ name: z.string(), url: z.string() }).passthrough(),
    inQueueSince: z.number(),
    why: z.nullable(z.string()).optional().default(null),
    stuck: z.boolean().optional().default(false),
    buildableStartMilliseconds: z.number().optional(),
  })
  .passthrough();

export const JenkinsQueueSchema = z
  .object({
    items: z.array(JenkinsQueueItemSchema).default([]),
  })
  .passthrough();

export const JenkinsInfoSchema = z
  .object({
    mode: z.string().optional(),
    nodeDescription: z.string().optional(),
    useSecurity: z.boolean().optional(),
  })
  .passthrough();

export type JenkinsJob = z.infer<typeof JenkinsJobSchema>;
export type JenkinsBuild = z.infer<typeof JenkinsBuildSchema>;
export type JenkinsAgent = z.infer<typeof JenkinsAgentSchema>;
export type JenkinsQueueItem = z.infer<typeof JenkinsQueueItemSchema>;
