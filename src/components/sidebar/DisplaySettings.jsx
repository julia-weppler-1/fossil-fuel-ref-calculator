import React, { useContext } from 'react';
import { ParametersContext } from '../../context/ParametersContext';

export default function DisplaySettings() {
  const { parameters, setParameters } = useContext(ParametersContext);

  return (
    <section className="mb-6 font-body">
      <h2 className="flex items-center bg-brand text-white text-sm font-bold uppercase px-4 py-2 rounded-t-lg">
        ▼ Display settings
      </h2>

      <div className="bg-white border border-gray-200 rounded-b-lg shadow-sm p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Table view
          </label>
          <select
            className="form-select block w-full rounded-md border-gray-300 focus:border-brand focus:ring focus:ring-brand/20"
            value={parameters.tableView}
            onChange={e =>
              setParameters(p => ({ ...p, tableView: e.target.value }))
            }
          >
            <option value="country">Country/region report</option>
            <option value="world">World summary</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Country or region to display
          </label>
          <select
            className="form-select block w-full rounded-md border-gray-300 focus:border-brand focus:ring focus:ring-brand/20"
            value={parameters.region}
            onChange={e =>
              setParameters(p => ({ ...p, region: e.target.value }))
            }
          >
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Year to display
          </label>
          <select
            className="form-select block w-full rounded-md border-gray-300 focus:border-brand focus:ring focus:ring-brand/20"
            value={parameters.year}
            onChange={e =>
              setParameters(p => ({ ...p, year: +e.target.value }))
            }
          >
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Base Year for table
          </label>
          <select
            className="form-select block w-full rounded-md border-gray-300 focus:border-brand focus:ring focus:ring-brand/20"
            value={parameters.baseYear}
            onChange={e =>
              setParameters(p => ({ ...p, baseYear: +e.target.value }))
            }
          >
          </select>
        </div>

        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer bg-brand-light text-brand px-3 py-2 text-xs font-medium rounded-md">
            Advanced Display Settings
            <span className="transform group-open:rotate-180 transition">⌄</span>
          </summary>
          <div className="mt-2 space-y-2">
          </div>
        </details>
      </div>

    </section>
  );
}
