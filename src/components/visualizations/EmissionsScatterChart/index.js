import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import * as XLSX from "xlsx";
import * as d3 from "d3";
import "./index.css";
import Tooltip from "../../common/Tooltip";

export default function EmissionsScatterChart({
  fuel,
  countries = [],
  onDataReady, // injected by ChartCard
  svgRef, // injected by ChartCard
  labelCountries = [],
}) {
  const containerRef = useRef();
  const tooltipRef = useRef();
  const [allData, setAllData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  // 1) measure container
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setDims({ width: w, height: w * 0.875 });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // 2) load once: emissions + production
  useEffect(() => {
    (async () => {
      const res = await fetch("/emissions.xlsx");
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      // --- load production sheet (sheet #1) ---
      const prodRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      // map key = country|fuel > Prod_EJ
      const prodMap = new Map(
        prodRows.map((r) => [`${r.Country}|${r.Fuel}`, +r.Prod_EJ])
      );

      // --- load the emissions sheet by detecting DepTot column ---
      const emisSheetName = wb.SheetNames.find((name) =>
        (
          XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 })[0] || []
        ).includes("DepTot")
      );
      const emisRows = XLSX.utils.sheet_to_json(wb.Sheets[emisSheetName]);

      // assemble full data
      const rows = emisRows.map((r) => {
        const year = Math.min(r.PhaseoutYr, 2050);
        const prod = prodMap.get(`${r.Country}|${r.Fuel}`) || 0;
        return {
          country: r.Country,
          fuel: r.Fuel,
          year,
          value: +r.DepTot,
          prod,
        };
      });

      setAllData(rows);
    })();
  }, []);

  // 3) filter per‐fuel & report data upward
  useEffect(() => {
    const data = allData.filter(
      (d) =>
        d.fuel === fuel &&
        (countries.length === 0 || countries.includes(d.country))
    );
    setFiltered(data);
    onDataReady?.(data);
  }, [allData, fuel, countries, onDataReady]);

  // 4) draw
  useEffect(() => {
    const { width, height } = dims;
    if (!width || !height) return;

    const margin = { top: 30, right: 20, bottom: 60, left: 60 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const maxVal = d3.max(allData, (d) => d.value) + 3;

    // prepare svg
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);
    svg.selectAll("*").remove();
    if (filtered.length === 0) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#6B7280")
        .attr("font-size", "1.25rem")
        .text("No data to display");
      return;
    }
    const tooltip = d3.select(tooltipRef.current);

    // scales
    const x = d3.scaleLinear().domain([2030, 2055]).range([0, w]);
    const y = d3.scaleLinear().domain([0, maxVal]).range([h, 0]);
    const rScale = d3
      .scaleSqrt()
      .domain([0, d3.max(filtered, (d) => d.prod)])
      .range([1, 20]); // adjust min/max radius as you like

    // container group
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // axes
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

    // labels
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

    // clipping
    g.append("defs")
      .append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", w)
      .attr("height", h);
    const plot = g.append("g").attr("clip-path", "url(#clip)");

    // sort so larger circles are drawn first (underneath)
    const sorted = filtered.slice().sort((a, b) => b.prod - a.prod);
    // vertical marker
    plot
      .append("line")
      .attr("x1", x(2050))
      .attr("x2", x(2050))
      .attr("y1", y(0))
      .attr("y2", y(maxVal))
      .attr("stroke", "#D1D5DB")
      .attr("stroke-dasharray", "4 2");
    // draw circles
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
          Production: ${d.prod.toFixed(3)} EJ
        `);
      })
      .on("mousemove", (e) => {
        const r = containerRef.current.getBoundingClientRect();
        tooltip
          .style("left", `${e.clientX - r.left + 10}px`)
          .style("top", `${e.clientY - r.top + 10}px`);
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
    const labels = plot.selectAll("text.country-label").data(
      sorted.filter((d) => labelCountries.includes(d.country)),
      (d) => d.country
    );

    labels.exit().remove();

    labels
      .enter()
      .append("text")
      .attr("class", "country-label")
      .attr("font-size", "0.75rem")
      .attr("fill", "#333")
      .attr("pointer-events", "none")
      .style("font-weight", "bold")
      .merge(labels)
      .attr("x", (d) => x(d.year) + 7)
      .attr("y", (d) => y(d.value))
      .text((d) => d.country);
    // zoom

    svg.call(
      d3
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
          const zx = transform.rescaleX(x);
          const zy = transform.rescaleY(y);
          xG.call(d3.axisBottom(zx).ticks(7).tickFormat(d3.format("d")))
            .call((g) => g.selectAll("path,line").attr("stroke", "#1F2937"))
            .call((g) => g.selectAll("text").attr("fill", "#4B5563"));
          yG.call(d3.axisLeft(zy).ticks(6))
            .call((g) => g.selectAll("path,line").attr("stroke", "#1F2937"))
            .call((g) => g.selectAll("text").attr("fill", "#4B5563"));

          plot
            .selectAll("circle")
            .attr("cx", (d) => zx(d.year))
            .attr("cy", (d) => zy(d.value));

          plot
            .selectAll("line")
            .attr("x1", zx(2050))
            .attr("x2", zx(2050))
            .attr("y1", zy(0))
            .attr("y2", zy(maxVal));
          plot
            .selectAll("text.country-label")
            .attr("x", (d) => zx(d.year) + 7)
            .attr("y", (d) => zy(d.value));
        })
    );
  }, [allData, filtered, countries, labelCountries, dims, fuel, svgRef]);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
      <Tooltip ref={tooltipRef} />
    </div>
  );
}
