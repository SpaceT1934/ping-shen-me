import type { GardenState } from '@apple/contracts';
import { sql } from 'drizzle-orm';
import {
  jsonb,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const projectStatus = pgEnum('project_status', ['active', 'completed', 'archived']);
export const goalType = pgEnum('goal_type', ['count', 'manual', 'percentage']);
export const goalStatus = pgEnum('goal_status', ['active', 'completed', 'archived']);
export const taskStatus = pgEnum('task_status', ['pending', 'completed']);
export const recordType = pgEnum('record_type', ['action', 'idea', 'goal']);
export const recordSource = pgEnum('record_source', ['text', 'voice', 'task_complete']);

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    status: projectStatus('status').default('active').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('projects_user_idx').on(table.userId)],
);

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id)
      .notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    type: goalType('type').notNull(),
    status: goalStatus('status').default('active').notNull(),
    unit: varchar('unit', { length: 30 }),
    targetValue: numeric('target_value', { precision: 12, scale: 2 }),
    currentValue: numeric('current_value', { precision: 12, scale: 2 }).default('0').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('goals_project_idx').on(table.projectId),
    check('goals_current_nonnegative', sql`${table.currentValue} >= 0`),
    check('goals_target_positive', sql`${table.targetValue} is null or ${table.targetValue} > 0`),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id)
      .notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    status: taskStatus('status').default('pending').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('tasks_project_idx').on(table.projectId)],
);

// Task、Goal 独立存储；统一记录只保存 Action 和 Idea，避免重复的事实来源。
export const records = pgTable(
  'records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    projectId: uuid('project_id').references(() => projects.id),
    type: recordType('type').notNull(),
    content: text('content').notNull(),
    source: recordSource('source').notNull(),
    sourceText: text('source_text'),
    emotion: varchar('emotion', { length: 100 }),
    sourceTaskId: uuid('source_task_id').references(() => tasks.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('records_user_occurred_idx').on(table.userId, table.occurredAt),
    index('records_project_idx').on(table.projectId),
    uniqueIndex('records_source_task_unique').on(table.sourceTaskId),
  ],
);

export const growthStates = pgTable(
  'growth_states',
  {
    projectId: uuid('project_id')
      .references(() => projects.id)
      .primaryKey(),
    actionCount: integer('action_count').default(0).notNull(),
    stage: integer('stage').default(0).notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [check('growth_count_nonnegative', sql`${table.actionCount} >= 0`)],
);

export const growthEvents = pgTable(
  'growth_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id)
      .notNull(),
    actionId: uuid('action_id')
      .references(() => records.id)
      .notNull(),
    beforeCount: integer('before_count').notNull(),
    afterCount: integer('after_count').notNull(),
    beforeStage: integer('before_stage').notNull(),
    afterStage: integer('after_stage').notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('growth_events_action_unique').on(table.actionId)],
);

export const results = pgTable(
  'results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id)
      .notNull(),
    goalId: uuid('goal_id')
      .references(() => goals.id)
      .notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    harvestedAt: timestamp('harvested_at', { withTimezone: true }),
    actionCount: integer('action_count').notNull(),
    ideaCount: integer('idea_count').notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('results_goal_unique').on(table.goalId)],
);

// 手动 V1 采用每用户聚合快照，跨任务、行动、成长和成果的变更一次提交。
// 既有实体表保留供后续细粒度查询投影；当前业务不同时维护两份事实来源。
export const gardenSnapshots = pgTable('garden_snapshots', {
  userId: uuid('user_id')
    .references(() => users.id)
    .primaryKey(),
  state: jsonb('state').$type<GardenState>().notNull(),
  updatedAt: updatedAt(),
});
export const webSessions = pgTable('web_sessions', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// Durable HTTP operation results, independent of the legacy 500-command cache.
export const apiOperations = pgTable(
  'api_operations',
  {
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    key: varchar('key', { length: 200 }).notNull(),
    fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
    response: jsonb('response').notNull(),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })],
);

// Identity guards provide DB uniqueness for entities persisted in snapshots.
export const entityLinks = pgTable(
  'garden_entity_links',
  {
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    kind: varchar('kind', { length: 30 }).notNull(),
    sourceId: varchar('source_id', { length: 100 }).notNull(),
    targetId: varchar('target_id', { length: 100 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.kind, table.sourceId] })],
);
