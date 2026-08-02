import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/layout/Shell';

// Si algo falla, en vez de pantalla en blanco mostramos el error para poder arreglarlo.
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, maxWidth: 640, margin: '40px auto', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Ocurrió un error en la aplicación</h1>
          <p style={{ marginBottom: 12 }}>Toma una foto de esta pantalla o copia este mensaje:</p>
          <pre style={{ background: '#fee', border: '1px solid #f99', borderRadius: 8, padding: 12, whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {String(this.state.error?.message || this.state.error)}
            {'\n\n'}
            {String((this.state.error as Error)?.stack || '').slice(0, 1500)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#16a34a', color: 'white', fontSize: 16, cursor: 'pointer' }}
          >
            Recargar la página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import Dashboard from '@/pages/dashboard';
import ProjectDetail from '@/pages/project-detail';
import Materials from '@/pages/materials';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-4xl font-bold font-serif text-primary">404</h1>
      <p className="text-muted-foreground mt-2">Página no encontrada</p>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/proyectos/:id" component={ProjectDetail} />
      <Route path="/materiales" component={Materials} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Shell>
            <Router />
          </Shell>
        </WouterRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
