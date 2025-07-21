import React from 'react';
import './index.css'
export default function ChartCard({ title, children }) {
  return (
    <div className="card-container">
      <div className="card-title">
        {title}
      </div>
      <div className="chart-container">
        {children}
      </div>
    </div>
  );
}
