import { useQuery } from '@tanstack/react-query';
import { jenkinsGetText } from '../../../api/jenkins-client';
import { useConnectionStore } from '../../../store/connection-store';

function jobPathToJenkinsUrl(baseUrl: string, jobPath: string, build: number): string {
  const segments = jobPath.split('/');
  const jenkinsPath = segments.map((s) => `job/${encodeURIComponent(s)}`).join('/');
  return `${baseUrl}/${jenkinsPath}/${build}/consoleText`;
}

export function useBuildLog(jobPath: string, build: number) {
  const config = useConnectionStore((s) => s.config);

  return useQuery({
    queryKey: ['build-log', jobPath, build],
    queryFn: async () => {
      if (!config) throw new Error('No Jenkins connection configured');
      const url = jobPathToJenkinsUrl(config.baseUrl, jobPath, build);
      return jenkinsGetText(url, config);
    },
    enabled: !!config && !!jobPath,
    staleTime: Infinity,
  });
}
