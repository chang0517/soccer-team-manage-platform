import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import HomeScreen from "../screens/HomeScreen";
import ScheduleScreen from "../screens/ScheduleScreen";
import BoardScreen from "../screens/BoardScreen";
import PollsScreen from "../screens/PollsScreen";
import RankingScreen from "../screens/RankingScreen";
import { colors } from "../theme";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  Home: "🏠",
  Schedule: "📅",
  Board: "📢",
  Polls: "🗳️",
  Ranking: "🏆",
};

const LABELS: Record<keyof MainTabParamList, string> = {
  Home: "홈",
  Schedule: "일정",
  Board: "게시판",
  Polls: "투표",
  Ranking: "랭킹",
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabel: LABELS[route.name as keyof MainTabParamList],
        tabBarIcon: () => <Text style={{ fontSize: 18 }}>{ICONS[route.name as keyof MainTabParamList]}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Board" component={BoardScreen} />
      <Tab.Screen name="Polls" component={PollsScreen} />
      <Tab.Screen name="Ranking" component={RankingScreen} />
    </Tab.Navigator>
  );
}
