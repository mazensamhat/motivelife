import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppShell } from "./src/AppShell";

type BoundaryProps = { children: ReactNode; onReset: () => void };
type BoundaryState = { error: Error | null };

class LaunchErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("MotiveLife launch error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorRoot}>
          <Text style={styles.errorTitle}>MotiveLife hit a launch error</Text>
          <Text style={styles.errorBody}>{this.state.error.message}</Text>
          <Pressable
            style={styles.retry}
            onPress={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [shellKey, setShellKey] = useState(0);

  return (
    <SafeAreaProvider>
      <LaunchErrorBoundary onReset={() => setShellKey((k) => k + 1)}>
        <AppShell key={shellKey} />
      </LaunchErrorBoundary>
      <StatusBar style="light" translucent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorRoot: {
    flex: 1,
    backgroundColor: "#050d18",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  errorBody: {
    color: "#a8b8d4",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  retry: {
    backgroundColor: "#00c6ff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: "#041018",
    fontWeight: "700",
  },
});
