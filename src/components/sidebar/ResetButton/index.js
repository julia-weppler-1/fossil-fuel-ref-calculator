import React, { useContext } from 'react';
import { ParametersContext } from '../../../context/ParametersContext';
import './index.css';
export default function ResetButton() {
  const { setParameters } = useContext(ParametersContext);

  return (
    <button
      className="btn-reset"
      onClick={() => setParameters({ tableView: 'country', year: 2035, baseYear: 1990 })}
    >
      Reset to default
    </button>
  );
}
