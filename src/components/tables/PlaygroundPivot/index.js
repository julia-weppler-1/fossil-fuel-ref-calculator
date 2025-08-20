import React, { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";

const DIMENSIONS = ["country", "fuel", "indicator", "paramset"];

const INDICATOR_VALUES = [
  { key: "Ext_Energy", label: "Domestic energy" },
  { key: "ExtEmp", label: "Employment" },
  { key: "ExtRevbyFuel", label: "Gov. revenue" },
  { key: "support_pct",   label: "Support (%)" },      // varies by result_id
  { key: "phaseout",      label: "Phaseout year" },    // varies by result_id
];

const FUEL_LABEL = (f) => (f ? f.charAt(0).toUpperCase() + f.slice(1) : "");
const FALLBACK_PARAMSET = "1";
const fmtValue = (indicatorKey, v) => {
  if (v == null || Number.isNaN(v)) return "—";
  return (+v).toFixed(3);
};

export default function PlaygroundPivot({
  selectedCountries = [],
  selectedFuels = [],
  resultSets = [],
  paramsets = [],
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const [slots, setSlots] = useState({
    supercol: null,
    col: null,
    row: "country",
  });
  const assigned = useMemo(() => Object.values(slots).filter(Boolean), [slots]);
  const unused = useMemo(
    () => DIMENSIONS.filter((d) => !assigned.includes(d)),
    [assigned]
  );
  const [sortStacks, setSortStacks] = useState({}); // { [facetKey]: [{ key, direction }] }

  const ridEntries = React.useMemo(
  () => (Array.isArray(resultSets) ? resultSets.filter(r => r && r.result_id) : []),
  [resultSets]
);

const ridList = React.useMemo(
    () => Array.from(new Set(ridEntries.map(r => String(r.result_id)).filter(Boolean))),
    [ridEntries]
  );
  const ridToName = React.useMemo(() => {
    const m = new Map();
    ridEntries.forEach(r => m.set(String(r.result_id), r.name || `RID ${r.result_id}`));
    return m;
  }, [ridEntries]);

  function isNumberLike(v) {
    const n = parseFloat(v);
    return Number.isFinite(n);
  }
  function cmpValues(a, b) {
    const aEmpty = a === null || a === undefined || a === "";
    const bEmpty = b === null || b === undefined || b === "";
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    if (isNumberLike(a) && isNumberLike(b)) {
      const na = parseFloat(a),
        nb = parseFloat(b);
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    }
    return String(a).localeCompare(String(b));
  }
  function getFacetKey(facetMap) {
    return JSON.stringify(facetMap || []);
  }
  function getStack(facetKey) {
    return sortStacks[facetKey] || [];
  }
  function cycleSort(facetKey, entryKey) {
    setSortStacks((prev) => {
      const stack = [...(prev[facetKey] || [])];
      const idx = stack.findIndex((s) => s.key === entryKey);
      if (idx === -1) {
        return {
          ...prev,
          [facetKey]: [...stack, { key: entryKey, direction: "asc" }],
        };
      }
      if (stack[idx].direction === "asc") {
        const next = [...stack];
        next[idx] = { key: entryKey, direction: "desc" };
        return { ...prev, [facetKey]: next };
      }
      const next = stack.filter((_, i) => i !== idx);
      return { ...prev, [facetKey]: next };
    });
  }
  function sortMarker(facetKey, entryKey) {
    const stack = getStack(facetKey);
    const idx = stack.findIndex((s) => s.key === entryKey);
    if (idx === -1) return "";
    const arrow = stack[idx].direction === "asc" ? " ↑" : " ↓";
    return `${arrow}${idx + 1}`;
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
  
        const fuelsParam =
          selectedFuels && selectedFuels.length
            ? selectedFuels.map((f) => f.toLowerCase()).join(",")
            : "all";
  
        const url = new URL("/api/pivot_support_phaseout.php", window.location.origin);
        if (ridList.length) {
          url.searchParams.set("result_id", ridList.join(","));
        } else {
          url.searchParams.set("result_id", "latest");
        }
        url.searchParams.set("fuel", fuelsParam);
  
        const res = await fetch(url.toString(), { credentials: "same-origin" });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const json = await res.json();
        if (!alive) return;
  
        const mapped = (json.rows || []).map((r) => ({
          iso3: r.iso3,
          country: r.country || r.iso3,
          fuel: (r.fuel || "").toLowerCase(),
          paramset: ridList.length
            ? (ridToName.get(String(r.result_id)) || `RID ${r.result_id}`)
            : FALLBACK_PARAMSET,
          Ext_Energy: r.Ext_Energy != null ? +r.Ext_Energy : null,
          ExtEmp: r.ExtEmp != null ? +r.ExtEmp : null,
          ExtRevbyFuel: r.ExtRevbyFuel != null ? +r.ExtRevbyFuel : null,
          support_pct: r.support_pct != null ? +r.support_pct : null,
          phaseout: r.phaseout != null ? +r.phaseout : null,
        }));
  
        setRows(mapped);
      } catch (e) {
        console.error(e);
        setErr(String(e.message || e));
      } finally {
        alive && setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedFuels, ridList.join("|")]);

  const allCountryNames = useMemo(() => {
    const set = new Set(rows.map((r) => r.country).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const usingCountryAsRow = slots.row === "country";
  const effectiveCountries = useMemo(() => {
    const chosen =
      selectedCountries && selectedCountries.length
        ? selectedCountries
        : allCountryNames;
    if (usingCountryAsRow) return chosen;
    const uniq = Array.from(new Set(chosen));
    const filtered = uniq.filter((c) => allCountryNames.includes(c));
    const fallback = filtered.length ? filtered : allCountryNames;
    return fallback.slice(0, 5);
  }, [selectedCountries, allCountryNames, usingCountryAsRow]);

  const effectiveFuels = useMemo(() => {
    return selectedFuels && selectedFuels.length
      ? selectedFuels.map((f) => f.toLowerCase())
      : ["oil", "coal", "gas"];
  }, [selectedFuels]);

  const effectiveParamsets = useMemo(() => {
    const namesFromIds = ridEntries.map(r => r.name).filter(Boolean);
    if (paramsets && paramsets.length) return paramsets; 
    return namesFromIds.length ? namesFromIds : ["Latest"]; 
    }, [paramsets, ridEntries]);

  const indicatorValues = INDICATOR_VALUES.map((x) => x.key);

  const dragData = useRef(null);
  const onDragStart = (e, what) => {
    dragData.current = { what };
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDropToSlot = (slotKey) => (e) => {
    e.preventDefault();
    const data = dragData.current;
    if (!data || !DIMENSIONS.includes(data.what)) return;
    setSlots((prev) => {
      if (prev[slotKey] === data.what) return prev;
      const next = { ...prev };
      for (const k of Object.keys(next))
        if (next[k] === data.what) next[k] = null;
      next[slotKey] = data.what;
      return next;
    });
    dragData.current = null;
  };
  const onDropToUnused = (e) => {
    e.preventDefault();
    const data = dragData.current;
    if (!data || !DIMENSIONS.includes(data.what)) return;
    setSlots((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next))
        if (next[k] === data.what) next[k] = null;
      return next;
    });
    dragData.current = null;
  };

  const domain = useMemo(
    () => ({
      country: effectiveCountries,
      fuel: effectiveFuels,
      indicator: indicatorValues,
      paramset: effectiveParamsets,
    }),
    [effectiveCountries, effectiveFuels, indicatorValues, effectiveParamsets]
  );

  const usedDims = useMemo(
    () => ["supercol", "col", "row"].map((k) => slots[k]).filter(Boolean),
    [slots]
  );
  const facetDims = useMemo(
    () => DIMENSIONS.filter((d) => !usedDims.includes(d)),
    [usedDims]
  );
  const facetCombos = useMemo(() => {
    if (facetDims.length === 0) return [[]];
    const acc = [[]];
    for (const d of facetDims) {
      const vals = domain[d] || [];
      const nxt = [];
      for (const combo of acc)
        for (const v of vals) nxt.push([...combo, [d, v]]);
      acc.splice(0, acc.length, ...nxt);
    }
    return acc;
  }, [facetDims, domain]);

  // metric resolver
  const getMetric = (rowObj, indicatorKey) => {
    if (!rowObj) return null;
    return rowObj[indicatorKey] ?? null;
  };

  const resolveCell = (keys, facetMap) => {
    const dimVal = {
      country: null,
      fuel: null,
      indicator: null,
      paramset: null,
    };
    const assign = (dim, val) => {
      if (dim) dimVal[dim] = val;
    };
    assign(slots.row, keys.rowVal);
    assign(slots.col, keys.colVal);
    assign(slots.supercol, keys.superVal);
    for (const [d, v] of facetMap) dimVal[d] = v;

    const r = rows.find(
      (x) =>
        (dimVal.country ? x.country === dimVal.country : true) &&
        (dimVal.fuel ? x.fuel === dimVal.fuel : true) &&
        (dimVal.paramset ? x.paramset === dimVal.paramset : true)
    );
    if (!r) return null;

    const indicatorKey =
      dimVal.indicator ||
      (slots.row === "indicator" && keys.rowVal) ||
      (slots.col === "indicator" && keys.colVal) ||
      (slots.supercol === "indicator" && keys.superVal) ||
      facetMap.find(([d]) => d === "indicator")?.[1] ||
      "Ext_Energy";

    return getMetric(r, indicatorKey);
  };

  const buildTable = (facetMap) => {
    const rowDim = slots.row,
      colDim = slots.col,
      supDim = slots.supercol;
    const rowsVals = rowDim ? domain[rowDim] : [];
    const colVals = colDim ? domain[colDim] : [];
    const supVals = supDim ? domain[supDim] : [null];

    const colGroups = supVals.map((sv) => ({
      superVal: sv,
      headers: colVals.map((cv) => ({ superVal: sv, colVal: cv })),
    }));

    const labelFor = (dim, val) => {
      if (dim === "fuel") return FUEL_LABEL(val);
      if (dim === "indicator")
        return INDICATOR_VALUES.find((x) => x.key === val)?.label || val;
      return String(val);
    };

    const facetKey = getFacetKey(facetMap);

    const valueForColumn = (rowVal, superVal, colVal) =>
      resolveCell({ rowVal, colVal, superVal }, facetMap);

    // stack sorting
    const stack = getStack(facetKey);
    const sortedRowVals = (() => {
      if (!stack.length) return rowsVals;
      const arr = [...rowsVals];
      arr.sort((a, b) => {
        for (const { key, direction } of stack) {
          if (key === "ROW_LABEL") {
            const ca = labelFor(rowDim, a);
            const cb = labelFor(rowDim, b);
            const c = cmpValues(ca, cb);
            if (c !== 0) return direction === "asc" ? c : -c;
            continue;
          }
          if (key.startsWith("col|")) {
            const [, svKey, cvKey] = key.split("|");
            const sv = svKey === "__" ? null : svKey;
            const cv = cvKey === "__" ? null : cvKey;
            const va = valueForColumn(a, sv, cv);
            const vb = valueForColumn(b, sv, cv);
            const c = cmpValues(va, vb);
            if (c !== 0) return direction === "asc" ? c : -c;
          }
        }
        return 0;
      });
      return arr;
    })();

    // click handlers for headers
    const onSortRowLabel = () => cycleSort(facetKey, "ROW_LABEL");
    const onSortColumn = (sv, cv) => {
      const k = `col|${sv ?? "__"}|${cv ?? "__"}`;
      cycleSort(facetKey, k);
    };
    console.log("ridList", ridList, "ridToName", [...ridToName.entries()]);
    return (
      <div className="dp-scroll" key={facetKey} style={{ marginBottom: 24 }}>
        {facetMap.length > 0 && (
          <div className="text-sm text-gray-700 mb-2">
            {facetMap.map(([d, v]) => (
              <span key={`${d}-${v}`} className="mr-3">
                <strong>{d}</strong>: {labelFor(d, v)}
              </span>
            ))}
          </div>
        )}
        <table className="dp-table">
          <thead className="dp-thead">
            <tr>
              <th
                className="dp-th text-left cursor-pointer"
                style={{ minWidth: 140 }}
                onClick={onSortRowLabel}
                title={`Sort by ${rowDim?.toUpperCase() || "row"}`}
              >
                {rowDim ? rowDim.toUpperCase() : ""}
                {sortMarker(facetKey, "ROW_LABEL")}
              </th>
              {colGroups.map((g) => (
                <th
                  key={`sup-${g.superVal ?? "none"}`}
                  className="dp-th text-center"
                  colSpan={g.headers.length || 1}
                >
                  {supDim ? labelFor(supDim, g.superVal) : ""}
                </th>
              ))}
            </tr>
            <tr>
              <th className="dp-th"></th>
              {colGroups.flatMap((g) =>
                g.headers.map((h) => {
                  const key = `col|${g.superVal ?? "__"}|${h.colVal ?? "__"}`;
                  return (
                    <th
                      key={`col-${g.superVal ?? "none"}-${h.colVal}`}
                      className="dp-th text-left cursor-pointer"
                      onClick={() => onSortColumn(g.superVal, h.colVal)}
                      title={`Sort by ${
                        colDim ? labelFor(colDim, h.colVal) : "column"
                      }`}
                    >
                      {colDim ? labelFor(colDim, h.colVal) : ""}
                      {sortMarker(facetKey, key)}
                    </th>
                  );
                })
              )}
            </tr>
          </thead>
          <tbody className="dp-tbody">
            {sortedRowVals.map((rv) => (
              <tr key={`row-${rv}`} className="dp-row">
                <td className="dp-td">{labelFor(rowDim, rv)}</td>
                {colGroups.flatMap((g) =>
                  g.headers.map((h) => {
                    const val = resolveCell(
                      { rowVal: rv, colVal: h.colVal, superVal: g.superVal },
                      facetMap
                    );
                    const indicatorKey =
                      (slots.row === "indicator" && rv) ||
                      (slots.col === "indicator" && h.colVal) ||
                      (slots.supercol === "indicator" && g.superVal) ||
                      facetMap.find(([d]) => d === "indicator")?.[1] ||
                      "Ext_Energy";
                    return (
                      <td
                        key={`cell-${rv}-${g.superVal}-${h.colVal}`}
                        className="dp-td"
                      >
                        {fmtValue(indicatorKey, val)}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const dragPill = (d) => (
    <div
      key={d}
      draggable
      onDragStart={(e) => onDragStart(e, d)}
      className="inline-block px-2 py-1 mr-2 mb-2 rounded bg-gray-100 border border-gray-300 text-xs cursor-move"
      title="Drag to a slot"
    >
      {d.toUpperCase()}
    </div>
  );

  return (
    <div className="bg-white rounded shadow p-4">
      <h3 className="text-lg font-semibold mb-2">Custom Pivot Table</h3>

      <div className="mb-3">
        <div className="text-xs text-gray-600 mb-1">
          Drag dimensions into slots:
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <div
            onDragOver={onDragOver}
            onDrop={onDropToUnused}
            className="p-2 border rounded min-w-[220px]"
          >
            <div className="text-xs font-semibold mb-1">Unused (facets)</div>
            <div>{unused.map((d) => dragPill(d))}</div>
          </div>
          <div
            onDragOver={onDragOver}
            onDrop={onDropToSlot("supercol")}
            className="p-2 border rounded min-w-[160px]"
          >
            <div className="text-xs font-semibold mb-1">Super-column</div>
            <div>
              {slots.supercol ? (
                dragPill(slots.supercol)
              ) : (
                <span className="text-xs text-gray-400">Drop here</span>
              )}
            </div>
          </div>
          <div
            onDragOver={onDragOver}
            onDrop={onDropToSlot("col")}
            className="p-2 border rounded min-w-[160px]"
          >
            <div className="text-xs font-semibold mb-1">Column</div>
            <div>
              {slots.col ? (
                dragPill(slots.col)
              ) : (
                <span className="text-xs text-gray-400">Drop here</span>
              )}
            </div>
          </div>
          <div
            onDragOver={onDragOver}
            onDrop={onDropToSlot("row")}
            className="p-2 border rounded min-w-[160px]"
          >
            <div className="text-xs font-semibold mb-1">Row</div>
            <div>
              {slots.row ? (
                dragPill(slots.row)
              ) : (
                <span className="text-xs text-gray-400">Drop here</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {err && <div className="text-sm text-red-600">Error: {err}</div>}

      {!loading && !err && facetCombos.map(buildTable)}
      {!loading && !err && facetCombos.length === 0 && (
        <div className="text-sm text-gray-500">No data.</div>
      )}
    </div>
  );
}
