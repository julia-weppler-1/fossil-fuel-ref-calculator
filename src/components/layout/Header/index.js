import React, { useState } from 'react';
import './index.css';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header-container">
      <div className="items-layout">
        {/* Logo only */}
        <div className="header-components">
          <img
            src="/F3-EPO.png"
            alt="F-3EPO Calculator"
            className="h-16 w-auto md:h-20 mr-10"
          />
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
      </div>

      {menuOpen && (
        <div className="mobile-menu-items">
          <div className="mobile-menu-layout">
            <a href="/project" className="header-item">
              About the Climate Equity Reference Project
            </a>
            <a href="/calculator" className="header-item">
              About the Climate Equity Reference Calculator
            </a>
            <a href="/docs" className="header-item">
              Online Documentation, Glossary, Help
            </a>
          </div>
          {/* If you still need mobile logos, swap their src here too, otherwise just remove this block */}
          <div className="mobile-logos">
            <img
              src="/F3-EPO.png"
              alt="F-3EPO Calculator"
              className="mobile-logo"
            />
          </div>
        </div>
      )}
    </header>
  );
}
