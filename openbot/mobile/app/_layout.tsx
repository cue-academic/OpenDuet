import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient, serverProblem } from "../src/auth";
import { notificationDestination } from "../src/links";
import { heading, Problem, Screen } from "../src/ui";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export default function Layout() {
  if (serverProblem) return <ServerProblem message={serverProblem} />;
  return <App />;
}
function ServerProblem({ message }: { message: string }) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Screen>
        <Text accessibilityRole="header" style={heading}>
          This app is not set up yet
        </Text>
        <Problem message={message} />
        <Text>
          Add the server URL to the app's .env file, then build the app again.
        </Text>
      </Screen>
    </SafeAreaView>
  );
}
function App() {
  const { data: session } = authClient.useSession();
  const pending = useRef<unknown>(null);
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handled.current === id) return;
      pending.current = response.notification.request.content.data;
      if (session) {
        const destination = notificationDestination(pending.current);
        if (destination) router.push(destination);
        handled.current = id;
        pending.current = null;
      }
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const subscription =
      Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [session]);
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ title: "OpenBot" }} />
      <Stack.Screen name="conversation" options={{ title: "Conversation" }} />
      <Stack.Screen name="approvals" options={{ title: "Approval inbox" }} />
      <Stack.Screen name="bots" options={{ title: "Bots" }} />
      <Stack.Screen name="bot" options={{ title: "Bot" }} />
      <Stack.Screen name="computer" options={{ title: "Computer" }} />
      <Stack.Screen name="routine" options={{ title: "Routine" }} />
      <Stack.Screen name="memory" options={{ title: "Memory" }} />
      <Stack.Screen name="rules" options={{ title: "Custom rules" }} />
      <Stack.Screen name="plugins" options={{ title: "Plugins" }} />
    </Stack>
  );
}
