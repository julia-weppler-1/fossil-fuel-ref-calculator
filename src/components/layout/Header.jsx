import React, { useState } from 'react';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between px-6 py-3 md:py-4">
        <div className="flex items-center space-x-3">
          <img
            src="/logo512.png"
            alt="Climate Equity Reference"
            className="h-8 w-auto md:h-10"
          />
          <div>
            <div className="text-base font-semibold text-gray-700 md:text-lg">
              Climate Equity Reference
            </div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wide md:text-sm">
              Calculator
            </div>
          </div>
        </div>

        <button
          className="md:hidden text-gray-600 hover:text-gray-800 focus:outline-none"
          onClick={() => setMenuOpen(open => !open)}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <span className="text-2xl">✕</span>
          ) : (
            <span className="text-2xl">☰</span>
          )}
        </button>

        <nav className="hidden md:flex flex-1 mx-6 space-x-6 text-sm text-blue-600">
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

        <div className="hidden md:flex items-center space-x-4">
          <img src="/logo512.png" alt="EcoEquity" className="h-5 w-auto" />
          <img
            src="/logo512.png"
            alt="Stockholm Environment Institute"
            className="h-5 w-auto"
          />
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-6 py-4 space-y-3">
            <a
              href="/project"
              className="block text-gray-700 font-medium hover:text-gray-900"
            >
              About the Climate Equity Reference Project
            </a>
            <a
              href="/calculator"
              className="block text-gray-700 font-medium hover:text-gray-900"
            >
              About the Climate Equity Reference Calculator
            </a>
            <a
              href="/docs"
              className="block text-gray-700 font-medium hover:text-gray-900"
            >
              Online Documentation, Glossary, Help
            </a>
          </div>
          <div className="px-6 pb-4 border-t border-gray-200 flex space-x-4">
            <img src="/logo512.png" alt="EcoEquity" className="h-6 w-auto" />
            <img
              src="/logo512.png"
              alt="Stockholm Environment Institute"
              className="h-6 w-auto"
            />
          </div>
        </div>
      )}
    </header>
  );
}
