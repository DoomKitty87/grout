import { ExternalLink } from '@tamagui/lucide-icons'
import { Spacer, Anchor, H2, H4, Input, Label, Paragraph, Popover, XStack, YStack, Button, ScrollView } from 'tamagui'
import { ToastControl } from 'components/CurrentToast'
import { useSQLiteContext } from 'expo-sqlite'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router';

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
  const router = useRouter();

  const [minutes, setMinutes] = useState(0);
  const [hours, setHours] = useState(0);

  return (
    <YStack flex={1} justify="center" items="center" gap="$8" px="$8" pt="$15" pb="$8" bg="$background">
      
      <XStack maxH={100}>
        <ScrollView onScroll={(e) => {
            const contentOffsetY = e.nativeEvent.contentOffset.y;
            const itemHeight = 51; // Approximate height of each H2 item
            const selectedHour = Math.round(contentOffsetY / itemHeight);
            setHours(selectedHour);
            console.log('Selected time (hours):', selectedHour);
        }}>
            {[...Array(12).keys()].map((t) => (
                <H2 key={t}>{t}</H2>
            ))}
        </ScrollView>
        <H2>:</H2>
        <ScrollView onScroll={(e) => {
            const contentOffsetY = e.nativeEvent.contentOffset.y;
            const itemHeight = 51; // Approximate height of each H2 item
            const selectedMinute = Math.round(contentOffsetY / itemHeight);
            setMinutes(selectedMinute);
            console.log('Selected time (minutes):', selectedMinute);
        }}>
            {[...Array(60).keys()].map((t) => (
                            <H2 key={t}>{t}</H2>
            ))}
        </ScrollView>
      </XStack>
      <YStack width="100%">
      <XStack>
      <Button size="$5" grow={1} onPress={() => router.back()}>Cancel</Button>
      </XStack>
      <Spacer />
      <XStack>
      <Button size="$5" grow={1} onPress={() => router.push({ pathname: 'work', params: { time: (hours * 60) + minutes }})}>Start Work</Button>
      </XStack>
      </YStack>
    </YStack>
  )
}