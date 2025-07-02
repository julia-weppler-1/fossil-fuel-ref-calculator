import React, { useContext } from 'react';
import { ParametersContext } from '../../context/ParametersContext';

export default function ResetButton() {
  const { setParameters } = useContext(ParametersContext);
  return (
    <button
      className="mt-4 w-full bg-red-600 text-white py-2 rounded"
      onClick={() => setParameters({
        tableView: 'country', year: 2035, baseYear: 1990
      })}
    >
      Reset to initial values
    </button>
  );
}
