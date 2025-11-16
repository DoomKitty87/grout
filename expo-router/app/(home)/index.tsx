import { Check, ExternalLink, Plus, Trash } from '@tamagui/lucide-icons'
import { Anchor, H2, H4, Input, Label, Paragraph, Popover, XStack, YStack, Button, ScrollView, H5, Select } from 'tamagui'
import { SQLiteDatabase, useSQLiteContext } from 'expo-sqlite'
import { useState, useEffect } from 'react'

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

export default function HomeScreen() {
  const db = useSQLiteContext()

  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    async function fetchTasks() {
      const result = await db.getAllAsync<Task>(`SELECT * FROM tasks WHERE completed = 0;`);
      setTasks(result);
    }
    fetchTasks();
  }, [])

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('General');

  return (
    <YStack flex={1} items="center" gap="$8" px="$10" pt="$5" bg="$background">
      <H2>home page</H2>

      <XStack>
        <Input placeholder='Task' value={newTaskTitle} onChangeText={setNewTaskTitle}></Input>
        <Select value={newTaskCategory} onValueChange={setNewTaskCategory}>
          <Select.Trigger maxWidth={100} maxHeight={40}>
            <Select.Value placeholder="Category" />
          </Select.Trigger>
          
          <Select.Content zIndex={20000}>
            <Select.Viewport>
              <Select.Group maxWidth={100} left={-100}>
                <Select.Item value="General" index={0}>
                  <Select.ItemText>General</Select.ItemText>
                </Select.Item>
                <Select.Item value="Work" index={1}>
                  <Select.ItemText>Work</Select.ItemText>
                </Select.Item>
                <Select.Item value="Personal" index={2}>
                  <Select.ItemText>Personal</Select.ItemText>
                </Select.Item>
              </Select.Group>
            </Select.Viewport>
          </Select.Content>
        </Select>
        <Button onPress={async () => {
          const statement = await db.prepareAsync(`
            INSERT INTO tasks (title, category, priority, completed)
            VALUES (?, ?, ?, 0);
          `);
          const taskName = newTaskTitle;
          if (taskName.trim() === '') {
            return;
          }
          await statement.executeAsync([taskName, 'General', 1]);
          const result = await db.getAllAsync<Task>(`SELECT * FROM tasks WHERE title = ? ORDER BY id DESC LIMIT 1;`, [taskName]);
          await statement.finalizeAsync();
          tasks.push({
            id: result[0].id,
            title: taskName,
            category: 'General',
            priority: 1,
            due_date: null,
            completed: 0,
            created_at: new Date().toISOString(),
            completed_at: null,
            time_spent: 0
          });
          setTasks([...tasks]);
          setNewTaskTitle('');}}>
          <Plus />
        </Button>
      </XStack>

      <H4>Database Preview:</H4>
      <ScrollView>
          <YStack gap={10}>
          {tasks.map(task => (
            <XStack key={task.id} width="100%" justify="space-between">
              <H5>{task.title}</H5>
              <Button ml="$4" onPress={async () => {
                const statement = await db.prepareAsync(`
                  DELETE FROM tasks WHERE id = ?;
                `);
                await statement.executeAsync([task.id]);
                await statement.finalizeAsync();
                setTasks(tasks.filter(t => t.id !== task.id));
              }}>
                <Trash />
              </Button>
            </XStack>
          ))}
          </YStack>
      </ScrollView>
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

    const estimatedTime = count > 0 ? totalTime / count : (DEFAULT_ESTIMATE * 60);
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