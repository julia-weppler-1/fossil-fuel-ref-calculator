import React, { useState } from 'react';
import './index.css';
export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header-container">
      <div className="items-layout">
        <div className="header-components">
          <img
            src="/logo512.png"
            alt="Climate Equity Reference"
            className="h-8 w-auto md:h-10"
          />
          <div>
            <div className="app-title">
              Climate Equity Reference
            </div>
            <div className="app-title-blue">
              Calculator
            </div>
          </div>
        </div>

        <button
          className="mobile-menu-toggle"
          onClick={() => setMenuOpen(open => !open)}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <span className="mobile-menu-item">✕</span>
          ) : (
            <span className="mobile-menu-item">☰</span>
          )}
        </button>

        <nav className="menu-items">
          <a href="/project" className="hover:underline">
            About the Climate Equity Reference Project
          </a>
          <a href="/calculator" className="hover:underline">
            About the Climate Equity Reference Calculator
          </a>
          <a href="/docs" className="hover:underline">
            Online Documentation, Glossary, Help
          </a>
        </nav>

        <div className="main-logos">
          <img src="/logo512.png" alt="EcoEquity" className="main-logo" />
          <img
            src="/logo512.png"
            alt="Stockholm Environment Institute"
            className="main-logo"
          />
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-menu-items">
          <div className="mobile-menu-layout">
            <a
              href="/project"
              className="header-item"
            >
              About the Climate Equity Reference Project
            </a>
            <a
              href="/calculator"
              className="header-item"
            >
              About the Climate Equity Reference Calculator
            </a>
            <a
              href="/docs"
              className="header-item"
            >
              Online Documentation, Glossary, Help
            </a>
          </div>
          <div className="mobile-logos">
            <img src="/logo512.png" alt="EcoEquity" className="mobile-logo" />
            <img
              src="/logo512.png"
              alt="Stockholm Environment Institute"
              className="mobile-logo"
            />
          </div>
        </div>
      )}
    </header>
  );
}
