import React, { useState } from 'react';
import DisplaySettings from '../components/sidebar/DisplaySettings';
import ResetButton from '../components/sidebar/ResetButton';
import Tabs from '../components/common/Tabs';
import ChartCard from '../components/common/ChartCard';
import MetricCard from '../components/common/MetricCard';
import Footer from '../components/layout/Footer';
import Header from '../components/layout/Header';
import EmissionsScatterChart from '../components/visualizations/EmissionsScatterChart';
import CapacityPhaseoutChart from '../components/visualizations/CapacityPhaseoutChart';
import LEDPathsChart from '../components/visualizations/LEDPathsChart';
import DependencePhaseout from '../components/tables/DependencePhaseout';
export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab]   = useState('global');

  const tabs = [
    { id: 'global',  label: 'Global overview' },
    { id: 'country', label: 'Country report' }
    
  ];

  const perCapita       = '4.4';
  const adaptationCost  = '$141';
  const mitigationCost  = '$141';
  const fuels = ['Oil','Gas','Coal'];
  return (
    <div className="flex flex-col h-screen font-body">
      <Header />
      <header className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="px-3 py-1 bg-brand text-white rounded-md text-sm"
        >
          {sidebarOpen ? 'Hide Filters' : 'Show Filters'}
        </button>
      </header>

      <div className="flex flex-1 relative">
      <aside
        className={`
          absolute inset-y-0 left-0 z-40 w-full
          bg-white border-r border-gray-200
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:inset-auto md:w-1/4 md:z-auto
        `}
      >
        <div className="flex flex-col h-full p-6 space-y-2">
          <DisplaySettings />
        </div>
      </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-25 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <main className="flex-1 flex flex-col bg-panelBg overflow-auto">
          <Tabs tabs={tabs} activeTab={activeTab} onTabClick={setActiveTab} />
          <div className="p-4 flex-1 overflow-y-auto">
            {activeTab === 'global' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-4">
                <ChartCard title="Oil Dependence vs Phaseout" className="h-96">
                  <EmissionsScatterChart fuel="Oil" />
                </ChartCard>

                <ChartCard title="Gas Dependence vs Phaseout" className="h-96">
                  <EmissionsScatterChart fuel="Gas" />
                </ChartCard>
                <ChartCard title="Coal Dependence vs Phaseout" className="h-96">
                  <EmissionsScatterChart fuel="Coal" />
                </ChartCard>
                <ChartCard title="Capacity Phaseout" className="h-full">
                    <CapacityPhaseoutChart />
                </ChartCard>
                <ChartCard title="LEDPaths Coal" className="h-full">
                    <LEDPathsChart fuel="Coal" />
                </ChartCard>
                <ChartCard title="LEDPaths Gas" className="h-full">
                    <LEDPathsChart fuel="Gas" />
                </ChartCard>
                <ChartCard title="LEDPaths Oil" className="h-full">
                    <LEDPathsChart fuel="Oil" />
                </ChartCard>
                  {/* <MetricCard
                    title="Per-capita share"
                    value={perCapita}
                    unit=" tCO₂e"
                  /> */}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <MetricCard
                    title="Adaptation cost"
                    value={adaptationCost}
                    unit=""
                  />
                  <MetricCard
                    title="Mitigation cost"
                    value={mitigationCost}
                    unit=""
                  />
                </div>
                <DependencePhaseout></DependencePhaseout>
              </>
            )}

            {activeTab === 'country' && (
              <div className="text-gray-500 text-center py-16">
                Country report coming soon…
              </div>
            )}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
