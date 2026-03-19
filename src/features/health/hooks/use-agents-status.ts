import { useQuery } from '@tanstack/react-query';
import { jenkinsGet } from '../../../api/jenkins-client';
import { agentsUrl } from '../../../api/jenkins-endpoints';
import { JenkinsComputerSetSchema } from '../../../api/types/jenkins-api';
import { useConnectionStore } from '../../../store/connection-store';
import { POLLING_INTERVALS } from '../../../config/constants';

export function useAgentsStatus() {
  const config = useConnectionStore((s) => s.config);

  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      if (!config) throw new Error('No Jenkins connection configured');
      const url = agentsUrl(config.baseUrl);
      const raw = await jenkinsGet(url, config);
      const parsed = JenkinsComputerSetSchema.safeParse(raw);
      if (!parsed.success) {
        console.error('Agents schema validation failed:', parsed.error);
        console.error('Raw response:', JSON.stringify(raw).slice(0, 500));
        throw new Error('Failed to parse agents response');
      }
      return parsed.data;
    },
    enabled: !!config,
    refetchInterval: POLLING_INTERVALS.AGENTS,
  });
}
