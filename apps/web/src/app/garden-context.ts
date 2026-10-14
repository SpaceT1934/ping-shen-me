import { createContext, useContext } from 'react';
import type { GardenState, GoalInput, ManualDraft, Feedback, Command } from '@apple/contracts';
import type { SpriteName } from '../components/PixelIcon';
import type { createGardenView } from '../lib/garden/view-model';
type GardenView = ReturnType<typeof createGardenView>;
type Context = GardenView & {
  state: GardenState;
  results: GardenState['results'];
  hasStarted: boolean;
  busy: boolean;
  startGarden: () => Promise<boolean>;
  addProject: (name: string, goal: GoalInput | null, icon?: SpriteName) => Promise<string | null>;
  addProjects: (
    projects: Extract<Command, { type: 'project.batch' }>['projects'],
  ) => Promise<boolean>;
  editProject: (
    id: string,
    name: string,
    icon: SpriteName,
    color: 'sage' | 'blue' | 'gold' | 'peach',
  ) => Promise<boolean>;
  setProjectStatus: (id: string, status: 'active' | 'completed' | 'archived') => Promise<boolean>;
  toggleTask: (id: string) => Promise<Feedback | null>;
  addTask: (projectId: string, title: string, dueDate: string | null) => Promise<boolean>;
  editTask: (id: string, title: string, dueDate: string | null) => Promise<boolean>;
  deleteTask: (id: string) => Promise<boolean>;
  saveEntries: (items: ManualDraft[], rawText?: string) => Promise<Feedback | null>;
  editEntry: (
    id: string,
    content: string,
    projectId: string | null,
    type: 'action' | 'idea' | 'goal',
    date: string,
    contribution: number,
  ) => Promise<boolean>;
  deleteEntry: (id: string) => Promise<boolean>;
  updateProgress: (goalId: string, value: number) => Promise<Feedback | null>;
  createGoal: (projectId: string, goal: GoalInput, replace: boolean) => Promise<Feedback | null>;
  harvestResult: (id: string, followUp: 'continue' | 'complete' | 'next_goal') => Promise<boolean>;
};
export const GardenContext = createContext<Context | null>(null);
export function useGarden() {
  const value = useContext(GardenContext);
  if (!value) throw new Error('GardenProvider missing');
  return value;
}
