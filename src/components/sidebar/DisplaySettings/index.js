import React, { useState, useEffect, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { createPortal } from "react-dom";

export default function DisplaySettings({
  selectedCountries,
  setSelectedCountries,
  labelCountries,
  setLabelCountries,
  ledChartKind,
  setLedChartKind,
  ledYAxisMode,
  setLedYAxisMode,
}) {
  const [open, setOpen] = useState(true);
  const [allCountries, setAll] = useState([]);

  // inline search boxes + their cookies
  const [filterText, setFilter] = useState("");
  const [labelText, setLabel] = useState("");

  // refs for portals
  const inputRef = useRef();
  const labelRef = useRef();
  const [portalStyle, setPortalStyle] = useState({});
  const [labelPortalStyle, setLabelPortalStyle] = useState({});

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("filter"); // 'filter' | 'label'
  const [availableList, setAvailableList] = useState([]);
  const [selectedList, setSelectedList] = useState([]);
  const [leftSelected, setLeftSelected] = useState([]); // highlighted in left
  const [pasteInput, setPasteInput] = useState("");

  // 1) Load country list once 
  useEffect(() => {
    (async () => {
      const res = await fetch("/LEDPaths.xlsx");
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
        header: 1,
      });
      const list = raw
        .slice(1)
        .map((r) => r[0])
        .filter(Boolean);
      setAll(Array.from(new Set(list)).sort());
    })();
  }, []);

  // Suggestions
  const suggestions = useMemo(() => {
    const q = filterText.toLowerCase();
    return allCountries
      .filter(
        (c) => c.toLowerCase().includes(q) && !selectedCountries.includes(c)
      )
      .slice(0, 10);
  }, [allCountries, filterText, selectedCountries]);

  const labelSuggestions = useMemo(() => {
    const q = labelText.toLowerCase();
    return allCountries
      .filter((c) => c.toLowerCase().includes(q) && !labelCountries.includes(c))
      .slice(0, 10);
  }, [allCountries, labelText, labelCountries]);

  // Add/remove chips
  const addCountry = (c) => {
    setSelectedCountries((prev) => [...prev, c]);
    setFilter("");
  };
  const removeCountry = (c) => {
    setSelectedCountries((prev) => prev.filter((x) => x !== c));
  };
  const addLabel = (c) => {
    setLabelCountries((prev) => [...prev, c]);
    setLabel("");
  };
  const removeLabel = (c) => {
    setLabelCountries((prev) => prev.filter((x) => x !== c));
  };

  // Portal positions
  useEffect(() => {
    if (filterText && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setPortalStyle({
        position: "absolute",
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        zIndex: 1000,
      });
    }
  }, [filterText, suggestions]);

  useEffect(() => {
    if (labelText && labelRef.current) {
      const rect = labelRef.current.getBoundingClientRect();
      setLabelPortalStyle({
        position: "absolute",
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        zIndex: 1000,
      });
    }
  }, [labelText, labelSuggestions]);

  // Modal helpers
  const openModal = (mode) => {
    const initial = mode === "filter" ? selectedCountries : labelCountries;
    setModalMode(mode);
    setSelectedList(initial);
    setAvailableList(allCountries.filter((c) => !initial.includes(c)));
    setLeftSelected([]);
    setPasteInput(initial.join(","));
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  const moveSelectedOver = () => {
    const newSel = Array.from(new Set([...selectedList, ...leftSelected]));
    setSelectedList(newSel);
    setAvailableList((av) => av.filter((c) => !leftSelected.includes(c)));
    setLeftSelected([]);
  };

  const handleRemove = (c) => {
    setSelectedList((sel) => sel.filter((x) => x !== c));
    setAvailableList((av) => [...av, c].sort((a, b) => a.localeCompare(b)));
  };

  const saveModal = () => {
    const pasted = pasteInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const final = Array.from(new Set([...selectedList, ...pasted]));
    if (modalMode === "filter") {
      setSelectedCountries(final);
    } else {
      setLabelCountries(final);
    }
    closeModal();
  };

  const toggleLeft = (c) =>
    setLeftSelected((ls) =>
      ls.includes(c) ? ls.filter((x) => x !== c) : [...ls, c]
    );

  return (
    <section className="mb-2 font-body relative">
      <div
        className="parameters-header bg-brand text-white px-4 py-2 cursor-pointer select-none flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <span>Display Settings</span>
        <span
          className={`transform transition-transform duration-300 ${
            open ? "" : "-rotate-180"
          }`}
        >
          ▼
        </span>
      </div>

      {/* collapse panel */}
      <div
        className={`
          overflow-hidden transform origin-top
          transition-transform duration-300
          ${open ? "scale-y-100" : "scale-y-0"}
        `}
      >
        <div
          className={`
            transition-opacity duration-200
            ${open ? "opacity-100" : "opacity-0"}
          `}
        >
          <div className="parameters-container p-4 relative">
            {/* Selected filter chips */}
            <div className="flex flex-wrap items-center mb-2">
              <label className="parameter-name flex-shrink-0">
                Filter by Country
              </label>
              <button
                className="ml-2 px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                onClick={() => openModal("filter")}
              >
                Custom set
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedCountries.map((c) => (
                <span
                  key={c}
                  className="flex items-center bg-blue-50 text-blue-400 text-xs px-2 py-1 rounded-full"
                >
                  {c}
                  <button
                    onClick={() => removeCountry(c)}
                    className="ml-1 focus:outline-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedCountries.length > 1 && (
                <button
                  onClick={() => setSelectedCountries([])}
                  className="text-xs text-red-600 hover:underline ml-2"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Search add */}
            <input
              ref={inputRef}
              type="text"
              placeholder={
                selectedCountries.length ? "Add another…" : "Search countries…"
              }
              className="parameter-input w-full mb-1"
              value={filterText}
              onChange={(e) => setFilter(e.target.value)}
            />
            {filterText &&
              suggestions.length > 0 &&
              createPortal(
                <ul
                  style={portalStyle}
                  className="bg-white border border-gray-200 rounded-md shadow-sm max-h-40 overflow-auto"
                >
                  {suggestions.map((c) => (
                    <li
                      key={c}
                      onClick={() => addCountry(c)}
                      className="cursor-pointer px-3 py-2 hover:bg-gray-100 text-sm"
                    >
                      {c}
                    </li>
                  ))}
                </ul>,
                document.body
              )}

            {/* Label chips + search */}
            <div className="mt-4">
              <div className="flex flex-wrap items-center mb-2">
                <label className="parameter-name">Label On Chart</label>
                <button
                  className="ml-2 px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                  onClick={() => openModal("label")}
                >
                  Custom set
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {labelCountries.map((c) => (
                  <span
                    key={c}
                    className="flex items-center bg-blue-50 text-blue-400 text-xs px-2 py-1 rounded-full"
                  >
                    {c}
                    <button
                      onClick={() => removeLabel(c)}
                      className="ml-1 focus:outline-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {labelCountries.length > 1 && (
                  <button
                    onClick={() => setLabelCountries([])}
                    className="text-xs text-red-600 hover:underline ml-2"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <input
                ref={labelRef}
                type="text"
                placeholder="Add label country…"
                className="parameter-input w-full mb-1"
                value={labelText}
                onChange={(e) => setLabel(e.target.value)}
              />
              {labelText &&
                labelSuggestions.length > 0 &&
                createPortal(
                  <ul
                    style={labelPortalStyle}
                    className="bg-white border border-gray-200 rounded-md shadow-sm max-h-40 overflow-auto"
                  >
                    {labelSuggestions.map((c) => (
                      <li
                        key={c}
                        onClick={() => {
                          addLabel(c);
                          setLabel("");
                        }}
                        className="cursor-pointer px-3 py-2 hover:bg-gray-100 text-sm"
                      >
                        {c}
                      </li>
                    ))}
                  </ul>,
                  document.body
                )}
            </div>
            <div className="mt-1 flex flex-wrap items-center">
            <label className="parameter-name">
                Phaseout Pathway Chart Settings
              </label>
              {/* Group 1: chart type */}
              <div className="flex items-center gap-4">
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="radio"
                    name="ledChartKind"
                    checked={ledChartKind === "line"}
                    onChange={() => setLedChartKind("line")}
                  />
                  Line
                </label>
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="radio"
                    name="ledChartKind"
                    checked={ledChartKind === "stacked"}
                    onChange={() => setLedChartKind("stacked")}
                  />
                  Stacked area
                </label>
              </div>

              {/* Divider: horizontal on small screens, vertical on md+ */}
              <div className="w-full h-px bg-gray-200 my-2 md:hidden" />
              <div className="hidden md:block h-6 w-px bg-gray-200 mx-3" />

              {/* Group 2: y-axis mode */}
              <div className="flex items-center gap-4">
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="radio"
                    name="ledYAxisMode"
                    checked={ledYAxisMode === "absolute"}
                    onChange={() => setLedYAxisMode("absolute")}
                  />
                  Absolute (CO₂ Gt)
                </label>
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="radio"
                    name="ledYAxisMode"
                    checked={ledYAxisMode === "relative"}
                    onChange={() => setLedYAxisMode("relative")}
                  />
                  Relative
                </label>

                {ledChartKind === "stacked" && ledYAxisMode !== "absolute" && (
                  <span className="text-xs text-gray-500">
                    ≤ 17 countries shown
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen &&
        createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white w-11/12 md:w-3/4 p-6 rounded shadow-lg z-50">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl">
                  {modalMode === "filter"
                    ? "Custom Country Filter"
                    : "Custom Label Countries"}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="flex gap-4">
                {/* Left box */}
                <ul className="w-1/2 max-h-64 overflow-auto border p-2">
                  {availableList.map((c) => (
                    <li
                      key={c}
                      className={`py-1 px-2 cursor-pointer ${
                        leftSelected.includes(c) ? "bg-blue-100" : ""
                      }`}
                      onClick={() => toggleLeft(c)}
                    >
                      {c}
                    </li>
                  ))}
                </ul>

                {/* Move → */}
                <div className="flex flex-col justify-center">
                  <button
                    onClick={moveSelectedOver}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                    disabled={leftSelected.length === 0}
                  >
                    →
                  </button>
                </div>

                {/* Right box + paste */}
                <div className="w-1/2">
                  <ul className="max-h-32 overflow-auto border p-2 mb-2">
                    {selectedList.map((c) => (
                      <li
                        key={c}
                        className="flex justify-between items-center py-1"
                      >
                        <span>{c}</span>
                        <button
                          onClick={() => handleRemove(c)}
                          className="text-red-500"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <textarea
                    rows={3}
                    className="w-full border p-1"
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    placeholder="Paste comma-separated countries"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-1 border rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={saveModal}
                  className="px-4 py-1 bg-green-600 text-white rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
