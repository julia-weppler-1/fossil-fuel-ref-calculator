import React, { useContext } from 'react';
import { ParametersContext } from '../../../context/ParametersContext';
import ResetButton from '../ResetButton';
import './index.css'
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
    <section className="mb-2 font-body">
      <h2 className="parameters-header">
        ▼ Input Selection
      </h2>
      <div className="parameters-container">
        {/* Mitigation Pathway / Carbon Budget */}
        <div>
          <label className="parameter-name">
            Mitigation Pathway / Carbon Budget
          </label>
          <select
            className="parameter-input-dropdown"
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
          <label className="parameter-name">
            Earliest Phaseout Year
          </label>
          <input
            type="number"
            min={new Date().getFullYear()}
            max="2100"
            className="parameter-input"
            value={parameters.earliestPhaseoutYear ?? 2030}
            onChange={e =>
              setParameters(p => ({ ...p, earliestPhaseoutYear: +e.target.value }))
            }
          />
        </div>

        {/* Latest Phaseout Year */}
        <div>
          <label className="parameter-name">
            Latest Phaseout Year
          </label>
          <input
            type="number"
            min={parameters.earliestPhaseoutYear ?? 2030}
            max="2100"
            className="parameter-input"
            value={parameters.latestPhaseoutYear ?? 2050}
            onChange={e =>
              setParameters(p => ({ ...p, latestPhaseoutYear: +e.target.value }))
            }
          />
        </div>

        {/* Phaseout Threshold */}
        <div>
          <label className="parameter-name">
            Phaseout Threshold (%)
          </label>
          <input
            type="number"
            min="80"
            max="100"
            step="1"
            className="parameter-input"
            value={parameters.phaseoutThreshold ?? 90}
            onChange={e =>
              setParameters(p => ({ ...p, phaseoutThreshold: +e.target.value }))
            }
          />
        </div>

        {/* Scaling of Dependence by Capacity */}
        <div>
          <label className="parameter-name">
            Scaling of Dependence by Capacity
          </label>
          <select
            className="parameter-input-dropdown"
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
          <label className="parameter-name">
            Weightings
          </label>
          <div className="weights-layout">
            {/* Domestic Energy */}
            <div className="weight-item">
              <label className="weight-title">
                Domestic Energy (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="weight-input"
                value={wDom}
                onChange={e => {
                  const newDom = +e.target.value;
                  const adjRev = Math.max(0, 100 - newDom - wJobs);
                  setParameters(p => ({ ...p, weightDomestic: newDom, weightRevenue: adjRev }));
                }}
              />
            </div>

            {/* Government Revenue */}
            <div className="weight-item">
              <label className="weight-title">
                Government Revenue (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="weight-input"
                value={wRev}
                onChange={e => {
                  const newRev = +e.target.value;
                  const adjJobs = Math.max(0, 100 - wDom - newRev);
                  setParameters(p => ({ ...p, weightRevenue: newRev, weightJobs: adjJobs }));
                }}
              />
            </div>

            {/* Jobs */}
            <div className="weight-item">
              <label className="weight-title">
                Jobs (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="weight-input"
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
          <summary className="advanced-dropdown">
            Advanced Input Options
          <span className="transform group-open:rotate-180 transition">⌄</span>
          </summary>
          <div className="options-container">
            <label className="dropdown-item">
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
      <ResetButton/>
    </section>
  );
}
