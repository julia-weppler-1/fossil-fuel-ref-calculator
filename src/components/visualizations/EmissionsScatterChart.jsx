import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import * as XLSX from 'xlsx';
import * as d3 from 'd3';

export default function EmissionsScatterChart({ fuel }) {
  const containerRef = useRef();
  const svgRef = useRef();
  const tooltipRef = useRef();
  const [allData, setAllData] = useState([]);
  const [data, setData] = useState([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Measure container size
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        const height = width * 0.875;
        setDimensions({ width, height });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Load all fuel data once
  useEffect(() => {
    async function loadData() {
      const resp = await fetch('/emissions.xlsx');
      if (!resp.ok) throw new Error('Excel not found');
      const buffer = await resp.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetName = wb.SheetNames.find(name => {
        const hdr = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, range: 0 })[0];
        return hdr && hdr.includes('DepTot');
      });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      const mapped = rows.map(r => ({
        country: r.Country,
        fuel:    r.Fuel,
        year:    Math.min(r.PhaseoutYr, 2050),
        value:   r.DepTot
      }));
      setAllData(mapped);
    }
    loadData().catch(console.error);
  }, []);

  // Filter data for selected fuel
  useEffect(() => {
    setData(allData.filter(d => d.fuel === fuel));
  }, [allData, fuel]);

  // D3 render
  useEffect(() => {
    if (!data.length || dimensions.width === 0) return;
    const { width, height } = dimensions;
    const margin = { top: 30, right: 20, bottom: 60, left: 60 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const globalMax = d3.max(allData, d => d.value) + 3;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
    svg.selectAll('*').remove();
    const tooltip = d3.select(tooltipRef.current);

    // Scales
    const x = d3.scaleLinear().domain([2030, 2055]).range([0, w]);
    const y = d3.scaleLinear().domain([0, globalMax]).range([h, 0]);

    // Chart group
    const chartG = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Axes
    const xAxis = d3.axisBottom(x).ticks(7).tickFormat(d3.format('d'));
    const yAxis = d3.axisLeft(y).ticks(6);

    const xAxisG = chartG.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(xAxis)
      .call(g => g.selectAll('path, line').attr('stroke','#333'))
      .call(g => g.selectAll('text').attr('fill','#333'));

    const yAxisG = chartG.append('g')
      .call(yAxis)
      .call(g => g.selectAll('path, line').attr('stroke','#333'))
      .call(g => g.selectAll('text').attr('fill','#333'));

    // Labels
    chartG.append('text')
      .attr('x', w/2).attr('y', h + margin.bottom - 15)
      .attr('text-anchor','middle').attr('fill','#333')
      .text(`Phaseout Year (${fuel})`);
    chartG.append('text')
      .attr('transform','rotate(-90)')
      .attr('x', -h/2).attr('y', -margin.left+15)
      .attr('text-anchor','middle').attr('fill','#333')
      .text('Dependence Indicator');

    // Clip on zoom
    chartG.append('defs').append('clipPath').attr('id','chartClip')
      .append('rect').attr('width', w).attr('height', h);

    const plot = chartG.append('g').attr('clip-path','url(#chartClip)');

    // Hollow circles
    plot.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', d => x(d.year))
      .attr('cy', d => y(d.value))
      .attr('r', 4)
      .attr('fill', 'transparent')
      .attr('stroke', '#1f77b4')
      .attr('stroke-width', 1.5)
      .on('mouseover', (event, d) => tooltip.style('opacity',1).html(d.country))
      .on('mousemove', event => {
        const rect = containerRef.current.getBoundingClientRect();
        tooltip
          .style('left',`${event.clientX-rect.left+10}px`)
          .style('top',`${event.clientY-rect.top}px`);
      })
      .on('mouseout',()=>tooltip.style('opacity',0));

    // 2050 line
    plot.append('line')
      .attr('x1', x(2050)).attr('x2', x(2050))
      .attr('y1', y(0)).attr('y2', y(globalMax))
      .attr('stroke','#aaa').attr('stroke-dasharray','4 2');

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([1,10])
      .translateExtent([[0,0],[w,h]])
      .extent([[0,0],[w,h]])
      .on('zoom',({transform})=>{
        const zx = transform.rescaleX(x);
        const zy = transform.rescaleY(y);
        xAxisG.call(d3.axisBottom(zx).ticks(7).tickFormat(d3.format('d')))
          .call(g=>g.selectAll('path, line').attr('stroke','#333'))
          .call(g=>g.selectAll('text').attr('fill','#333'));
        yAxisG.call(d3.axisLeft(zy).ticks(6))
          .call(g=>g.selectAll('path, line').attr('stroke','#333'))
          .call(g=>g.selectAll('text').attr('fill','#333'));
        plot.selectAll('circle')
          .attr('cx',d=>zx(d.year)).attr('cy',d=>zy(d.value));
        plot.selectAll('line')
          .attr('x1',zx(2050)).attr('x2',zx(2050))
          .attr('y1', zy(0))     // bottom
          .attr('y2', zy(globalMax)); // top
      });
    svg.call(zoom);
  }, [allData, data, fuel, dimensions]);

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
