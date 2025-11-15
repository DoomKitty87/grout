import { ExternalLink } from '@tamagui/lucide-icons'
import { Anchor, H2, H4, Input, Label, Paragraph, Popover, XStack, YStack, Button, ScrollView } from 'tamagui'
import { ToastControl } from 'components/CurrentToast'
import { useSQLiteContext } from 'expo-sqlite'
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

export default function TabOneScreen() {
  const db = useSQLiteContext()

  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    async function fetchTasks() {
      const result = await db.getAllAsync<Task>(`SELECT * FROM tasks;`);
      setTasks(result);
    }
    fetchTasks();
  }, [])

  const [newTaskTitle, setNewTaskTitle] = useState('');

  return (
    <YStack flex={1} items="center" gap="$8" px="$10" pt="$5" bg="$background">
      <H2>home page</H2>

      <Popover>
        <Popover.Trigger asChild>
          <Button>Add Task</Button>
        </Popover.Trigger>
        <Popover.Content>
          <YStack>
            <XStack>
              <Label htmlFor="title">Title:</Label>
              <Input id="title" placeholder="Task title" value={newTaskTitle} onChangeText={setNewTaskTitle} />
            </XStack>

            <Popover.Close asChild>
              <Button onPress={async () => {
                const statement = await db.prepareAsync(`
                  INSERT INTO tasks (title, category, priority, completed)
                  VALUES (?, ?, ?, 0);
                `);
                const taskName = newTaskTitle;
                await statement.executeAsync([taskName, 'General', 1]);
                await statement.finalizeAsync();
                tasks.push({
                  id: tasks.length + 1,
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
              }}>
                Add
              </Button>
            </Popover.Close>
          </YStack>
        </Popover.Content>
      </Popover>

      <H4>Database Preview:</H4>
      <ScrollView>
      {tasks.map(task => (
        <Paragraph key={task.id}>
          {task.title} (Category: {task.category}, Priority: {task.priority}, Completed: {task.completed ? 'Yes' : 'No'})
        </Paragraph>
      ))}
      </ScrollView>
    </YStack>
  )
}
