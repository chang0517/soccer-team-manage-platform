import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import AuthNavigator from "./AuthNavigator";
import MainTabs from "./MainTabs";
import { colors } from "../theme";

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return user ? <MainTabs /> : <AuthNavigator />;
}
