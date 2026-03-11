import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-600 bg-red-50 h-screen font-mono text-sm max-w-4xl mx-auto overflow-auto">
          <h1 className="text-2xl font-bold mb-4">React Rendering Error</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary className="font-bold cursor-pointer mb-2">Show Error Details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
