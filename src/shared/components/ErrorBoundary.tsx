import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Alert, Button, Stack, Text } from '@mantine/core';

interface Props {
  readonly children: ReactNode;
  readonly fallbackMessage?: string;
}

interface State {
  readonly hasError: boolean;
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Alert color="red" title="Something went wrong">
          <Stack gap="sm">
            <Text size="sm">
              {this.props.fallbackMessage ??
                'An unexpected error occurred in this section.'}
            </Text>
            {this.state.error && (
              <Text size="xs" c="dimmed">
                {this.state.error.message}
              </Text>
            )}
            <Button
              size="xs"
              variant="outline"
              onClick={this.handleReset}
            >
              Try Again
            </Button>
          </Stack>
        </Alert>
      );
    }

    return this.props.children;
  }
}
