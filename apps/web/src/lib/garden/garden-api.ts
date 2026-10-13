import { z } from 'zod';
import {
  gardenSchema,
  legacySchema,
  mutationResponseSchema,
  reportSchema,
  type CommandEnvelope,
  type GardenState,
} from '@apple/contracts';
import { apiRequest } from '../api';
export const gardenApi = {
  report: (period: string) =>
    apiRequest(`/reports?period=${encodeURIComponent(period)}`, reportSchema),
  read: () => apiRequest('/garden', gardenSchema),
  mutate: (envelope: CommandEnvelope) =>
    apiRequest('/garden/commands', mutationResponseSchema, {
      method: 'POST',
      body: JSON.stringify(envelope),
    }),
};
export async function initializeGarden(): Promise<GardenState> {
  const session = await apiRequest(
    '/session',
    z.object({ mode: z.literal('anonymous'), state: gardenSchema }),
    { method: 'POST', body: '{}' },
  );
  const state = session.state;
  if (state.version !== 0 || state.projects.length || state.onboardingCompleted) return state;
  // 单次迁移老版本数据，原始浏览器缓存保留，失败时不标记为已迁移。
  let legacy: z.infer<typeof legacySchema> | null = null;
  let onboardingCompleted: boolean;
  try {
    if (localStorage.getItem('apple-legacy-imported-v2') === 'true') return state;
    const parsed = legacySchema.safeParse(
      JSON.parse(localStorage.getItem('apple-ui-garden-v1') || 'null'),
    );
    if (parsed.success) legacy = parsed.data;
    onboardingCompleted = localStorage.getItem('apple-ui-onboarding-completed-v1') === 'true';
  } catch {
    return state;
  }
  if (!legacy) return state;
  const response = await gardenApi.mutate({
    operationId: crypto.randomUUID(),
    expectedVersion: state.version,
    command: { type: 'import.legacy', legacy, onboardingCompleted },
  });
  try {
    localStorage.setItem('apple-legacy-imported-v2', 'true');
  } catch {
    /* 后端非空检查同样防止重复迁移。 */
  }
  return response.state;
}
