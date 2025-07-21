import React from 'react';
import './index.css';
export default function Tabs({ tabs, activeTab, onTabClick }) {
  return (
    <nav className="tab-container">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onTabClick(t.id)}
          className={`
            tab-title
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
