import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

export function useRequireAuth() {
  const { session, loading } = useAuth();
  const navigation = useNavigation();

  useEffect(() => {
    if (!loading && !session) {
      navigation.navigate('Login' as never);
    }
  }, [session, loading, navigation]);

  return { session, loading, isAuthenticated: !!session };
}
