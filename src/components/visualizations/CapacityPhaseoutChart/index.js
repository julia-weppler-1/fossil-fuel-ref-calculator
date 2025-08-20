import React, { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import "./index.css";
import Tooltip from "../../common/Tooltip";
import { useChartDims } from "../../../hooks/useChartDims";

export default function CapacityPhaseoutChart({
  fuel,                    // 'oil' | 'coal' | 'gas'
  rows = [],               // unified dataset from parent (/api/capacity_phaseout.php?fuel=all)
  countries = [],
  labelCountries = [],
  yMax = null,
  onYMax = null,
}) {
  const { containerRef, dims } = useChartDims(0.875);
  const svgRef = useRef();
  const tooltipRef = useRef();
  const clipId = useRef(`clip-${fuel}-${Math.random().toString(36).slice(2)}`);

  const points = useMemo(() => {
    const ff = String(fuel || "").toLowerCase();
    const rowsForFuel = Array.isArray(rows)
      ? rows.filter(r => (r.fuel || "").toLowerCase() === ff)
      : [];

    const pts = rowsForFuel.map(r => {
      const isSupporter =
        Number(r.is_supporter) === 1 || (!!r.is_supporter && r.is_supporter !== 0);
      const cap = +r.capacity_pcap || 0;
      const support = r.support_pct != null ? +r.support_pct : null;
      const rawYr = r.PhaseoutYr != null ? +r.PhaseoutYr : null;
      const year = isSupporter ? 2050.25 : (rawYr == null ? null : Math.min(rawYr, 2050));
      return {
        country: r.country || r.iso3,
        iso3: r.iso3,
        fuel: r.fuel || ff,
        year,
        cap,
        support_pct: support,
        isSupporter,
      };
    }).filter(p => !Number.isNaN(p.cap));

    // let parent know a local max (for synchronized y ranges.)
    const localMax = d3.max(pts, d => d.cap) ?? 0;
    onYMax?.(Math.ceil(localMax));
    return pts;
  }, [rows, fuel, onYMax]);

  const filtered = useMemo(() => {
    return points.filter(d => (countries.length === 0 || countries.includes(d.country)));
  }, [points, countries]);

  useEffect(() => {
    const { width, height } = dims;
    const svg = d3.select(svgRef.current).attr("width", width).attr("height", height);
    svg.selectAll("*").remove();

    if (!width || !height) return;

    if (filtered.length === 0) {
      svg.append("text")
        .attr("x", width/2).attr("y", height/2)
        .attr("text-anchor","middle").attr("fill","#6B7280")
        .attr("font-size","1.25rem").text("No data to display");
      return;
    }

    const margin = { top: 40, right: 20, bottom: 60, left: 70 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const tooltip = d3.select(tooltipRef.current);

    const localMax = (d3.max(filtered, d => d.cap) ?? 0);
    const maxVal = yMax != null ? yMax : Math.ceil(localMax + 10000);

    const x0 = d3.scaleLinear().domain([2030, 2055]).range([0, w]);
    const y0 = d3.scaleLinear().domain([0, maxVal]).range([h, 0]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    g.append("defs").append("clipPath").attr("id", clipId.current)
      .append("rect").attr("x",0).attr("y",0).attr("width",w).attr("height",h);
    const plot = g.append("g").attr("clip-path", `url(#${clipId.current})`);

    // axes
    const xAxisG = g.append("g").attr("transform", `translate(0,${h})`);
    const yAxisG = g.append("g");
    const drawAxes = (xs, ys) => {
      xAxisG.call(d3.axisBottom(xs).ticks(5).tickFormat(d3.format("d")))
        .call(g => g.selectAll("path,line").attr("stroke","#1F2937"))
        .call(g => g.selectAll("text").attr("fill","#4B5563"));
      yAxisG.call(d3.axisLeft(ys).ticks(6))
        .call(g => g.selectAll("path,line").attr("stroke","#1F2937"))
        .call(g => g.selectAll("text").attr("fill","#4B5563"));
    };
    drawAxes(x0, y0);

    // labels
    g.append("text")
      .attr("x", w/2).attr("y", h + margin.bottom - 15)
      .attr("text-anchor","middle").attr("fill","#1F2937")
      .text(`Phaseout Year (${fuel})`);
    g.append("text")
      .attr("transform","rotate(-90)")
      .attr("x", -h/2).attr("y", -margin.left + 15)
      .attr("text-anchor","middle").attr("fill","#1F2937")
      .text("Capacity per Capita");

    // 2050 marker
    const marker2050 = plot.append("line")
      .attr("x1", x0(2050)).attr("x2", x0(2050))
      .attr("y1", y0(0)).attr("y2", y0(maxVal))
      .attr("stroke", "#D1D5DB").attr("stroke-dasharray", "4 2");

    // split groups
    const extractors = filtered.filter(d => !d.isSupporter && d.year != null);
    const supporters = filtered.filter(d => d.isSupporter);

    // avg line (extractors only)
    const avg = d3.mean(extractors, d => d.cap);
    let avgLine = null;
    if (Number.isFinite(avg)) {
      avgLine = plot.append("line")
        .attr("x1", 0).attr("x2", w)
        .attr("y1", y0(avg)).attr("y2", y0(avg))
        .attr("stroke","#3F6F2A").attr("stroke-width",2)
        .on("mouseover", () => tooltip.style("opacity",1).html(`Global average: ${avg.toFixed(3)}`))
        .on("mousemove", e => {
          const r = containerRef.current.getBoundingClientRect();
          tooltip.style("left",`${e.clientX-r.left+10}px`).style("top",`${e.clientY-r.top+10}px`);
        })
        .on("mouseout", () => tooltip.style("opacity",0));
    }

    // colors
    const COLOR_EXTRACT = "#008BB9";
    const COLOR_SUPPORT = "#F59E0B";

    // extractors
    const cExtract = plot.selectAll("circle.extractor")
      .data(extractors, d => d.iso3)
      .join("circle")
      .attr("class","extractor")
      .attr("cx", d => x0(d.year))
      .attr("cy", d => y0(d.cap))
      .attr("r", 4)
      .attr("fill", COLOR_EXTRACT)
      .on("mouseover", (e,d) => {
        tooltip.style("opacity",1).html(
          `${d.country}<br/>Phaseout: ${d.year}<br/>Capacity/Capita: ${d.cap.toFixed(3)}`
        );
      })
      .on("mousemove", (e) => {
        const r = containerRef.current.getBoundingClientRect();
        tooltip.style("left",`${e.clientX-r.left+10}px`).style("top",`${e.clientY-r.top+10}px`);
      })
      .on("mouseout", () => tooltip.style("opacity",0));

    // supporters (x = 2050.25)
    const cSupport = plot.selectAll("circle.supporter")
      .data(supporters, d => d.iso3)
      .join("circle")
      .attr("class","supporter")
      .attr("cx", () => x0(2050.25))
      .attr("cy", d => y0(d.cap))
      .attr("r", 4)
      .attr("fill", COLOR_SUPPORT)
      .on("mouseover", (e,d) => {
        const pct = d.support_pct != null ? `${(d.support_pct*100).toFixed(1)}%` : "—";
        tooltip.style("opacity",1).html(
          `Supporter (non-extracting)<br/>${d.country}<br/>Support: ${pct}<br/>Cap/Cap: ${d.cap.toFixed(3)}`
        );
      })
      .on("mousemove", (e) => {
        const r = containerRef.current.getBoundingClientRect();
        tooltip.style("left",`${e.clientX-r.left+10}px`).style("top",`${e.clientY-r.top+10}px`);
      })
      .on("mouseout", () => tooltip.style("opacity",0));

    // labels (only chosen countries)
    const toLabel = filtered.filter(d => labelCountries.includes(d.country));
    plot.selectAll("text.country-label")
      .data(toLabel, d => d.iso3)
      .join("text")
      .attr("class","country-label")
      .attr("font-size","0.75rem")
      .attr("fill","#333")
      .attr("pointer-events","none")
      .attr("x", d => x0(d.isSupporter ? 2050.25 : d.year) + 6)
      .attr("y", d => y0(d.cap) - 6)
      .text(d => d.country);

    // zoom
    const zoom = d3.zoom()
      .scaleExtent([1,8])
      .translateExtent([[0,0],[w,h]])
      .extent([[0,0],[w,h]])
      .on("zoom", ({transform}) => {
        const zx = transform.rescaleX(x0);
        const zy = transform.rescaleY(y0);
        drawAxes(zx, zy);
        marker2050
          .attr("x1", zx(2050)).attr("x2", zx(2050))
          .attr("y1", zy(0)).attr("y2", zy(maxVal));
        if (avgLine) avgLine.attr("y1", zy(avg)).attr("y2", zy(avg));

        cExtract.attr("cx", d => zx(d.year)).attr("cy", d => zy(d.cap));
        cSupport.attr("cx", () => zx(2050.25)).attr("cy", d => zy(d.cap));
        plot.selectAll("text.country-label")
          .attr("x", d => zx(d.isSupporter ? 2050.25 : d.year) + 6)
          .attr("y", d => zy(d.cap) - 6);
      });

    // invisible overlay for zoom (below)
    svg.append("rect")
      .attr("width", width).attr("height", height)
      .style("fill","none").style("pointer-events","all")
      .call(zoom).lower();

  }, [filtered, dims, fuel, labelCountries, yMax]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: `${dims.height}px` }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
      <Tooltip ref={tooltipRef} />
    </div>
  );
}
