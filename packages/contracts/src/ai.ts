import { z } from 'zod';

export const aiCapabilitiesSchema = z.object({
  ai_configured: z.boolean(),
  asr_enabled: z.boolean(),
});
export const projectAnalysisInputSchema = z.object({ text: z.string().trim().min(1).max(300) });
export const recordAnalysisInputSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  source: z.enum(['text', 'voice']).default('text'),
});
export const projectAnalysisSchema = z.object({
  candidates: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        goal_text: z.string().trim().min(1).max(200).nullable(),
        source_text: z.string().min(1).max(300),
      }),
    )
    .max(20),
});
export const recordAnalysisSchema = z.object({
  items: z
    .array(
      z.object({
        content: z.string().trim().min(1).max(2000),
        type: z.enum(['action', 'task', 'idea', 'goal']),
        client_item_id: z.string().min(1).max(100),
        project_id: z.string().min(1).max(100).nullable(),
        emotion: z.string().max(100).nullable(),
        source_text: z.string().min(1).max(2000),
      }),
    )
    .max(50),
});
export const reportSummaryInputSchema = z.object({
  period: z.enum(['7天', '30天', '本月', '全部']),
});
export const reportSummarySchema = z.object({ summary: z.string().trim().min(1).max(240) });
export const transcriptionInputSchema = z.object({
  audio_base64: z.string().min(4).max(6990508),
  mime_type: z.enum(['audio/wav', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/flac']),
});
export const transcriptionSchema = z.object({ text: z.string().trim().min(1).max(2000) });
export type ProjectCandidate = { name: string; goalText: string | null; sourceText: string };
