// EmissionsScatterChart.jsx
import React, { useEffect, useRef, useState, useContext} from "react";
import * as d3 from "d3";
import "./index.css";
import Tooltip from "../../common/Tooltip";
import { useChartDims } from "../../../hooks/useChartDims";
import { ParametersContext } from "../../../context/ParametersContext";

export default function EmissionsScatterChart({
  fuel,
  data = [],         
  countries = [],
  onDataReady,
  svgRef,
  labelCountries = [],
  yMax = null,
  onYMax = null,
  loading = false,        
  error = null,          
  xStartYear = 2030,
  phaseoutLineYear = 2050,
}) {
  const tooltipRef = useRef();
  const [allData, setAllData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const { containerRef, dims } = useChartDims(0.875);
  const clipId = useRef(`clip-${fuel}-${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    const f = String(fuel || "").toLowerCase();
    const rows = Array.isArray(data) ? data : [];
    const norm = rows
      .filter((r) => {
        const rf = String(r.fuel ?? r.Fuel ?? "").toLowerCase();
        return !fuel || rf === f;
      })
      .map((r) => {
        const name = r.name ?? r.country ?? r.Country ?? r.iso3 ?? "";
        const rfuel = r.fuel ?? r.Fuel ?? fuel ?? "";
        const yearRaw = r.PhaseoutYr ?? r.phaseout_year ?? r.phaseout ?? 0;
        const depRaw  = r.DepTot ?? r.dep ?? r.Dependence ?? 0;
        const prodRaw = r.Prod_EJ ?? r.prod ?? r.Production_EJ ?? 0;
        const year = Math.min(+yearRaw || 0, Number(phaseoutLineYear) || 2050);
        return {
          country: name,
          fuel: String(rfuel),
          year,
          value: +depRaw || 0,
          prod: +prodRaw || 0,
        };
      });

    setAllData(norm);
    // report local max to parent
    const localMax = (d3.max(norm, (d) => d.value) ?? 0) + 3;
    onYMax?.(localMax);
    onDataReady?.(norm);
  }, [data, fuel, onYMax, onDataReady, phaseoutLineYear]);

  // Filter view
  useEffect(() => {
    const f = String(fuel || "").toLowerCase();
    const list = allData.filter(
      (d) =>
        d.fuel.toLowerCase() === f &&
        (countries.length === 0 || countries.includes(d.country))
    );
    setFiltered(list);
  }, [allData, fuel, countries]);

  // Draw
  useEffect(() => {
    const { width, height } = dims;
    if (!width || !height) return;

    const svg = d3.select(svgRef.current).attr("width", width).attr("height", height);
    svg.selectAll("*").remove();

    // Loading / error / empty states
    if (loading) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#6B7280")
        .attr("font-size", "1.1rem")
        .text("Loading…");
      return;
    }
    if (error) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#B91C1C")
        .attr("font-size", "1.1rem")
        .text(error);
      return;
    }
    if (filtered.length === 0) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#6B7280")
        .attr("font-size", "1.1rem")
        .text("No data to display");
      return;
    }

    const margin = { top: 30, right: 20, bottom: 60, left: 60 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const tooltip = d3.select(tooltipRef.current);

    const localMax = (d3.max(filtered, (d) => d.value) ?? 0) + 3;
    const maxVal = yMax != null ? yMax : localMax + 2;
    const y = d3.scaleLinear().domain([0, maxVal]).range([h, 0]);
    const x = d3.scaleLinear()
      .domain([Number(xStartYear) - 5 || 2030, (Number(phaseoutLineYear) || 2050) + 5])
      .range([0, w]);
    const rScale = d3
      .scaleSqrt()
      .domain([0, d3.max(filtered, (d) => d.prod) || 0])
      .range([1, 20]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xG = g
      .append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format("d")))
      .call((g) => g.selectAll("path,line").attr("stroke", "#1F2937"))
      .call((g) => g.selectAll("text").attr("fill", "#4B5563"));
    const yG = g
      .append("g")
      .call(d3.axisLeft(y).ticks(6))
      .call((g) => g.selectAll("path,line").attr("stroke", "#1F2937"))
      .call((g) => g.selectAll("text").attr("fill", "#4B5563"));

    g.append("text")
      .attr("x", w / 2)
      .attr("y", h + margin.bottom - 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#1F2937")
      .text(`Phaseout Year (${fuel})`);

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -h / 2)
      .attr("y", -margin.left + 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#1F2937")
      .text("Dependence Indicator");

    g.append("defs")
      .append("clipPath")
      .attr("id", clipId.current)
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", w)
      .attr("height", h);

    const plot = g.append("g").attr("clip-path", `url(#${clipId.current})`);

    // marker at 2050
    plot
      .append("line")
      .attr("class", "phaseout-marker")
      .attr("x1", x(phaseoutLineYear))
      .attr("x2", x(phaseoutLineYear))
      .attr("y1", y(0))
      .attr("y2", y(maxVal))
      .attr("stroke", "#D1D5DB")
      .attr("stroke-dasharray", "4 2");

    const sorted = filtered.slice().sort((a, b) => b.prod - a.prod);

    plot
      .selectAll("circle")
      .data(sorted)
      .join("circle")
      .attr("cx", (d) => x(d.year))
      .attr("cy", (d) => y(d.value))
      .attr("r", (d) => rScale(d.prod))
      .attr("fill", "#A7DDF5")
      .attr("stroke", "#000")
      .attr("stroke-width", 1)
      .on("mouseover", (e, d) => {
        tooltip.style("opacity", 1).html(`
          ${d.country} (${d.fuel})<br/>
          Production: ${d.prod.toFixed(3)} EJ
        `);
      })
      .on("mousemove", (e) => {
        const r = containerRef.current.getBoundingClientRect();
        tooltip
          .style("left", `${e.clientX - r.left + 10}px`)
          .style("top", `${e.clientY - r.top + 10}px`);
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    plot
      .selectAll("text.country-label")
      .data(sorted.filter((d) => labelCountries.includes(d.country)), (d) => d.country)
      .join(
        (enter) =>
          enter
            .append("text")
            .attr("class", "country-label")
            .attr("font-size", "0.75rem")
            .attr("fill", "#333")
            .attr("pointer-events", "none")
            .style("font-weight", "bold")
            .attr("x", (d) => x(d.year) + 7)
            .attr("y", (d) => y(d.value))
            .text((d) => d.country),
        (update) =>
          update
            .attr("x", (d) => x(d.year) + 7)
            .attr("y", (d) => y(d.value)),
        (exit) => exit.remove()
      );

    // Zoom
    d3
      .select(svg.node())
      .call(
        d3.zoom()
          .scaleExtent([1, 10])
          .translateExtent([[0, 0],[w, h]])
          .extent([[0, 0],[w, h]])
          .on("zoom", ({ transform }) => {
            const zx = transform.rescaleX(x);
            const zy = transform.rescaleY(y);
            xG.call(d3.axisBottom(zx).ticks(7).tickFormat(d3.format("d")))
              .call((g) => g.selectAll("path,line").attr("stroke", "#1F2937"))
              .call((g) => g.selectAll("text").attr("fill", "#4B5563"));
            yG.call(d3.axisLeft(zy).ticks(6))
              .call((g) => g.selectAll("path,line").attr("stroke", "#1F2937"))
              .call((g) => g.selectAll("text").attr("fill", "#4B5563"));
            plot.selectAll("circle")
              .attr("cx", (d) => zx(d.year))
              .attr("cy", (d) => zy(d.value));
            plot.selectAll("line.phaseout-marker")
              .attr("x1", zx(phaseoutLineYear)).attr("x2", zx(phaseoutLineYear))
              .attr("y1", zy(0)).attr("y2", zy(maxVal));
            plot.selectAll("text.country-label")
              .attr("x", (d) => zx(d.year) + 7)
              .attr("y", (d) => zy(d.value));
          })
      );

  }, [filtered, labelCountries, dims, fuel, svgRef, yMax, loading, error, xStartYear, phaseoutLineYear]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: `${dims.height}px` }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
      <Tooltip ref={tooltipRef} />
    </div>
  );
}
