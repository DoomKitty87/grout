import { H3, Slider, Text, View } from 'tamagui'

export default function TabTwoScreen() {
  return (
    <View flex={1} items="center" justify="center" bg="$background">
      
      <H3>
        Prioritization
      </H3>

      <Slider size="$2" width={200} defaultValue={[50]} max={100} step={1}>
    <Slider.Track>
      <Slider.TrackActive />
    </Slider.Track>
    <Slider.Thumb circular index={0} />
     </Slider>
      
      <Text fontSize={20} color="$blue10">
        Percentage Value
      </Text>

    </View>
  )
}
