import { useQuery } from "@tanstack/react-query";
import { jenkinsGet } from "../../../api/jenkins-client";
import { queueUrl } from "../../../api/jenkins-endpoints";
import { JenkinsQueueSchema } from "@tig/shared";
import { useConnectionStore } from "../../../store/connection-store";
import { POLLING_INTERVALS } from "@tig/shared";

export function useQueueStatus() {
  const config = useConnectionStore((s) => s.config);

  return useQuery({
    queryKey: ["queue"],
    queryFn: async () => {
      if (!config) throw new Error("No Jenkins connection configured");
      const url = queueUrl(config.baseUrl);
      const raw = await jenkinsGet(url, config);
      return JenkinsQueueSchema.parse(raw);
    },
    enabled: !!config,
    refetchInterval: POLLING_INTERVALS.QUEUE,
  });
}
