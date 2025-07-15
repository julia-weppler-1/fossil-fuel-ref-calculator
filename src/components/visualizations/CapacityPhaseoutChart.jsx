import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import * as XLSX from 'xlsx';
import * as d3 from 'd3';

export default function CapacityPhaseoutAll() {
  const containerRef = useRef();
  const svgRef = useRef();
  const tooltipRef = useRef();
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [data, setData] = useState([]);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setDims({ width: w, height: w * 0.8 });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Load and merge sheet2 (capacity) + sheet7 (phaseout)
  useEffect(() => {
    async function load() {
      const res = await fetch('/emissions.xlsx');
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const capRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]]);
      const phaseRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[6]]);
      const phaseMap = new Map(phaseRows.map(r => [r.Country, Math.min(r.PhaseoutYr, 2050)]));
      const merged = capRows.map(r => {
        const year = phaseMap.get(r.Country);
        const cap = +r.Capacitypercap || +r.CapacityPerCapita || 0;
        return year != null && !isNaN(cap)
          ? { country: r.Country, year, cap }
          : null;
      }).filter(d => d);
      setData(merged);
    }
    load().catch(console.error);
  }, []);

  // Render with zoom
  useEffect(() => {
    const { width, height } = dims;
    if (!width || !data.length) return;

    const margin = { top: 40, right: 20, bottom: 60, left: 70 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
    svg.selectAll('*').remove();
    const tooltip = d3.select(tooltipRef.current);

    // scales
    const years = data.map(d => d.year);
    const caps = data.map(d => d.cap);
    const x0 = d3.scaleLinear().domain([2030, 2050]).range([0, w-5]);
    const y0 = d3.scaleLinear().domain([0, d3.max(caps)]).nice().range([h-1, 0]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // axes groups
    const xAxisG = g.append('g').attr('transform', `translate(0,${h})`);
    const yAxisG = g.append('g');

    function drawAxes(xScale, yScale) {
      xAxisG.call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('d')))
        .call(g => g.selectAll('path, line').attr('stroke', '#333'))
        .call(g => g.selectAll('text').attr('fill', '#333'));
      yAxisG.call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format(',d')))
        .call(g => g.selectAll('path, line').attr('stroke', '#333'))
        .call(g => g.selectAll('text').attr('fill', '#333'));
    }

    // initial axes
    drawAxes(x0, y0);

    // labels
    g.append('text')
      .attr('x', w / 2).attr('y', h + margin.bottom - 15)
      .attr('text-anchor', 'middle').attr('fill', '#333')
      .text('Phaseout Year');
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -h / 2).attr('y', -margin.left + 15)
      .attr('text-anchor', 'middle').attr('fill', '#333')
      .text('Capacity per Capita');

    // plot group
    const plot = g.append('g').attr('clip-path', 'url(#clip)');
    g.append('defs').append('clipPath').attr('id', 'clip')
      .append('rect').attr('width', w).attr('height', h);

    // points
    const circles = plot.selectAll('circle').data(data).join('circle')
      .attr('cx', d => x0(d.year))
      .attr('cy', d => y0(d.cap))
      .attr('r', 4)
      .attr('fill', '#1f77b4')
      .on('mouseover', (e, d) => tooltip.style('opacity', 1).html(d.country))
      .on('mousemove', e => {
        const r = containerRef.current.getBoundingClientRect();
        tooltip.style('left', `${e.clientX - r.left + 10}px`).style('top', `${e.clientY - r.top + 10}px`);
      })
      .on('mouseout', () => tooltip.style('opacity', 0));

    // zoom
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .translateExtent([[0, 0], [w, h]])
      .extent([[0, 0], [w, h]])
      .on('zoom', ({ transform }) => {
        const zx = transform.rescaleX(x0);
        const zy = transform.rescaleY(y0);
        drawAxes(zx, zy);
        circles.attr('cx', d => zx(d.year)).attr('cy', d => zy(d.cap));
      });

    svg.call(zoom);
  }, [dims, data]);

  return (
    <div ref={containerRef} style={{ position:'relative', width:'100%', height:'100%' }}>
      <svg ref={svgRef} style={{ width:'100%', height:'100%' }} />
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          background: 'white',
          padding: '4px 8px',
          border: 'none',
          borderRadius: 0,
          pointerEvents: 'none',
          opacity: 0,
          fontSize: '12px',
          color: '#333'
        }}
      />
    </div>
  );
}