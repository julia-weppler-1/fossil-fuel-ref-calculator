import React, { createContext, useState, useEffect } from 'react';

export const ParametersContext = createContext();

export function ParametersProvider({ children }) {
  const [parameters, setParameters] = useState({
    tableView: 'country',
    year: 2035,
    baseYear: 1990,
  });
  const [chartData, setChartData] = useState([]);
  const [tableData, setTableData] = useState([]);

  useEffect(() => {
    const { chart, table } = fetchDataFor(parameters);
    setChartData(chart);
    setTableData(table);
  }, [parameters]);

  return (
    <ParametersContext.Provider value={{ parameters, setParameters, chartData, tableData }}>
      {children}
    </ParametersContext.Provider>
  );
}

function fetchDataFor(params) {
  return { chart: [], table: [] };
}
