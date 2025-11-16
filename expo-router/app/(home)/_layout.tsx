import { Link, Stack } from 'expo-router'
import { Button, useTheme } from 'tamagui'
import { Home, Settings } from '@tamagui/lucide-icons'

export default function HomeLayout() {
  const theme = useTheme()
  
  return (
    <Stack>
      <Stack.Screen name='index' options={{ headerShown: false }}/>
      <Stack.Screen name='work' options={{ headerShown: false }} />
    </Stack>
  )
}
