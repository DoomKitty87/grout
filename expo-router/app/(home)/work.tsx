import { ExternalLink } from '@tamagui/lucide-icons'
import { Anchor, H2, H4, Input, Label, Paragraph, Popover, XStack, YStack, Button, ScrollView } from 'tamagui'
import { ToastControl } from 'components/CurrentToast'
import { useSQLiteContext, SQLiteDatabase } from 'expo-sqlite'
import { useState, useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router';
import bm25 from "wink-bm25-text-search";
import nlp from "wink-nlp-utils";
import WordPOS from "wordpos";

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
      const tasksToDo = await pickTasksToDo(db, availableTime)
      setTasks(tasksToDo);
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

async function getUnfinishedTasks(db: SQLiteDatabase): Promise<[Task[], number[]]> {
  const ESTIMATION_SAMPLES = 5;
  const DEFAULT_ESTIMATE = 30; // in minutes

  const completedTasks = db.getAllSync<Task>(`SELECT * FROM tasks WHERE completed = 1;`);
  const uncompletedTasks = db.getAllSync<Task>(`SELECT * FROM tasks WHERE completed = 0;`);

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
  for (const task of uncompletedTasks) {
    const expandedTitle = await expandSynonyms(task.title, wordpos);
    const results = engine.search(expandedTitle);

    console.log(`Estimation results for task "${task.title}":`, results);

    let totalTime = 0;
    let totalScore = 0;
    for (let i = 0; i < Math.min(ESTIMATION_SAMPLES, results.length); i++) {

        totalTime += taskById[parseInt(results[i][0])].time_spent * results[i][1];
        console.log(`  Considering completed task "${taskById[parseInt(results[i][0])].title}" with time spent ${taskById[parseInt(results[i][0])].time_spent} and score ${results[i][1]}`);
        totalScore += results[i][1];
    }

    console.log(`Total time: ${totalTime}, Total score: ${totalScore}`);

    const estimatedTime = totalScore > 0 ? totalTime / totalScore : DEFAULT_ESTIMATE;
    estimates.push(estimatedTime);
  }

  return [uncompletedTasks, estimates];
}

async function pickTasksToDo(db: SQLiteDatabase, availableTime: number): Promise<Task[]> {
  // Temporary function to just return all unfinished tasks
  //return db.getAllSync<Task>(`SELECT * FROM tasks WHERE completed = 0;`);

  const [unfinishedTasks, estimates] = await getUnfinishedTasks(db);

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