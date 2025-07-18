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
    const positiveCaps = caps.filter(c => c > 0);
    const minCap = d3.min(positiveCaps);
    const y0 = d3.scalePow()
      .exponent(0.5)          
      .domain([0, d3.max(caps)])
      .range([h-1, 0])
      .nice();

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    g.append('defs')
    .append('clipPath')
    .attr('id','clip')
    .append('rect')
    .attr('width', w)
    .attr('height', h);
  
    g.append('defs').append('clipPath').attr('id', 'clip')
      .append('rect').attr('width', w).attr('height', h);
    // axes groups
    const xAxisG = g.append('g').attr('transform', `translate(0,${h})`);
    const yAxisG = g.append('g');
    
    function drawAxes(xScale, yScale) {
      let ticks = yScale.ticks(6);
      ticks = Array.from(new Set([ ...ticks, 2500, 5000 ]));
      const [y0, y1] = yScale.domain();    // [min,max] after zoom
      ticks = ticks.filter(v => v >= y0 && v <= y1).sort((a,b)=>a-b);
      xAxisG.call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('d')))
        .call(g => g.selectAll('path, line').attr('stroke', '#333'))
        .call(g => g.selectAll('text').attr('fill', '#333'));
      yAxisG.call(d3.axisLeft(yScale).tickValues(ticks)
        .tickFormat(d3.format(',d')))
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
    const avgCap = d3.mean(data, d => d.cap);           
    const plot = g.append('g').attr('clip-path', 'url(#clip)');

    // draw global average line
    plot.append('line')
      .attr('class','avg-line')                                      
      .attr('x1', 0).attr('x2', w)
      .attr('y1', y0(avgCap)).attr('y2', y0(avgCap))
      .attr('stroke', '#93bcc0')
      .style('stroke-width', 2)
      .style('pointer-events','all')              
      .on('mouseover', (e) =>                   
        tooltip
        .style('opacity', 1)
        .html('Global average capacity‑per‑capita'))
      .on('mousemove', (e) => {                
        const r = containerRef.current.getBoundingClientRect();
        tooltip.style('left',  `${e.clientX - r.left + 10}px`)
        .style('top',   `${e.clientY - r.top  + 10}px`);
      })
      .on('mouseout', () =>                       
        tooltip.style('opacity', 0)
      );


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
        g.select('.avg-line').attr('y1', zy(avgCap)).attr('y2', zy(avgCap));
        plot.select('avg-line').attr('y1', zy(avgCap)).attr('y2', zy(avgCap));
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