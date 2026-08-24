import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import EventDetailScreen from "../screens/EventDetailScreen";
import AccountScreen from "../screens/AccountScreen";
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
    </Stack.Navigator>
  );
}
