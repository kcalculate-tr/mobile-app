import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import NutritionSetupScreen from '../screens/onboarding/NutritionSetupScreen';
import { haptic } from '../utils/haptics';
import { CustomTabBar } from './CustomTabBar';
import { RootStackParamList, TabParamList } from './types';

import HomeScreen from '../screens/HomeScreen';
import CartScreen from '../screens/CartScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import TrackerScreen from '../screens/TrackerScreen';
import ProfileScreen from '../screens/ProfileScreen';

import AddressesScreen from '../screens/AddressesScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import CategoryProductsScreen from '../screens/CategoryProductsScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import DevDiagnosticsScreen from '../screens/DevDiagnosticsScreen';
import OffersScreen from '../screens/OffersScreen';
import OrderSuccessScreen from '../screens/OrderSuccessScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';
import NutritionProfileScreen from '../screens/tracker/NutritionProfileScreen';
import MeasurementHistoryScreen from '../screens/tracker/MeasurementHistoryScreen';

import PaymentScreen from '../screens/PaymentScreen';
import PersonalInfoScreen from '../screens/PersonalInfoScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import ContractsScreen from '../screens/profile/ContractsScreen';
import CouponsScreen from '../screens/profile/CouponsScreen';
import OrderDetailScreen from '../screens/profile/OrderDetailScreen';
import OrdersScreen from '../screens/profile/OrdersScreen';
import SavedCardsScreen from '../screens/profile/SavedCardsScreen';
import SecurityScreen from '../screens/profile/SecurityScreen';
import SupportScreen from '../screens/profile/SupportScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  const { session } = useAuth();
  return (
    <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        listeners={{ tabPress: () => haptic.selection() }}
      />
      <Tab.Screen
        name="Tracker"
        component={TrackerScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            haptic.selection();
            if (!session) {
              e.preventDefault();
              navigation.getParent()?.navigate('Login' as never);
            }
          },
        })}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="Subscriptions"
        component={SubscriptionScreen}
        listeners={{ tabPress: () => haptic.selection() }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            haptic.selection();
            if (!session) {
              e.preventDefault();
              navigation.getParent()?.navigate('Login' as never);
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, authLoading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [needsNutrition, setNeedsNutrition] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('@kcal_onboarding_done'),
      AsyncStorage.getItem('@kcal_needs_nutrition_profile'),
    ]).then(([done, needs]) => {
      setOnboardingDone(done === 'true');
      setNeedsNutrition(needs === 'true');
    });
  }, [user?.id]);

  if (onboardingDone === null || needsNutrition === null || authLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f6f6' }}>
        <ActivityIndicator color="#C6F04F" />
      </View>
    );
  }

  const initial = !onboardingDone
    ? 'Onboarding'
    : !user
    ? 'Login'
    : needsNutrition
    ? 'NutritionSetup'
    : 'Tabs';

  return (
    <Stack.Navigator
      initialRouteName={initial}
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: 'slide_from_right',
        animationDuration: 280,
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="NutritionSetup" component={NutritionSetupScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ animation: 'slide_from_bottom', animationDuration: 320 }} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ animation: 'slide_from_bottom', animationDuration: 320 }} />
      <Stack.Screen name="Offers" component={OffersScreen} />
      <Stack.Screen name="DevDiagnostics" component={DevDiagnosticsScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <Stack.Screen name="NutritionProfile" component={NutritionProfileScreen} />
      <Stack.Screen name="MeasurementHistory" component={MeasurementHistoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProfileOrders" component={OrdersScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="ProfileSavedCards" component={SavedCardsScreen} />
      <Stack.Screen name="ProfileCoupons" component={CouponsScreen} />
      <Stack.Screen name="ProfileSupport" component={SupportScreen} />
      <Stack.Screen name="ProfileSecurity" component={SecurityScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <Stack.Screen name="ProfileContracts" component={ContractsScreen} />
      <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
    </Stack.Navigator>
  );
}
