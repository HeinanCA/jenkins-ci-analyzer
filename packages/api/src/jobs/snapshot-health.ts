import type { Task } from 'graphile-worker';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { ciInstances, healthSnapshots } from '../db/schema';
import {
  decryptCredentials,
  type EncryptedCredentials,
} from '../services/credential-vault';
import { jenkinsGet } from '../services/jenkins-client';
import { calculateHealth, STUCK_AGENT_THRESHOLD_MS } from '@tig/shared';

interface JenkinsAgentResponse {
  readonly computer: readonly {
    readonly displayName: string;
    readonly idle: boolean;
    readonly offline: boolean;
    readonly numExecutors: number;
    readonly executors: readonly {
      readonly currentExecutable: {
        readonly timestamp?: number;
      } | null;
    }[];
  }[];
}

interface JenkinsQueueResponse {
  readonly items: readonly { readonly id: number }[];
}

export const snapshotHealth: Task = async (payload, helpers) => {
  const { instanceId } = payload as { instanceId: string };

  const [instance] = await db
    .select({
      baseUrl: ciInstances.baseUrl,
      credentials: ciInstances.credentials,
    })
    .from(ciInstances)
    .where(eq(ciInstances.id, instanceId))
    .limit(1);

  if (!instance) {
    helpers.logger.error(`Instance ${instanceId} not found`);
    return;
  }

  const credentials = decryptCredentials(
    instance.credentials as EncryptedCredentials,
  );

  let agentData: JenkinsAgentResponse;
  let queueData: JenkinsQueueResponse;

  try {
    const agentsUrl = `${instance.baseUrl}/computer/api/json?tree=computer[displayName,idle,offline,numExecutors,executors[currentExecutable[timestamp]]]`;
    const queueUrl = `${instance.baseUrl}/queue/api/json?tree=items[id]`;

    [agentData, queueData] = await Promise.all([
      jenkinsGet<JenkinsAgentResponse>(agentsUrl, credentials),
      jenkinsGet<JenkinsQueueResponse>(queueUrl, credentials),
    ]);
  } catch (error) {
    helpers.logger.error(
      `Failed to fetch health for instance ${instanceId}: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return;
  }

  const agents = agentData.computer ?? [];
  const agentsOnline = agents.filter((a) => !a.offline).length;
  const executorsTotal = agents.reduce((s, a) => s + a.numExecutors, 0);
  const executorsBusy = agents.reduce(
    (s, a) =>
      s + a.executors.filter((e) => e.currentExecutable !== null).length,
    0,
  );
  const stuckBuilds = agents.reduce(
    (s, a) =>
      s +
      a.executors.filter((e) => {
        if (!e.currentExecutable?.timestamp) return false;
        return Date.now() - e.currentExecutable.timestamp > STUCK_AGENT_THRESHOLD_MS;
      }).length,
    0,
  );

  const report = calculateHealth({
    controllerReachable: true,
    agentsOnline,
    agentsTotal: agents.length,
    executorsBusy,
    executorsTotal,
    queueDepth: queueData.items?.length ?? 0,
    stuckBuilds,
  });

  await db.insert(healthSnapshots).values({
    ciInstanceId: instanceId,
    level: report.level,
    score: report.score,
    agentsOnline,
    agentsTotal: agents.length,
    executorsBusy,
    executorsTotal,
    queueDepth: queueData.items?.length ?? 0,
    stuckBuilds,
    issues: report.issues,
  });

  helpers.logger.info(
    `Health snapshot for ${instanceId}: ${report.level} (score: ${report.score})`,
  );
};
