import React, { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import './index.css';

export default function DependencePhaseout() {
  const [data, setData] = useState([]);
  const [filterFuel, setFilterFuel] = useState('All');
  const fuels = ['All', 'Oil', 'Gas', 'Coal'];
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  useEffect(() => {
    async function load() {
      const resp   = await fetch('/emissions.xlsx');
      const buffer = await resp.arrayBuffer();
      const wb     = XLSX.read(buffer, { type: 'array' });
    
      // Main sheet
      const mainSheetName = wb.SheetNames.find(name => {
        const hdr = XLSX.utils
          .sheet_to_json(wb.Sheets[name], { header:1, range:0 })[0] || [];
        return hdr.includes('DepTot') && hdr.includes('PhaseoutYr') && hdr.includes('Fuel');
      });
      const mainRows = XLSX.utils.sheet_to_json(wb.Sheets[mainSheetName]);

      // Sub‐sheet (sheet #3)
      const subRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[2]], {
        header: 1,
        range: 1
      });

      // Merge & clip phaseout
      const merged = mainRows.map((r, i) => {
        const sub = subRows[i] || [];
        const raw  = Math.min(r.PhaseoutYr, 2050);
        return {
          country:  r.Country,
          fuel:     r.Fuel,
          E:        sub[3] ?? 0,
          R:        sub[4] ?? 0,
          J:        sub[5] ?? 0,
          total:    r.DepTot,
          phaseout: Math.floor(raw)
        };
      });

      setData(merged);
    }

    load().catch(console.error);
  }, []);

  const displayed = filterFuel === 'All'
    ? data
    : data.filter(d => d.fuel === filterFuel);

    const sorted = useMemo(() => {
        if (!sortConfig.key) return displayed;
    
        // copy before mutating
        const arr = [...displayed];
        const { key, direction } = sortConfig;
    
        arr.sort((a, b) => {
          const v1 = a[key], v2 = b[key];
    
          // numeric comparison when possible
          const num1 = parseFloat(v1), num2 = parseFloat(v2);
          const isNum = !isNaN(num1) && !isNaN(num2);
    
          let cmp = 0;
          if (isNum) {
            cmp = num1 - num2;
          } else {
            cmp = String(v1).localeCompare(String(v2));
          }
          return direction === 'asc' ? cmp : -cmp;
        });
    
        return arr;
      }, [displayed, sortConfig]);
    
      // --- click handler ---
      function handleSort(key) {
        setSortConfig(prev => {
          if (prev.key === key) {
            if (prev.direction === 'asc')  return { key, direction: 'desc' };
            if (prev.direction === 'desc') return { key: null, direction: 'asc' };
          }
          return { key, direction: 'asc' };
        });
      }
  const handleDownloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(displayed);
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws, 'Data');
    XLSX.writeFile(wb2, `dependence_phaseout_${filterFuel}.xlsx`);
  };

  const handleDownloadCSV = () => {
    const ws  = XLSX.utils.json_to_sheet(displayed);
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
          >
            Download XLSX
          </button>
          <button
            onClick={handleDownloadCSV}
            className="bg-blue-400 text-white px-2 py-1 rounded text-xs hover:bg-blue-200"
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

      <div className="dp-scroll">
      <table className="dp-table">
          <thead className="dp-thead">
            <tr>
              <th
                rowSpan={2}
                className="dp-th text-left cursor-pointer"
                onClick={() => handleSort('country')}
              >
                Country {sortConfig.key==='country' ? (sortConfig.direction==='asc' ? ' ↑':' ↓') : ''}
              </th>
              <th
                rowSpan={2}
                className="dp-th text-left cursor-pointer"
                onClick={() => handleSort('fuel')}
              >
                Fuel {sortConfig.key==='fuel' ? (sortConfig.direction==='asc' ? ' ↑':' ↓') : ''}
              </th>
              <th
                colSpan={4}
                className="dp-th text-center"
              >
                Dependence Indicator
              </th>
              <th
                rowSpan={2}
                className="dp-th text-left cursor-pointer"
                onClick={() => handleSort('phaseout')}
              >
                Phaseout Year {sortConfig.key==='phaseout' ? (sortConfig.direction==='asc' ? ' ↑':' ↓') : ''}
              </th>
              <th rowSpan={2} className="dp-th text-left">
                Support
              </th>
              <th rowSpan={2} className="dp-th text-left">
                Reduction in 2030 (%)
              </th>
            </tr>
            <tr>
              {['E','R','J','total'].map(col => (
                <th
                  key={col}
                  className="dp-th text-left cursor-pointer"
                  onClick={() => handleSort(col)}
                >
                  {col.toUpperCase()}{sortConfig.key===col ? (sortConfig.direction==='asc' ? ' ↑':' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="dp-tbody">
            {sorted.map((d,i) => (
              <tr key={i} className="dp-row">
                <td className="dp-td">{d.country}</td>
                <td className="dp-td">{d.fuel}</td>
                <td className="dp-td">{d.E.toFixed(3)}</td>
                <td className="dp-td">{d.R.toFixed(3)}</td>
                <td className="dp-td">{d.J.toFixed(3)}</td>
                <td className="dp-td">{d.total.toFixed(3)}</td>
                <td className="dp-td">{d.phaseout}</td>
              </tr>
            ))}
          </tbody>
        </table>


      </div>
    </div>
  );
}
