import { Spacer, Text, YStack, H2, H3, XStack, H5, Separator, ScrollView } from 'tamagui'
import { useSQLiteContext } from 'expo-sqlite'
import { useState, useEffect, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'

export default function StatsScreen() {
  const db = useSQLiteContext()
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [maxCount, setMaxCount] = useState(0);
  const [counts, setCounts] = useState<number[]>([]);
  const [dayTaskCounts, setDayTaskCounts] = useState<number[]>([]);

  useFocusEffect(useCallback(() => {
    async function fetchTaskStats() {
      const completedCount = await db.getFirstAsync<number>(`SELECT COUNT(*) as count FROM tasks WHERE completed = 1;`);
      setTasksCompleted(completedCount!['count'] || 0);

      const totalTime = await db.getFirstAsync<number>(`SELECT SUM(time_spent) as total FROM tasks WHERE completed = 1;`);
      setTimeSpent(totalTime!['total'] || 0);

      let maxCount = 0;
      const counts = [...Array(10).keys()].map((t) => {
        const lowerBound = t * 10;
        const upperBound = (t + 1) * 10;
        const countInRange = db.getFirstSync<number>(`SELECT COUNT(*) as count FROM tasks WHERE completed = 1 AND time_spent >= ${lowerBound} AND time_spent < ${upperBound};`)!['count'] || 0;
        if (countInRange > maxCount) {
          maxCount = countInRange;
        }
        return countInRange;
      })
      setMaxCount(maxCount);
      setCounts(counts);

      const dayCounts = Array.from({ length: 112 }).map((_, index) => {
        const dateStr = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - index).toISOString().split('T')[0];
        const tasksCompletedOnDay = db.getFirstSync<number>(`SELECT COUNT(*) as count FROM tasks WHERE completed = 1 AND DATE(completed_at) = DATE('${dateStr}');`)!['count'] || 0;
        return tasksCompletedOnDay;
      });
      setDayTaskCounts(dayCounts);
    }
    fetchTaskStats();
  }, []))

  return (
    <ScrollView backgroundColor="$color1">
      <YStack width="100%" p="$5" gap="$3">
        <YStack borderColor="$color4" borderWidth={1} borderRadius="$3" p="$4" gap="$2">
          <Text fontWeight="bold">Base Stats</Text>
          <Separator />
          <XStack pt="$1" justify="space-between">
            <Text>Tasks Completed: </Text>
            <Text>{tasksCompleted.toString()}</Text>
          </XStack>
          {
            timeSpent > 100 ? 
            <XStack justify="space-between">
              <Text>Hours Spent Working: </Text>
              <Text>{(timeSpent / 60).toFixed(1).toString()}</Text>
            </XStack>
            : 
            <XStack justify="space-between">
              <Text>Minutes Spent Working: </Text>
              <Text>{timeSpent.toString()}</Text>
            </XStack>
          }
        </YStack>
        <YStack borderColor="$color4" borderWidth={1} borderRadius="$3" p="$4" gap="$2">
          <Text fontWeight="bold">Task Completion Frequency</Text>
          <Separator />
          <XStack width="100%" pt="$2" gap="$1" justify="center">
            {
              Array.from({ length: 16 }).map((_, columnIndex) => (
                <YStack key={columnIndex} flexDirection="column" gap="$1">
                  {
                    Array.from({ length: 7 }).map((_, rowIndex) => {
                      const daysAgo = rowIndex + (15 - columnIndex) * 7;                      
                      const tasksCompletedOnDay = dayTaskCounts[daysAgo] || 0;
                      let bgColor = '$color2';
                      if (tasksCompletedOnDay >= 5) {
                        bgColor = '#8ce99a';
                      } else if (tasksCompletedOnDay >= 3) {
                        bgColor = '#40a869';
                      } else if (tasksCompletedOnDay >= 1) {
                        bgColor = '#216e39';
                      }
                      return <YStack key={rowIndex} width={20} height={20} borderWidth={1} borderColor="$color3" borderRadius="$2" backgroundColor={bgColor}/>;
                    })
                  }
                </YStack>
              ))
            }
          </XStack>
        </YStack>
        <YStack borderColor="$color4" borderWidth={1} borderRadius="$3" p="$4" gap="$2">
          <Text fontWeight="bold">Task Completion Time</Text>
          <Separator />
          <YStack width="100%" gap="$2" pt="$2">
              {
                [...Array(10).keys()].map((t, i) => {
                  const lowerBound = t * 10;
                  const upperBound = (t + 1) * 10;
                  return (
                    <XStack key={t} alignItems="center" height={30} gap="$3">
                      <YStack width="$4">
                        <Text fontVariant="tabular-nums" fontSize="$1" color="$color11" text="left">
                          {upperBound} min
                        </Text>
                      </YStack>
                      <XStack height="100%" width={counts[i] * 200 / maxCount + 10} borderRadius="$1" backgroundColor="rgba(73, 123, 73, 1)" justifyContent="flex-end"/>
                      <Separator />
                      <YStack width="$2">
                        <Text fontVariant="tabular-nums" fontSize="$1" color="$color11" text="left">
                          {counts[i]}
                        </Text>
                      </YStack>
                    </XStack>
                  );
                })
              }
          </YStack>
        </YStack>
      </YStack>
    </ScrollView>
  )
}
