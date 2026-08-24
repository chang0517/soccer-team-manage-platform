import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import EventDetailScreen from "../screens/EventDetailScreen";
import AccountScreen from "../screens/AccountScreen";
import MembersScreen from "../screens/MembersScreen";
import NoticeDetailScreen from "../screens/NoticeDetailScreen";
import CoachFeedbackScreen from "../screens/CoachFeedbackScreen";
import AdminScreen from "../screens/AdminScreen";
import HistoricalStatsScreen from "../screens/HistoricalStatsScreen";
import FinesScreen from "../screens/FinesScreen";
import { colors } from "../theme";
import type { AppStackParamList } from "./types";

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: "일정" }} />
      <Stack.Screen name="Account" component={AccountScreen} options={{ title: "계정 설정" }} />
      <Stack.Screen name="Members" component={MembersScreen} options={{ title: "멤버" }} />
      <Stack.Screen name="NoticeDetail" component={NoticeDetailScreen} options={{ title: "게시글" }} />
      <Stack.Screen
        name="CoachFeedback"
        component={CoachFeedbackScreen}
        options={{ title: "코치 피드백" }}
      />
      <Stack.Screen name="Admin" component={AdminScreen} options={{ title: "가입 승인" }} />
      <Stack.Screen
        name="HistoricalStats"
        component={HistoricalStatsScreen}
        options={{ title: "역대 기록 관리" }}
      />
      <Stack.Screen name="Fines" component={FinesScreen} options={{ title: "미투표자 벌금" }} />
    </Stack.Navigator>
  );
}
