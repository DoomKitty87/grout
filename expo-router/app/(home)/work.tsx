import { ExternalLink } from '@tamagui/lucide-icons'
import { Anchor, H2, H4, Input, Label, Paragraph, Popover, XStack, YStack, Button, ScrollView } from 'tamagui'
import { ToastControl } from 'components/CurrentToast'
import { useSQLiteContext, SQLiteDatabase } from 'expo-sqlite'
import { useState, useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router';

interface Task {
  id: number;
  title: string;
  category: string;
  priority: number;
  due_date: string | null;
  completed: number;
  created_at: string;
  completed_at: string | null;
  time_spent: number;
}

export default function WorkScreen() {
  const db = useSQLiteContext()
  const router = useRouter();
  const availableTime = useLocalSearchParams().time ? parseInt(useLocalSearchParams().time as string) : 0;
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    async function fetchTasks() {
      setTasks(pickTasksToDo(db, availableTime));
    }
    fetchTasks();
  }, [])
  const [lastFinishedTime, setLastFinishedTime] = useState(Date.now());
  return (
    <YStack flex={1} items="center" gap="$8" px="$10" pt="$5" bg="$background">
      <H2>work page</H2>
      <ScrollView>
        <YStack gap="$4" pb="$10">
          {tasks.map((task) => (
            <Button key={task.id} onPress={() => {
              const now = Date.now();
              const elapsedMinutes = Math.floor((now - lastFinishedTime) / 60000);
              const timeToLog = Math.min(elapsedMinutes, (task as any).estimatedTime);
              db.execSync(`
                UPDATE tasks
                SET time_spent = time_spent + ${timeToLog},
                completed = 1,
                completed_at = CURRENT_TIMESTAMP
                WHERE id = ${task.id};
              `);
              setLastFinishedTime(now);
              setTasks(tasks.filter(t => t.id !== task.id));
            }}>
              <H4 key={task.id}>{task.title} - Estimated time: {Math.ceil((task as any).estimatedTime)} mins</H4>
            </Button>
          ))}
        </YStack>
      </ScrollView>
      <Button onPress={() => {
        if (tasks.length > 0) {
          const now = Date.now();
          const elapsedMinutes = Math.floor((now - lastFinishedTime) / 60000);
          const task = tasks[0];
          const timeToLog = Math.min(elapsedMinutes, (task as any).estimatedTime);
          db.execSync(`
            UPDATE tasks
            SET time_spent = time_spent + ${timeToLog}
            WHERE id = ${task.id};
          `);
          setLastFinishedTime(now);
        }
        router.back()
        router.back()
      }}>End Session</Button>
    </YStack>
  )
}

function levenshtein (a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) {
    return bn;
  }
  if (bn === 0) {
    return an;
  }

  a = a.toLowerCase().replace(' ', '');
  b = b.toLowerCase().replace(' ', '');

  const matrix = new Array<number[]>(bn + 1);
  for (let i = 0; i <= bn; ++i) {
    const row = new Array<number>(an + 1);
    row[0] = i;
    matrix[i] = row;
  }
  for (let j = 0; j <= an; ++j) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      const deletion = matrix[i - 1][j] + 1;
      const insertion = matrix[i][j - 1] + 1;
      const substitution = matrix[i - 1][j - 1] + cost;
      matrix[i][j] = Math.min(deletion, insertion, substitution);
    }
  }
  return matrix[bn][an];
}

function getUnfinishedTasks(db: SQLiteDatabase): [Task[], number[]] {
  const ESTIMATION_SAMPLES = 5;
  const DEFAULT_ESTIMATE = 30; // in minutes

  const completedTasks = db.getAllSync<Task>(`SELECT * FROM tasks WHERE completed = 1;`);
  const uncompletedTasks = db.getAllSync<Task>(`SELECT * FROM tasks WHERE completed = 0;`);
  const estimates: number[] = []
  for (const task of uncompletedTasks) {
    const distances: { distance: number; time_spent: number }[] = [];
    for (const completedTask of completedTasks) {
      const distance = levenshtein(task.title, completedTask.title);
      distances.push({ distance, time_spent: completedTask.time_spent });
    }

    distances.sort((a, b) => a.distance - b.distance);

    let totalTime = 0;
    let count = 0;
    for (let i = 0; i < Math.min(ESTIMATION_SAMPLES, distances.length); i++) {
      totalTime += distances[i].time_spent;
      count++;
    }

    const estimatedTime = count > 0 ? totalTime / count : DEFAULT_ESTIMATE;
    estimates.push(estimatedTime);
  }

  return [uncompletedTasks, estimates];
}

function pickTasksToDo(db: SQLiteDatabase, availableTime: number): Task[] {
  const [unfinishedTasks, estimates] = getUnfinishedTasks(db);

  const categoryPriorities: { [category: string]: number } = {
    'Work': 3,
    'Personal': 2,
    'General': 1,
  }; // Placeholder category priorities (fetch from settings)

  const toWorkOn: Task[] = [];
  let timeLeft = availableTime;

  unfinishedTasks.forEach((task, index) => {
    const estimatedTime = estimates[index];
    const categoryPriority = categoryPriorities[task.category] || 0;
    (task as any).estimatedTime = estimatedTime;
    (task as any).categoryPriority = categoryPriority;
  });

  unfinishedTasks.sort((a, b) => {
    const priorityDiff = (b as any).categoryPriority - (a as any).categoryPriority;
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    const due_dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const due_dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return due_dateA - due_dateB;
  });

  for (const task of unfinishedTasks) {
    const estimatedTime = (task as any).estimatedTime;
    if (estimatedTime <= timeLeft) {
      toWorkOn.push(task);
      timeLeft -= estimatedTime;
    }
  }

  return toWorkOn;
}