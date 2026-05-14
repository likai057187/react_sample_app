import type { NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuctionScreen } from '../screens/AuctionScreen';
import { DiscoveryScreen } from '../screens/DiscoveryScreen';
import { InventoryArtistsScreen } from '../screens/InventoryArtistsScreen';
import { InventoryArtistDetailScreen } from '../screens/InventoryArtistDetailScreen';
import { InventoryArtworkDetailScreen } from '../screens/InventoryArtworkDetailScreen';
import { NetworkingScreen } from '../screens/NetworkingScreen';

export type InventoryStackParamList = {
  InventoryArtists: undefined;
  InventoryArtist: { artistId: string; artistName?: string };
  InventoryArtwork: { id: string; returnTo?: 'artist' | 'auction' | 'inventory' };
};

export type MainTabParamList = {
  Discovery: undefined;
  Auction: undefined;
  Inventory: NavigatorScreenParams<InventoryStackParamList>;
  Networking: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const InvStack = createNativeStackNavigator<InventoryStackParamList>();
const TAB_BAR_CONTENT_HEIGHT = 62;

function InventoryNavigator() {
  return (
    <InvStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: '#0a0a0b' },
        headerTintColor: '#f5f0e6',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#0a0a0b' },
      }}
    >
      <InvStack.Screen name="InventoryArtists" component={InventoryArtistsScreen} options={{ title: 'Inventory' }} />
      <InvStack.Screen
        name="InventoryArtist"
        component={InventoryArtistDetailScreen}
        options={({ route }) => ({ title: route.params.artistName ?? 'Artist' })}
      />
      <InvStack.Screen name="InventoryArtwork" component={InventoryArtworkDetailScreen} options={{ title: 'Lot' }} />
    </InvStack.Navigator>
  );
}

export function AppNavigator() {
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Platform.OS === 'web' ? Math.max(insets.bottom, 14) : Math.max(insets.bottom, 24);

  return (
    <Tab.Navigator
      initialRouteName="Inventory"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#101012',
          borderTopColor: '#2a2a2e',
          height: TAB_BAR_CONTENT_HEIGHT + tabBarBottomPadding,
          paddingTop: 8,
          paddingBottom: tabBarBottomPadding,
        },
        tabBarItemStyle: {
          paddingTop: 2,
          paddingBottom: Platform.OS === 'web' ? 4 : 8,
        },
        tabBarIconStyle: {
          marginTop: 2,
          marginBottom: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 14,
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarLabelPosition: 'below-icon',
        tabBarLabel: ({ color, children }) => <Text style={[styles.tabLabel, { color }]}>{children}</Text>,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#e8d9b4',
        tabBarInactiveTintColor: '#6e6e73',
      }}
    >
      <Tab.Screen
        name="Discovery"
        component={DiscoveryScreen}
        options={{
          title: 'Discovery',
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Auction"
        component={AuctionScreen}
        options={{
          title: 'Auction',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="gavel" color={color} size={size + 2} />,
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryNavigator}
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Networking"
        component={NetworkingScreen}
        options={{
          title: 'Networking',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
    textAlign: 'center',
  },
});
