import '../tamagui-web.css'

import { useEffect } from 'react'
import { useColorScheme } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { SplashScreen, Stack } from 'expo-router'
import { Provider } from 'components/Provider'
import { useTheme } from 'tamagui'
import * as SQLite from 'expo-sqlite'

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router'

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [interLoaded, interError] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  })

  const db = SQLite.openDatabaseSync('tasks.db')
  db.execSync('PRAGMA user_version = 1;')
  // Check tasks table version
  const result = db.getFirstSync<{ user_version: number }>(`PRAGMA user_version;`)
  let currentVersion = result?.user_version
  if (currentVersion === undefined) {
    currentVersion = -1
  }
  const DATABASE_VERSION = 1
  if (currentVersion < DATABASE_VERSION) {
    // Perform initial setup or migrations here
    db.execSync(`
      DROP TABLE IF EXISTS tasks;
    `)
    db.execSync(`PRAGMA user_version = ${DATABASE_VERSION};`)
  }

  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA user_version = ${DATABASE_VERSION};
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      due_date DATETIME,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      time_spent INTEGER DEFAULT 0
    );
  `)

  useEffect(() => {
    if (interLoaded || interError) {
      // Hide the splash screen after the fonts have loaded (or an error was returned) and the UI is ready.
      SplashScreen.hideAsync()
    }
  }, [interLoaded, interError])

  if (!interLoaded && !interError) {
    return null
  }

  return (
    <Providers>
      <RootLayoutNav />
    </Providers>
  )
}

const Providers = ({ children }: { children: React.ReactNode }) => {
  return <Provider>{children}</Provider>
}

function RootLayoutNav() {
  const colorScheme = useColorScheme()
  const theme = useTheme()
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="modal"
          options={{
            title: 'Tamagui + Expo',
            presentation: 'modal',
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            contentStyle: {
              backgroundColor: theme.background.val,
            },
          }}
        />
      </Stack>
    </ThemeProvider>
  )
}
