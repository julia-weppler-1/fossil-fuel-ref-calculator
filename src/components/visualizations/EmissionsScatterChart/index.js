import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import * as XLSX from 'xlsx';
import * as d3   from 'd3';
import './index.css';
import Tooltip from '../../common/Tooltip';

export default function EmissionsScatterChart({
  fuel,
  countries = [],
  onDataReady,   // injected by ChartCard
  svgRef,        // injected by ChartCard
}) {
  const containerRef = useRef();
  const tooltipRef   = useRef();
  const [allData, setAllData]     = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [dims, setDims]           = useState({ width: 0, height: 0 });

  // measure size
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

  // load once
  useEffect(() => {
    (async () => {
      const res = await fetch('/emissions.xlsx');
      const buf = await res.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array' });
      const sheet = wb.SheetNames.find(name =>
        XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 })[0]?.includes('DepTot')
      );
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet]);
      setAllData(rows.map(r => ({
        country: r.Country,
        fuel:    r.Fuel,
        year:    Math.min(r.PhaseoutYr, 2050),
        value:   r.DepTot
      })));
    })();
  }, []);

  // filter + report data up
  useEffect(() => {
    const data = allData.filter(d =>
      d.fuel === fuel &&
      (countries.length === 0 || countries.includes(d.country))
    );
    setFiltered(data);
    onDataReady?.(data);
  }, [allData, fuel, countries, onDataReady]);

  // draw
  useEffect(() => {
    const { width, height } = dims;
    if (!width) return;

    const margin = { top: 30, right: 20, bottom: 60, left: 60 };
    const w = width  - margin.left - margin.right;
    const h = height - margin.top  - margin.bottom;
    const globalMax = d3.max(allData, d => d.value) + 3;

    const svg = d3.select(svgRef.current)
      .attr('width',  width)
      .attr('height', height)
      .selectAll('*').remove() &&
      d3.select(svgRef.current);

    if (!filtered.length) {
      svg.append('text')
        .attr('x', width/2).attr('y', height/2)
        .attr('text-anchor','middle')
        .attr('fill','#4B5563')
        .attr('font-size','1rem')
        .text('No data for selected countries');
      return;
    }

    const tooltip = d3.select(tooltipRef.current);
    const x = d3.scaleLinear().domain([2030,2055]).range([0,w]);
    const y = d3.scaleLinear().domain([0,globalMax]).range([h,0]);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xG = g.append('g').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format('d')))
      .call(g => g.selectAll('path,line').attr('stroke','#1F2937'))
      .call(g => g.selectAll('text').attr('fill','#4B5563'));

    const yG = g.append('g')
      .call(d3.axisLeft(y).ticks(6))
      .call(g => g.selectAll('path,line').attr('stroke','#1F2937'))
      .call(g => g.selectAll('text').attr('fill','#4B5563'));

    // labels
    g.append('text')
      .attr('x', w/2).attr('y', h + margin.bottom - 15)
      .attr('text-anchor','middle').attr('fill','#1F2937')
      .text(`Phaseout Year (${fuel})`);
    g.append('text')
      .attr('transform','rotate(-90)')
      .attr('x', -h/2).attr('y', -margin.left+15)
      .attr('text-anchor','middle').attr('fill','#1F2937')
      .text('Dependence Indicator');

    // clip & plot
    g.append('defs').append('clipPath').attr('id','clip')
      .append('rect').attr('width', w).attr('height', h);
    const plot = g.append('g').attr('clip-path','url(#clip)');

    plot.selectAll('circle')
      .data(filtered)
      .join('circle')
      .attr('cx', d => x(d.year))
      .attr('cy', d => y(d.value))
      .attr('r', 4)
      .attr('fill', 'transparent')
      .attr('stroke','#4659C0')
      .attr('stroke-width', 1.5)
      .on('mouseover', (e,d) => tooltip.style('opacity',1).html(d.country))
      .on('mousemove', e => {
        const r = containerRef.current.getBoundingClientRect();
        tooltip
          .style('left', `${e.clientX - r.left + 10}px`)
          .style('top',  `${e.clientY - r.top  + 10}px`);
      })
      .on('mouseout', () => tooltip.style('opacity',0));

    plot.append('line')
      .attr('x1', x(2050)).attr('x2', x(2050))
      .attr('y1', y(0)).attr('y2', y(globalMax))
      .attr('stroke','#D1D5DB').attr('stroke-dasharray','4 2');

    svg.call(d3.zoom()
      .scaleExtent([1,10])
      .translateExtent([[0,0],[w,h]])
      .extent([[0,0],[w,h]])
      .on('zoom', ({transform}) => {
        const zx = transform.rescaleX(x);
        const zy = transform.rescaleY(y);
        xG.call(d3.axisBottom(zx).ticks(7).tickFormat(d3.format('d')))
          .call(g => g.selectAll('path,line').attr('stroke','#1F2937'))
          .call(g => g.selectAll('text').attr('fill','#4B5563'));
        yG.call(d3.axisLeft(zy).ticks(6))
          .call(g => g.selectAll('path,line').attr('stroke','#1F2937'))
          .call(g => g.selectAll('text').attr('fill','#4B5563'));
        plot.selectAll('circle')
          .attr('cx', d => zx(d.year))
          .attr('cy', d => zy(d.value));
        plot.selectAll('line')
          .attr('x1', zx(2050)).attr('x2', zx(2050))
          .attr('y1', zy(0)).attr('y2', zy(globalMax));
      })
    );
  }, [allData, filtered, countries, dims, fuel, svgRef]);

  return (
    <div ref={containerRef} style={{ position:'relative', width:'100%', height:'100%' }}>
      <svg ref={svgRef} style={{ width:'100%', height:'100%' }} />
      <Tooltip ref={tooltipRef}/>
    </div>
  );
}
