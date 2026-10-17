import { useQuery } from '@tanstack/react-query';
import { aiApi } from '../ai-api';
/** Read-only encouragement has an immediate fallback; it never holds up saving or navigation. */
export function useActionFeedback(version: number, enabled: boolean) {
  return useQuery({
    queryKey: ['action-feedback', version],
    queryFn: aiApi.feedback,
    enabled,
    staleTime: 600_000,
    retry: false,
  });
}
