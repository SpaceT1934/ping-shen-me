import { useState, useRef, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commandSchema, type Command, type GardenState } from '@apple/contracts';
import { finishOperation } from '../lib/garden/request-operations';
import { gardenApi, initializeGarden } from '../lib/garden/garden-api';
import { createGardenView } from '../lib/garden/view-model';
import { ApiRequestError } from '../lib/api';
import { createUuid } from '../lib/uuid';
import { GardenContext } from './garden-context';
type PendingOperation = { fingerprint: string; operationId: string };
const pendingStorageKey = 'apple-pending-operation-v3';
function restorePending(): PendingOperation | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingStorageKey) || 'null');
    return value && typeof value.fingerprint === 'string' && typeof value.operationId === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}
function persistPending(value: PendingOperation | null) {
  try {
    if (value) sessionStorage.setItem(pendingStorageKey, JSON.stringify(value));
    else sessionStorage.removeItem(pendingStorageKey);
  } catch {
    /* 当前页面仍保留提交编号。 */
  }
}
export function GardenProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [error, setError] = useState('');
  const [initialPending] = useState(restorePending);
  const pending = useRef(initialPending);
  const [canRetry, setCanRetry] = useState(Boolean(initialPending));
  const query = useQuery({
    queryKey: ['garden'],
    queryFn: initializeGarden,
    staleTime: Infinity,
    retry: (count, cause) =>
      count < 3 && cause instanceof ApiRequestError && (cause.status === 0 || cause.status >= 500),
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });
  const mutation = useMutation({
    mutationFn: gardenApi.mutate,
    retry: (count, error) =>
      count < 1 && error instanceof ApiRequestError && (error.status === 0 || error.status >= 500),
    onSuccess: (response) => client.setQueryData(['garden'], response.state),
  });
  const execute = async (command: Command) => {
    setError('');
    const current = client.getQueryData<GardenState>(['garden']);
    if (!current) return null;
    const fingerprint = JSON.stringify(command);
    if (pending.current && pending.current.fingerprint !== fingerprint) {
      setError('上次提交结果还未确认，请先重试上次提交，再保存修改。');
      return null;
    }
    if (!pending.current) pending.current = { fingerprint, operationId: createUuid() };
    persistPending(pending.current);
    try {
      const result = await mutation.mutateAsync({
        operationId: pending.current.operationId,
        expectedVersion: current.version,
        command,
      });
      pending.current = null;
      persistPending(null);
      setCanRetry(false);
      return result;
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status >= 400 && cause.status < 500) {
        if (pending.current) finishOperation(pending.current.operationId);
        pending.current = null;
      }
      persistPending(pending.current);
      setCanRetry(Boolean(pending.current));
      setError(
        cause instanceof ApiRequestError && cause.details?.length
          ? `${cause.message}：${cause.details
              .slice(0, 3)
              .map((item) => item.message)
              .join('；')}`
          : cause instanceof Error
            ? cause.message
            : '保存失败，输入已保留',
      );
      if (cause instanceof ApiRequestError && cause.status === 409) {
        try {
          client.setQueryData(['garden'], await gardenApi.read());
        } catch {
          /* 保留旧数据和错误提示。 */
        }
      }
      return null;
    }
  };
  const retryPending = async () => {
    const previous = pending.current;
    if (!previous || mutation.isPending) return;
    try {
      const envelope = commandSchema.parse({
        command: JSON.parse(previous.fingerprint),
        operationId: previous.operationId,
        expectedVersion: query.data?.version || 0,
      });
      await mutation.mutateAsync(envelope);
      pending.current = null;
      persistPending(null);
      setCanRetry(false);
      setError('上次提交已确认保存。请先查看记录，再决定是否保存当前修改。');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '仍未确认保存结果，请重试。');
      if (cause instanceof ApiRequestError && cause.status >= 400 && cause.status < 500) {
        finishOperation(previous.operationId);
        pending.current = null;
        persistPending(null);
        setCanRetry(false);
      }
    }
  };
  if (!query.data)
    return (
      <div className="app-shell immersive-shell">
        <div className="connection-screen">
          <h1>正在打开你的小花园</h1>
          <p>
            {query.isError
              ? '服务暂时无法连接，你之前的记录仍保留着。'
              : '让每一份努力，都有地方安放。'}
          </p>
          {query.isError && (
            <button className="dark-button" onClick={() => void query.refetch()}>
              重新连接
            </button>
          )}
        </div>
      </div>
    );
  const state = query.data;
  const view = createGardenView(state);
  return (
    <GardenContext.Provider
      value={{
        ...view,
        state,
        results: state.results,
        hasStarted: state.onboardingCompleted,
        busy: mutation.isPending,
        startGarden: async () => Boolean(await execute({ type: 'onboard' })),
        addProject: async (name, goal, icon = 'green', category) => {
          const result = await execute({
            type: 'project.create',
            name,
            category,
            goal,
            icon,
            color: icon === 'book' ? 'blue' : icon === 'work' ? 'peach' : 'sage',
          });
          return result?.state.projects.find((project) => project.name === name)?.id || null;
        },
        editProject: async (id, name, icon, color, category) =>
          Boolean(await execute({ type: 'project.update', id, name, icon, color, category })),
        addProjects: async (projects) => {
          const previousIds = new Set(state.projects.map((project) => project.id));
          const result = await execute({ type: 'project.batch', projects });
          return (
            result?.state.projects
              .filter((project) => !previousIds.has(project.id))
              .map((project) => project.id) || null
          );
        },
        /* 单个项目与批量确认使用同一套业务命令。 */
        setProjectStatus: async (id, status) =>
          Boolean(await execute({ type: 'project.status', id, status })),
        toggleTask: async (id) =>
          (
            await execute({
              type: 'task.complete',
              id,
              completed: !view.tasks.find((item) => item.id === id)?.done,
            })
          )?.feedback || null,
        addTask: async (projectId, title, dueDate) =>
          Boolean(await execute({ type: 'task.create', projectId, title, dueDate })),
        editTask: async (id, title, dueDate) =>
          Boolean(await execute({ type: 'task.update', id, title, dueDate })),
        deleteTask: async (id) => Boolean(await execute({ type: 'task.delete', id })),
        saveEntries: async (items, rawText) =>
          (await execute({ type: 'records.save', items, rawText }))?.feedback || null,
        editEntry: async (id, content, projectId, recordType, date, contribution) =>
          Boolean(
            await execute({
              type: 'record.update',
              id,
              content,
              projectId,
              recordType,
              date,
              contribution,
            }),
          ),
        deleteEntry: async (id) => Boolean(await execute({ type: 'record.delete', id })),
        updateProgress: async (id, value) =>
          (
            await execute({
              type: 'goal.progress',
              id,
              value,
              manual: state.goals.find((item) => item.id === id)?.type === 'manual',
            })
          )?.feedback || null,
        createGoal: async (projectId, goal, replace) =>
          (await execute({ type: 'goal.create', projectId, goal, replace }))?.feedback || null,
        setPrimaryGoal: async (projectId, goalId) =>
          Boolean(await execute({ type: 'goal.primary', projectId, goalId })),
        setTreeThreshold: async (id, threshold) =>
          Boolean(await execute({ type: 'project.threshold', id, threshold })),
        harvestResult: async (id, followUp) =>
          Boolean(await execute({ type: 'result.harvest', id, followUp })),
      }}
    >
      {children}
      {error && (
        <div className="save-error" role="alert">
          <span>{error}</span>
          {canRetry && (
            <button disabled={mutation.isPending} onClick={() => void retryPending()}>
              重试上次提交
            </button>
          )}
          <button aria-label="关闭提示" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
    </GardenContext.Provider>
  );
}
