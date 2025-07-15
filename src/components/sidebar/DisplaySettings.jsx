import React, { useContext } from 'react';
import { ParametersContext } from '../../context/ParametersContext';

const mitigationOptions = [
  { id: 1, label: 'Low Energy Demand Scenario' },
  { id: 2, label: 'High Energy Demand Scenario' },
];

const scalingOptions = [
  'CSER High Capacity',
  'off',
];

export default function DisplaySettings() {
  const { parameters, setParameters } = useContext(ParametersContext);

  const wDom = parameters.weightDomestic ?? 33;
  const wRev = parameters.weightRevenue ?? 33;
  const wJobs = parameters.weightJobs ?? 34;

  return (
    <section className="mb-6 font-body">
      <h2 className="flex items-center bg-brand text-white text-sm font-bold uppercase px-4 py-2 rounded-t-lg">
        ▼ Input Selection
      </h2>
      <div className="bg-white border border-gray-200 rounded-b-lg shadow-sm p-4 space-y-4">
        {/* Mitigation Pathway / Carbon Budget */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Mitigation Pathway / Carbon Budget
          </label>
          <select
            className="form-select block w-full rounded-md border-gray-300 focus:border-brand focus:ring focus:ring-brand/20"
            value={parameters.mitigationPathwayId ?? mitigationOptions[0].id}
            onChange={e =>
              setParameters(p => ({ ...p, mitigationPathwayId: +e.target.value }))
            }
          >
            {mitigationOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Earliest Phaseout Year */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Earliest Phaseout Year
          </label>
          <input
            type="number"
            min={new Date().getFullYear()}
            max="2100"
            className="form-input block w-full rounded-md border-gray-300 focus:border-brand focus:ring focus:ring-brand/20"
            value={parameters.earliestPhaseoutYear ?? 2030}
            onChange={e =>
              setParameters(p => ({ ...p, earliestPhaseoutYear: +e.target.value }))
            }
          />
        </div>

        {/* Latest Phaseout Year */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Latest Phaseout Year
          </label>
          <input
            type="number"
            min={parameters.earliestPhaseoutYear ?? 2030}
            max="2100"
            className="form-input block w-full rounded-md border-gray-300 focus:border-brand focus:ring focus:ring-brand/20"
            value={parameters.latestPhaseoutYear ?? 2050}
            onChange={e =>
              setParameters(p => ({ ...p, latestPhaseoutYear: +e.target.value }))
            }
          />
        </div>

        {/* Phaseout Threshold */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Phaseout Threshold (%)
          </label>
          <input
            type="number"
            min="80"
            max="100"
            step="1"
            className="form-input block w-full rounded-md border-gray-300 focus:border-brand focus:ring focus:ring-brand/20"
            value={parameters.phaseoutThreshold ?? 90}
            onChange={e =>
              setParameters(p => ({ ...p, phaseoutThreshold: +e.target.value }))
            }
          />
        </div>

        {/* Scaling of Dependence by Capacity */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Scaling of Dependence by Capacity
          </label>
          <select
            className="form-select block w-full rounded-md border-gray-300 focus:border-brand focus:ring focus:ring-brand/20"
            value={parameters.scalingOption ?? scalingOptions[0]}
            onChange={e =>
              setParameters(p => ({ ...p, scalingOption: e.target.value }))
            }
          >
            {scalingOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Weighting of Dependence Elements */}
        <div>
          <label className="block text-s font-medium text-gray-700 mb-1">
            Weightings
          </label>
          <div className="grid grid-cols-3 gap-4 items-end">
            {/* Domestic Energy */}
            <div className="flex flex-col items-center">
              <label className="text-xs text-center text-gray-600 mb-1 whitespace-normal">
                Domestic Energy (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="form-input block w-full rounded-md border-gray-300 text-center focus:border-brand focus:ring focus:ring-brand/20"
                value={wDom}
                onChange={e => {
                  const newDom = +e.target.value;
                  const adjRev = Math.max(0, 100 - newDom - wJobs);
                  setParameters(p => ({ ...p, weightDomestic: newDom, weightRevenue: adjRev }));
                }}
              />
            </div>

            {/* Government Revenue */}
            <div className="flex flex-col items-center">
              <label className="text-xs text-center text-gray-600 mb-1 whitespace-normal">
                Government Revenue (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="form-input block w-full rounded-md border-gray-300 text-center focus:border-brand focus:ring focus:ring-brand/20"
                value={wRev}
                onChange={e => {
                  const newRev = +e.target.value;
                  const adjJobs = Math.max(0, 100 - wDom - newRev);
                  setParameters(p => ({ ...p, weightRevenue: newRev, weightJobs: adjJobs }));
                }}
              />
            </div>

            {/* Jobs */}
            <div className="flex flex-col items-center">
              <label className="text-xs text-center text-gray-600 mb-1 whitespace-normal">
                Jobs (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="form-input block w-full rounded-md border-gray-300 text-center focus:border-brand focus:ring focus:ring-brand/20"
                value={wJobs}
                onChange={e => {
                  const newJobs = +e.target.value;
                  const adjDom = Math.max(0, 100 - wRev - newJobs);
                  setParameters(p => ({ ...p, weightJobs: newJobs, weightDomestic: adjDom }));
                }}
              />
            </div>
          </div>
        </div>



        {/* Advanced Options */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer bg-brand-light text-brand px-3 py-2 text-xs font-medium rounded-md">
            Advanced Input Options
          <span className="transform group-open:rotate-180 transition">⌄</span>
          </summary>
          <div className="mt-2 space-y-2">
            <label className="inline-flex items-center text-xs">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={parameters.separateBudgetsByFuelType}
                onChange={e =>
                  setParameters(p => ({ ...p, separateBudgetsByFuelType: e.target.checked }))
                }
              />
              <span className="ml-2">Separate budgets by fuel type</span>
            </label>
            {/* Further fuel-type budget inputs can be added here */}
          </div>
        </details>
      </div>
    </section>
  );
}
