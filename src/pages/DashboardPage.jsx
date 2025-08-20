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
import PlaygroundPivot from "../components/tables/PlaygroundPivot";

function useActiveResultId() {
  const [rid, setRid] = useState(
    () => localStorage.getItem("active.result_id") ?? "1"
  );
  useEffect(() => {
    const onEvt = (e) => {
      const next = e?.detail != null ? String(e.detail) : null;
      if (next) setRid(next);
    };
    window.addEventListener("active-result-id", onEvt);

    return () => {
      window.removeEventListener("active-result-id", onEvt);
    };
  }, []);
  console.log("RID:", rid);
  return rid;
}

export default function DashboardPage() {
  const [phaseoutStartYear, setPhaseoutStartYear] = useState(
    () => Number(localStorage.getItem("active.earliest_year")) || 2030
  );
  const [phaseoutLineYear, setPhaseoutLineYear] = useState(
    () => Number(localStorage.getItem("active.latest_year")) || 2050
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("global");
  const [filterText, setFilterText] = useState(""); // search input
  const [selectedCountries, setSelectedCountries] = useState([]); // multi‑select
  const [labelCountries, setLabelCountries] = useState([]);
  const [ledChartKind, setLedChartKind] = useState("line"); // 'line' | 'stacked'
  const [ledYAxisMode, setLedYAxisMode] = useState("relative");

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

  const [ledYMax, setLedYMax] = useState(0);
  const [scatterYMax, setScatterYMax] = useState(null);
  const [capYMax, setCapYMax] = useState(null);

  const [pgLedYMax, setPgLedYMax] = useState(null);
  const [pgScatterYMax, setPgScatterYMax] = useState(null);
  const [pgCapYMax, setPgCapYMax] = useState(null);

  const [resultId, setResultId] = useState(null);

  const [scatterRows, setScatterRows] = useState([]);
  const [scatterLoading, setScatterLoading] = useState(false);
  const [scatterError, setScatterError] = useState(null);
  const [ledSeriesByFuel, setLedSeriesByFuel] = useState({
    oil: [],
    coal: [],
    gas: [],
  });
  const [ledError, setLedError] = useState(null);
  const [ledLoading, setLedLoading] = useState(false);
  const [capRows, setCapRows] = useState([]);
  const [capLoading, setCapLoading] = useState(false);
  const [capError, setCapError] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState(null);
  const [pivotRidEntries, setPivotRidEntries] = useState(() =>
    toRidEntries(readAllSavedSets())
  );

  // helper to read saved sets with known result_id (provided by ParameterSettings)
  const SAVED_SETS_LS = "paramSettings.savedSets.v1";

  function readAllSavedSets() {
    try {
      const raw = localStorage.getItem(SAVED_SETS_LS);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function toRidEntries(sets) {
    const out = [];
    for (const s of sets) {
      if (!s) continue;
      const name =
        (typeof s === "string" ? s : s.name) ||
        s?.meta?.set_name ||
        s?.parameters?.meta?.set_name ||
        null;

      const rid =
        s?.meta?.known_result_id ??
        s?.result_id ??
        s?.resultId ??
        s?.rid ??
        s?.param_sets?.result_id ?? // if a schema-like object was stored
        null;

      const ridNum = rid != null ? Number(rid) : null;
      if (name && Number.isFinite(ridNum) && ridNum > 0) {
        out.push({ name: String(name), result_id: String(ridNum) });
      }
    }
    // de-dupe by (name,result_id) keeping first occurrence (UI order friendliness)
    const seen = new Set();
    return out.filter(({ name, result_id }) => {
      const k = `${name}::${result_id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function dedupByRid(list) {
    const seen = new Set();
    const out = [];
    for (const x of list) {
      const k = String(x.result_id);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  }

  const handleCapYMax = (val) => {
    setCapYMax((prev) => {
      const candidate = Math.ceil((val ?? 0) + 2);
      return prev == null ? candidate : Math.max(prev, candidate);
    });
  };
  function handleYMax(val) {
    setScatterYMax((prev) => (prev == null ? val : Math.max(prev, val)));
  }
  const handleLedYMax = (localMax) => {
    setLedYMax((prev) => {
      const candidate = Math.ceil((localMax ?? 0) + 1);
      return Math.max(prev, candidate);
    });
  };
  const handlePgLedYMax = (val) =>
    setPgLedYMax((prev) => Math.max(prev ?? 0, Math.ceil((val ?? 0) + 2)));
  const handlePgScatterYMax = (val) =>
    setPgScatterYMax((prev) => Math.max(prev ?? 0, Math.ceil((val ?? 0) + 2)));
  const handlePgCapYMax = (val) =>
    setPgCapYMax((prev) => Math.max(prev ?? 0, Math.ceil((val ?? 0) + 2)));

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
  useEffect(() => {
    const onEarliest = (e) => setPhaseoutStartYear(Number(e.detail) || 2030);
    const onLatest = (e) => setPhaseoutLineYear(Number(e.detail) || 2050);
    window.addEventListener("active-earliest-year", onEarliest);
    window.addEventListener("active-latest-year", onLatest);
    return () => {
      window.removeEventListener("active-earliest-year", onEarliest);
      window.removeEventListener("active-latest-year", onLatest);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const rid =
      resultId && Number.isFinite(Number(resultId)) && Number(resultId) > 0
        ? String(resultId)
        : "1";
    (async () => {
      try {
        setScatterLoading(true);
        setLedLoading(true);
        setCapLoading(true);
        setTableLoading(true);

        setScatterError(null);
        setLedError(null);
        setCapError(null);

        setLedYMax(0);
        setCapYMax(null);
        setTableError(null);
        setLedSeriesByFuel({ oil: [], coal: [], gas: [] });
        const scatterUrl = new URL(
          "/api/results_emissions_scatter.php",
          window.location.origin
        );
        scatterUrl.searchParams.set("result_id", rid);

        // NOTE: no `fuel` param => PHP returns all fuels
        const ledUrl = new URL(
          "/api/results_timeseries.php",
          window.location.origin
        );
        ledUrl.searchParams.set("result_id", rid);

        const capUrl = new URL(
          "/api/capacity_phaseout.php",
          window.location.origin
        );
        capUrl.searchParams.set("fuel", "all");
        capUrl.searchParams.set("result_id", rid);

        const tableUrl = new URL(
          "/api/dependence_phaseout.php",
          window.location.origin
        );
        tableUrl.searchParams.set("fuel", "all");
        tableUrl.searchParams.set("result_id", rid);

        const [scatterRes, ledRes, capRes, tableRes] = await Promise.all([
          fetch(scatterUrl.toString(), { credentials: "same-origin" }),
          fetch(ledUrl.toString(), { credentials: "same-origin" }),
          fetch(capUrl.toString(), { credentials: "same-origin" }),
          fetch(tableUrl.toString(), { credentials: "same-origin" }),
        ]);
        const [scatterJson, ledJson, capJson, tableJson] = await Promise.all([
          scatterRes.json(),
          ledRes.json(),
          capRes.json(),
          tableRes.json(),
        ]);
        if (!alive) return;
        if (!scatterRes.ok)
          throw new Error(
            scatterJson?.error || `Scatter HTTP ${scatterRes.status}`
          );
        if (!ledRes.ok)
          throw new Error(ledJson?.error || `LED HTTP ${ledRes.status}`);
        if (!capRes.ok)
          throw new Error(capJson?.error || `Capacity HTTP ${capRes.status}`);
        if (!tableRes.ok)
          throw new Error(tableJson?.error || `Table HTTP ${tableRes.status}`);

        setScatterRows(Array.isArray(scatterJson.rows) ? scatterJson.rows : []);
        const byFuel = ledJson.series_by_fuel || {};
        setLedSeriesByFuel({
          oil: byFuel.oil || [],
          coal: byFuel.coal || [],
          gas: byFuel.gas || [],
        });
        setCapRows(Array.isArray(capJson.rows) ? capJson.rows : []);
        setTableRows(Array.isArray(tableJson.rows) ? tableJson.rows : []);
      } catch (err) {
        if (alive) {
          const msg = String(err.message || err);
          setScatterError((prev) => prev ?? msg);
          setLedError((prev) => prev ?? msg);
          setCapError((prev) => prev ?? msg);
          setTableError((prev) => prev ?? msg);
        }
      } finally {
        if (alive) {
          setScatterLoading(false);
          setLedLoading(false);
          setCapLoading(false);
          setTableLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [resultId]);

  useEffect(() => {
    setPgLedYMax(null);
    setPgScatterYMax(null);
    setPgCapYMax(null);
  }, [
    pgChartTypes,
    pgFuelTypes,
    selectedCountries,
    pgDisplayMode,
    activeTab,
    ledChartKind,
    ledYAxisMode,
  ]);

  const chartOptions = [
    { id: "scatter", label: "Emissions Scatter" },
    { id: "ledpaths", label: "Phaseout Pathway" },
    { id: "phaseout", label: "Capacity Phaseout" },
  ];
  const fuelOptions = [
    { id: "Oil", label: "Oil" },
    { id: "Coal", label: "Coal" },
    { id: "Gas", label: "Gas" },
  ];
  const [availableParamSets, setAvailableParamSets] = useState(() => {
    try {
      const raw = localStorage.getItem(SAVED_SETS_LS);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map((s) => s.name).filter(Boolean) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const refresh = () => {
      setPivotRidEntries(toRidEntries(readAllSavedSets()));
      try {
        const raw = localStorage.getItem(SAVED_SETS_LS);
        const arr = raw ? JSON.parse(raw) : [];
        setAvailableParamSets(
          Array.isArray(arr) ? arr.map((s) => s?.name).filter(Boolean) : []
        );
      } catch {
        console.log("Error")
      }
    };
    const onStorage = (e) => {
      if (!e || e.key === SAVED_SETS_LS) refresh();
    };

    window.addEventListener("param-sets-updated", refresh);
    window.addEventListener("storage", onStorage);

    refresh();

    return () => {
      window.removeEventListener("param-sets-updated", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    setPgParamsets((prev) =>
      prev.filter((n) => availableParamSets.includes(n))
    );
  }, [availableParamSets]);
  const toggleParamset = (name) => {
    setPgParamsets((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };

  const activePivotSets = React.useMemo(() => {
    if (pgParamsets.length) {
      const byName = new Map(pivotRidEntries.map((x) => [x.name, x]));
      return pgParamsets.map((n) => byName.get(n)).filter(Boolean);
    }
    return pivotRidEntries;
  }, [pivotRidEntries, pgParamsets]);

  const ridEntries = React.useMemo(() => activePivotSets, [activePivotSets]);

  const [pgDataByRid, setPgDataByRid] = useState({});
  const pgDataRef = React.useRef(pgDataByRid);
  useEffect(() => {
    pgDataRef.current = pgDataByRid;
  }, [pgDataByRid]);

  const ensurePgData = React.useCallback(async (rid) => {
    if (!rid) return;
    const current = pgDataRef.current[rid];
    if (current?.status === "ready" || current?.status === "loading") return;

    setPgDataByRid((prev) => ({
      ...prev,
      [rid]: { ...(prev[rid] || {}), status: "loading", error: null },
    }));
    try {
      const scatterUrl = new URL(
        "/api/results_emissions_scatter.php",
        window.location.origin
      );
      scatterUrl.searchParams.set("result_id", rid);

      const ledUrl = new URL(
        "/api/results_timeseries.php",
        window.location.origin
      );
      ledUrl.searchParams.set("result_id", rid);

      const capUrl = new URL(
        "/api/capacity_phaseout.php",
        window.location.origin
      );
      capUrl.searchParams.set("fuel", "all");
      capUrl.searchParams.set("result_id", rid);

      const [scatterRes, ledRes, capRes] = await Promise.all([
        fetch(scatterUrl, { credentials: "same-origin" }),
        fetch(ledUrl, { credentials: "same-origin" }),
        fetch(capUrl, { credentials: "same-origin" }),
      ]);
      const [scatterJson, ledJson, capJson] = await Promise.all([
        scatterRes.json(),
        ledRes.json(),
        capRes.json(),
      ]);

      if (!scatterRes.ok)
        throw new Error(
          scatterJson?.error || `Scatter HTTP ${scatterRes.status}`
        );
      if (!ledRes.ok)
        throw new Error(ledJson?.error || `LED HTTP ${ledRes.status}`);
      if (!capRes.ok)
        throw new Error(capJson?.error || `Capacity HTTP ${capRes.status}`);

      const byFuel = ledJson.series_by_fuel || {};
      setPgDataByRid((prev) => ({
        ...prev,
        [rid]: {
          status: "ready",
          error: null,
          scatterRows: Array.isArray(scatterJson.rows) ? scatterJson.rows : [],
          series_by_fuel: {
            oil: byFuel.oil || [],
            coal: byFuel.coal || [],
            gas: byFuel.gas || [],
          },
          capRows: Array.isArray(capJson.rows) ? capJson.rows : [],
        },
      }));
    } catch (e) {
      setPgDataByRid((prev) => ({
        ...prev,
        [rid]: { status: "error", error: String(e.message || e) },
      }));
    }
  }, []);

  useEffect(() => {

    ridEntries.forEach(({ result_id }) => ensurePgData(result_id));
  }, [ridEntries, ensurePgData]);

  const tabs = [
    { id: "global", label: "Global Overview" },
    { id: "dash", label: "Support Dashboard" },
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
  console.log("activePivotSets", activePivotSets);
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
            <ParameterSettings onResultReady={(rid) => setResultId(rid)} />
            <DisplaySettings
              selectedCountries={selectedCountries}
              setSelectedCountries={setSelectedCountries}
              labelCountries={labelCountries}
              setLabelCountries={setLabelCountries}
              ledChartKind={ledChartKind}
              setLedChartKind={setLedChartKind}
              ledYAxisMode={ledYAxisMode}
              setLedYAxisMode={setLedYAxisMode}
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
                      data={scatterRows}
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                      yMax={scatterYMax}
                      onYMax={handleYMax}
                      loading={scatterLoading}
                      error={scatterError}
                      xStartYear={phaseoutStartYear}
                      phaseoutLineYear={phaseoutLineYear}
                    />
                  </ChartCard>
                  <ChartCard title="Phaseout Pathway for Oil">
                    <LEDPathsChart
                      key={`led-oil-${resultId}-${ledChartKind}-${ledYAxisMode}`}
                      fuel="Oil"
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                      onYMax={handleLedYMax}
                      yMax={ledYMax}
                      chartKind={ledChartKind}
                      yMode={ledYAxisMode}
                      data={ledSeriesByFuel.oil}
                      scatterRows={scatterRows}
                    />
                  </ChartCard>
                  <ChartCard title="Coal Dependence vs Phaseout">
                    <EmissionsScatterChart
                      fuel="Coal"
                      data={scatterRows}
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                      yMax={scatterYMax}
                      onYMax={handleYMax}
                      loading={scatterLoading}
                      error={scatterError}
                      xStartYear={phaseoutStartYear}
                      phaseoutLineYear={phaseoutLineYear}
                    />
                  </ChartCard>
                  <ChartCard title="Phaseout Pathway for Coal">
                    <LEDPathsChart
                      key={`led-coal-${resultId}-${ledChartKind}-${ledYAxisMode}`}
                      fuel="Coal"
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                      onYMax={handleLedYMax}
                      yMax={ledYMax}
                      chartKind={ledChartKind}
                      yMode={ledYAxisMode}
                      data={ledSeriesByFuel.coal}
                      scatterRows={scatterRows}
                    />
                  </ChartCard>
                  <ChartCard title="Gas Dependence vs Phaseout">
                    <EmissionsScatterChart
                      fuel="Gas"
                      data={scatterRows}
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                      yMax={scatterYMax}
                      onYMax={handleYMax}
                      loading={scatterLoading}
                      error={scatterError}
                      xStartYear={phaseoutStartYear}
                      phaseoutLineYear={phaseoutLineYear}
                    />
                  </ChartCard>
                  <ChartCard title="Phaseout Pathway for Gas">
                    <LEDPathsChart
                      key={`led-gas-${resultId}-${ledChartKind}-${ledYAxisMode}`}
                      fuel="Gas"
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                      onYMax={handleLedYMax}
                      yMax={ledYMax}
                      chartKind={ledChartKind}
                      yMode={ledYAxisMode}
                      data={ledSeriesByFuel.gas}
                      scatterRows={scatterRows}
                    />
                  </ChartCard>
                </div>

                <DependencePhaseout
                  rows={tableRows}
                  loading={tableLoading}
                  error={tableError}
                  selectedCountries={selectedCountries}
                />
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
                      rows={capRows}
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                      yMax={capYMax}
                      onYMax={handleCapYMax}
                    />
                  </div>
                  <hr className="w-full max-w-2xl border-t border-gray-300 my-4" />

                  {/* Coal */}
                  <div className="w-full max-w-2xl px-4">
                    <CapacityPhaseoutChart
                      fuel="Coal"
                      rows={capRows}
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                      yMax={capYMax}
                      onYMax={handleCapYMax}
                    />
                  </div>
                  <hr className="w-full max-w-2xl border-t border-gray-300 my-4" />

                  {/* Gas */}
                  <div className="w-full max-w-2xl px-4">
                    <CapacityPhaseoutChart
                      fuel="Gas"
                      rows={capRows}
                      countries={selectedCountries}
                      labelCountries={labelCountries}
                      yMax={capYMax}
                      onYMax={handleCapYMax}
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
                  {/* <div className="flex items-center border rounded">
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
                  </div> */}
                </div>

                {/* Chart grid */}
                <div className="mx-auto max-w-screen-xl grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {pgFuelTypes.length > 0 && pgChartTypes.length > 0 ? (
                    pgFuelTypes.flatMap((fuel) =>
                      pgChartTypes.flatMap((chart) => {
                        const baseKey = `${chart}-${fuel}`;
                        const knownCharts = new Set([
                          "scatter",
                          "ledpaths",
                          "phaseout",
                        ]);

                        const titleBase =
                          chart === "scatter"
                            ? `${fuel} Emissions vs Phaseout`
                            : chart === "ledpaths"
                            ? `Phaseout Pathway ${fuel}`
                            : chart === "phaseout"
                            ? `${fuel} Capacity Phaseout`
                            : baseKey;

                        // If nothing selected, show a one-time helper card
                        if (!activePivotSets.length) {
                          return (
                            <div
                              key={`${baseKey}-empty`}
                              className="col-span-full bg-white p-6 rounded shadow text-gray-600"
                            >
                              Select at least one parameter set to view
                              Playground charts.
                            </div>
                          );
                        }

                        // Skip unknown chart ids (from old cookies, etc.)
                        if (!knownCharts.has(chart)) return null;

                        return activePivotSets.map(({ name, result_id }) => {
                          const dataForRid = pgDataByRid?.[result_id] || {};
                          const fuelKey = (fuel || "").toLowerCase();

                          const scatterRowsRID = dataForRid.scatterRows || [];
                          const ledSeriesForFuelRID =
                            (dataForRid.series_by_fuel &&
                              dataForRid.series_by_fuel[fuelKey]) ||
                            [];
                          const capRowsRID = dataForRid.capRows || [];

                          const status = dataForRid.status || "idle";
                          const error = dataForRid.error || null;
                          const loading = status === "loading";

                          const commonProps = {
                            countries: selectedCountries,
                            labelCountries,
                          };

                          let content;
                          if (chart === "scatter") {
                            content = (
                              <EmissionsScatterChart
                                fuel={fuel}
                                data={scatterRowsRID}
                                yMax={pgScatterYMax}
                                onYMax={handlePgScatterYMax}
                                loading={loading}
                                error={error}
                                xStartYear={phaseoutStartYear}
                                phaseoutLineYear={phaseoutLineYear}
                                {...commonProps}
                              />
                            );
                          } else if (chart === "ledpaths") {
                            content = (
                              <LEDPathsChart
                                fuel={fuel}
                                data={ledSeriesForFuelRID}
                                scatterRows={scatterRowsRID}
                                yMax={pgLedYMax}
                                onYMax={handlePgLedYMax}
                                chartKind={ledChartKind}
                                yMode={ledYAxisMode}
                                {...commonProps}
                              />
                            );
                          } else if (chart === "phaseout") {
                            content = (
                              <CapacityPhaseoutChart
                                fuel={fuel}
                                rows={capRowsRID}
                                yMax={pgCapYMax}
                                onYMax={handlePgCapYMax}
                                {...commonProps}
                              />
                            );
                          }

                          // fallback placeholder if something slips through
                          if (!content) {
                            content = (
                              <div className="text-sm text-gray-500 min-h-[80px] flex items-center">
                                {error ? `Error: ${error}` : "Loading…"}
                              </div>
                            );
                          }

                          return (
                            <ChartCard
                              key={`${baseKey}-${result_id}`}
                              title={`${titleBase} — ${name}`}
                            >
                              {content}
                            </ChartCard>
                          );
                        });
                      })
                    )
                  ) : (
                    <div className="col-span-full bg-white p-6 rounded shadow text-gray-600">
                      Select at least one chart and one fuel.
                    </div>
                  )}
                </div>
                <div className="mt-8">
                  <PlaygroundPivot
                    selectedCountries={selectedCountries}
                    selectedFuels={pgFuelTypes}
                    paramsets={pgParamsets} 
                    resultSets={activePivotSets} 
                  />
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
