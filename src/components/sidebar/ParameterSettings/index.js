// components/sidebar/ParameterSettings/index.js
import React, { useContext, useState, useEffect, useRef } from "react";
import { ParametersContext } from "../../../context/ParametersContext";
import ResetButton from "../ResetButton";
import "./index.css";
import Cookies from "js-cookie";

export default function ParameterSettings({ onResultReady }) {
  const { parameters, setParameters } = useContext(ParametersContext);

  const PARAM_COOKIE = "paramSettings.v1"; // current working draft (cookie)
  const SAVED_SETS_LS = "paramSettings.savedSets.v1"; // localStorage: [{name, parameters}]
  const SAVED_SETS_COOKIE_OLD = "paramSettings.savedSets.v1"; // old cookie key (migrate if present)
  const CURRENT_NAME_COOKIE = "paramSettings.currentName.v1"; // current set name (cookie)

  const mitigationOptions = [
    { id: 1, label: "Low Energy Demand Scenario" },
    { id: 2, label: "High Energy Demand Scenario" },
  ];
  const scalingOptions = ["CSER High Capacity", "CSER Medium Progressivity", "off"];

  const [open, setOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);

  // Import/Export + Named sets UI state
  const [ioMsg, setIoMsg] = useState(null);
  const importRef = useRef(null);
  const [savedSets, setSavedSets] = useState([]); // [{name, parameters}]
  const [currentSetName, setCurrentSetName] = useState("");
  const [nameInput, setNameInput] = useState("");

  const round1 = (x) => Math.round(x * 10) / 10;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const asInt = (v, fallback = null) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  };
  const WEIGHT_KEYS = ["weightDomestic", "weightRevenue", "weightJobs"];
  const RIGHT_OF = {
    weightDomestic: "weightRevenue",
    weightRevenue: "weightJobs",
    weightJobs: "weightDomestic",
  };
  const __PS_DEBUG__ =
  (typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).get("psdebug") === "1" ||
     window.localStorage?.getItem("ps.debug") === "1")) || false;
  const d = (...args) => { if (__PS_DEBUG__) console.log("[ParamSettings]", ...args); };
  function eq33_3(x) {
    return Math.abs(round1(x) - 33.3) < 0.05;
  }
  
  function redistributeOnChange(changedKey, rawVal) {
    const desired = sanitizePct(rawVal);
    setParameters((prev) => {
      const partnerKey = RIGHT_OF[changedKey];
      const thirdKey   = WEIGHT_KEYS.find(k => k !== changedKey && k !== partnerKey);
  
      const partner0 = Number(prev[partnerKey] ?? 0);
      const third0   = Number(prev[thirdKey]   ?? 0);
  
      const maxChangedNoThird = 100 - third0;    
      if (desired <= maxChangedNoThird) {
        const changed = desired;
        const partner = 100 - third0 - changed;         
        d("onChange", { changedKey, rawVal, desired, partner0, third0 });
        return {
          ...prev,
          [changedKey]: changed,
          [partnerKey]: partner,
        };
      }

      const changed = Math.min(desired, 100);             
      const third   = Math.max(0, 100 - changed);       
      const partner = 100 - third - changed;               
      d("onChange -> using partner only", {
        changedKey, changed, partner, third: third0, sum: changed + partner + third0
      });
      d("onChange -> partner pinned at 0", {
        changedKey, changed, partner, third, sum: changed + partner + third
      });
      return {
        ...prev,
        [changedKey]: changed,
        [partnerKey]: partner,
        [thirdKey]:   third,
      };
    });
  }
  
  function handleWeightBlur(changedKey) {
    setParameters((prev) => {
      const partnerKey = RIGHT_OF[changedKey];
      const thirdKey   = WEIGHT_KEYS.find(k => k !== changedKey && k !== partnerKey);
  
      const wd0 = Number(prev.weightDomestic ?? 0);
      const wr0 = Number(prev.weightRevenue  ?? 0);
      const wj0 = Number(prev.weightJobs     ?? 0);
      d("onBlur: before", { changedKey, d: wd0, r: wr0, j: wj0 });

      // Preserve exact 33.3/33.3/33.3 (sum 99.9 allowed).
      if (eq33_3(wd0) && eq33_3(wr0) && eq33_3(wj0)) {
        return { ...prev, weightDomestic: 33.3, weightRevenue: 33.3, weightJobs: 33.3 };
      }
  
      const desiredRaw = clamp(Number(prev[changedKey] ?? 0), 0, 100);
      const third0     = clamp(Number(prev[thirdKey]   ?? 0), 0, 100);
  
      const maxChangedNoThird = 100 - third0;
      let changed, partner, third;
  
      if (desiredRaw <= maxChangedNoThird) {
        third   = round1(third0);
        changed = round1(clamp(desiredRaw, 0, 100 - third));
        partner = round1(100 - third - changed);
  
        const sum = round1(changed + partner + third);
        if (sum < 99) {
          const diff = round1(100 - sum); 
          const newPartner = round1(clamp(partner + diff, 0, 100 - third));
          const used = round1(newPartner - partner);
          partner = newPartner;
          if (used !== diff) {
            // If neighbor saturated, adjust the edited field minimally
            changed = round1(clamp(changed + (diff - used), 0, 100 - third));
            partner = round1(100 - third - changed);
          }
        }
      } else {
        // Partner pinned at 0; now edited + third change
        changed = round1(Math.min(desiredRaw, 100));
        third   = round1(Math.max(0, 100 - changed));
        partner = round1(100 - third - changed); // ~0
  
        // If rounding caused tiny drift, adjust the edited field
        const sum = round1(changed + partner + third);
        if (sum < 99) {
          const diff = round1(100 - sum);
          changed = round1(clamp(changed + diff, 0, 100 - third));
          partner = round1(100 - third - changed);
        }
      }
      d("onBlur: after", {
        changedKey,
        next: { [changedKey]: changed, [partnerKey]: partner, [thirdKey]: third },
        sum: changed + partner + third
      });
      return {
        ...prev,
        [changedKey]: changed,
        [partnerKey]: partner,
        [thirdKey]:   third,
      };
    });
  }
  
  const asFloat = (v, fallback = null) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const fromBoolish = (v) => v === 1 || v === "1" || v === true;
  const pctToFrac = (v) => {
    const f = Number(v);
    if (!Number.isFinite(f)) return null;
    return f > 1 ? clamp(f / 100, 0, 1) : clamp(f, 0, 1);
  };
  const fracToPct = (v) => {
    const f = Number(v);
    if (!Number.isFinite(f)) return null;
    return f <= 1 ? round1(clamp(f, 0, 1) * 100) : round1(clamp(f, 0, 100));
  };
  const cookieDays = 180;

  // percentage-based display/edit logic
  const wDom = parameters.weightDomestic ?? 33.3;
  const wRev = parameters.weightRevenue ?? 33.3;
  const wJobs = parameters.weightJobs ?? 33.3;
  d("render weights %", { wDom, wRev, wJobs });
  const evenDistribute = () => {
    const base = parseFloat((100 / 3).toFixed(1)); // 33.3
    setParameters((p) => ({
      ...p,
      weightDomestic: base,
      weightRevenue: base,
      weightJobs: base,
    }));
  };
  const sanitizePct = (x) => {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
  };

  const LS = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (e) {
        console.warn("localStorage save failed", e);
        setIoMsg("Unable to persist sets (localStorage full or disabled).");
      }
    },
  };

  useEffect(() => {
    try {
      const savedParams = Cookies.get(PARAM_COOKIE);
      if (savedParams) {
        setParameters((p) => ({ ...p, ...JSON.parse(savedParams) }));
      }
    } catch (e) {
      console.warn("Could not parse param cookie:", e);
    }

    let sets = LS.get(SAVED_SETS_LS, null);

    if (!sets) {
      try {
        const oldCookie = Cookies.get(SAVED_SETS_COOKIE_OLD);
        if (oldCookie) {
          const arr = JSON.parse(oldCookie);
          if (Array.isArray(arr)) {
            sets = arr;
            LS.set(SAVED_SETS_LS, arr);
            window.dispatchEvent(
              new CustomEvent("param-sets-updated", { detail: savedSets })
            );
            Cookies.remove(SAVED_SETS_COOKIE_OLD);
          }
        }
      } catch (e) {
        console.warn("Saved sets migration failed:", e);
      }
    }

    setSavedSets(Array.isArray(sets) ? sets : []);

    const name = Cookies.get(CURRENT_NAME_COOKIE) || "Untitled";
    setCurrentSetName(name);
    setNameInput(name);

    const onStorage = (e) => {
      if (e.key === SAVED_SETS_LS) {
        const latest = LS.get(SAVED_SETS_LS, []);
        setSavedSets(Array.isArray(latest) ? latest : []);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    if (parameters.scalingOption == null) {
      setParameters((p) => ({ ...p, scalingOption: "CSER High Capacity" }));
    }
  }, [parameters.scalingOption, setParameters]);
  useEffect(() => {
    Cookies.set(PARAM_COOKIE, JSON.stringify(parameters), { expires: 14 });
  }, [parameters]);
  

  useEffect(() => {
    LS.set(SAVED_SETS_LS, savedSets);
    window.dispatchEvent(new CustomEvent("param-sets-updated", { detail: savedSets }));
  }, [savedSets]);


  useEffect(() => {
    Cookies.set(CURRENT_NAME_COOKIE, currentSetName || "Untitled", {
      expires: cookieDays,
    });
  }, [currentSetName]);
  useEffect(() => {
    if (parameters.separateBudgetsByFuelType === undefined) {
      setParameters((p) => ({ ...p, separateBudgetsByFuelType: false }));
    }
  }, [parameters.separateBudgetsByFuelType, setParameters]);

  function uiToSchemaJson(p, nameForMeta) {
    const scenario_id = asInt(p.mitigationPathwayId ?? mitigationOptions[0].id);

    let wd = pctToFrac(p.weightDomestic ?? 33.3);
    let wr = pctToFrac(p.weightRevenue ?? 33.3);
    let wj = pctToFrac(p.weightJobs ?? 33.3);
    const sum = (wd ?? 0) + (wr ?? 0) + (wj ?? 0);
    if (sum > 0) {
      wd = wd / sum;
      wr = wr / sum;
      wj = wj / sum;
    }

    const schema = {
      meta: {
        set_name: nameForMeta || currentSetName || "Untitled",
      },
      param_sets: {
        result_id: null,
        is_calculated: 0,
        date_calculated: null,
        date_last_used: null,
        scenario_id,
        earliest_year: asInt(p.earliestPhaseoutYear ?? 2030),
        latest_year: asInt(p.latestPhaseoutYear ?? 2050),
        phaseout_thresh: pctToFrac(p.phaseoutThreshold ?? 90), // 0..1
        w_dom_energy: wd,
        w_gov_revenue: wr,
        w_employment: wj,
        capacity_settings_id: null,
        scale_dep_by_capacity:
          p.scalingOption && p.scalingOption !== "off" ? 1 : 0,
        // UI: separateBudgetsByFuelType -> DB: floating_budget
        floating_budget: p.separateBudgetsByFuelType ? 0 : 1,
      },
      capacity_settings: {
        capacity_settings_id: null,
        capacity_name: parameters.scalingOption ?? "CSER High Capacity",
        low_thresh:
          p.capacityLow === null || p.capacityLow === undefined
            ? null
            : asInt(p.capacityLow),
        high_thresh:
          p.capacityHigh === null || p.capacityHigh === undefined
            ? null
            : asInt(p.capacityHigh),
        interp_btw_thresh: p.capacityInterpolate ? 1 : 0,
        resp_since:
          p.responsibilitySince === null || p.responsibilitySince === undefined
            ? null
            : asInt(p.responsibilitySince),
        r_weight:
          p.responsibilityWeight === null ||
          p.responsibilityWeight === undefined
            ? null
            : pctToFrac(p.responsibilityWeight),
      },
      scenarios: mitigationOptions.map((m) => ({
        scenario_id: m.id,
        scenario_name: m.label,
      })),
    };

    // clamps
    const clamp01 = (x) => (x == null ? x : clamp(x, 0, 1));
    schema.param_sets.phaseout_thresh = clamp01(
      schema.param_sets.phaseout_thresh
    );
    schema.param_sets.w_dom_energy = clamp01(schema.param_sets.w_dom_energy);
    schema.param_sets.w_gov_revenue = clamp01(schema.param_sets.w_gov_revenue);
    schema.param_sets.w_employment = clamp01(schema.param_sets.w_employment);
    schema.capacity_settings.r_weight = clamp01(
      schema.capacity_settings.r_weight
    );

    return schema;
  }

  function schemaToUiParams(json) {
    if (!json || typeof json !== "object") {
      throw new Error("Uploaded JSON must be an object.");
    }
    if (json.param_sets && typeof json.param_sets === "object") {
      const ps = json.param_sets;
      const cs = json.capacity_settings || {};

      const pctWeights = {
        weightDomestic: fracToPct(ps.w_dom_energy ?? 1 / 3),
        weightRevenue: fracToPct(ps.w_gov_revenue ?? 1 / 3),
        weightJobs: fracToPct(ps.w_employment ?? 1 / 3),
      };
      // const sumPct =
      //   (pctWeights.weightDomestic ?? 0) +
      //   (pctWeights.weightRevenue ?? 0) +
      //   (pctWeights.weightJobs ?? 0);
      // if (sumPct > 0) {
      //   pctWeights.weightDomestic = round1(
      //     (pctWeights.weightDomestic / sumPct) * 100
      //   );
      //   pctWeights.weightRevenue = round1(
      //     (pctWeights.weightRevenue / sumPct) * 100
      //   );
      //   pctWeights.weightJobs = round1(
      //     100 - pctWeights.weightDomestic - pctWeights.weightRevenue
      //   );
      // }

      return {
        mitigationPathwayId: asInt(ps.scenario_id ?? mitigationOptions[0].id),
        earliestPhaseoutYear: asInt(ps.earliest_year ?? 2030),
        latestPhaseoutYear: asInt(ps.latest_year ?? 2050),
        phaseoutThreshold: fracToPct(ps.phaseout_thresh ?? 0.9),
        ...pctWeights,
        scalingOption:
          (cs.capacity_name ??
            (fromBoolish(ps.scale_dep_by_capacity)
              ? "CSER High Capacity"
              : "off")) ||
          "CSER High Capacity",
        capacityLow:
          cs.low_thresh === null || cs.low_thresh === undefined
            ? null
            : asInt(cs.low_thresh),
        capacityHigh:
          cs.high_thresh === null || cs.high_thresh === undefined
            ? null
            : asInt(cs.high_thresh),
        capacityInterpolate: fromBoolish(cs.interp_btw_thresh),
        responsibilitySince:
          cs.resp_since === null || cs.resp_since === undefined
            ? null
            : asInt(cs.resp_since),
        responsibilityWeight:
          cs.r_weight === null || cs.r_weight === undefined
            ? null
            : fracToPct(cs.r_weight),
        separateBudgetsByFuelType: ps.floating_budget === 1 ? false : true,
      };
    }

    const p = { ...json };
    ["weightDomestic", "weightRevenue", "weightJobs"].forEach((k) => {
      if (k in p) p[k] = asFloat(p[k]);
    });
    if ("phaseoutThreshold" in p)
      p.phaseoutThreshold = asFloat(p.phaseoutThreshold);
    if ("responsibilityWeight" in p)
      p.responsibilityWeight = asFloat(p.responsibilityWeight);

    if (p.phaseoutThreshold != null)
      p.phaseoutThreshold = clamp(p.phaseoutThreshold, 0, 100);
    ["weightDomestic", "weightRevenue", "weightJobs"].forEach((k) => {
      if (p[k] != null) p[k] = clamp(round1(p[k]), 0, 100);
    });
    return p;
  }

  const normalizeName = (s) => (s || "").trim();

  const upsertSavedSet = (name, params, meta = {}) => {
    const key = normalizeName(name) || "Untitled";
    setSavedSets((prev) => {
      const idx = prev.findIndex((x) => x.name === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { name: key, parameters: params, meta: { ...(prev[idx].meta||{}), ...meta } };
        return next;
      }
      return [...prev, { name: key, parameters: params, meta }];
    });
  };

  const deleteSavedSet = (name) => {
    setSavedSets((prev) => prev.filter((x) => x.name !== name));
    if (currentSetName === name) {
      setCurrentSetName("Untitled");
      setNameInput("Untitled");
    }
  };

  function handleDownload() {
    try {
    const schemaJson = uiToSchemaJson(parameters, currentSetName);
    const rec = savedSets.find(s => s.name === (currentSetName || "Untitled"));
    if (rec?.meta?.known_result_id != null) {
      schemaJson.param_sets.result_id = rec.meta.known_result_id;
    }
      const data = JSON.stringify(schemaJson, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const ts = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const safeName = (currentSetName || "Untitled")
        .replace(/[^\w\-]+/g, "_")
        .slice(0, 40);
      const fileName = `param_set-${safeName}-${ts.getFullYear()}${pad(
        ts.getMonth() + 1
      )}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(
        ts.getSeconds()
      )}.json`;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setIoMsg("Downloaded schema JSON (with set name).");
    } catch (err) {
      console.error(err);
      setIoMsg(`Download failed: ${String(err.message || err)}`);
    }
  }

  function triggerUpload() {
    setIoMsg(null);
    if (importRef.current) {
      importRef.current.value = ""; // allow re-selecting same file
      importRef.current.click();
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setIoMsg("File too large (max 2MB).");
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const uiParams = schemaToUiParams(parsed);

      // name (meta)
      const uploadedName =
        normalizeName(
          (parsed.meta && parsed.meta.set_name) ||
            parsed.set_name ||
            parsed.name
        ) || "Imported Set";

      const newParams = { ...parameters, ...uiParams };
      setParameters(newParams);
      setCurrentSetName(uploadedName);
      setNameInput(uploadedName);

      const knownId = parsed?.param_sets?.result_id ?? null;
      upsertSavedSet(uploadedName, newParams, knownId != null ? { known_result_id: knownId } : {});


      setIoMsg("Imported, saved to named sets, and applied.");
    } catch (err) {
      console.error(err);
      setIoMsg(`Import failed: ${String(err.message || err)}`);
    }
  }

  function handleExportAll() {
    try {
      const setsSchemas = savedSets.map((s) => {
        const sch = uiToSchemaJson(s.parameters, s.name);
        if (s.meta?.known_result_id != null) sch.param_sets.result_id = s.meta.known_result_id;
        const { scenarios, ...rest } = sch;
        return rest;
      });

      const bundle = {
        meta: {
          type: "param_settings.bundle",
          version: 1,
          exported_at: new Date().toISOString(),
          count: setsSchemas.length,
        },
        scenarios: mitigationOptions.map((m) => ({
          scenario_id: m.id,
          scenario_name: m.label,
        })),
        sets: setsSchemas, // each entry has { meta, param_sets, capacity_settings }
      };

      const data = JSON.stringify(bundle, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const ts = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const fileName = `param_sets_bundle-${ts.getFullYear()}${pad(
        ts.getMonth() + 1
      )}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(
        ts.getSeconds()
      )}.json`;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setIoMsg(`Exported ${setsSchemas.length} saved set(s) as a bundle.`);
    } catch (err) {
      console.error(err);
      setIoMsg(`Export all failed: ${String(err.message || err)}`);
    }
  }

  const triggerImport = () => {
    setIoMsg(null);
    if (importRef.current) {
      importRef.current.value = ""; // allow same-file reselect
      importRef.current.click();
    }
  };

  function mergeImportedSets(imported) {
    setSavedSets((prev) => {
      const byName = new Map(prev.map((x) => [x.name, x]));
      imported.forEach(({ name, parameters, meta }) => {
        const key = normalizeName(name) || "Untitled";
        const prior = byName.get(key);
        byName.set(key, {
          name: key,
          parameters,
          meta: { ...(prior?.meta || {}), ...(meta || {}) },
        });
      });
      return Array.from(byName.values());
    });
  }

  async function handleImportChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const MAX_SIZE = 5 * 1024 * 1024;
    if (files.some((f) => f.size > MAX_SIZE)) {
      setIoMsg("A file is too large (max 5MB).");
      return;
    }

    try {
      const texts = await Promise.all(files.map((f) => f.text()));
      let imported = [];

      for (const text of texts) {
        const parsed = JSON.parse(text);

        if (
          parsed?.meta?.type === "param_settings.bundle" &&
          Array.isArray(parsed.sets)
        ) {
          for (const sch of parsed.sets) {
            const name = sch?.meta?.set_name || "Imported Set";
            const uiParams = schemaToUiParams(sch);
            const rid = sch?.param_sets?.result_id ?? parsed?.param_sets?.result_id ?? null;
            imported.push({ name, parameters: uiParams, meta: rid!=null ? { known_result_id: rid } : {} });
          }
        }
        else if (Array.isArray(parsed)) {
          if (parsed[0]?.param_sets) {
            for (const sch of parsed) {
              const name = sch?.meta?.set_name || "Imported Set";
              const uiParams = schemaToUiParams(sch);
             const rid = sch?.param_sets?.result_id ?? parsed?.param_sets?.result_id ?? null;
            imported.push({ name, parameters: uiParams, meta: rid!=null ? { known_result_id: rid } : {} });
            }
          } else if (parsed[0]?.name && parsed[0]?.parameters) {
            imported = imported.concat(parsed);
          }
        }
        else if (parsed?.param_sets) {
          const name = parsed?.meta?.set_name || "Imported Set";
          const uiParams = schemaToUiParams(parsed);
          const rid = parsed?.param_sets?.result_id ?? null;    
          imported.push({
            name,
            parameters: uiParams,
            meta: rid != null ? { known_result_id: rid } : {},
          });
        } else {
          const uiParams = schemaToUiParams(parsed); 
          const name = parsed?.meta?.set_name || parsed?.name || "Imported Set";
          const rid = parsed?.param_sets?.result_id ?? null;     
          imported.push({
            name,
            parameters: uiParams,
            meta: rid != null ? { known_result_id: rid } : {},
          });
        }
      }

      if (!imported.length) {
        setIoMsg("No sets found in file(s).");
        return;
      }

      mergeImportedSets(imported);

      // Apply first imported set
      const first = imported[0];
      setParameters((prev) => ({ ...prev, ...first.parameters }));
      setCurrentSetName(first.name);
      setNameInput(first.name);

      setIoMsg(`Imported ${imported.length} set(s). First set applied.`);
    } catch (err) {
      console.error(err);
      setIoMsg(`Import failed: ${String(err.message || err)}`);
    }
  }

  async function handleSaveNamedSet() {
    const name = normalizeName(nameInput);
    if (!name) {
      setIoMsg("Please enter a name for this set.");
      return;
    }
    upsertSavedSet(name, parameters);
    setCurrentSetName(name);
    setIoMsg(`Saved parameter set "${name}".`);
    const rid = await findExistingResultId(parameters);
  if (rid != null) {
    upsertSavedSet(name, parameters, { known_result_id: rid });
    d("save: linked to existing result_id", rid);
  }
  }

  function handleLoadNamedSet(name) {
    const item = savedSets.find((x) => x.name === name);
    if (!item) {
      setIoMsg(`Could not find set "${name}".`);
      return;
    }
    setParameters((prev) => ({ ...prev, ...item.parameters }));
    setCurrentSetName(name);
    setNameInput(name);
    setIoMsg(`Loaded parameter set "${name}".`);
  }
function buildFindPayload(p) {
  const mitigationOptions = [
    { id: 1, label: "Low Energy Demand Scenario" },
    { id: 2, label: "High Energy Demand Scenario" },
  ];
  const snap01 = (x) => Math.min(100, Math.max(0, Math.round((+x || 0) * 10) / 10));
  let wd = snap01(p.weightDomestic ?? 33.3);
  let wr = snap01(p.weightRevenue  ?? 33.3);
  let wj = snap01(p.weightJobs     ?? 33.3);
  const sum = Math.round((wd + wr + wj) * 10) / 10;
  if (sum < 99) {
    const diff = Math.round((100 - sum) * 10) / 10;
    wj = Math.min(100, Math.max(0, Math.round((wj + diff) * 10) / 10));
  }
  const fwd = +(wd / 100).toFixed(3);
  const fwr = +(wr / 100).toFixed(3);
  const fwj = +(wj / 100).toFixed(3);

  return {
    scenario_id: p.mitigationPathwayId ?? mitigationOptions[0].id,
    earliest_year: p.earliestPhaseoutYear ?? 2030,
    latest_year: p.latestPhaseoutYear ?? 2050,

    phaseout_thresh: p.phaseoutThreshold ?? 90,
    w_dom_energy: wd,
    w_gov_revenue: wr,
    w_employment: wj,

    w_dom_energy_frac: fwd,
    w_gov_revenue_frac: fwr,
    w_employment_frac: fwj,
    weights_fingerprint: `${fwd}|${fwr}|${fwj}`,

    scale_dep_by_capacity: (p.scalingOption && p.scalingOption !== "off") ? 1 : 0,
    capacity_settings: {
      capacity_name: p.scalingOption ?? "CSER High Capacity",
      low_thresh: p.capacityLow ?? null,
      high_thresh: p.capacityHigh ?? null,
      interp_btw_thresh: p.capacityInterpolate ? 1 : 0,
      resp_since: p.responsibilitySince ?? null,
      r_weight: typeof p.responsibilityWeight === "number"
        ? p.responsibilityWeight
        : null,
    },
    floating_budget: (p.separateBudgetsByFuelType ?? true) ? 0 : 1,
  };
}

async function findExistingResultId(params) {
  try {
    const payload = buildFindPayload(params);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const res = await fetch("/api/param_lookup.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    clearTimeout(t);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    const rid = (json && typeof json.result_id === "number") ? json.result_id : null;
    return rid;
  } catch { return null; }
}

  async function handleSubmit() {
    d("submit:start", { parameters });
    try {
      setSubmitting(true);
      setSubmitMsg(null);
  
      const floatingBudget = (parameters.separateBudgetsByFuelType ?? true) ? 0 : 1;
  
      const snap01 = (x) => Math.min(100, Math.max(0, Math.round((+x || 0) * 10) / 10));
      let wd = snap01(parameters.weightDomestic ?? 33.3);
      let wr = snap01(parameters.weightRevenue  ?? 33.3);
      let wj = snap01(parameters.weightJobs     ?? 33.3);
  
      const sum = +(wd + wr + wj).toFixed(1);
      const isEvenCase = wd === 33.3 && wr === 33.3 && wj === 33.3 && sum === 99.9;
      if (!isEvenCase && sum < 99) {
        const diff = +(100 - sum).toFixed(1);
        if (wd >= wr && wd >= wj) wd = +(wd + diff).toFixed(1);
        else if (wr >= wd && wr >= wj) wr = +(wr + diff).toFixed(1);
        else wj = +(wj + diff).toFixed(1);
      }
  
      const fwd = +(wd / 100).toFixed(3);
      const fwr = +(wr / 100).toFixed(3);
      const fwj = +(wj / 100).toFixed(3);
      const weights_fp = `${fwd}|${fwr}|${fwj}`;
  
      d("submit:weights (percent)", { wd, wr, wj, sum });
      d("submit:weights (fractions)", { fwd, fwr, fwj, weights_fp });
  
      const payload = {
        scenario_id: parameters.mitigationPathwayId ?? mitigationOptions[0].id,
        earliest_year: parameters.earliestPhaseoutYear ?? 2030,
        latest_year: parameters.latestPhaseoutYear ?? 2050,
  
        phaseout_thresh: parameters.phaseoutThreshold ?? 90,
        w_dom_energy: wd,
        w_gov_revenue: wr,
        w_employment: wj,
  
        w_dom_energy_frac: fwd,
        w_gov_revenue_frac: fwr,
        w_employment_frac: fwj,
        weights_fingerprint: weights_fp,
  
        scale_dep_by_capacity:
          parameters.scalingOption && parameters.scalingOption !== "off" ? 1 : 0,
  
        capacity_settings: {
          capacity_name: parameters.scalingOption ?? "CSER High Capacity",
          low_thresh: parameters.capacityLow ?? null,
          high_thresh: parameters.capacityHigh ?? null,
          interp_btw_thresh: parameters.capacityInterpolate ? 1 : 0,
          resp_since: parameters.responsibilitySince ?? null,
          r_weight:
            typeof parameters.responsibilityWeight === "number"
              ? parameters.responsibilityWeight
              : null,
        },
        floating_budget: (parameters.separateBudgetsByFuelType ?? true) ? 0 : 1,
      };
  
      d("submit:payload", payload);
  
      const url = "/api/param_submit_simple.php?debug=1";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      d("submit:response status", res.status);
  
      const raw = await res.text();
      d("submit:raw response", raw);
      const json = JSON.parse(raw);
      d("submit:json", json);
  
      if (json?.debug) {
        d("server.debug.phase", json.debug.phase);
        d("server.debug.find_params", json.debug.find_params);
        d("server.debug.find_sql_literal\n" + json.debug.find_sql_literal);
        d("server.debug.matched_row_delta_report", json.debug.matched_row_delta_report);
        d("server.debug.nearest_by_weights_top5", json.debug.nearest_by_weights_top5);
      }
  
      setSubmitMsg(
        json.status === "ready"
          ? `Result ready (result_id=${json.result_id}).`
          : `Submitted.`
      );
      d("submit:status", { status: json.status, result_id: json.result_id, existing: json.existing });
  
      if (json?.result_id != null) {
        const rid = String(json.result_id);
        const committedLatest = parameters.latestPhaseoutYear ?? 2050;
        const committedEarliest = parameters.earliestPhaseoutYear ?? 2030;
        localStorage.setItem("active.earliest_year", String(committedEarliest));
        localStorage.setItem("active.latest_year", String(committedLatest));
        window.dispatchEvent(new CustomEvent("active-earliest-year", { detail: committedEarliest }));
        window.dispatchEvent(new CustomEvent("active-latest-year",   { detail: committedLatest   }));
  
        onResultReady?.(rid);
        localStorage.setItem("active.result_id", rid);
        window.dispatchEvent(new CustomEvent("active-result-id", { detail: rid }));
      }
    } catch (err) {
      setSubmitMsg(`Submit failed: ${String(err.message || err)}`);
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }
  

  return (
    <section className="mb-2 font-body">
      {/* hidden file inputs */}
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        multiple
        className="hidden"
        onChange={handleImportChange}
      />

      <div
        className="parameters-header bg-green-500 text-white px-4 py-2 cursor-pointer select-none flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <span>Input Selection</span>
        <span
          className={`ml-2 transform transition-transform duration-300 ${
            open ? "rotate-0" : "-rotate-180"
          }`}
        >
          ▼
        </span>
      </div>

      <div
        className={`overflow-hidden transform origin-top transition-transform duration-300 ${
          open ? "scale-y-100" : "scale-y-0"
        }`}
      >
        <div
          className={`transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="parameters-container p-4 bg-white border border-gray-200">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-4 p-3 border rounded bg-gray-50">
              <div className="flex flex-col md:flex-row md:items-end md:gap-3">
                <div className="flex-1 min-w-0">
                  <label className="parameter-name">Parameter set name</label>
                  <input
                    type="text"
                    className="parameter-input w-full"
                    placeholder="e.g., LED 2030–2050 (v1)"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                  />
                  <div className="text-xs text-gray-600 mt-1">
                    Using:{" "}
                    <span className="font-semibold">
                      {currentSetName || "Untitled"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveNamedSet}
                    className={`text-xs px-3 py-1 rounded text-white ${
                      submitting
                        ? "bg-gray-400"
                        : "bg-brand hover:brightness-110"
                    }`}
                    title="Save or update this parameter set"
                  >
                    Save set
                  </button>
                </div>
              </div>

              {savedSets.length > 0 && (
                <div className="mt-1">
                  <label className="parameter-name">Load saved set</label>
                  <div className="flex gap-2 items-center">
                    <select
                      className="parameter-input-dropdown"
                      onChange={(e) =>
                        e.target.value && handleLoadNamedSet(e.target.value)
                      }
                      defaultValue=""
                    >
                      <option value="" disabled>
                        — Select a saved set —
                      </option>
                      {savedSets.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    {savedSets.some(
                      (s) => s.name === (nameInput || "").trim()
                    ) && (
                      <button
                        type="button"
                        className="text-xs px-3 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 whitespace-nowrap"
                        onClick={() => {
                          const n = (nameInput || "").trim();
                          deleteSavedSet(n);
                          setIoMsg(`🗑️ Deleted set "${n}".`);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-4">
                <button
                  type="button"
                  onClick={triggerImport}
                  className="text-xs px-3 py-1 rounded border border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 whitespace-nowrap"
                  title="Import one or more parameter sets"
                >
                  Import Params
                </button>

                <button
                  type="button"
                  onClick={handleExportAll}
                  className="text-xs px-3 py-1 rounded border border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 whitespace-nowrap"
                  title="Export all saved sets as a bundle"
                >
                  Export All Sets
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="text-xs px-3 py-1 rounded border border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 whitespace-nowrap"
                  title="Export the current set"
                >
                  Export&nbsp;
                  <span className="font-semibold truncate max-w-[160px] inline-block align-bottom">
                    “{currentSetName || "Untitled"}”
                  </span>
                </button>
              </div>
            </div>

            <div className="mb-3">
              <label className="parameter-name">
                Mitigation Pathway / Carbon Budget
              </label>
              <select
                className="parameter-input-dropdown"
                value={
                  parameters.mitigationPathwayId ?? mitigationOptions[0].id
                }
                onChange={(e) =>
                  setParameters((p) => ({
                    ...p,
                    mitigationPathwayId: +e.target.value,
                  }))
                }
              >
                {mitigationOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="parameter-name">Earliest Phaseout Year</label>
              <input
                type="number"
                min={new Date().getFullYear()}
                max="2100"
                className="parameter-input"
                value={parameters.earliestPhaseoutYear ?? 2030}
                onChange={(e) =>
                  setParameters((p) => ({
                    ...p,
                    earliestPhaseoutYear: +e.target.value,
                  }))
                }
              />
            </div>

            <div className="mb-3">
              <label className="parameter-name">Latest Phaseout Year</label>
              <input
                type="number"
                min={parameters.earliestPhaseoutYear ?? 2030}
                max="2100"
                className="parameter-input"
                value={parameters.latestPhaseoutYear ?? 2050}
                onChange={(e) =>
                  setParameters((p) => ({
                    ...p,
                    latestPhaseoutYear: +e.target.value,
                  }))
                }
              />
            </div>

            <div className="mb-4">
              <label className="parameter-name flex items-center">
                Phaseout Threshold:
                <span className="ml-2 font-semibold text-gray-700">
                  {parameters.phaseoutThreshold ?? 90}%
                </span>
              </label>
              <input
                type="range"
                min="80"
                max="100"
                step="1"
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none parameter-input-range accent-accentBlue"
                value={parameters.phaseoutThreshold ?? 90}
                onChange={(e) =>
                  setParameters((p) => ({
                    ...p,
                    phaseoutThreshold: +e.target.value,
                  }))
                }
                style={{
                  background: `linear-gradient(to right,
                    #1692df ${
                      (((parameters.phaseoutThreshold ?? 90) - 80) / 20) * 100
                    }%,
                    #E5E7EB ${
                      (((parameters.phaseoutThreshold ?? 90) - 80) / 20) * 100
                    }% )`,
                }}
              />
            </div>

            <div className="mb-4">
              <label className="parameter-name">
                Scaling of Dependence by Capacity
              </label>
              <select
                className="parameter-input-dropdown"
                value={parameters.scalingOption ?? "CSER High Capacity"}
                onChange={(e) =>
                  setParameters((p) => ({
                    ...p,
                    scalingOption: e.target.value,
                  }))
                }
              >
                {scalingOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <div className="flex items-center mb-2">
                <span className="parameter-name">Weightings (%)</span>
                <button
                  type="button"
                  className="ml-2 px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                  onClick={evenDistribute}
                >
                  Evenly distribute
                </button>
              </div>
              <div className="weights-layout">
                <div className="weight-item">
                  <label className="weight-title">Domestic Energy</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="weight-input"
                    value={wDom}
                    onChange={(e) => redistributeOnChange("weightDomestic", e.target.value)}
                    onBlur={() => handleWeightBlur("weightDomestic")}
                  />
                </div>

                <div className="weight-item">
                  <label className="weight-title">Government Revenue</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="weight-input"
                    value={wRev}
                    onChange={(e) => redistributeOnChange("weightRevenue", e.target.value)}
                    onBlur={() => handleWeightBlur("weightRevenue")}
                  />
                </div>

                <div className="weight-item">
                  <label className="weight-title">Jobs</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="weight-input"
                    value={wJobs}
                    onChange={(e) => redistributeOnChange("weightJobs", e.target.value)}
                    onBlur={() => handleWeightBlur("weightJobs")}
                  />
                </div>
              </div>
            </div>

            <details className="group">
              <summary className="advanced-dropdown">
                Advanced Input Options
                <span className="transform group-open:rotate-180 transition">
                  ⌄
                </span>
              </summary>
              <div className="options-container">
                <label className="dropdown-item">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={parameters.separateBudgetsByFuelType ?? true}
                    onChange={(e) =>
                      setParameters((p) => ({
                        ...p,
                        separateBudgetsByFuelType: e.target.checked,
                      }))
                    }
                  />
                  <span className="ml-2">Separate budgets by fuel type</span>
                </label>
              </div>
            </details>

            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className={`text-sm px-3 py-1 rounded text-white ${
                  submitting ? "bg-gray-400" : "bg-brand hover:brightness-110"
                }`}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>

              <ResetButton />
            </div>

            {submitMsg && (
              <div className="mt-2 text-sm text-gray-700">{submitMsg}</div>
            )}
            {ioMsg && <div className="mt-1 text-sm text-gray-700">{ioMsg}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
