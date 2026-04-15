import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from './ScreenContainer';

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

export default class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Beklenmeyen bir hata oluştu.',
    };
  }

  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary]', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Bir Hata Oluştu</Text>
          <Text style={styles.message}>
            Uygulama beklenmeyen bir hatayla karşılaştı. Lütfen tekrar deneyin.
          </Text>
          {this.state.errorMessage ? (
            <Text style={styles.detail}>{this.state.errorMessage}</Text>
          ) : null}
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 16,
    backgroundColor: 'white',
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#202020',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#4B5563',
  },
  detail: {
    marginTop: 10,
    fontSize: 13,
    textAlign: 'center',
    color: '#6B7280',
  },
  button: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#C6F04F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
