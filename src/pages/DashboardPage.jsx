import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Parameter from "../components/sidebar/ParameterSettings";
import Tabs from "../components/common/Tabs";
import ChartCard from "../components/common/ChartCard";
import MetricCard from "../components/common/MetricCard";
import Footer from "../components/layout/Footer";
import Header from "../components/layout/Header";
import EmissionsScatterChart from "../components/visualizations/EmissionsScatterChart";
import CapacityPhaseoutChart from "../components/visualizations/CapacityPhaseoutChart";
import LEDPathsChart from "../components/visualizations/LEDPathsChart";
import DependencePhaseout from "../components/tables/DependencePhaseout";
import ParameterSettings from "../components/sidebar/ParameterSettings";
import DisplaySettings from "../components/sidebar/DisplaySettings";
import Cookies from "js-cookie";

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("global");
  const [filterText, setFilterText] = useState(""); // search input
  const [selectedCountries, setSelectedCountries] = useState([]); // multi‑select
  const [labelCountries, setLabelCountries] = useState([]);

  // Playground settings
  const cookieKey = "playgroundSettings";
  const saved = Cookies.get(cookieKey);
  const initial = saved ? JSON.parse(saved) : {};
  const [pgChartTypes, setPgChartTypes] = useState(initial.chartTypes || []);
  const [pgFuelTypes, setPgFuelTypes] = useState(initial.fuelTypes || []);
  const [pgDisplayMode, setPgDisplayMode] = useState(
    initial.displayMode || "side-by-side"
  );
  const [pgParamsets, setPgParamsets] = useState(initial.paramsets || []);

  // dropdown open/close state
  const [chartOpen, setChartOpen] = useState(false);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [paramOpen, setParamOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);

  useEffect(() => {
    Cookies.set(
      cookieKey,
      JSON.stringify({
        chartTypes: pgChartTypes,
        fuelTypes: pgFuelTypes,
        displayMode: pgDisplayMode,
        paramsets: pgParamsets,
      }),
      { expires: 7 }
    );
  }, [pgChartTypes, pgFuelTypes, pgDisplayMode, pgParamsets]);

  const chartOptions = [
    { id: "scatter", label: "Emissions Scatter" },
    { id: "ledpaths", label: "LEDPaths" },
    { id: "phaseout", label: "Capacity Phase-out" },
  ];
  const fuelOptions = [
    { id: "Oil", label: "Oil" },
    { id: "Coal", label: "Coal" },
    { id: "Gas", label: "Gas" },
  ];
  const availableParamSets = ["Default", "High Demand", "Low Demand"];
  const toggleParamset = (name) => {
    setPgParamsets((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };
  const tabs = [
    { id: "global", label: "Global Overview" },
    { id: "dash", label: "Phaseout Dashboard" },
    { id: "comp", label: "Playground" },
  ];
  const toggleChartType = (id) => {
    setPgChartTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const toggleFuelType = (id) => {
    setPgFuelTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  return (
    <div className="flex flex-col h-screen font-body">
      <Header />
      <header className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="px-3 py-1 bg-brand text-white rounded-md text-sm"
        >
          {sidebarOpen ? "Hide Filters" : "Show Filters"}
        </button>
      </header>

      <div className="flex flex-1 relative">
        <aside
          className={`
          absolute inset-y-0 left-0 z-40 w-full
          bg-white border-r border-gray-200
          transform transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:inset-auto md:w-1/4 md:z-auto
        `}
        >
          <div className="flex flex-col h-full p-6 space-y-2">
            <ParameterSettings />
            <DisplaySettings
              selectedCountries={selectedCountries}
              setSelectedCountries={setSelectedCountries}
              labelCountries={labelCountries}
              setLabelCountries={setLabelCountries}
            />
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
            {activeTab === "global" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-4">
                  <ChartCard title="Oil Dependence vs Phaseout">
                    <EmissionsScatterChart
                      fuel="Oil"
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                    />
                  </ChartCard>
                  <ChartCard title="LEDPaths Oil">
                    <LEDPathsChart
                      fuel="Oil"
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                    />
                  </ChartCard>
                  <ChartCard title="Coal Dependence vs Phaseout">
                    <EmissionsScatterChart
                      fuel="Coal"
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                    />
                  </ChartCard>
                  <ChartCard title="LEDPaths Coal">
                    <LEDPathsChart
                      fuel="Coal"
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                    />
                  </ChartCard>
                  <ChartCard title="Gas Dependence vs Phaseout">
                    <EmissionsScatterChart
                      fuel="Gas"
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                    />
                  </ChartCard>
                  <ChartCard title="LEDPaths Gas">
                    <LEDPathsChart
                      fuel="Gas"
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                    />
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
                <DependencePhaseout></DependencePhaseout>
              </>
            )}

            {activeTab === "dash" && (
              <>
                <h2 className="text-xl font-semibold text-gray-700 my-4 mx-3">
                  Global Capacity Phase‑out
                </h2>

                <div className="flex flex-col items-center">
                  {/* Oil */}

                  <div className="w-full max-w-2xl px-4">
                    <CapacityPhaseoutChart
                      fuel="Oil"
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                    />
                  </div>
                  <hr className="w-full max-w-2xl border-t border-gray-300 my-4" />

                  {/* Coal */}
                  <div className="w-full max-w-2xl px-4">
                    <CapacityPhaseoutChart
                      fuel="Coal"
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                    />
                  </div>
                  <hr className="w-full max-w-2xl border-t border-gray-300 my-4" />

                  {/* Gas */}
                  <div className="w-full max-w-2xl px-4">
                    <CapacityPhaseoutChart
                      fuel="Gas"
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                    />
                  </div>
                </div>
              </>
            )}
            {activeTab === "comp" && (
              <div>
                {/* Header with hover-dropdowns and toggle */}
                <div className="flex flex-wrap items-center space-x-4 mb-6">
                  <h2 className="text-2xl font-semibold">Playground</h2>

                  {/* Charts dropdown */}
                  <div className="relative group">
                    <button className="text-sm px-3 py-1">Charts ⌄</button>
                    <div className="absolute left-0 mt-1 bg-white shadow-md rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      {chartOptions.map((o) => (
                        <label
                          key={o.id}
                          className="text-sm flex items-center mb-1"
                        >
                          <input
                            type="checkbox"
                            className="text-sm mr-2"
                            checked={pgChartTypes.includes(o.id)}
                            onChange={() => toggleChartType(o.id)}
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Fuels dropdown */}
                  <div className="relative group">
                    <button className="text-sm px-3 py-1">Fuels ⌄</button>
                    <div className="absolute left-0 mt-1 bg-white shadow-md rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      {fuelOptions.map((o) => (
                        <label
                          key={o.id}
                          className="text-sm flex items-center mb-1"
                        >
                          <input
                            type="checkbox"
                            className="mr-2 text-sm"
                            checked={pgFuelTypes.includes(o.id)}
                            onChange={() => toggleFuelType(o.id)}
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Parameters dropdown */}
                  <div className="relative group">
                    <button className="text-sm px-3 py-1">Param Sets ⌄</button>
                    <div className="absolute left-0 mt-1 bg-white shadow-md rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      {availableParamSets.map((name) => (
                        <label
                          key={name}
                          className="text-sm flex items-center mb-1"
                        >
                          <input
                            type="checkbox"
                            className="text-sm mr-2 "
                            checked={pgParamsets.includes(name)}
                            onChange={() => toggleParamset(name)}
                          />
                          {name}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Display Mode toggle */}
                  <div className="flex items-center border rounded">
                    <button
                      className={`text-sm px-3 py-1 rounded-l ${
                        pgDisplayMode === "side-by-side"
                          ? "bg-brand text-white"
                          : "bg-white text-gray-700"
                      }`}
                      onClick={() => setPgDisplayMode("side-by-side")}
                    >
                      Side-by-Side
                    </button>
                    <button
                      className={`text-sm px-3 py-1 rounded-r ${
                        pgDisplayMode === "overlay"
                          ? "bg-brand text-white"
                          : "bg-white text-gray-700"
                      }`}
                      onClick={() => setPgDisplayMode("overlay")}
                    >
                      Overlay
                    </button>
                  </div>
                </div>

                {/* Chart grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pgFuelTypes.length > 0 && pgChartTypes.length > 0 ? (
                    pgFuelTypes.map((fuel) =>
                      pgChartTypes.map((chart) => {
                        const key = `${chart}-${fuel}`;
                        let Comp, title;
                        switch (chart) {
                          case "scatter":
                            Comp = EmissionsScatterChart;
                            title = `${fuel} Emissions vs Phaseout`;
                            break;
                          case "ledpaths":
                            Comp = LEDPathsChart;
                            title = `LEDPaths ${fuel}`;
                            break;
                          case "phaseout":
                            Comp = CapacityPhaseoutChart;
                            title = `${fuel} Capacity Phase-out`;
                            break;
                          default:
                            return null;
                        }
                        return (
                          <ChartCard key={key} title={title}>
                            <Comp
                              fuel={fuel}
                              countries={selectedCountries}
                              labelCountries={labelCountries}
                            />
                          </ChartCard>
                        );
                      })
                    )
                  ) : (
                    <div className="col-span-full bg-white p-6 rounded shadow text-gray-600">
                      Select at least one chart and one fuel.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
