import { ExternalLink, Plus, Trash } from '@tamagui/lucide-icons'
import { Anchor, H2, H4, Input, Label, Paragraph, Popover, XStack, YStack, Button, ScrollView, H5 } from 'tamagui'
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

      <XStack>
        <Input placeholder='Task' value={newTaskTitle} onChangeText={setNewTaskTitle}></Input>
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
