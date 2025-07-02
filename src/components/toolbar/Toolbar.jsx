import React from 'react';

export default function Toolbar() {
  return (
    <div className="flex space-x-2 mb-6">
      <button className="bg-primary-500 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
        Review equity settings
      </button>
      <button className="border border-gray-300 hover:bg-gray-100 text-gray-800 text-sm px-4 py-2 rounded-lg">
        Download Excel table
      </button>
      <button className="border border-gray-300 hover:bg-gray-100 text-gray-800 text-sm px-4 py-2 rounded-lg">
        Copy view to new window
      </button>
    </div>

  );
}
