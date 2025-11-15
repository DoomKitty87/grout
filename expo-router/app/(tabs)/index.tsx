import { ExternalLink } from '@tamagui/lucide-icons'
import { Anchor, H2, H4, Input, Label, Paragraph, Popover, XStack, YStack, Button } from 'tamagui'
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

  return (
    <YStack flex={1} items="center" gap="$8" px="$10" pt="$5" bg="$background">
      <H2>Tamagui + Expo</H2>

      <ToastControl />

      <H4>Database Preview:</H4>
      {tasks.map(task => (
        <Paragraph key={task.id}>
          {task.id}: {task.title} (Category: {task.category}, Priority: {task.priority}, Completed: {task.completed ? 'Yes' : 'No'})
        </Paragraph>
      ))}

      <Popover>
        <Popover.Trigger asChild>
          <Button>Add Task</Button>
        </Popover.Trigger>
        <Popover.Content>
          <YStack>
            <XStack>
              <Label htmlFor="title">Title:</Label>
              <Input id="title" placeholder="Task title" />
            </XStack>

            <Popover.Close asChild>
              <Button onPress={async () => {
                const statement = await db.prepareAsync(`
                  INSERT INTO tasks (title, category, priority, completed)
                  VALUES (?, ?, ?, 0);
                `);
                await statement.executeAsync(['New Task', 'General', 1]);
                await statement.finalizeAsync();
              }}>
                Add
              </Button>
            </Popover.Close>
          </YStack>
        </Popover.Content>
      </Popover>

      <XStack
        items="center"
        justify="center"
        flexWrap="wrap"
        gap="$1.5"
        position="absolute"
        b="$8"
      >
        <Paragraph fontSize="$5">Add</Paragraph>

        <Paragraph fontSize="$5" px="$2" py="$1" color="$blue10" bg="$blue5">
          tamagui.config.ts
        </Paragraph>

        <Paragraph fontSize="$5">to root and follow the</Paragraph>

        <XStack
          items="center"
          gap="$1.5"
          px="$2"
          py="$1"
          rounded="$3"
          bg="$green5"
          hoverStyle={{ bg: '$green6' }}
          pressStyle={{ bg: '$green4' }}
        >
          <Anchor
            href="https://tamagui.dev/docs/core/configuration"
            textDecorationLine="none"
            color="$green10"
            fontSize="$5"
          >
            Configuration guide
          </Anchor>
          <ExternalLink size="$1" color="$green10" />
        </XStack>

        <Paragraph fontSize="$5" text="center">
          to configure your themes and tokens.
        </Paragraph>
      </XStack>
    </YStack>
  )
}
