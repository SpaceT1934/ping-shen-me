import { z } from 'zod';
export const projectCategorySchema = z.enum([
  '工作事业',
  '学习成长',
  '健康运动',
  '生活习惯',
  '兴趣爱好',
  '其他',
]);

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
        category: projectCategorySchema.default('其他'),
      }),
    )
    .max(20),
});
export const recordAnalysisSchema = z.object({
  emotion_text: z.string().trim().min(1).max(2000).nullable().default(null),
  items: z
    .array(
      z.object({
        content: z.string().trim().min(1).max(2000),
        type: z.enum(['action', 'task', 'idea', 'goal']),
        client_item_id: z.string().min(1).max(100),
        project_id: z.string().min(1).max(100).nullable(),
        goal_id: z.string().min(1).max(100).nullable().default(null),
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
export type ProjectCandidate = {
  name: string;
  goalText: string | null;
  sourceText: string;
  category?: string;
};

export const actionFeedbackSchema = z.object({ text: z.string().trim().min(1).max(60) });
export const taskPlanInputSchema = z.object({
  project_id: z.string().min(1).max(100),
  text: z.string().trim().min(1).max(200),
});
export const taskPlanSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(80),
        description: z.string().trim().min(1).max(110),
      }),
    )
    .min(1)
    .max(6),
});

export const emotionMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(2000),
});
export const emotionChatInputSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  history: z.array(emotionMessageSchema).max(10).default([]),
});
export const emotionReplySchema = z.object({
  reply: z.string().trim().min(1).max(600),
  referenced_action_ids: z.array(z.string().min(1).max(100)).max(6),
});
export const emotionChatSchema = emotionReplySchema.extend({
  mode: z.enum(['ai', 'fallback']),
  today: z.object({
    date: z.iso.date(),
    action_count: z.number().int().nonnegative(),
    actions: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          content: z.string().min(1).max(2000),
          project_name: z.string().max(200).nullable(),
        }),
      )
      .max(6),
  }),
});
export type EmotionMessage = z.infer<typeof emotionMessageSchema>;
export type EmotionChat = z.infer<typeof emotionChatSchema>;
