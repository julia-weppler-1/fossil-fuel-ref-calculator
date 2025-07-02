import React from 'react';

export default function Tabs({ tabs, activeTab, onTabClick }) {
  return (
    <nav className="flex bg-orange-600 text-white overflow-x-auto">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onTabClick(t.id)}
          className={`
            px-6 py-3 whitespace-nowrap text-sm font-medium
            ${activeTab === t.id
              ? 'bg-white text-orange-600 border-b-4 border-orange-600'
              : 'hover:bg-orange-500'}
          `}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
