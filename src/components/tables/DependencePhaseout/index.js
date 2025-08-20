import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import './index.css';

export default function DependencePhaseout({
  rows = [],              // raw rows from /api/dependence_phaseout.php (fuel=all)
  loading = false,
  error = null,
  selectedCountries = [], 
}) {
  const [filterFuel, setFilterFuel] = useState('All');
  const fuels = ['All', 'Oil', 'Gas', 'Coal'];

  const [sortStack, setSortStack] = useState([]); // [{ key, direction: 'asc'|'desc' }]

  const mapped = useMemo(() => {
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
    return (Array.isArray(rows) ? rows : []).map(r => {
      const fuelTitle = cap(r.fuel);
      const phase = r.PhaseoutYr != null ? Math.min(+r.PhaseoutYr, 2050) : 0;
      const supportRaw = r.support_pct != null ? +r.support_pct : null;
      const supportPct = supportRaw == null
        ? null
        : (supportRaw <= 1 ? supportRaw * 100 : supportRaw); // handle fraction or percent
      return {
        country: r.name || r.iso3,
        fuel: fuelTitle,                      // 'Oil' | 'Coal' | 'Gas'
        Energy: +r.Ext_Energy || 0,
        Revenue: +r.ExtRevbyFuel || 0,
        Jobs: +r.ExtEmp || 0,
        total: +r.DepTot || 0,
        phaseout: phase ? Math.floor(phase) : 0,
        support: supportPct,                 // 0..100 (or null)
        reduction2030: null,
      };
    });
  }, [rows]);

  // filters
  const filteredByFuel = useMemo(
    () => (filterFuel === 'All' ? mapped : mapped.filter(d => d.fuel === filterFuel)),
    [mapped, filterFuel]
  );
  const displayed = useMemo(
    () => (selectedCountries?.length
      ? filteredByFuel.filter(d => selectedCountries.includes(d.country))
      : filteredByFuel),
    [filteredByFuel, selectedCountries]
  );

  // stacked sort helpers
  function isNumberLike(v) {
    const n = parseFloat(v);
    return Number.isFinite(n);
  }
  function cmpValues(a, b) {
    const aEmpty = (a === null || a === undefined || a === '');
    const bEmpty = (b === null || b === undefined || b === '');
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    if (isNumberLike(a) && isNumberLike(b)) {
      const na = parseFloat(a), nb = parseFloat(b);
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    }
    return String(a).localeCompare(String(b));
  }

  const sorted = useMemo(() => {
    if (!sortStack.length) return displayed;
    const arr = [...displayed];

    arr.sort((a, b) => {
      for (const { key, direction } of sortStack) {
        const c = cmpValues(a[key], b[key]);
        if (c !== 0) return direction === 'asc' ? c : -c;
      }
      return 0;
    });
    return arr;
  }, [displayed, sortStack]);

  function handleSort(key) {
    setSortStack(prev => {
      const idx = prev.findIndex(s => s.key === key);
      if (idx === -1) {
        return [...prev, { key, direction: 'asc' }];
      }
      const item = prev[idx];
      if (item.direction === 'asc') {
        const next = prev.slice();
        next[idx] = { key, direction: 'desc' };
        return next;
      }
      return prev.filter((_, i) => i !== idx);
    });
  }
  const sortMarker = (key) => {
    const idx = sortStack.findIndex(s => s.key === key);
    if (idx === -1) return '';
    const arrow = sortStack[idx].direction === 'asc' ? ' ↑' : ' ↓';
    return `${arrow}${idx + 1}`;
  };

  const handleDownloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(sorted);
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws, 'Data');
    XLSX.writeFile(wb2, `dependence_phaseout_${filterFuel}.xlsx`);
  };
  const handleDownloadCSV = () => {
    const ws  = XLSX.utils.json_to_sheet(sorted);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `dependence_phaseout_${filterFuel}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dp-container">
      <div className="dp-header">
        <h3 className="dp-title">Dependence &amp; Phaseout</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleDownloadExcel}
            className="bg-blue-400 text-white px-2 py-1 rounded text-xs hover:bg-blue-200"
            disabled={sorted.length === 0}
          >
            Download XLSX
          </button>
          <button
            onClick={handleDownloadCSV}
            className="bg-blue-400 text-white px-2 py-1 rounded text-xs hover:bg-blue-200"
            disabled={sorted.length === 0}
          >
            Download CSV
          </button>
        </div>
        <select
          className="dp-select"
          value={filterFuel}
          onChange={e => setFilterFuel(e.target.value)}
        >
          {fuels.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="text-sm text-red-600 mb-2">
          {String(error)}
        </div>
      )}
      {loading && (
        <div className="text-sm text-gray-500 mb-2">Loading…</div>
      )}

      <div className="dp-hint text-xs text-gray-500 mb-2">
        Click headers to sort. Click again to reverse. Sorting is stacked in the order you click.
      </div>

      <div className="dp-scroll">
        <table className="dp-table">
          <thead className="dp-thead">
            <tr>
              <th
                rowSpan={2}
                className="dp-th text-left cursor-pointer"
                onClick={() => handleSort('country')}
                title="Sort by Country"
              >
                Country{sortMarker('country')}
              </th>
              <th
                rowSpan={2}
                className="dp-th text-left cursor-pointer"
                onClick={() => handleSort('fuel')}
                title="Sort by Fuel"
              >
                Fuel{sortMarker('fuel')}
              </th>
              <th colSpan={4} className="dp-th text-center">
                Dependence Indicator
              </th>
              <th
                rowSpan={2}
                className="dp-th text-left cursor-pointer"
                onClick={() => handleSort('phaseout')}
                title="Sort by Phaseout Year"
              >
                Phaseout Year{sortMarker('phaseout')}
              </th>
              <th
                rowSpan={2}
                className="dp-th text-left cursor-pointer"
                onClick={() => handleSort('support')}
                title="Sort by Support"
              >
                Support (%){sortMarker('support')}
              </th>
              <th rowSpan={2} className="dp-th text-left">
                Reduction in 2030 (%)
              </th>
            </tr>
            <tr>
              {['Energy','Revenue','Jobs','total'].map(col => (
                <th
                  key={col}
                  className="dp-th text-left cursor-pointer"
                  onClick={() => handleSort(col)}
                  title={`Sort by ${col.toUpperCase()}`}
                >
                  {col.toUpperCase()}{sortMarker(col)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="dp-tbody">
            {sorted.length === 0 && !loading ? (
              <tr>
                <td className="dp-td text-gray-500" colSpan={9}>
                  No data to display
                </td>
              </tr>
            ) : (
              sorted.map((d,i) => (
                <tr key={`${d.country}-${d.fuel}-${i}`} className="dp-row">
                  <td className="dp-td">{d.country}</td>
                  <td className="dp-td">{d.fuel}</td>
                  <td className="dp-td">{d.Energy.toFixed(3)}</td>
                  <td className="dp-td">{d.Revenue.toFixed(3)}</td>
                  <td className="dp-td">{d.Jobs.toFixed(3)}</td>
                  <td className="dp-td">{d.total.toFixed(3)}</td>
                  <td className="dp-td">{d.phaseout || ''}</td>
                  <td className="dp-td">
                    {d.support == null ? '' : `${d.support.toFixed(1)}%`}
                  </td>
                  <td className="dp-td">—</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
