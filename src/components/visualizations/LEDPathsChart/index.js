import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import * as XLSX from 'xlsx';
import * as d3 from 'd3';
import Tooltip from '../../common/Tooltip';
export default function LEDPathsChart({
  fuel,
  countries = [],        
  onDataReady,           // injected by ChartCard
  svgRef,                // injected by ChartCard
  labelCountries 
}) {
  const containerRef = useRef();
  const localSvgRef  = useRef();
  const tooltipRef   = useRef();

  const [dims,      setDims]      = useState({ width: 0, height: 0 });
  const [allSeries, setAllSeries] = useState([]);     // full data
  const [series,    setSeries]    = useState([]);     // filtered data
  const [globalMax,  setGlobalMax]  = useState(0);      // max across every row

  // 1) measure container
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setDims({ width: w, height: 0.875 * w });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // 2) load once
  useEffect(() => {
    async function load() {
      const res  = await fetch('/LEDPaths.xlsx');
      const buf  = await res.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array' });
      const raw  = XLSX.utils
        .sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      const hdr  = raw[0];
      const yrs  = hdr.slice(2).map(h => +h);
      const rows = raw.slice(1).map(r => ({
        country: r[0],
        fuel:    r[1],
        values:  yrs.map((y, i) => ({ year: y, value: +r[i + 2] }))
      }));
      const maxVal = d3.max(
        rows.flatMap(r => r.values.map(v => v.value))
      );

      setAllSeries(rows);
      setGlobalMax(maxVal);
    }
    load().catch(console.error);
  }, []); 

  // 3) filter whenever data, fuel, or countries change
  useEffect(() => {
    const filtered = allSeries.filter(d =>
      d.fuel === fuel &&
      (countries.length === 0 || countries.includes(d.country))
    );
    setSeries(filtered);
    const flat = filtered.flatMap(r =>
      r.values.map(v => ({
      country: r.country,
      fuel:    r.fuel,
      year:    v.year,
      value:   v.value
      }))
    );
    onDataReady?.(flat);
  }, [allSeries, fuel, countries, onDataReady]);

  // 4) draw with D3, exactly as before but using `series`
  useEffect(() => {
    const { width, height } = dims;
    if (!width || !height || !series.length) return;

    const margin = { top: 30, right: 20, bottom: 60, left: 60 };
    const w = width  - margin.left - margin.right;
    const h = height - margin.top  - margin.bottom;

    const svgEl = (svgRef?.current ?? localSvgRef.current);
    const svg   = d3.select(svgEl)
      .attr('width',  width)
      .attr('height', height);
      
    svg.selectAll('*').remove();
    const tooltip = d3.select(tooltipRef.current);

    // compute domains
    const allYears = series.flatMap(s => s.values.map(v => v.year));
    const allVals  = series.flatMap(s => s.values.map(v => v.value));

    const x0 = d3.scaleLinear()
      .domain([d3.min(allYears) - 3, d3.max(allYears)])
      .range([0, w]);

    const y0 = d3.scaleLinear()
      .domain([0, globalMax])
      .range([h - 5, 0]);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('defs').append('clipPath')
      .attr('id', 'plot-clip')
      .append('rect')
      .attr('width',  w)
      .attr('height', h);

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

    const lineGen = d3.line()
      .x(d => x0(d.year))
      .y(d => y0(d.value))
      .curve(d3.curveLinear);

    const plotG = g.append('g')
      .attr('clip-path', 'url(#plot-clip)');

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
          .style('top',  `${event.clientY - rect.top  + 10}px`);
      })
      .on('mouseout', () => tooltip.style('opacity', 0));

      const toLabel = series.filter(s => labelCountries.includes(s.country));
      const labelG = g.append('g');  

labelG.selectAll('text.series-label')
  .data(toLabel, d => d.country)
  .join(
    enter => enter.append('text')
      .attr('class', 'series-label')
      .attr('font-size', '0.75rem')
      .attr('fill', '#1F2937')
      .style('font-weight', 'bold')
      .attr('x', d => x0(d.values[0].year) + 4)
      .attr('y', d => y0(d.values[0].value) - 4)
      .text(d => d.country),
    update => update
      .attr('x', d => x0(d.values[0].year) + 4)
      .attr('y', d => y0(d.values[0].value) - 4),
    exit => exit.remove()
  );
    // labels
    g.append('text')
       .attr('x', w/2)
       .attr('y', h + margin.bottom - 15)
       .attr('text-anchor','middle')
       .attr('fill','#1F2937')
       .attr('font-size','1rem')
       .text(`LED Path (${fuel})`);

    g.append('text')
      .attr('transform','rotate(-90)')
      .attr('x', -h/2)
      .attr('y', -margin.left + 15)
      .attr('text-anchor','middle')
      .attr('fill','#1F2937')
      .attr('font-size','1rem')
      .text('CO₂ Gt');

    // zoom
    const zoom = d3.zoom()
      .scaleExtent([1,10])
      .translateExtent([[0,0],[w,h]])
      .extent([[0,0],[w,h]])
      .on('zoom', ({ transform }) => {
        const zx = transform.rescaleX(x0);
        const zy = transform.rescaleY(y0);
        drawAxes(zx, zy);
        plotG.selectAll('path')
          .attr('d', d => d3.line()
            .x(pt => zx(pt.year))
            .y(pt => zy(pt.value))
            .curve(d3.curveLinear)(d.values)
          );
        plotG.selectAll('text.series-label')
          .attr('x', d => zx(d.values[d.values.length-1].year) + 4)
          .attr('y', d => zy(d.values[d.values.length-1].value) - 4);
      });

    svg.call(zoom);
  }, [series, dims, labelCountries, globalMax]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <svg ref={svgRef ?? localSvgRef} style={{ width: '100%', height: '100%' }} />
      <Tooltip ref={tooltipRef} />
    </div>
  );
}
