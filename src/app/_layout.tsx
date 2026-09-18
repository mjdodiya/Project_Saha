import { Tabs } from 'expo-router';

import { SahaTabBar } from '@/design/SahaTabBar';
import { BleProvider } from '@/hooks/BleContext';

export default function RootLayout() {
  return (
    <BleProvider>
      <Tabs
        tabBar={(props) => <SahaTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: '#F6F3EC' },
        }}>
        <Tabs.Screen
          name="index"
          options={{ title: 'Home' }}
        />
        <Tabs.Screen
          name="nearby"
          options={{ title: 'Nearby' }}
        />
        <Tabs.Screen
          name="chat"
          options={{ title: 'Messages' }}
        />
        <Tabs.Screen
          name="conversation"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: 'Settings' }}
        />
        <Tabs.Screen
          name="scanner"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="diagnostics"
          options={{ href: null }}
        />
      </Tabs>
    </BleProvider>
  );
}
