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
              ? 'active-title'
              : 'hover-title'}
          `}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
