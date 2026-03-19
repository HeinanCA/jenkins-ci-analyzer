import { useQuery } from "@tanstack/react-query";
import { jenkinsGet } from "../../../api/jenkins-client";
import { jobsUrl } from "../../../api/jenkins-endpoints";
import { JenkinsJobsResponseSchema } from "@tig/shared";
import { useConnectionStore } from "../../../store/connection-store";
import { useTeamScopeStore } from "../../../store/team-scope-store";
import { POLLING_INTERVALS } from "@tig/shared";

export function usePipelines() {
  const config = useConnectionStore((s) => s.config);
  const selectedFolder = useTeamScopeStore((s) => s.selectedFolder);

  return useQuery({
    queryKey: ["pipelines", selectedFolder],
    queryFn: async () => {
      if (!config) throw new Error("No Jenkins connection configured");
      const url = jobsUrl(config.baseUrl, selectedFolder ?? undefined);
      const raw = await jenkinsGet(url, config);
      const parsed = JenkinsJobsResponseSchema.safeParse(raw);
      if (!parsed.success) {
        console.error("Pipelines schema validation failed:", parsed.error);
        console.error("Raw response:", JSON.stringify(raw).slice(0, 500));
        throw new Error("Failed to parse pipelines response");
      }
      return parsed.data;
    },
    enabled: !!config,
    refetchInterval: POLLING_INTERVALS.BUILDS,
  });
}
