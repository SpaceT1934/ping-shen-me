import {
  aiCapabilitiesSchema,
  projectAnalysisSchema,
  recordAnalysisSchema,
  reportSummarySchema,
  transcriptionSchema,
  actionFeedbackSchema,
  taskPlanSchema,
  emotionChatSchema,
  type EmotionMessage,
} from '@apple/contracts';
import { apiRequest } from './api';
export const aiApi = {
  emotions: (text: string, history: EmotionMessage[] = []) =>
    apiRequest(
      '/ai/emotions/respond',
      emotionChatSchema,
      { method: 'POST', body: JSON.stringify({ text, history }) },
      40_000,
    ),
  plan: (projectId: string, text: string) =>
    apiRequest(
      '/ai/tasks/plan',
      taskPlanSchema,
      { method: 'POST', body: JSON.stringify({ project_id: projectId, text }) },
      40_000,
    ),
  capabilities: async () => {
    const data = await apiRequest('/ai/capabilities', aiCapabilitiesSchema);
    return { aiConfigured: data.ai_configured, asrEnabled: data.asr_enabled };
  },
  projects: async (text: string) => {
    const data = await apiRequest(
      '/ai/projects/analyze',
      projectAnalysisSchema,
      { method: 'POST', body: JSON.stringify({ text }) },
      40_000,
    );
    return {
      candidates: data.candidates.map((item) => ({
        name: item.name,
        goalText: item.goal_text,
        sourceText: item.source_text,
        category: item.category,
      })),
    };
  },
  records: async (text: string, source: 'text' | 'voice' = 'text') => {
    const data = await apiRequest(
      '/ai/records/analyze',
      recordAnalysisSchema,
      { method: 'POST', body: JSON.stringify({ text, source }) },
      40_000,
    );
    return {
      emotionText: data.emotion_text,
      items: data.items.map((item) => ({
        key: item.client_item_id,
        content: item.content,
        type: item.type,
        projectId: item.project_id,
        goalId: item.goal_id,
        sourceText: item.source_text,
        emotion: item.emotion,
        source,
      })),
    };
  },
  summarize: (period: '7天' | '30天' | '本月' | '全部') =>
    apiRequest(
      '/ai/reports/summarize',
      reportSummarySchema,
      { method: 'POST', body: JSON.stringify({ period }) },
      40_000,
    ),
  feedback: () =>
    apiRequest('/ai/feedback', actionFeedbackSchema, { method: 'POST', body: '{}' }, 40_000),
  transcribe: (audioBase64: string, mimeType: string) =>
    apiRequest(
      '/asr/transcribe',
      transcriptionSchema,
      { method: 'POST', body: JSON.stringify({ audio_base64: audioBase64, mime_type: mimeType }) },
      40_000,
    ),
};
