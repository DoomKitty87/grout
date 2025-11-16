import { YStack, H2, H3, XStack, H5 } from 'tamagui'
import { useSQLiteContext } from 'expo-sqlite'
import { useState, useEffect } from 'react'

export default function StatsScreen() {
  const db = useSQLiteContext()
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);

  useEffect(() => {
    async function fetchCompletedCount() {
      const completedCount = await db.getFirstAsync<number>(`SELECT COUNT(*) as count FROM tasks WHERE completed = 1;`);
      setTasksCompleted(completedCount!['count'] || 0);
    }
    fetchCompletedCount();
  }, []);

  useEffect(() => {
    async function fetchTimeSpent() {
      const totalTime = await db.getFirstAsync<number>(`SELECT SUM(time_spent) as total FROM tasks WHERE completed = 1;`);
      setTimeSpent(totalTime!['total'] || 0);
    }
    fetchTimeSpent();
  }, []);

  const monthStartDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const rows = Math.ceil((daysInMonth + monthStartDay) / 7);
  console.log(timeSpent);
  console.log(tasksCompleted);

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

  return (
    <YStack>
      <H2>Statistics</H2>
      
      <H3>{tasksCompleted.toString()} Tasks Completed</H3>
      {timeSpent > 100 ? <H3>{(timeSpent / 60).toFixed(1).toString()} Hours Spent Working</H3> : <H3>{timeSpent.toString()} Minutes Spent Working</H3>}

      <H3>Task Completion Calendar</H3>
      <YStack>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <YStack key={rowIndex} flexDirection="row">
            {Array.from({ length: 7 }).map((_, colIndex) => {
              const dayOfMonth = rowIndex * 7 + colIndex - monthStartDay + 1;
              if (dayOfMonth < 0 || dayOfMonth >= daysInMonth) {
                return <YStack key={colIndex} width={40} height={40} margin={5} backgroundColor="#111" />;
              }
              // Fetch number of tasks completed on this day
              const dateStr = new Date(new Date().getFullYear(), new Date().getMonth(), dayOfMonth).toISOString().split('T')[0];
              const tasksCompletedOnDay = db.getFirstSync<number>(`SELECT COUNT(*) as count FROM tasks WHERE completed = 1 AND DATE(completed_at) = DATE('${dateStr}');`)!['count'] || 0;
              let bgColor = '#222';
              if (tasksCompletedOnDay >= 5) {
                bgColor = '#8ce99a';
              } else if (tasksCompletedOnDay >= 3) {
                bgColor = '#40a869';
              } else if (tasksCompletedOnDay >= 1) {
                bgColor = '#216e39';
              }
              return <YStack key={colIndex} width={40} height={40} margin={5} backgroundColor={bgColor} />;
            })}
          </YStack>
        ))
      }
      </YStack>

      <H3>Tasks By Time To Complete</H3>
      <XStack alignItems="flex-end" height={150} padding={10}>
        {[...Array(10).keys()].map((t, i) => {
          const lowerBound = t * 10;
          const upperBound = (t + 1) * 10;
          return (
            <YStack key={t} alignItems="center" margin={5}>
              <YStack width={30} height={counts[i] * 100 / maxCount + 10} backgroundColor="#beb" justifyContent="flex-end"/>
            </YStack>
          );
        })}
      </XStack>
    </YStack>
  )
}
