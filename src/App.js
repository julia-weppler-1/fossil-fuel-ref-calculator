import React from 'react';
import DashboardPage from './pages/DashboardPage';
import { ParametersProvider } from './context/ParametersContext';

function App() {
  return (
    <ParametersProvider>
      <DashboardPage />
    </ParametersProvider>
  );
}

export default App;
