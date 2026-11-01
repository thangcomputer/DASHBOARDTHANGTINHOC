import { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/app/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { colors } from './src/theme/tokens';

const mobileSystemFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export default function App() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const rootFont = document.documentElement.style.fontFamily;
    const bodyFont = document.body.style.fontFamily;
    document.documentElement.style.fontFamily = mobileSystemFont;
    document.body.style.fontFamily = mobileSystemFont;

    return () => {
      document.documentElement.style.fontFamily = rootFont;
      document.body.style.fontFamily = bodyFont;
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
