import React, { useContext, useState } from "react";
import { ParametersContext } from "../../../context/ParametersContext";
import ResetButton from "../ResetButton";
import "./index.css";


export default function ParameterSettings() {
  const { parameters, setParameters } = useContext(ParametersContext);

  const mitigationOptions = [
    { id: 1, label: "Low Energy Demand Scenario" },
    { id: 2, label: "High Energy Demand Scenario" },
  ];
  const [open, setOpen] = useState(true);

  const scalingOptions = ["CSER High Capacity", "off"];
  const round1 = (x) => Math.round(x * 10) / 10;
  const wDom = parameters.weightDomestic ?? 33.3;
  const wRev = parameters.weightRevenue ?? 33.3;
  const wJobs = parameters.weightJobs ?? 33.3;
  const evenDistribute = () => {
    const base = parseFloat((100 / 3).toFixed(1)); // 33.3
    setParameters((p) => ({
      ...p,
      weightDomestic: base,
      weightRevenue: base,
      weightJobs: base,
    }));
  };
  return (
    <section className="mb-2 font-body">
      {/* header */}
      <div
        className="parameters-header bg-green-500 text-white px-4 py-2 cursor-pointer select-none flex items-center justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <span>Input Selection</span>
        <span
          className={`ml-2 transform transition-transform duration-300 ${
            open ? "rotate-0" : "-rotate-180"
          }`}
        >
          ▼
        </span>
      </div>

      {/* animated panel */}
      <div
        className={`
          overflow-hidden
          transform origin-top
          transition-transform duration-300
          ${open ? "scale-y-100" : "scale-y-0"}
        `}
      >
        {/* fade container for a bit of opacity easing */}
        <div
          className={`
            transition-opacity duration-200
            ${open ? "opacity-100" : "opacity-0"}
          `}
        >
        <div className="parameters-container p-4 bg-white border border-gray-200">
          {/* Mitigation Pathway / Carbon Budget */}
          <div className="mb-3">
            <label className="parameter-name">Mitigation Pathway / Carbon Budget</label>
            <select
              className="parameter-input-dropdown"
              value={parameters.mitigationPathwayId ?? mitigationOptions[0].id}
              onChange={e =>
                setParameters(p => ({
                  ...p,
                  mitigationPathwayId: +e.target.value,
                }))
              }
            >
              {mitigationOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Earliest Phaseout Year */}
          <div className="mb-3">
            <label className="parameter-name">Earliest Phaseout Year</label>
            <input
              type="number"
              min={new Date().getFullYear()}
              max="2100"
              className="parameter-input"
              value={parameters.earliestPhaseoutYear ?? 2030}
              onChange={e =>
                setParameters(p => ({
                  ...p,
                  earliestPhaseoutYear: +e.target.value,
                }))
              }
            />
          </div>

          {/* Latest Phaseout Year */}
          <div className="mb-3">
            <label className="parameter-name">Latest Phaseout Year</label>
            <input
              type="number"
              min={parameters.earliestPhaseoutYear ?? 2030}
              max="2100"
              className="parameter-input"
              value={parameters.latestPhaseoutYear ?? 2050}
              onChange={e =>
                setParameters(p => ({
                  ...p,
                  latestPhaseoutYear: +e.target.value,
                }))
              }
            />
          </div>

          {/* Phaseout Threshold */}
          <div className="mb-4">
            <label className="parameter-name flex items-center">
              Phaseout Threshold:
              <span className="ml-2 font-semibold text-gray-700">
                {parameters.phaseoutThreshold ?? 90}%
              </span>
            </label>
            <input
              type="range"
              min="80"
              max="100"
              step="1"
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none parameter-input-range accent-accentBlue"
              value={parameters.phaseoutThreshold ?? 90}
              onChange={e =>
                setParameters(p => ({
                  ...p,
                  phaseoutThreshold: +e.target.value,
                }))
              }
              style={{
                background: `linear-gradient(
                  to right,
                  #1692df ${(((parameters.phaseoutThreshold ?? 90) - 80) / 20) * 100}%,
                  #E5E7EB ${(((parameters.phaseoutThreshold ?? 90) - 80) / 20) * 100}%
                )`,
              }}
            />
          </div>

          {/* Scaling of Dependence by Capacity */}
          <div className="mb-4">
            <label className="parameter-name">Scaling of Dependence by Capacity</label>
            <select
              className="parameter-input-dropdown"
              value={parameters.scalingOption ?? scalingOptions[0]}
              onChange={e =>
                setParameters(p => ({ ...p, scalingOption: e.target.value }))
              }
            >
              {scalingOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Weightings */}
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <span className="parameter-name">Weightings (%)</span>
              <button
                type="button"
                className="ml-2 px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                onClick={evenDistribute}
              >
                Evenly distribute
              </button>
            </div>
            <div className="weights-layout">
              {/* Domestic */}
              <div className="weight-item">
                <label className="weight-title">Domestic Energy</label>
                <input
                  type="number" min="0" max="100" step="0.1"
                  className="weight-input"
                  value={wDom}
                  onChange={e => {
                    const newDom = parseFloat(e.target.value) || 0;
                    const adjRev = round1(100 - newDom - wJobs);
                    setParameters(p => ({
                      ...p,
                      weightDomestic: newDom,
                      weightRevenue:  adjRev,
                    }));
                  }}
                  onBlur={() =>
                    setParameters(p => ({
                      ...p,
                      weightDomestic: round1(p.weightDomestic ?? 0),
                    }))
                  }
                />
              </div>
              {/* Revenue */}
              <div className="weight-item">
                <label className="weight-title">Government Revenue</label>
                <input
                  type="number" min="0" max="100" step="0.1"
                  className="weight-input"
                  value={wRev}
                  onChange={e => {
                    const newRev = parseFloat(e.target.value) || 0;
                    const adjJobs = round1(100 - wDom - newRev);
                    setParameters(p => ({
                      ...p,
                      weightRevenue: newRev,
                      weightJobs:    adjJobs,
                    }));
                  }}
                  onBlur={() =>
                    setParameters(p => ({
                      ...p,
                      weightRevenue: round1(p.weightRevenue ?? 0),
                    }))
                  }
                />
              </div>
              {/* Jobs */}
              <div className="weight-item">
                <label className="weight-title">Jobs</label>
                <input
                  type="number" min="0" max="100" step="0.1"
                  className="weight-input"
                  value={wJobs}
                  onChange={e => {
                    const newJobs = parseFloat(e.target.value) || 0;
                    const adjDom = round1(100 - wRev - newJobs);
                    setParameters(p => ({
                      ...p,
                      weightJobs:     newJobs,
                      weightDomestic: adjDom,
                    }));
                  }}
                  onBlur={() =>
                    setParameters(p => ({
                      ...p,
                      weightJobs: round1(p.weightJobs ?? 0),
                    }))
                  }
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
                    setParameters(p => ({
                      ...p,
                      separateBudgetsByFuelType: e.target.checked,
                    }))
                  }
                />
                <span className="ml-2">Separate budgets by fuel type</span>
              </label>
            </div>
          </details>

          <ResetButton />
        </div>
      </div>
    </div>
    </section>
  );
}