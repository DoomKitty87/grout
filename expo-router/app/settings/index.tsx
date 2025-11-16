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
      </YStack>
    </TouchableWithoutFeedback>
  )
}
