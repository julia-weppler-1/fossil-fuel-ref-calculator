import React from 'react';

export default function MetricsTable({ data }) {
  return (
    <table>
      <thead><tr><th>Metric</th><th>Value</th></tr></thead>
      <tbody>
        {data.map((row,i) => (
          <tr key={i}><td>{row.metric}</td><td>{row.value}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
