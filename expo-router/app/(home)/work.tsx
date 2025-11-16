import { Check, StopCircle } from '@tamagui/lucide-icons'
import { Spacer, Separator, Text, Anchor, H2, H4, Input, Label, Paragraph, Popover, XStack, YStack, Button, ScrollView, Checkbox } from 'tamagui'
import { ToastControl } from 'components/CurrentToast'
import { useSQLiteContext, SQLiteDatabase } from 'expo-sqlite'
import { useState, useEffect, useMemo } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import Reanimated, {
  useSharedValue,
  SharedValue,
  useAnimatedStyle,
  withSpring,
  useAnimatedRef,
} from 'react-native-reanimated'
import Animated from 'react-native-reanimated'

interface Task {
  id: number;
  title: string;
  completed: number;
  created_at: string;
  completed_at: string | null;
  time_spent: number;
  estimated_time: number;
  embedding?: string;
}

export default function WorkScreen() {
  const db = useSQLiteContext()
  const router = useRouter();
  const availableTime = useLocalSearchParams().time ? parseInt(useLocalSearchParams().time as string) : 0;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [additionalTasksBuffer, setAdditionalTasksBuffer] = useState<Task[]>([]);

  const [sessionStart, setSessionStart] = useState(0);
  const [lastFinishedTime, setLastFinishedTime] = useState(Date.now());

  useEffect(() => {
    async function fetchTasks() {
      const [tasksToDo, additionalTasksBuffer] = await pickTasksToDo(db, availableTime)
      setTasks(tasksToDo);
      setAdditionalTasksBuffer(additionalTasksBuffer);
    }
    fetchTasks();
    setSessionStart(Date.now());
  }, [])

  function handleTaskComplete(task) {
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
    if (tasks.length === 0) {
      if (additionalTasksBuffer.length > 0) {
        const nextTask = additionalTasksBuffer[0];
        setTasks([nextTask]);
        setAdditionalTasksBuffer(additionalTasksBuffer.slice(1));
      }
    }
  }

  return (
    <>
    <YStack flex={1} items="center" gap={0} pt="$13" pb="$8" bg="$background">
      <Countdown startTime={sessionStart} availableTimeMin={availableTime} currentTime={Date.now()}/>
      <Spacer />
      <Spacer />
      <XStack px="$5">
        <Button icon={StopCircle} size="$5" grow={1} onPress={() => {
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
        }}>
          End Session
        </Button>
      </XStack>
      <Spacer />
      <Spacer />
      <XStack px="$5">
        <Separator alignSelf="stretch"/>
      </XStack>
      <Spacer />
      <Spacer />
      <ScrollView width="100%">
        <YStack gap={0} pb="$10">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} onTaskComplete={handleTaskComplete}></TaskItem>
          ))}
        </YStack>
      </ScrollView>
    </YStack>
    </>
  )
}

function Countdown({ startTime, availableTimeMin }: { startTime: number, availableTimeMin: number }) {
  const numSize = 75;
  const endTime = useMemo(() => startTime + availableTimeMin * 60 * 1000, [startTime, availableTimeMin]);

  const [timeRemaining, setTimeRemaining] = useState(() => Math.max(endTime - Date.now(), 0));

  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  useEffect(() => {
    setTimeRemaining(Math.max(endTime - Date.now(), 0));

    const interval = setInterval(() => {
      const timeLeft = Math.max(endTime - Date.now(), 0);
      setTimeRemaining(timeLeft);
      if (timeLeft === 0) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <XStack height={numSize} width="100%" justify="center" items="center">
      <H2 fontVariant="tabular-nums">
        {hours.toString().padStart(2, "0")} : {minutes.toString().padStart(2, "0")} : {seconds.toString().padStart(2, "0")}
      </H2>
    </XStack>
  );
}

function TaskItem({task, onTaskComplete}) { 

  function handleTaskComplete() {
    onTaskComplete(task);
  }

  return (
    <Button 
      key={task.id} 
      backgroundColor="$color1" 
      borderRadius={0}
      px="$7"
      onPress={handleTaskComplete}
    >
      <Checkbox>
        <Checkbox.Indicator>
          <Check />
        </Checkbox.Indicator>
      </Checkbox>
      <XStack width="100%" justify="space-between">
        <Text>{task.title}</Text>
      </XStack>
    </Button>
  )
}

function sortTaskList(tasks: Task[], method: string): Task[] {
  switch (method) {
    case 'largest':
      return tasks.sort((a, b) => b.estimated_time - a.estimated_time);
    case 'smallest':
      return tasks.sort((a, b) => a.estimated_time - b.estimated_time);
    default:
      return tasks;
  }
}

async function pickTasksToDo(db: SQLiteDatabase, availableTime: number): Promise<[Task[], Task[]]> {
  // Temporary function to just return all unfinished tasks
  // return db.getAllSync<Task>(`SELECT * FROM tasks WHERE completed = 0;`);

  const tasks = db.getAllSync<Task>(`SELECT * FROM tasks WHERE completed = 0;`);

  const organizeByMethod = await AsyncStorage.getItem('organizeBy') || '';
  const addByMethod = await AsyncStorage.getItem('addBy') || '';
  const toWorkOn: Task[] = [];
  const tasksSorted = sortTaskList(tasks, organizeByMethod);
  let timeLeft = availableTime;
  for (const task of tasksSorted) {
    const estimatedTime = task.estimated_time;
    if (estimatedTime <= timeLeft) {
      toWorkOn.push(task);
      timeLeft -= estimatedTime;
    }
  }

  const leftoverTasks = sortTaskList(tasks.filter(t => !toWorkOn.includes(t)), addByMethod === 'continue' ? organizeByMethod : '');

  return [toWorkOn, leftoverTasks];
}