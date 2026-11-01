import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/app/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { colors } from './src/theme/tokens';

export default function App() {
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
