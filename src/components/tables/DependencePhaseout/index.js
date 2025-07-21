import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import './index.css';

export default function DependencePhaseout() {
  const [data, setData] = useState([]);
  const [filterFuel, setFilterFuel] = useState('All');
  const fuels = ['All', 'Oil', 'Gas', 'Coal'];

  useEffect(() => {
    async function load() {
      const resp = await fetch('/emissions.xlsx');
      const buffer = await resp.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      // find sheet with DepTot and PhaseoutYr
      const sheetName = wb.SheetNames.find(name => {
        const hdr = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, range: 0 })[0] || [];
        return hdr.includes('DepTot') && hdr.includes('PhaseoutYr') && hdr.includes('Fuel');
      });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      const mapped = rows.map(r => ({
        country: r.Country,
        fuel:    r.Fuel,
        phaseout: Math.min(r.PhaseoutYr, 2050),
        dependence: r.DepTot
      }));
      setData(mapped);
    }
    load().catch(console.error);
  }, []);

  const displayed = filterFuel === 'All'
    ? data
    : data.filter(d => d.fuel === filterFuel);

    return (
        <div className="dp-container">
          <div className="dp-header">
            <h3 className="dp-title">Dependence &amp; Phaseout</h3>
            <select
              className="dp-select"
              value={filterFuel}
              onChange={e => setFilterFuel(e.target.value)}
            >
              {fuels.map(f => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
    
          <div className="dp-scroll">
            <table className="dp-table">
              <thead className="dp-thead">
                <tr>
                  <th className="dp-th">Country</th>
                  <th className="dp-th">Fuel</th>
                  <th className="dp-th">Dependence Indicator</th>
                  <th className="dp-th">Phaseout Year</th>
                </tr>
              </thead>
              <tbody className="dp-tbody">
                {displayed.map((d, i) => (
                  <tr key={i} className="dp-row">
                    <td className="dp-td">{d.country}</td>
                    <td className="dp-td">{d.fuel}</td>
                    <td className="dp-td">{d.dependence.toFixed(3)}</td>
                    <td className="dp-td">{d.phaseout}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
