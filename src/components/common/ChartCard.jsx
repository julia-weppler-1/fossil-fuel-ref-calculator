import React from 'react';

export default function ChartCard({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
      <div className="px-4 py-2 font-semibold text-gray-700 border-b border-gray-100">
        {title}
      </div>
      <div className="flex-1 flex items-center justify-center p-4 text-gray-300">
        {children}
      </div>
    </div>
  );
}
