import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import DisplaySettings from '../components/sidebar/DisplaySettings';
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
  const [activeTab, setActiveTab]   = useState('country');
  const [countryOptions, setCountryOptions]       = useState([]);      // all countries
  const [filterText, setFilterText]               = useState('');      // search input
  const [selectedCountries, setSelectedCountries] = useState([]);      // multi‑select
  const tabs = [
    { id: 'country', label: 'Country report' },
    { id: 'global',  label: 'Global overview' }
  ];
   // 1a) Load the list of countries from your LEDPaths.xlsx
 useEffect(() => {
   async function loadCountries() {
     const res = await fetch('/LEDPaths.xlsx');
     const buf = await res.arrayBuffer();
     const wb  = XLSX.read(buf, { type: 'array' });
     const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
     // assume first column is country name
     const all = raw.slice(1).map(r => r[0]).filter(Boolean);
     setCountryOptions(Array.from(new Set(all)).sort());
   }
   loadCountries().catch(console.error);
 }, []);
   // helper to add a country
   const addCountry = country => {
    if (!selectedCountries.includes(country)) {
      setSelectedCountries([...selectedCountries, country]);
    }
    setFilterText('');
  };



  // helper to remove a country
  const removeCountry = country => {
    setSelectedCountries(selectedCountries.filter(c => c !== country));
  };

  // filtered dropdown list (exclude already selected)
  const suggestions = countryOptions
    .filter(c => 
      c.toLowerCase().includes(filterText.toLowerCase()) &&
      !selectedCountries.includes(c)
    )
    .slice(0, 10); // limit to first 10 matches
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
            {activeTab === 'country' && (
              <>
                <div className="mb-6 relative">
                  <label className="block text-sm text-gray-700">
                    Filter by Country
                  </label>
                  {/* Chips */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedCountries.map(country => (
                      <span
                        key={country}
                        className="flex items-center bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                      >
                        {country}
                        <button
                          onClick={() => removeCountry(country)}
                          className="ml-1 focus:outline-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {selectedCountries.length > 1 && (
                      <button
                        onClick={() => setSelectedCountries([])}
                        className="text-xs text-red-600 hover:underline ml-2"
                      >
                        Clear All
                       </button>
                    )}
                  </div>

                  {/* Search input */}
                  <input
                    type="text"
                    placeholder={selectedCountries.length ? "Add another..." : "Search countries..."}
                    className="form-input block w-full rounded-md border-gray-300 focus:border-brand text-xs focus:ring focus:ring-brand/20"
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                  />

                  {/* Dropdown suggestions */}
                  {filterText && suggestions.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-sm max-h-40 overflow-y-auto">
                      {suggestions.map(country => (
                        <li
                          key={country}
                          onClick={() => addCountry(country)}
                          className="cursor-pointer px-3 py-2 hover:bg-gray-100 text-sm"
                        >
                          {country}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-4">
                <ChartCard title="Oil Dependence vs Phaseout">
                  <EmissionsScatterChart fuel="Oil" countries={selectedCountries}/>
                </ChartCard>

                <ChartCard title="Gas Dependence vs Phaseout" >
                  <EmissionsScatterChart fuel="Gas" countries={selectedCountries}/>
                </ChartCard>
                <ChartCard title="Coal Dependence vs Phaseout">
                  <EmissionsScatterChart fuel="Coal" countries={selectedCountries}/>
                </ChartCard>
                <ChartCard title="LEDPaths Coal">
                    <LEDPathsChart fuel="Coal" countries={selectedCountries}/>
                </ChartCard>
                <ChartCard title="LEDPaths Gas">
                    <LEDPathsChart fuel="Gas" countries={selectedCountries}/>
                </ChartCard>
                <ChartCard title="LEDPaths Oil">
                    <LEDPathsChart fuel="Oil" countries={selectedCountries}/>
                </ChartCard>
                </div>

                {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                </div> */}
                <DependencePhaseout countries={selectedCountries}></DependencePhaseout>
              </>
            )}

            {activeTab === 'global' && (
              <>
              <h2 className="text-xl font-semibold text-gray-700 my-4 mx-3">
                Global Capacity Phase‑out
              </h2>
                  <div className="p-4 flex-1">
                    <CapacityPhaseoutChart />
                  </div>

              </>
            )}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
