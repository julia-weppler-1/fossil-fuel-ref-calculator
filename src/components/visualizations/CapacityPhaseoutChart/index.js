import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import * as XLSX from 'xlsx';
import * as d3   from 'd3';
import './index.css';
import Tooltip from '../../common/Tooltip';

export default function CapacityPhaseoutChart({
  fuel,
  countries = [],
  labelCountries = []
}) {
  const containerRef = useRef();
  const svgRef       = useRef();
  const tooltipRef   = useRef();

  const [dims,      setDims]      = useState({ width: 0, height: 0 });
  const [data,      setData]      = useState([]);      // merged for fuel
  const [globalMax, setGlobalMax] = useState(0);       // shared max
  // 1) Measure container
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width,
            h = w * 0.8;
      setDims(prev =>
        prev.width === w && prev.height === h
          ? prev
          : { width: w, height: h }
      );
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // 2) Load workbook once, compute globalMax & per‑fuel data
  useEffect(() => {
    (async () => {
      const res     = await fetch('/emissions.xlsx');
      const buf     = await res.arrayBuffer();
      const wb      = XLSX.read(buf, { type: 'array' });

      // global capacity max from sheet2
      const capRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]]);
      const allCaps = capRows.map(r =>
        +r.CapacityPerCapita || +r.Capacitypercap || 0
      );
      setGlobalMax(d3.max(allCaps));

      // phaseout + merge for this fuel
      const allPhase  = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[6]]);
      const phaseRows = allPhase.filter(r => r.Fuel === fuel);
      const phaseMap  = new Map(
        phaseRows.map(r => [r.Country, Math.min(r.PhaseoutYr, 2065)])
      );

      const merged = capRows
        .map(r => {
          const year = phaseMap.get(r.Country);
          const cap  = +r.CapacityPerCapita || +r.Capacitypercap || 0;
          return year != null && !isNaN(cap)
            ? { country: r.Country, year, cap }
            : null;
        })
        .filter(Boolean);

      setData(merged);
    })();
  }, [fuel]);

  // 3) Draw + zoom
  useEffect(() => {
    const { width, height } = dims;
    if (!width || !data.length || globalMax == null) return;

    const margin = { top: 40, right: 20, bottom: 60, left: 70 };
    const w = width  - margin.left - margin.right;
    const h = height - margin.top  - margin.bottom;

    // filter by selected countries
    const filtered = data.filter(d =>
      countries.length === 0 || countries.includes(d.country)
    );

    // base svg
    const svg = d3.select(svgRef.current)
      .attr('width',  width)
      .attr('height', height);
    svg.selectAll('*').remove();

    const tooltip = d3.select(tooltipRef.current);

    // scales
    const x0 = d3.scaleLinear().domain([2030, 2065]).range([0, w]);
    const y0 = d3.scaleLinear().domain([0, globalMax]).nice().range([h, 0]);
    const avg = d3.mean(data, d => d.cap);

    // chart group + clip
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    g.append('defs').append('clipPath').attr('id','clip')
      .append('rect').attr('width', w).attr('height', h);

    // axes setup
    const xAxisG = g.append('g').attr('transform', `translate(0,${h})`);
    const yAxisG = g.append('g');
    function drawAxes(xs, ys) {
      let yt = ys.ticks(6);
      yt = Array.from(new Set([...yt, 2500, 5000]))
        .filter(v => v >= ys.domain()[0] && v <= ys.domain()[1])
        .sort((a,b) => a - b);

      xAxisG.call(d3.axisBottom(xs).ticks(5).tickFormat(d3.format('d')))
        .call(g => g.selectAll('path,line').attr('stroke','#1F2937'))
        .call(g => g.selectAll('text').attr('fill','#4B5563'));

      yAxisG.call(d3.axisLeft(ys).tickValues(yt).tickFormat(d3.format(',d')))
        .call(g => g.selectAll('path,line').attr('stroke','#1F2937'))
        .call(g => g.selectAll('text').attr('fill','#4B5563'));
    }
    drawAxes(x0, y0);

    // axis labels
    g.append('text')
      .attr('x', w/2).attr('y', h + margin.bottom - 15)
      .attr('text-anchor','middle').attr('fill','#1F2937')
      .text(`Phaseout Year (${fuel})`);
    g.append('text')
      .attr('transform','rotate(-90)')
      .attr('x', -h/2).attr('y', -margin.left + 15)
      .attr('text-anchor','middle').attr('fill','#1F2937')
      .text('Capacity per Capita');

    const plot = g.append('g').attr('clip-path','url(#clip)');

    // average line
    plot.append('line')
      .attr('class','avg-line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', y0(avg)).attr('y2', y0(avg))
      .attr('stroke','#3F6F2A').attr('stroke-width',2)
      .on('mouseover', () => tooltip.style('opacity',1).html(`Global average: ${avg.toFixed(3)}`))
      .on('mousemove', e => {
        const r = containerRef.current.getBoundingClientRect();
        tooltip.style('left',`${e.clientX-r.left+10}px`)
               .style('top',`${e.clientY-r.top+10}px`);
      })
      .on('mouseout', () => tooltip.style('opacity',0));

    // circles
    const circles = plot.selectAll('circle')
      .data(filtered)
      .join('circle')
      .attr('cx', d => x0(d.year))
      .attr('cy', d => y0(d.cap))
      .attr('r', 4)
      .attr('fill','#008BB9')
      .on('mouseover', (e,d) => {
        tooltip.style('opacity',1).html(d.country);
      })
      .on('mousemove', e => {
        const r = containerRef.current.getBoundingClientRect();
        tooltip.style('left',`${e.clientX-r.left+10}px`)
               .style('top',`${e.clientY-r.top+10}px`);
      })
      .on('mouseout', () => tooltip.style('opacity',0));

    // country labels
    const labels = plot.selectAll('text.country-label')
      .data(filtered.filter(d => labelCountries.includes(d.country)), d => d.country);

    labels.exit().remove();

    labels.enter().append('text')
      .attr('class','country-label')
      .attr('font-size','0.75rem')
      .attr('fill','#333')
      .attr('pointer-events','none')
    .merge(labels)
      .attr('x', d => x0(d.year) + 6)
      .attr('y', d => y0(d.cap)  - 6)
      .text(d => d.country);

    // zoom
    const zoom = d3.zoom()
      .scaleExtent([1,8])
      .translateExtent([[0,0],[w,h]])
      .extent([[0,0],[w,h]])
      .on('zoom', ({transform}) => {
        const zx = transform.rescaleX(x0);
        const zy = transform.rescaleY(y0);

        drawAxes(zx, zy);

        circles
          .attr('cx', d => zx(d.year))
          .attr('cy', d => zy(d.cap));

        plot.select('.avg-line')
          .attr('y1', zy(avg))
          .attr('y2', zy(avg));

        // **reposition labels on zoom**
        plot.selectAll('text.country-label')
          .attr('x', d => zx(d.year) + 6)
          .attr('y', d => zy(d.cap)  - 6);
      });

    // transparent zoom overlay (behind everything)
    svg.append('rect')
      .attr('width',  width)
      .attr('height', height)
      .style('fill','none')
      .style('pointer-events','all')
      .call(zoom)
      .lower();

  }, [dims, data, fuel, countries, labelCountries, globalMax]);

  return (
    <div
      ref={containerRef}
      style={{
        position:'relative',
        width:  '100%',
        height: `${dims.height}px`
      }}
    >
      <svg ref={svgRef} style={{ width:'100%' }} />
      <Tooltip ref={tooltipRef}/>
    </div>
  );
}
