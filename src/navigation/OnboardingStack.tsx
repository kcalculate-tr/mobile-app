import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import ValuePropOrderScreen from '../screens/onboarding/ValuePropOrderScreen';
import ValuePropTrackerScreen from '../screens/onboarding/ValuePropTrackerScreen';

import AuthGatewayScreen from '../screens/auth/AuthGatewayScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterEmailScreen from '../screens/auth/RegisterEmailScreen';
import VerifyOtpScreen from '../screens/auth/VerifyOtpScreen';
import RegisterIdentityScreen from '../screens/auth/RegisterIdentityScreen';
import RegisterAddressScreen from '../screens/auth/RegisterAddressScreen';

import ForgotPasswordEmailScreen from '../screens/auth/ForgotPasswordEmailScreen';
import ResetPasswordOtpScreen from '../screens/auth/ResetPasswordOtpScreen';
import NewPasswordScreen from '../screens/auth/NewPasswordScreen';

import NutritionGenderScreen from '../screens/onboarding/nutrition/NutritionGenderScreen';
import NutritionMetricsScreen from '../screens/onboarding/nutrition/NutritionMetricsScreen';
import NutritionGoalScreen from '../screens/onboarding/nutrition/NutritionGoalScreen';
import NutritionActivityScreen from '../screens/onboarding/nutrition/NutritionActivityScreen';
import NutritionSummaryScreen from '../screens/onboarding/nutrition/NutritionSummaryScreen';

const Stack = createNativeStackNavigator();

interface Props { initialRouteName?: string }

export default function OnboardingStack({ initialRouteName }: Props) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#0A0A0A' },
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="ValuePropOrder" component={ValuePropOrderScreen} />
      <Stack.Screen name="ValuePropTracker" component={ValuePropTrackerScreen} />

      <Stack.Screen name="AuthGateway" component={AuthGatewayScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="RegisterEmail" component={RegisterEmailScreen} />
      <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
      <Stack.Screen name="RegisterIdentity" component={RegisterIdentityScreen} />
      <Stack.Screen name="RegisterAddress" component={RegisterAddressScreen} />

      <Stack.Screen name="ForgotPasswordEmail" component={ForgotPasswordEmailScreen} />
      <Stack.Screen name="ResetPasswordOtp" component={ResetPasswordOtpScreen} />
      <Stack.Screen name="NewPassword" component={NewPasswordScreen} />

      <Stack.Screen name="NutritionGender" component={NutritionGenderScreen} />
      <Stack.Screen name="NutritionMetrics" component={NutritionMetricsScreen} />
      <Stack.Screen name="NutritionGoal" component={NutritionGoalScreen} />
      <Stack.Screen name="NutritionActivity" component={NutritionActivityScreen} />
      <Stack.Screen name="NutritionSummary" component={NutritionSummaryScreen} />
    </Stack.Navigator>
  );
}
