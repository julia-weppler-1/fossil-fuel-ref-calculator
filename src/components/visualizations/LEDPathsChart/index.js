import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import Tooltip from "../../common/Tooltip";
import { useChartDims } from "../../../hooks/useChartDims";

const MAX_STACKED_COUNTRIES = 17;
const AGG_NAME = "Aggregate";
const AGG_COLOR = "#d62728";

export default function LEDPathsChart({
  fuel,
  data = [],
  countries = [],
  onDataReady,
  onYMax,
  yMax,
  svgRef,
  labelCountries = [],
  chartKind = "line",
  yMode = "absolute",
  scatterRows = [],
}) {
  const localSvgRef = useRef();
  const tooltipRef = useRef();
  const { containerRef, dims } = useChartDims(0.875);
  const clipId = useRef(`clip-${Math.random().toString(36).slice(2)}`);

  const [allSeries, setAllSeries] = useState([]); // ALL countries
  const [series, setSeries] = useState([]); // visible (plus aggregate for line modes)
  const [autoMax, setAutoMax] = useState(0);

  const isStacked = chartKind === "stacked";
  const isRelative = yMode === "relative";

  useEffect(() => {
    setAllSeries(Array.isArray(data) ? data : []);
  }, [data]);

  const latestValOf = (s) => +(s?.values?.[s.values.length - 1]?.value ?? 0);
  const peakValOf = (s) => d3.max(s.values, (d) => +d.value) ?? 0;

  const pickTopByLatest = (rows, limit) =>
    [...rows]
      .sort((a, b) => d3.descending(latestValOf(a), latestValOf(b)))
      .slice(0, limit);

  const phaseoutYrByIso3 = useMemo(() => {
    const f = String(fuel || "").toLowerCase();
    const map = new Map();
    for (const r of scatterRows || []) {
      const rf = String(r.fuel ?? r.Fuel ?? "").toLowerCase();
      if (f && rf && rf !== f) continue; // match the chart’s fuel
      const iso = String(r.iso3 ?? r.ISO3 ?? "").toUpperCase();
      if (!iso) continue; // require ISO3 to avoid name mismatches
      const yr = Number(r.PhaseoutYr ?? r.phaseout_year ?? r.phaseout);
      if (Number.isFinite(yr)) map.set(iso, yr);
    }
    return map;
  }, [scatterRows, fuel]);
  function buildAggregate(rows) {
    const yearMap = new Map();
    for (const s of rows) {
      for (const v of s.values) {
        const y = +v.year;
        const val = +v.value || 0;
        yearMap.set(y, (yearMap.get(y) || 0) + val);
      }
    }
    return {
      country: AGG_NAME,
      fuel: rows[0]?.fuel || String(fuel || "").toLowerCase(),
      values: Array.from(yearMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([year, value]) => ({ year, value })),
    };
  }

  useEffect(() => {
    if (!allSeries.length) {
      setSeries([]);
      setAutoMax(0);
      onYMax?.(0);
      return;
    }

    const aggregate = buildAggregate(allSeries);
    const base = allSeries.filter(
      (d) => countries.length === 0 || countries.includes(d.country)
    );

    // For stacked, cap to 17
    const selectedForStack = isStacked
      ? pickTopByLatest(base, MAX_STACKED_COUNTRIES)
      : base;

    // Visible list
    const visible = isStacked ? selectedForStack : [...base, aggregate];

    // Compute yMax (depends on mode)
    let localMax = 0;

    if (isRelative) {
      const years = Array.from(
        new Set(visible.flatMap((s) => s.values.map((v) => +v.year)))
      ).sort((a, b) => a - b);
      const nonAgg = visible.filter((s) => s.country !== AGG_NAME);
      const byCountry = new Map(nonAgg.map((s) => [s.country, s]));

      let baselineDenom = 0;
      for (const y of years) {
        const dsum = nonAgg.reduce((acc, s) => {
          const v = s.values.find((vv) => +vv.year === y)?.value ?? 0;
          return acc + (+v || 0);
        }, 0);
        if (dsum > 0) {
          baselineDenom = dsum;
          break;
        }
      }
      // Build total-of-baseline time series
      const totalOfBaseline = years.map((y) => {
        const sumY = nonAgg.reduce((acc, s) => {
          const v = s.values.find((vv) => +vv.year === y)?.value ?? 0;
          return acc + (+v || 0);
        }, 0);
        return baselineDenom > 0 ? sumY / baselineDenom : 0;
      });
      const perSeriesMax = nonAgg.map((s) => {
        return (
          d3.max(
            years.map((y) => {
              const v = s.values.find((vv) => +vv.year === y)?.value ?? 0;
              return baselineDenom > 0 ? (+v || 0) / baselineDenom : 0;
            })
          ) ?? 0
        );
      });
      localMax = 1;
    } else {
      if (isStacked) {
        // top of absolute stack among VISIBLE non-agg series
        const nonAgg = visible.filter((s) => s.country !== AGG_NAME);
        const years = Array.from(
          new Set(nonAgg.flatMap((s) => s.values.map((v) => +v.year)))
        ).sort((a, b) => a - b);
        const keys = [...nonAgg]
          .sort((a, b) => d3.ascending(peakValOf(a), peakValOf(b)))
          .map((s) => s.country);
        const byCountry = new Map(nonAgg.map((s) => [s.country, s]));
        const rows = years.map((year) => {
          const row = { year };
          for (const k of keys) {
            const s = byCountry.get(k);
            const v = s?.values?.find((vv) => +vv.year === year)?.value ?? 0;
            row[k] = +v || 0;
          }
          return row;
        });
        const layers = d3.stack().keys(keys)(rows);
        const top = d3.max(layers, (layer) => d3.max(layer, (d) => d[1])) ?? 0;
        localMax = top;
      } else {
        // lines absolute: include aggregate
        localMax =
          d3.max(visible.flatMap((r) => r.values.map((v) => +v.value))) ?? 0;
      }
    }

    onYMax?.(localMax);
    setAutoMax(localMax);
    setSeries(visible);

    // parent callback (exclude aggregate)
    const flat = (isStacked ? selectedForStack : base).flatMap((r) =>
      r.values.map((v) => ({
        country: r.country,
        fuel: r.fuel,
        year: +v.year,
        value: +v.value,
      }))
    );
    onDataReady?.(flat);
  }, [allSeries, countries, fuel, onDataReady, onYMax, isStacked, isRelative]);

  useEffect(() => {
    if (onYMax && yMax == null && autoMax > 0) onYMax(autoMax);
  }, [yMax, autoMax, onYMax]);

  useEffect(() => {
    const { width, height } = dims;

    const margin = { top: 30, right: 20, bottom: 60, left: 60 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svgEl = svgRef?.current ?? localSvgRef.current;
    const svg = d3
      .select(svgEl)
      .attr("width", width || 0)
      .attr("height", height || 0);
    svg.selectAll("*").remove();

    if (!width || !height || !series.length) {
      if (width && height) {
        svg
          .append("g")
          .attr("transform", `translate(${width / 2}, ${height / 2})`)
          .append("text")
          .attr("text-anchor", "middle")
          .attr("fill", "#9CA3AF")
          .text("No data");
      }
      return;
    }
    const tooltip = d3
      .select(tooltipRef.current)
      .style("pointer-events", "none");
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("defs")
      .append("clipPath")
      .attr("id", clipId.current)
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", w)
      .attr("height", h);

    const allYears = Array.from(
      new Set(series.flatMap((s) => s.values.map((v) => +v.year)))
    ).sort((a, b) => a - b);
    const x0 = d3
      .scaleLinear()
      .domain([d3.min(allYears) - 3, d3.max(allYears)])
      .range([0, w]);

    const y0 = d3
      .scaleLinear()
      .domain(
        isRelative
          ? [0, 1] // always 0–100% when relative
          : [
              0,
              typeof yMax === "number" && yMax > 0
                ? yMax
                : Math.ceil((autoMax ?? 0) + 2),
            ]
      )
      .range([h - 5, 0]);

    const xAxisG = g.append("g").attr("transform", `translate(0,${h})`);
    const yAxisG = g.append("g");

    const yTickFmt = isRelative ? d3.format(".0%") : d3.format("~s");
    function drawAxes(xScale, yScale) {
      xAxisG
        .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format("d")))
        .call((g) => g.selectAll("path, line").attr("stroke", "#333"))
        .call((g) => g.selectAll("text").attr("fill", "#333"));
      yAxisG
        .call(d3.axisLeft(yScale).ticks(6).tickFormat(yTickFmt))
        .call((g) => g.selectAll("path, line").attr("stroke", "#333"))
        .call((g) => g.selectAll("text").attr("fill", "#333"));
    }
    drawAxes(x0, y0);

    const plotG = g.append("g").attr("clip-path", `url(#${clipId.current})`);
    const nonAgg = series.filter((s) => s.country !== AGG_NAME);
    const agg = series.find((s) => s.country === AGG_NAME);

    // colors
    const palette = [
      ...(d3.schemeObservable10 || d3.schemeTableau10 || d3.schemeCategory10),
      ...d3.schemePaired,
    ];
    const colorScale = d3
      .scaleOrdinal()
      .domain(nonAgg.map((d) => d.country))
      .range(palette.slice(0, Math.max(1, nonAgg.length)));

    // utilities
    const valueMap = (s) => {
      const m = new Map();
      for (const v of s.values) m.set(+v.year, +v.value || 0);
      return m;
    };
    const nonAggMaps = nonAgg.map((s) => ({
      key: s.country,
      map: valueMap(s),
    }));

    // baseline denom (relative modes)
    let baselineDenom = 0;
    if (isRelative) {
      for (const y of allYears) {
        const sumY = nonAggMaps.reduce(
          (acc, { map }) => acc + (map.get(y) || 0),
          0
        );
        if (sumY > 0) {
          baselineDenom = sumY;
          break;
        }
      }
    }

    // build normalized (relative) series if needed
    const nonAggRel = isRelative
      ? nonAgg.map((s) => ({
          country: s.country,
          values: allYears.map((y) => ({
            year: y,
            value:
              baselineDenom > 0 ? (valueMap(s).get(y) || 0) / baselineDenom : 0,
          })),
        }))
      : null;

    const aggRel =
      isRelative && !isStacked
        ? {
            country: AGG_NAME,
            values: allYears.map((y) => {
              const sumY = nonAggMaps.reduce(
                (acc, { map }) => acc + (map.get(y) || 0),
                0
              );
              return {
                year: y,
                value: baselineDenom > 0 ? sumY / baselineDenom : 0,
              };
            }),
          }
        : null;

    // generators
    const mkLine = (xScale, yScale) =>
      d3
        .line()
        .x((d) => xScale(+d.year))
        .y((d) => yScale(+d.value))
        .curve(d3.curveMonotoneX);

    const drawStacked = (xScale, yScale) => {
      // sort by peak to stabilize band ordering
      const ordering = [...nonAgg]
        .sort((a, b) => d3.ascending(peakValOf(a), peakValOf(b)))
        .map((s) => s.country);
      const byKey = new Map(nonAgg.map((s) => [s.country, s]));
      const byKeyRel = new Map((nonAggRel || []).map((s) => [s.country, s]));

      const rows = allYears.map((year) => {
        const row = { year };
        for (const k of ordering) {
          if (isRelative) {
            const sRel = byKeyRel.get(k);
            const v = sRel?.values?.find((vv) => +vv.year === year)?.value ?? 0;
            row[k] = +v || 0; // normalized to baseline
          } else {
            const s = byKey.get(k);
            const v = s?.values?.find((vv) => +vv.year === year)?.value ?? 0;
            row[k] = +v || 0; // absolute
          }
        }
        return row;
      });

      const layers = d3.stack().keys(ordering)(rows);

      const areaGen = d3
        .area()
        .x((d) => xScale(d.data.year))
        .y0((d) => yScale(d[0]))
        .y1((d) => yScale(d[1]))
        .curve(d3.curveMonotoneX);

      const fmt = isRelative ? d3.format(".1%") : d3.format("~s");

      plotG
        .selectAll("path.series-area")
        .data(layers, (d) => d.key)
        .join("path")
        .attr("class", "series-area")
        .attr("fill", (d) => colorScale(d.key))
        .attr("stroke", "none")
        .attr("opacity", 0.95)
        .style("pointer-events", "all")
        .attr("d", areaGen)
        .on("mouseover", (event, layer) =>
          tooltip.style("opacity", 1).html(layer.key)
        )
        .on("mousemove", (event, layer) => {
          const [mx] = d3.pointer(event, g.node());
          const xYear = Math.round(xScale.invert(mx));
          const i = d3.bisectCenter(allYears, xYear);
          const idx = Math.max(0, Math.min(allYears.length - 1, i));
          const row = rows[idx];
          const val = row?.[layer.key] ?? 0;

          let extra = "";
          if (isRelative) {
            const top = layers.reduce(
              (acc, lyr) => acc + (row?.[lyr.key] ?? 0),
              0
            );
            extra = `<br/><span style="color:#6b7280">Total: ${fmt(
              top
            )}</span>`;
          }
          tooltip.html(
            `${layer.key}<br/><strong>${fmt(val)}</strong> in ${
              allYears[idx]
            }${extra}`
          );

          const rect = containerRef.current.getBoundingClientRect();
          tooltip
            .style("left", `${event.clientX - rect.left + 10}px`)
            .style("top", `${event.clientY - rect.top + 10}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

      // no aggregate overlay in stacked modes
      plotG.selectAll("path.series-aggregate").remove();
    };

    const drawLines = (xScale, yScale) => {
      const lineSeries = isRelative ? nonAggRel : nonAgg;
      const aggSeries = isRelative ? aggRel : agg;

      const fmt = isRelative ? d3.format(".1%") : d3.format("~s");
      const phaseoutPoints = [];
      for (const s of nonAgg) {
        const iso = String(s.iso3 ?? s.ISO3 ?? "").toUpperCase();
        const yr = iso ? phaseoutYrByIso3.get(iso) : undefined;
        if (!Number.isFinite(yr)) continue; // no table value → skip dot
        const vAbs = valueAtYearInterpolated(s.values, yr); // keeps your y on the actual line
        const vPlot =
          isRelative && baselineDenom > 0 ? vAbs / baselineDenom : vAbs;
        phaseoutPoints.push({
          country: s.country,
          year: yr,
          valueAbs: vAbs,
          value: vPlot,
        });
      }
      plotG
        .selectAll("path.series")
        .data(lineSeries, (d) => d.country)
        .join("path")
        .attr("class", "series")
        .attr("fill", "none")
        .attr("stroke", "#888")
        .attr("stroke-width", 1)
        .attr("d", (d) => mkLine(xScale, yScale)(d.values))
        .style("pointer-events", "all")
        .on("mouseover", (event, d) =>
          tooltip.style("opacity", 1).html(d.country)
        )
        .on("mousemove", (event) => {
          const rect = containerRef.current.getBoundingClientRect();
          tooltip
            .style("left", `${event.clientX - rect.left + 10}px`)
            .style("top", `${event.clientY - rect.top + 10}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

      if (aggSeries) {
        plotG
          .selectAll("path.series-aggregate")
          .data([aggSeries])
          .join("path")
          .attr("class", "series-aggregate")
          .attr("fill", "none")
          .attr("stroke", AGG_COLOR)
          .attr("stroke-width", 2.5)
          .attr("d", (d) => mkLine(xScale, yScale)(d.values));
      }
      plotG
      .selectAll("circle.phaseout-point")
      .data(phaseoutPoints, (d) => d.country)
      .join("circle")
      .attr("class", "phaseout-point")
      .attr("r", 2)
      .attr("fill", AGG_COLOR)
      .style("pointer-events", "all")
      .attr("cx", (d) => x0(d.year))
      .attr("cy", (d) => y0(d.value))
      .on("mouseover", (event, d) => {
        const rect = containerRef.current.getBoundingClientRect();
        const txt = isRelative
          ? d3.format(".1%")(d.value)
          : d3.format("~s")(d.valueAbs);
        tooltip
          .style("opacity", 1)
          .html(
            `${d.country}<br/>PhaseoutYr: <strong>${d.year}</strong><br/>Value: ${txt}`
          );
        tooltip
          .style("left", `${event.clientX - rect.left + 10}px`)
          .style("top", `${event.clientY - rect.top + 10}px`);
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
      // labels only for line modes
      const toLabel = (isRelative ? nonAggRel : nonAgg).filter((s) =>
        labelCountries.includes(s.country)
      );
      g.append("g")
        .selectAll("text.series-label")
        .data(toLabel, (d) => d.country)
        .join(
          (enter) =>
            enter
              .append("text")
              .attr("class", "series-label")
              .attr("font-size", "0.75rem")
              .attr("fill", "#1F2937")
              .style("font-weight", "bold")
              .attr("x", (d) => xScale(+d.values[0].year) + 4)
              .attr("y", (d) => yScale(+d.values[0].value) - 4)
              .text((d) => d.country),
          (update) =>
            update
              .attr("x", (d) => xScale(+d.values[0].year) + 4)
              .attr("y", (d) => yScale(+d.values[0].value) - 4),
          (exit) => exit.remove()
        );
    };
    function valueAtYearInterpolated(values, year) {
      const arr = (values || [])
        .map((v) => ({ year: +v.year, value: +v.value || 0 }))
        .sort((a, b) => a.year - b.year);
      if (!arr.length) return 0;
      if (year <= arr[0].year) return arr[0].value;
      if (year >= arr[arr.length - 1].year) return arr[arr.length - 1].value;
      const i = Math.max(
        1,
        Math.min(arr.length - 1, d3.bisector((d) => d.year).left(arr, year))
      );
      const a = arr[i - 1],
        b = arr[i];
      const t = (year - a.year) / (b.year - a.year);
      return a.value + t * (b.value - a.value);
    }
    if (isStacked) drawStacked(x0, y0);
    else drawLines(x0, y0);

    // axis labels
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h + margin.bottom - 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#1F2937")
      .attr("font-size", "1rem")
      .text("Year");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -h / 2)
      .attr("y", -margin.left + 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#1F2937")
      .attr("font-size", "1rem")
      .text(isRelative ? "Share of baseline" : "CO₂ Gt");

    // zoom
    const zoom = d3
      .zoom()
      .scaleExtent([1, 10])
      .translateExtent([
        [0, 0],
        [w, h],
      ])
      .extent([
        [0, 0],
        [w, h],
      ])
      .on("zoom", ({ transform }) => {
        const zx = transform.rescaleX(x0);
        const zy = transform.rescaleY(y0);
        drawAxes(zx, zy);

        if (isStacked) {
          // recompute stacked paths under zoom (using same rows/order)
          const ordering = [...nonAgg]
            .sort((a, b) => d3.ascending(peakValOf(a), peakValOf(b)))
            .map((s) => s.country);
          const byKey = new Map(nonAgg.map((s) => [s.country, s]));
          const byKeyRel = new Map(
            (nonAggRel || []).map((s) => [s.country, s])
          );
          const rows = allYears.map((year) => {
            const row = { year };
            for (const k of ordering) {
              if (isRelative) {
                const sRel = byKeyRel.get(k);
                const v =
                  sRel?.values?.find((vv) => +vv.year === year)?.value ?? 0;
                row[k] = +v || 0;
              } else {
                const s = byKey.get(k);
                const v =
                  s?.values?.find((vv) => +vv.year === year)?.value ?? 0;
                row[k] = +v || 0;
              }
            }
            return row;
          });
          const layers = d3.stack().keys(ordering)(rows);
          const areaGen = d3
            .area()
            .x((d) => zx(d.data.year))
            .y0((d) => zy(d[0]))
            .y1((d) => zy(d[1]))
            .curve(d3.curveMonotoneX);
          plotG
            .selectAll("path.series-area")
            .data(layers, (d) => d.key)
            .attr("d", areaGen);
        } else {
          const lineSeries = isRelative ? nonAggRel : nonAgg;
          plotG
            .selectAll("path.series")
            .attr("d", (d) => mkLine(zx, zy)(d.values));
          if (isRelative ? aggRel : agg) {
            plotG
              .selectAll("path.series-aggregate")
              .attr("d", (d) =>
                mkLine(zx, zy)((isRelative ? aggRel : agg).values)
              );
          }
          g.selectAll("text.series-label")
            .attr("x", (d) => zx(+d.values[0].year) + 4)
            .attr("y", (d) => zy(+d.values[0].value) - 4);
          plotG
            .selectAll("circle.phaseout-point")
            .attr("cx", (d) => zx(d.year))
            .attr("cy", (d) => {
              // Repeat the relative/absolute logic with the new 'zy' scale
              if (isRelative) {
                const relativeValue =
                  baselineDenom > 0 ? d.value / baselineDenom : 0;
                return zy(relativeValue);
              }
              return zy(d.value);
            });
        }
      });

    svg.call(zoom);
  }, [series, dims, labelCountries, autoMax, yMax, chartKind, yMode, svgRef]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: `${dims.height}px`,
      }}
    >
      <svg
        ref={svgRef ?? localSvgRef}
        style={{ width: "100%", height: "100%" }}
      />
      <Tooltip ref={tooltipRef} />
    </div>
  );
}
