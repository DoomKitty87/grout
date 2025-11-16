import { H2, Image, XStack, YStack, ToggleGroup, Input, Label, Button, Paragraph, Spacer } from 'tamagui'
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
      <YStack minH="100%" padding="$5" bg="$background">
        <XStack width="100%" justify="center" items="center">
          <Image
            source={require("assets/images/qhlogo.png")}
            height="$1"
            resizeMode="contain"
          />
        </XStack>
        <Spacer />
        <Label>Default Task Time Estimate</Label>
        <Input value={defaultEstimate.toString()} inputMode="numeric" onChangeText={text => setDefaultEstimate(parseInt(text) || 0)}></Input>
        <Label>Organize Tasks By:</Label>
        <ToggleGroup value={organizeBy} type="single" onValueChange={value => setOrganizeBy(value)} disableDeactivation={true}>
          <ToggleGroup.Item value="largest" borderColor={organizeBy === 'largest' ? '$color12' : undefined}>
            <Paragraph>Largest (Eat the Frog)</Paragraph>
          </ToggleGroup.Item>
          <ToggleGroup.Item value="smallest" borderColor={organizeBy === 'smallest' ? '$color12' : undefined}>
            <Paragraph>Smallest (Start off Easy)</Paragraph>
          </ToggleGroup.Item>
        </ToggleGroup>
        <Label>Add Additional Tasks By:</Label>
        <ToggleGroup value={addBy} type="single" onValueChange={value => setAddBy(value)} disableDeactivation={true}>
          <ToggleGroup.Item value="continue" borderColor={addBy === 'continue' ? '$color12' : undefined}>
            <Paragraph>Continue Main Pattern</Paragraph>
          </ToggleGroup.Item>
          <ToggleGroup.Item value="smallest" borderColor={addBy === 'smallest' ? '$color12' : undefined}>
            <Paragraph>Smallest</Paragraph>
          </ToggleGroup.Item>
          <ToggleGroup.Item value="largest" borderColor={addBy === 'largest' ? '$color12' : undefined}>
            <Paragraph>Largest</Paragraph>
          </ToggleGroup.Item>
        </ToggleGroup>
        <Label>Time Estimation Method:</Label>
        <ToggleGroup value={timeEstimator} type="single" onValueChange={value => setTimeEstimator(value)} orientation='vertical' disableDeactivation={true}>
          <ToggleGroup.Item value="local" borderColor={timeEstimator === 'local' ? '$color12' : undefined}>
            <Paragraph>Local NLP (Faster, Less Accurate)</Paragraph>
          </ToggleGroup.Item>
          <ToggleGroup.Item value="api" borderColor={timeEstimator === 'api' ? '$color12' : undefined}>
            <Paragraph>Embeddings API (Slower, More Accurate)</Paragraph>
          </ToggleGroup.Item>
        </ToggleGroup>
        <Spacer />
        <Button bg="$color5" borderWidth={1} borderColor="$borderColor" marginBottom="$2" onPress={async () => {
          Keyboard.dismiss();
          await AsyncStorage.setItem('defaultEstimate', defaultEstimate.toString());
          await AsyncStorage.setItem('organizeBy', organizeBy);
          await AsyncStorage.setItem('addBy', addBy);
          await AsyncStorage.setItem('timeEstimator', timeEstimator);
        }}>Save</Button>
        <Button bg="$color5" borderWidth={1} borderColor="$borderColor" marginBottom="$2" onPress={async () => {
          Keyboard.dismiss();
          setDefaultEstimate(30);
          setOrganizeBy('smallest');
          setAddBy('continue');
          await AsyncStorage.removeItem('defaultEstimate');
          await AsyncStorage.removeItem('organizeBy');
          await AsyncStorage.removeItem('addBy');
          await AsyncStorage.removeItem('timeEstimator');
        }}>Reset to Defaults</Button>
        <Button bg="$color5" borderWidth={1} borderColor="$borderColor" marginBottom="$2" onPress={async () => {
          Keyboard.dismiss();
          db.execSync(`DELETE FROM tasks;`);
        }}>
          Clear All Tasks & History
        </Button>
        <Button bg="$color5" borderWidth={1} borderColor="$borderColor" onPress={async () => {
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
