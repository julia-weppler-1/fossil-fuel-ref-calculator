import React from 'react';

export default function CalculatorSettingsAccordion() {
  return (
    <div className="mb-4">
      <details className="mb-4 group">
        <summary className="bg-primary-700 text-white px-4 py-2 rounded-lg cursor-pointer flex justify-between items-center">
          Responsibility
          <span className="transform group-open:rotate-180 transition">⌄</span>
        </summary>
        <div className="bg-white border border-gray-200 rounded-b-lg shadow-sm p-4 space-y-3">
          <label className="flex items-center space-x-2">
            <input type="checkbox" className="form-checkbox accent-primary-500" />
            <span className="text-sm text-gray-700">Include non-CO₂ gases</span>
          </label>
        </div>
      </details>

    </div>
  );
}
