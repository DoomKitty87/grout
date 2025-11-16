import { H2, YStack, ToggleGroup, Input, Label, Button } from 'tamagui'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

export default function SettingsScreen() {
  const [defaultEstimate, setDefaultEstimate] = useState(30);
  const [organizeBy, setOrganizeBy] = useState('smallest');
  const [addBy, setAddBy] = useState('continue');
  const [timeEstimator, setTimeEstimator] = useState('local');
  useEffect(() => {
    async function fetchSettings() {
      const estimate = await AsyncStorage.getItem('defaultEstimate');
      if (estimate) {
        setDefaultEstimate(parseInt(estimate));
      }
      const organizeBy = await AsyncStorage.getItem('organizeBy');
      if (organizeBy) {
        setOrganizeBy(organizeBy);
      }
      const addBy = await AsyncStorage.getItem('addBy');
      if (addBy) {
        setAddBy(addBy);
      }
      const timeEstimator = await AsyncStorage.getItem('timeEstimator');
      if (timeEstimator) {
        setTimeEstimator(timeEstimator);
      }
    }
    fetchSettings();
  }, []);

  const db = useSQLiteContext();

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <YStack minH="100%">
        <H2>Preferences</H2>
        <Label>Default Task Time Estimate</Label>
        <Input value={defaultEstimate.toString()} inputMode="numeric" onChangeText={text => setDefaultEstimate(parseInt(text) || 0)}></Input>
        <Label>Organize Tasks By:</Label>
        <ToggleGroup value={organizeBy} type="single" onValueChange={value => setOrganizeBy(value)}>
          <ToggleGroup.Item value="largest">
            <Label>Largest (Eat the Frog)</Label>
          </ToggleGroup.Item>
          <ToggleGroup.Item value="smallest">
            <Label>Smallest (Start off Easy)</Label>
          </ToggleGroup.Item>
        </ToggleGroup>
        <Label>Add Additional Tasks By:</Label>
        <ToggleGroup value={addBy} type="single" onValueChange={value => setAddBy(value)}>
          <ToggleGroup.Item value="continue">
            <Label>Continue Main Pattern</Label>
          </ToggleGroup.Item>
          <ToggleGroup.Item value="smallest">
            <Label>Smallest</Label>
          </ToggleGroup.Item>
          <ToggleGroup.Item value="largest">
            <Label>Largest</Label>
          </ToggleGroup.Item>
        </ToggleGroup>
        <Label>Time Estimation Method:</Label>
        <ToggleGroup value={timeEstimator} type="single" onValueChange={value => setTimeEstimator(value)}>
          <ToggleGroup.Item value="local">
            <Label>Local (Faster, Less Accurate)</Label>
          </ToggleGroup.Item>
          <ToggleGroup.Item value="api">
            <Label>API (Slower, More Accurate)</Label>
          </ToggleGroup.Item>
        </ToggleGroup>
        <Button onPress={async () => {
          Keyboard.dismiss();
          await AsyncStorage.setItem('defaultEstimate', defaultEstimate.toString());
          await AsyncStorage.setItem('organizeBy', organizeBy);
          await AsyncStorage.setItem('addBy', addBy);
          await AsyncStorage.setItem('timeEstimator', timeEstimator);
        }}>Save</Button>
        <Button onPress={async () => {
          Keyboard.dismiss();
          setDefaultEstimate(30);
          setOrganizeBy('smallest');
          setAddBy('continue');
          await AsyncStorage.removeItem('defaultEstimate');
          await AsyncStorage.removeItem('organizeBy');
          await AsyncStorage.removeItem('addBy');
          await AsyncStorage.removeItem('timeEstimator');
        }}>Reset to Defaults</Button>
        <Button onPress={async () => {
          Keyboard.dismiss();
          db.execSync(`DELETE FROM tasks;`);
        }}>
          Clear All Tasks & History
        </Button>
        <Button onPress={async () => {
          db.execSync(`DELETE FROM tasks;`);
          const demoTasksFinished = [
            { title: 'Chem quiz', time_spent: 10 },
            { title: 'Math homework', time_spent: 30 },
            { title: 'Math hw reflection', time_spent: 5 },
            { title: 'Canvas discussion post engr', time_spent: 20 },
            { title: 'Education discussion post', time_spent: 40 },
            { title: 'Comms speech outline', time_spent: 70 },
            { title: 'Education essay', time_spent: 85 },
            { title: 'Math quiz', time_spent: 12 },
          ];
          for (const task of demoTasksFinished) {
            // Random date within the last 30 days
            const daysAgo = Math.floor(Math.random() * 30);
            
            await db.prepareAsync(`
              INSERT INTO tasks (title, time_spent, completed, completed_at)
              VALUES (?, ?, 1, datetime('now', ? || ' days'));
            `).then(statement => statement.executeAsync([task.title, task.time_spent, `-${daysAgo}`]).then(() => statement.finalizeAsync()));
          }

          const demoTasksUnfinished = [
            { title: 'Math assignment' },
            { title: 'Chemistry quiz' },
            { title: 'Education canvas discussion' },
            { title: 'Communications speech' },
            { title: 'Math homework reflection' },
          ];

          for (const task of demoTasksUnfinished) {
            await db.prepareAsync(`
              INSERT INTO tasks (title)
              VALUES (?);
            `).then(statement => statement.executeAsync([task.title]).then(() => statement.finalizeAsync()));
          }
        }}>
          Load Demo Tasks & History
        </Button>
      </YStack>
    </TouchableWithoutFeedback>
  )
}
