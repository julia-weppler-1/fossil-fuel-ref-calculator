import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import * as XLSX from 'xlsx';
import * as d3 from 'd3';

/**
 * Zoomable line chart of phaseout trajectories for each country, per fuel, with tooltips.
 * Data source: public/LEDPaths.xlsx
 */
export default function LEDPathsLineChart({ fuel }) {
  const containerRef = useRef();
  const svgRef       = useRef();
  const tooltipRef   = useRef();
  const [dims, setDims]     = useState({ width: 0, height: 0 });
  const [series, setSeries] = useState([]);

  // 1) responsive sizing
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setDims({ width: w, height: w * 0.75 });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // 2) load & parse
  useEffect(() => {
    async function load() {
      const res  = await fetch('/LEDPaths.xlsx');
      const buf  = await res.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array' });
      const raw  = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      const hdr  = raw[0];
      const yrs  = hdr.slice(2).map(h => +h);
      const rows = raw.slice(1).map(r => ({
        country: r[0],
        fuel:    r[1],
        values:  yrs.map((y, i) => ({ year: y, value: +r[i+2] }))
      }));
      setSeries(rows.filter(d => d.fuel === fuel));
    }
    load().catch(console.error);
  }, [fuel]);

  // 3) draw + zoom
  useEffect(() => {
    const { width, height } = dims;
    if (!width || !height || !series.length) return;

    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const w = width  - margin.left - margin.right;
    const h = height - margin.top  - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width',  width)
      .attr('height', height);

    svg.selectAll('*').remove();
    const tooltip = d3.select(tooltipRef.current);

    // domain from data
    const allYears = series.flatMap(s => s.values.map(v => v.year));
    const allVals  = series.flatMap(s => s.values.map(v => v.value));

    const x0 = d3.scaleLinear()
      .domain([d3.min(allYears)-3, d3.max(allYears)])
      .range([0, w]);

    const y0 = d3.scaleLinear()
      .domain([0, d3.max(allVals)])
      .range([h-5, 0]);

    // container
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // clip for both lines & points
    g.append('defs').append('clipPath')
      .attr('id', 'plot-clip')
      .append('rect')
      .attr('width',  w)
      .attr('height', h);

    // axis groups
    const xAxisG = g.append('g').attr('transform', `translate(0,${h})`);
    const yAxisG = g.append('g');

    function drawAxes(xScale, yScale) {
      xAxisG
        .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('d')))
        .call(g => g.selectAll('path, line').attr('stroke', '#333'))
        .call(g => g.selectAll('text').attr('fill', '#333'));

      yAxisG
        .call(d3.axisLeft(yScale).ticks(6))
        .call(g => g.selectAll('path, line').attr('stroke', '#333'))
        .call(g => g.selectAll('text').attr('fill', '#333'));
    }
    drawAxes(x0, y0);

    // line generator
    const lineGen = d3.line()
      .x(d => x0(d.year))
      .y(d => y0(d.value))
      .curve(d3.curveLinear);

    // clipped group for plot
    const plotG = g.append('g')
      .attr('clip-path', 'url(#plot-clip)');

    // draw lines
    plotG.selectAll('path')
      .data(series)
      .join('path')
      .attr('fill','none')
      .attr('stroke', d => d.country === 'Aggregate' ? 'red' : '#888')
      .attr('stroke-width', d => d.country === 'Aggregate' ? 2 : 1)
      .attr('d',       d => lineGen(d.values))
      .on('mouseover', (event, d) => {
        tooltip.style('opacity', 1).html(d.country);
      })
      .on('mousemove', event => {
        const rect = containerRef.current.getBoundingClientRect();
        tooltip
          .style('left', `${event.clientX - rect.left + 10}px`)
          .style('top', `${event.clientY - rect.top + 10}px`);
      })
      .on('mouseout', () => tooltip.style('opacity', 0));


    // labels
    svg.append('text')
      .attr('x', margin.left + w / 2)
      .attr('y', height - 5)
      .attr('text-anchor','middle')
      .attr('fill','#333')
      .text(`LED Path (${fuel})`);

    svg.append('text')
      .attr('transform','rotate(-90)')
      .attr('x', -(margin.top + h / 2))
      .attr('y', 15)
      .attr('text-anchor','middle')
      .attr('fill','#333')
      .text('CO₂ Gt');

    // zoomable in both X and Y
    const zoom = d3.zoom()
      .scaleExtent([1,10])
      .translateExtent([[0,0],[w,h]])
      .extent([[0,0],[w,h]])
      .on('zoom', ({ transform }) => {
        const zx = transform.rescaleX(x0);
        const zy = transform.rescaleY(y0);

        // redraw axes
        drawAxes(zx, zy);

        // redraw lines
        plotG.selectAll('path')
          .attr('d', d => d3.line()
            .x(pt => zx(pt.year))
            .y(pt => zy(pt.value))
            .curve(d3.curveLinear)(d.values)
          );

      });

    svg.call(zoom);
  }, [series, dims]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg    ref={svgRef}    style={{ width: '100%', height: '100%' }} />
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
