import { useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Command, GardenState } from '@apple/contracts';
import { gardenApi, initializeGarden } from '../lib/garden/garden-api';
import { createGardenView } from '../lib/garden/view-model';
import { ApiRequestError } from '../lib/api';
import { createUuid } from '../lib/uuid';
import { GardenContext } from './garden-context';
export function GardenProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [error, setError] = useState('');
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
    try {
      return await mutation.mutateAsync({
        operationId: createUuid(),
        expectedVersion: current.version,
        command,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，输入已保留');
      if (cause instanceof ApiRequestError && cause.code === 'VERSION_CONFLICT') {
        try {
          client.setQueryData(['garden'], await gardenApi.read());
        } catch {
          /* 保留旧数据和错误提示。 */
        }
      }
      return null;
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
        addProject: async (name, goal, icon = 'green') => {
          const result = await execute({
            type: 'project.create',
            name,
            goal,
            icon,
            color: icon === 'book' ? 'blue' : icon === 'work' ? 'peach' : 'sage',
          });
          return result?.state.projects.at(-1)?.id || null;
        },
        editProject: async (id, name, icon, color) =>
          Boolean(await execute({ type: 'project.update', id, name, icon, color })),
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
        saveEntries: async (items) =>
          (await execute({ type: 'records.save', items }))?.feedback || null,
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
          (await execute({ type: 'goal.progress', id, value }))?.feedback || null,
        createGoal: async (projectId, goal, replace) =>
          (await execute({ type: 'goal.create', projectId, goal, replace }))?.feedback || null,
        harvestResult: async (id, followUp) =>
          Boolean(await execute({ type: 'result.harvest', id, followUp })),
      }}
    >
      {children}
      {error && (
        <div className="save-error" role="alert">
          <span>{error}</span>
          <button aria-label="关闭提示" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
    </GardenContext.Provider>
  );
}
