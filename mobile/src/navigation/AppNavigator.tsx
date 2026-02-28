import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import PostJobScreen from '../screens/PostJobScreen';
import JobDetailScreen from '../screens/JobDetailScreen';
import ChatScreen from '../screens/ChatScreen';

export type RootStackParamList = {
  Home: undefined;
  PostJob: { sessionId?: string };
  JobDetail: { jobId: number };
  Chat: { jobId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'SWARMS' }} />
        <Stack.Screen name="PostJob" component={PostJobScreen} options={{ title: 'Post a Job' }} />
        <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job Details' }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Agent Chat' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
