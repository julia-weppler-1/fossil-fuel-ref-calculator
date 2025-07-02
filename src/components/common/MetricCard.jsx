import React from 'react';

export default function MetricCard({ title, value, unit }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col justify-center items-center">
      <div className="text-sm font-medium text-gray-500 mb-2">
        {title}
      </div>
      <div className="text-3xl font-bold text-green-700">
        {value}{unit}
      </div>
    </div>
  );
}
