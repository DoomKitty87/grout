import { Check, ExternalLink, Plus, Trash, Play, AlarmClockOff, AlarmClockPlus, Timer, ClipboardPlus } from '@tamagui/lucide-icons'
import { Image, Square, H1, H3, Separator, Checkbox, Text, Spacer, Anchor, H2, H4, Input, Label, Paragraph, Popover, XStack, YStack, Button, ScrollView, H5, Select } from 'tamagui'
import { SQLiteDatabase, useSQLiteContext } from 'expo-sqlite'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { useRouter } from 'expo-router';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import Reanimated, {
  useSharedValue,
  SharedValue,
  useAnimatedStyle,
  withSpring,
  useAnimatedRef,
  LinearTransition,
  SlideOutLeft,
  SlideInDown,
} from 'react-native-reanimated'
import bm25 from "wink-bm25-text-search";
import nlp from "wink-nlp-utils";
import WordPOS from "wordpos";
import Animated from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';

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

export default function HomeScreen() {
  const db = useSQLiteContext()
  const router = useRouter()

  const [tasks, setTasks] = useState<Task[]>([])
  useFocusEffect(useCallback(() => {
    async function fetchTasks() {
      const result = await updateTaskEstimations(db)
      setTasks(result)
    }
    fetchTasks()
  }, []))

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [workHr, setWorkHr] = useState(0);
  const [workMin, setWorkMin] = useState(0);

  const taskDurationSum = tasks.reduce((sum, task) => sum + task.estimated_time, 0);

  function handleHour(hour) {
    if (workHr != hour) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    }
    setWorkHr(hour);
  }

  function handleMin(min) {
    if (workMin != min) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    }
    setWorkMin(min);
  }

  async function handleDelete(task) {
    const statement = await db.prepareAsync(`
      DELETE FROM tasks WHERE id = ?;
    `);
    await statement.executeAsync([task.id]);
    await statement.finalizeAsync();
    setTasks(tasks.filter(t => t.id !== task.id));
  }

  return (
    <YStack flex={1} items="center" gap={0} pt="$11" bg="$background">
      <Spacer />
      <WorkTimer setHour={handleHour} setMin={handleMin}/>
      <Spacer />
      <Spacer />
      <Spacer />
      <XStack px="$8" width="100%" justify="space-between" alignItems="center">
        <Paragraph fontWeight="bold">{tasks.length} Tasks Total</Paragraph>
        <Paragraph fontWeight="bold">
          {(taskDurationSum >= 60) ? Math.floor(taskDurationSum / 60).toString() + " hr" : ""}
          {" "}
          {taskDurationSum % 60 != 0 ? taskDurationSum % 60 + " min" : ""}
          {taskDurationSum == 0 ? "0 min" : ""}
        </Paragraph>
      </XStack>
      <Spacer />
      <XStack px="$5">
        <Button 
        bg="$color5" 
        borderWidth={1} 
        borderColor="$borderColor" 
        icon={tasks.length > 0 ? ((workHr * 60 + workMin) < 5 ? Timer : Play) : ClipboardPlus}
        size="$5" 
        grow={1}
        disabled={(workHr * 60 + workMin) < 5 || tasks.length == 0}
        onPress={() => {
          router.push({ pathname: 'work', params: { time: (workHr * 60) + workMin }})
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}>
          {tasks.length > 0 ? ((workHr * 60 + workMin) < 5 ? "Select Session Length" : "Start Work Session") : "Add Tasks"}
        </Button>
      </XStack>
      <Spacer />
      <Spacer />
      <XStack px="$5">
        <Separator alignSelf="stretch"/>
      </XStack>
      <Spacer />
      <Spacer />
      <XStack width="100%" px="$5" justify="space-between">
        <Input width="80%" placeholder='Add Task' borderColor="$borderColor" value={newTaskTitle} onChangeText={setNewTaskTitle}></Input>
        <Button onPress={async () => {
          const statement = await db.prepareAsync(`
            INSERT INTO tasks (title)
            VALUES (?);
          `);
          const taskName = newTaskTitle;
          if (taskName.trim() === '') {
            return;
          }
          await statement.executeAsync([taskName]);
          const result = await db.getAllAsync<Task>(`SELECT * FROM tasks WHERE title = ? ORDER BY id DESC LIMIT 1;`, [taskName]);
          await statement.finalizeAsync();
          tasks.push({
            id: result[0].id,
            title: taskName,
            completed: 0,
            created_at: new Date().toISOString(),
            completed_at: null,
            time_spent: 0,
            estimated_time: 0,
          });
          setTasks([...tasks])
          Keyboard.dismiss();
          setNewTaskTitle('');
          const updatedTasks = await updateTaskEstimations(db);
          setTasks(updatedTasks);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}>
          <Plus />
        </Button>
      </XStack>
      <Spacer />
      <ScrollView width="100%">
          <YStack gap="$0">
          {tasks.map(task => (<TaskItem key={task.id} task={task} onDelete={handleDelete}/>))}
          </YStack>
      </ScrollView>
      
    </YStack>
  )
}

function WorkTimer({ setHour, setMin }) {

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  const numSize = 75;

  return (
    <XStack height={numSize} width="100%" justify="center" items="center" gap="$5">
      <YStack height="100%">
        <YStack borderRadius="$5" borderColor="$borderColor" borderWidth={1} width={numSize}>
          <ScrollView 
            snapToInterval={numSize} 
            gap={0} 
            snapToAlignment="center" 
            decelerationRate="fast" 
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              const contentOffsetY = e.nativeEvent.contentOffset.y;
              const itemHeight = numSize; // Approximate height of each H2 item
              const selectedHour = clamp(Math.round(contentOffsetY / itemHeight), 0, 23);
              setHour(selectedHour);
            }}
          >
          {
            Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((t) => (
              <YStack key={t} height={numSize} justify="center" items="center">
                <H2 fontWeight={400}>{t}</H2>
              </YStack>
            ))
          }
          </ScrollView>
        </YStack>
        <Text pt="$2" text="center">Hour</Text>
      </YStack>
      <H2 t={-3} fontWeight={400}>:</H2>
      <YStack height="100%">
        <YStack borderRadius="$5" borderColor="$borderColor" borderWidth={1} width={numSize}>
          <ScrollView 
            snapToInterval={numSize} 
            gap={0} 
            snapToAlignment="center" 
            decelerationRate="fast" 
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              const contentOffsetY = e.nativeEvent.contentOffset.y;
              const itemHeight = numSize; // Approximate height of each H2 item
              const selectedMin = clamp(Math.round(contentOffsetY / itemHeight) * 5, 0, 55);
              setMin(selectedMin);
            }}
          >
          {
            Array.from(
              { length: 12 }, 
              (_, i) => String((i) * 5).padStart(2, '0')
            ).map((t) => (
              <YStack key={t} height={numSize} justify="center" items="center">
                <H2 fontWeight={400}>{t}</H2>
              </YStack>
            ))
          }
          </ScrollView>
        </YStack>
        <Text pt="$2" text="center">Min</Text>
      </YStack>
    </XStack>
  )
}

function DeleteAction(prog: SharedValue<number>, drag: SharedValue<number>) {
  
  const styleAnimation = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: drag.value + 800 }],
      backgroundColor: "red",
      justifyContent: "center",
      alignItems: "left",
      paddingLeft: 20,
      width: 800,
      // height: (1 - prog.value) * 50,
    };
  });

  return (
    <Reanimated.View style={styleAnimation}>
      <Trash themeInverse></Trash>
    </Reanimated.View>
  );
}

function TaskItem({task, onDelete} : {task : Task, onDelete : Function}) {

  function handleDisappear() {
    onDelete(task);
  }
  
  return (
    <Animated.View layout={LinearTransition} entering={SlideInDown} exiting={SlideOutLeft}>
    <ReanimatedSwipeable
      onSwipeableWillOpen={handleDisappear}
      friction={2}
      enableTrackpadTwoFingerGesture
      rightThreshold={180}
      renderRightActions={DeleteAction}>
      <YStack backgroundColor="$color1" width="100%" borderRadius="0" justify="center" py="$3" px="$5" borderColor="$borderColor" gap={0}>
        <XStack key={task.id} width="100%" justify="space-between">
          <Paragraph width="85%" fontSize="$4">{task.title}</Paragraph>
          <Paragraph text="right" width="15%" fontSize="$2" color="$color10">{Math.ceil(task.estimated_time)} min</Paragraph>
        </XStack>
      </YStack>
    </ReanimatedSwipeable>
    </Animated.View>
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

async function expandSynonyms(text: string, wordpos: WordPOS): Promise<string> {
  const tokens = nlp.string.tokenize0(text.toLowerCase());
  const synonymPromises = tokens.map(async token => {
    try {
      const synonyms = await wordpos.lookupSynonyms(token)
      return synonyms.flatMap(syn => syn.synonyms);
    }
    catch (e) {
      return [];
    }
  });

  const lists = await Promise.all(synonymPromises);
  const uniqueSynonyms = new Set(tokens)

  lists.flat().forEach(syn => uniqueSynonyms.add(syn.toLowerCase()));

  return [...uniqueSynonyms].join(' ');
}

async function estimateTimesBM25(db: SQLiteDatabase, tasks: Task[]): Promise<number[]> {
  // Use BM25 engine to estimate task times
  const ESTIMATION_SAMPLES = 3;
  const DEFAULT_ESTIMATE = await AsyncStorage.getItem('defaultEstimate').then(val => val ? parseInt(val) : 30)

  const completedTasks = db.getAllSync<Task>(`SELECT * FROM tasks WHERE completed = 1;`)

  if (completedTasks.length < 3) {
    return tasks.map(_ => DEFAULT_ESTIMATE);
  }

  const wordpos = new WordPOS();
  const validTokens = new Set<string>();

  function catchTokens(tokens: string[]): string[] {
    tokens.forEach(token => validTokens.add(token));
    return tokens;
  }

  const prepTasks = [
    nlp.string.lowerCase,
    nlp.string.removePunctuations,
    nlp.string.tokenize0,
    catchTokens,
    nlp.tokens.stem
  ]

  const engine = bm25()
  engine.defineConfig({ fldWeights: { title: 1 } })
  engine.definePrepTasks(prepTasks)

  console.log(`Indexing ${completedTasks.length} completed tasks for estimation...`);
  completedTasks.forEach((task) => {
    engine.addDoc({ title: task.title }, task.id.toString())
  })
  engine.consolidate()

  function fuzzyMatchTokens(tokens: string[]): string[] {
    const FUZZY_THRESHOLD = 0.8;
    const matchedTokens: string[] = [];
    tokens.forEach(token => {
      let bestMatch = token;
      let bestScore = 0;
      validTokens.forEach(validToken => {
        const distance = levenshtein(token, validToken);
        const maxLen = Math.max(token.length, validToken.length);
        const score = 1 - (distance / maxLen);
        if (score > bestScore && score >= FUZZY_THRESHOLD) {
          bestScore = score;
          bestMatch = validToken;
        }
      });
      matchedTokens.push(bestMatch);
    });
    return matchedTokens;
  }

  const prepTasksNew = [
    nlp.string.lowerCase,
    nlp.string.removePunctuations,
    nlp.string.tokenize0,
    fuzzyMatchTokens,
    nlp.tokens.stem
  ]

  engine.definePrepTasks(prepTasksNew)

  const taskById: { [id: number]: Task } = {}
  completedTasks.forEach((task) => {
    taskById[task.id] = task;
  })

  const estimates: number[] = []
  for (const task of tasks) {
    const expandedTitle = await expandSynonyms(task.title, wordpos);
    const results = engine.search(expandedTitle);

    console.log(`Estimation results for task "${task.title}":`, results);

    let totalTime = 0;
    let totalScore = 0;
    for (let i = 0; i < Math.min(ESTIMATION_SAMPLES, results.length); i++) {
        totalTime += taskById[parseInt(results[i][0])].time_spent * Math.pow(results[i][1], 8);
        console.log(`  Considering completed task "${taskById[parseInt(results[i][0])].title}" with time spent ${taskById[parseInt(results[i][0])].time_spent} and score ${results[i][1]}`);
        totalScore += Math.pow(results[i][1], 8);
    }

    console.log(`Total time: ${totalTime}, Total score: ${totalScore}`);

    const estimatedTime = totalScore > 0 ? totalTime / totalScore : DEFAULT_ESTIMATE;
    estimates.push(estimatedTime);
  }

  return estimates; 
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  console.log('Calculating cosine similarity between', vecA.length, 'and', vecB.length, typeof vecA, typeof vecB);
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * (vecB[idx] || 0), 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

async function estimateTimesEmbeddings(db: SQLiteDatabase, tasks: Task[]): Promise<number[]> {
  // Use embeddings stored in db to estimate task times
  const completedTasks = await db.getAllAsync<Task>(`SELECT * FROM tasks WHERE completed = 1;`)

  const DEFAULT_ESTIMATE = await AsyncStorage.getItem('defaultEstimate').then(val => val ? parseInt(val) : 30)
  const ESTIMATION_SAMPLES = 3;
  let totalTime = 0;
  let totalSimilarity = 0;

  const estimates: number[] = []

  for (const task of tasks) {
    const similarities: { similarity: number; timeSpent: number }[] = []
    for (const completedTask of completedTasks) {
      const similarity = Math.pow(cosineSimilarity(JSON.parse(task.embedding || "[]"), JSON.parse(completedTask.embedding || "[]")), 8);
      console.log(`Cosine similarity between "${task.title}" and completed task "${completedTask.title}": ${similarity}`);
      similarities.push({ similarity, timeSpent: completedTask.time_spent });
    }

    similarities.sort((a, b) => b.similarity - a.similarity);

    totalTime = 0;
    totalSimilarity = 0;
    for (let i = 0; i < Math.min(ESTIMATION_SAMPLES, similarities.length); i++) {
      totalTime += similarities[i].timeSpent * similarities[i].similarity;
      totalSimilarity += similarities[i].similarity;
      console.log(`  Considering completed task with time spent ${similarities[i].timeSpent} and similarity ${similarities[i].similarity}`);
    }
    const estimatedTime = totalSimilarity > 0 ? totalTime / totalSimilarity : DEFAULT_ESTIMATE;
    console.log(`Estimated time for task "${task.title}": ${estimatedTime}`);
    estimates.push(estimatedTime);
  }

  return estimates;
}

async function fillEmbeddings(db: SQLiteDatabase): Promise<void> {
  // Fill in missing embeddings for tasks
  const tasks = db.getAllSync<Task>(`SELECT * FROM tasks WHERE embedding IS NULL OR embedding = '';`)
  if (tasks.length === 0) {
    return;
  }
  console.log(process.env.EXPO_PUBLIC_OPENROUTER_API_KEY);
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.EXPO_PUBLIC_OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      "model": "google/gemini-embedding-001",
      "input": tasks.map(t => t.title),
      "encoding_format": "float"
    })  
  });

  const embeddings = await response.json();

  console.log('Fetched embeddings from OpenRouter:', embeddings);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const embedding = embeddings.data[i].embedding;
    console.log(`Storing embedding for task "${task.title}":`, embedding[0], '...', embedding[embedding.length - 1]);
    await db.execAsync(`
      UPDATE tasks
      SET embedding = '${JSON.stringify(embedding)}'
      WHERE id = ${task.id};
    `);
  }

  return;
}

async function estimateTaskTime(db: SQLiteDatabase): Promise<[Task[], number[]]> {
  const timeEstimator = await AsyncStorage.getItem('timeEstimator') || 'local';
  const useEmbeddings = timeEstimator === 'api';

  if (useEmbeddings) {
    await fillEmbeddings(db)
    const uncompletedTasks = await db.getAllAsync<Task>(`SELECT * FROM tasks WHERE completed = 0;`)
    const estimates = await estimateTimesEmbeddings(db, uncompletedTasks)
    return [uncompletedTasks, estimates]
  } else {
    const uncompletedTasks = await db.getAllAsync<Task>(`SELECT * FROM tasks WHERE completed = 0;`)
    const estimates = await estimateTimesBM25(db, uncompletedTasks)
    return [uncompletedTasks, estimates]
  }
}

async function updateTaskEstimations(db: SQLiteDatabase): Promise<Task[]> {
  const [tasks, estimates] = await estimateTaskTime(db);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const estimatedTime = estimates[i];
    await db.execAsync(`
      UPDATE tasks
      SET estimated_time = ${Math.round(estimatedTime)}
      WHERE id = ${task.id};
    `);
    tasks[i].estimated_time = Math.round(estimatedTime);
  }

  return tasks;
}