import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppShell } from "./src/AppShell";

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
