import React, { useState } from 'react';
import DisplaySettings from '../components/sidebar/DisplaySettings';
import CalculatorSettingsAccordion from '../components/sidebar/CalculatorSettingsAccordion';
import ResetButton from '../components/sidebar/ResetButton';
import Tabs from '../components/common/Tabs';
import ChartCard from '../components/common/ChartCard';
import MetricCard from '../components/common/MetricCard';
import Footer from '../components/layout/Footer';
import Header from '../components/layout/Header';

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab]   = useState('country');

  const tabs = [
    { id: 'country', label: 'Country report' },
    { id: 'global',  label: 'Global overview' }
  ];

  const perCapita       = '4.4';
  const adaptationCost  = '$141';
  const mitigationCost  = '$141';

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
           bg-white border-r border-gray-200 p-6
           flex flex-col
           transform transition-transform duration-200
           ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}

           /* Desktop: static flex child again */
           md:relative md:translate-x-0 md:inset-auto md:w-1/4 md:z-auto
         `}
        >
         <div className="flex-1 overflow-auto">
           <DisplaySettings />
           <CalculatorSettingsAccordion />
         </div>

         <div className="mt-4">
           <ResetButton />
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
            {activeTab === 'country' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <ChartCard title="Emissions timeline">
                    <span>Chart placeholder</span>
                  </ChartCard>

                  <ChartCard title="Fair-share breakdown">
                    <span>Chart placeholder</span>
                  </ChartCard>

                  <MetricCard
                    title="Per-capita share"
                    value={perCapita}
                    unit=" tCO₂e"
                  />
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
              </>
            )}

            {activeTab === 'global' && (
              <div className="text-gray-500 text-center py-16">
                Global overview coming soon…
              </div>
            )}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
