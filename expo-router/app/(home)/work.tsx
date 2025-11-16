import { ExternalLink } from '@tamagui/lucide-icons'
import { Anchor, H2, H4, Input, Label, Paragraph, Popover, XStack, YStack, Button, ScrollView } from 'tamagui'
import { ToastControl } from 'components/CurrentToast'
import { useSQLiteContext, SQLiteDatabase } from 'expo-sqlite'
import { useState, useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router';

interface Task {
  id: number;
  title: string;
  completed: number;
  created_at: string;
  completed_at: string | null;
  time_spent: number;
  estimated_time: number;
  embedding?: number[];
}

export default function WorkScreen() {
  const db = useSQLiteContext()
  const router = useRouter();
  const availableTime = useLocalSearchParams().time ? parseInt(useLocalSearchParams().time as string) : 0;
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    async function fetchTasks() {
      const tasksToDo = await pickTasksToDo(db, availableTime)
      setTasks(tasksToDo);
    }
    fetchTasks();
  }, [])
  const [lastFinishedTime, setLastFinishedTime] = useState(Date.now());
  return (
    <YStack flex={1} items="center" gap="$8" px="$8" pt="$15" pb="$8" bg="$background">
      <H2>work page</H2>
      <ScrollView>
        <YStack gap="$4" pb="$10">
          {tasks.map((task) => (
            <Button key={task.id} onPress={() => {
              const now = Date.now();
              const elapsedMinutes = Math.floor((now - lastFinishedTime) / 60000);
              const timeToLog = Math.min(elapsedMinutes, (task as any).estimatedTime ? (task as any).estimatedTime : 0);
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
          const timeToLog = Math.min(elapsedMinutes, (task as any).estimatedTime ? (task as any).estimatedTime : 0);
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

async function pickTasksToDo(db: SQLiteDatabase, availableTime: number): Promise<Task[]> {
  // Temporary function to just return all unfinished tasks
  // return db.getAllSync<Task>(`SELECT * FROM tasks WHERE completed = 0;`);

  const tasks = db.getAllSync<Task>(`SELECT * FROM tasks WHERE completed = 0;`);

  const toWorkOn: Task[] = [];
  let timeLeft = availableTime;

  tasks.sort((a, b) => {
    return a.estimated_time - b.estimated_time;
  });

  // TODO: Implement algorithms that people can choose (read settings)

  for (const task of tasks) {
    const estimatedTime = task.estimated_time;
    if (estimatedTime <= timeLeft) {
      toWorkOn.push(task);
      timeLeft -= estimatedTime;
    }
  }

  return toWorkOn;
}