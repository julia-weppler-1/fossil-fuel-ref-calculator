import React from 'react';
import './index.css';
export default function MetricCard({ title, value, unit }) {
  return (
    <div className="card-container">
      <div className="card-title">
        {title}
      </div>
      <div className="metric-container">
        {value}{unit}
      </div>
    </div>
  );
}
