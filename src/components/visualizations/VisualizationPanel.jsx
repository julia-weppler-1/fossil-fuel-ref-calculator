import React, { useContext } from 'react';
import LineAreaChart from './LineAreaChart';
import ChartControls from './ChartControls';
import MetricsTable from '../tables/MetricsTable';
import { ParametersContext } from '../../context/ParametersContext';

export default function VisualizationPanel() {
  const { chartData, tableData } = useContext(ParametersContext);

  return (
    <div className="space-y-6 flex-1">
      <div className="bg-white p-4 shadow rounded">
        <LineAreaChart data={chartData} />
        <ChartControls />
      </div>
      <div className="bg-white p-4 shadow rounded overflow-x-auto">
        <MetricsTable data={tableData} />
      </div>
    </div>
  );
}
