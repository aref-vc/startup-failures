/* Overview Tab - Failure Landscape */

let overviewInitialized = false;

function initOverview() {
  if (overviewInitialized) return;
  overviewInitialized = true;

  renderReasonSurvival();
  renderFailureTreemap();
  renderCoOccurrenceHeatmap();
  renderYearlyTimeline();
  renderSankeyFlow();
  renderParallelCoordinates();
  renderBubbleMatrix();
  renderViolinPlot();
}

// ============================================
// Hero Stats
// ============================================
function renderOverviewStats() {
  const container = document.getElementById('overview-stats');
  if (!container) return;

  const stats = [
    {
      value: DATA.summary.totalStartups,
      label: 'Failed Startups',
      color: 'coral',
      format: 'number'
    },
    {
      value: DATA.summary.totalFundingLost,
      label: 'Capital Lost',
      color: 'amber',
      format: 'money'
    },
    {
      value: DATA.summary.avgSurvivalYears,
      label: 'Avg Survival',
      color: 'cyan',
      format: 'years'
    },
    {
      value: DATA.summary.peakFailureYear.count,
      label: `Peak Year (${DATA.summary.peakFailureYear.year})`,
      color: 'lime',
      format: 'number'
    }
  ];

  container.innerHTML = `
    <div class="stat-row stagger">
      ${stats.map(s => `
        <div class="stat-card ${s.color}">
          <div class="stat-card-value" data-target="${s.value}" data-format="${s.format}">0</div>
          <div class="stat-card-label">${s.label}</div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top: 20px;">
      <div class="label" style="margin-bottom: 8px;">Top Failure Reason</div>
      <div style="font-size: 1.25rem; color: var(--coral);">${DATA.summary.topReason}</div>
      <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 4px;">
        ${DATA.byReason[DATA.summary.topReason].count} startups (${DATA.byReason[DATA.summary.topReason].percentage}%)
      </div>
    </div>
  `;

  // Animate counters
  container.querySelectorAll('.stat-card-value').forEach(el => {
    const target = parseFloat(el.dataset.target);
    const format = el.dataset.format;
    Utils.animateCounter(el, target, 1500, format);
  });
}

// ============================================
// Failure Reasons Treemap
// ============================================
function renderFailureTreemap() {
  const container = document.getElementById('overview-treemap');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);

  // Prepare data
  const reasonData = Object.entries(DATA.byReason)
    .map(([reason, data]) => ({
      name: reason,
      value: data.count,
      percentage: data.percentage
    }))
    .sort((a, b) => b.value - a.value);

  // Create hierarchy
  const root = d3.hierarchy({ children: reasonData })
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);

  // Create treemap layout
  d3.treemap()
    .size([width, height])
    .padding(2)
    .round(true)(root);

  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Color scale
  const maxCount = d3.max(reasonData, d => d.value);
  const colorScale = d3.scaleSequential()
    .domain([0, maxCount])
    .interpolator(d3.interpolate('#2A2A28', '#F04E50'));

  // Draw rectangles
  const nodes = svg.selectAll('g')
    .data(root.leaves())
    .join('g')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  nodes.append('rect')
    .attr('width', d => d.x1 - d.x0)
    .attr('height', d => d.y1 - d.y0)
    .attr('fill', d => Utils.getReasonColor(d.data.name))
    .attr('fill-opacity', 0.8)
    .attr('stroke', Utils.colors.bgMain)
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('fill-opacity', 1);
      const html = `
        <div class="tooltip-title">${d.data.name}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Count</span>
          <span class="tooltip-value">${d.data.value}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Percentage</span>
          <span>${d.data.percentage}%</span>
        </div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mousemove', function(event) {
      Utils.showTooltip(Utils.tooltip.innerHTML, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('fill-opacity', 0.8);
      Utils.hideTooltip();
    });

  // Add labels for larger rectangles
  nodes.append('text')
    .attr('x', 6)
    .attr('y', 16)
    .attr('fill', Utils.colors.bgMain)
    .attr('font-size', '11px')
    .attr('font-weight', '500')
    .text(d => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      if (w > 60 && h > 30) return Utils.truncate(d.data.name, 12);
      return '';
    });

  nodes.append('text')
    .attr('x', 6)
    .attr('y', 30)
    .attr('fill', Utils.colors.bgMain)
    .attr('font-size', '10px')
    .attr('opacity', 0.8)
    .text(d => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      if (w > 50 && h > 40) return d.data.value;
      return '';
    });
}

// ============================================
// Co-occurrence Heatmap
// ============================================
function renderCoOccurrenceHeatmap() {
  const container = document.getElementById('overview-heatmap');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 80, right: 10, bottom: 10, left: 100 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const reasons = DATA.failureReasons;
  const cellSize = Math.min(innerWidth / reasons.length, innerHeight / reasons.length);

  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleBand()
    .domain(reasons)
    .range([0, cellSize * reasons.length])
    .padding(0.05);

  const y = d3.scaleBand()
    .domain(reasons)
    .range([0, cellSize * reasons.length])
    .padding(0.05);

  // Find max for color scale (excluding diagonal)
  let maxVal = 0;
  reasons.forEach(r1 => {
    reasons.forEach(r2 => {
      if (r1 !== r2) {
        maxVal = Math.max(maxVal, DATA.coOccurrence[r1][r2]);
      }
    });
  });

  const colorScale = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(d3.interpolate('#1A1A18', '#BEFF00'));

  // Create data array
  const data = [];
  reasons.forEach(r1 => {
    reasons.forEach(r2 => {
      data.push({
        x: r1,
        y: r2,
        value: DATA.coOccurrence[r1][r2]
      });
    });
  });

  // Draw cells
  svg.selectAll('rect')
    .data(data)
    .join('rect')
    .attr('x', d => x(d.x))
    .attr('y', d => y(d.y))
    .attr('width', x.bandwidth())
    .attr('height', y.bandwidth())
    .attr('fill', d => d.x === d.y ? Utils.colors.border : colorScale(d.value))
    .attr('rx', 2)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      if (d.x === d.y) return;
      d3.select(this).attr('stroke', Utils.colors.lime).attr('stroke-width', 2);
      const html = `
        <div class="tooltip-title">${Utils.truncate(d.x, 15)} + ${Utils.truncate(d.y, 15)}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Co-occurrence</span>
          <span class="tooltip-value">${d.value}</span>
        </div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('stroke', 'none');
      Utils.hideTooltip();
    });

  // X axis labels (top, rotated)
  svg.append('g')
    .selectAll('text')
    .data(reasons)
    .join('text')
    .attr('x', d => x(d) + x.bandwidth() / 2)
    .attr('y', -8)
    .attr('text-anchor', 'start')
    .attr('transform', d => `rotate(-45, ${x(d) + x.bandwidth() / 2}, -8)`)
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '9px')
    .text(d => Utils.truncate(d, 10));

  // Y axis labels (left)
  svg.append('g')
    .selectAll('text')
    .data(reasons)
    .join('text')
    .attr('x', -8)
    .attr('y', d => y(d) + y.bandwidth() / 2)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'middle')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '9px')
    .text(d => Utils.truncate(d, 12));
}

// ============================================
// Yearly Timeline
// ============================================
function renderYearlyTimeline() {
  const container = document.getElementById('overview-timeline');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Prepare data
  const yearData = Object.entries(DATA.byFailureYear)
    .map(([year, data]) => ({
      year: parseInt(year),
      count: data.count,
      funding: data.totalFunding
    }))
    .sort((a, b) => a.year - b.year);

  // Create SVG
  const svg = Utils.createSvg(container, width, height, margin);

  // Scales
  const x = d3.scaleLinear()
    .domain(d3.extent(yearData, d => d.year))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(yearData, d => d.count) * 1.1])
    .range([innerHeight, 0]);

  // Add grid lines
  Utils.addGridLines(svg, x, y, innerWidth, innerHeight);

  // Area
  const area = d3.area()
    .x(d => x(d.year))
    .y0(innerHeight)
    .y1(d => y(d.count))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(yearData)
    .attr('fill', Utils.colors.coral)
    .attr('fill-opacity', 0.3)
    .attr('d', area);

  // Line
  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.count))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(yearData)
    .attr('fill', 'none')
    .attr('stroke', Utils.colors.coral)
    .attr('stroke-width', 2)
    .attr('d', line);

  // Dots
  svg.selectAll('circle')
    .data(yearData)
    .join('circle')
    .attr('cx', d => x(d.year))
    .attr('cy', d => y(d.count))
    .attr('r', 4)
    .attr('fill', Utils.colors.coral)
    .attr('stroke', Utils.colors.bgMain)
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('r', 6);
      const html = `
        <div class="tooltip-title">${d.year}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Failures</span>
          <span class="tooltip-value">${d.count}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Capital Lost</span>
          <span>${Utils.formatMoney(d.funding)}</span>
        </div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('r', 4);
      Utils.hideTooltip();
    });

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format('d')));
  Utils.styleAxis(xAxis);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5));
  Utils.styleAxis(yAxis);

  // Annotations for key events
  const annotations = [
    { year: 2000, label: 'Dot-com' },
    { year: 2008, label: '2008 Crisis' },
    { year: 2020, label: 'COVID' }
  ];

  annotations.forEach(a => {
    if (x(a.year) > 0 && x(a.year) < innerWidth) {
      svg.append('line')
        .attr('x1', x(a.year))
        .attr('x2', x(a.year))
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', Utils.colors.textTertiary)
        .attr('stroke-dasharray', '3,3')
        .attr('opacity', 0.5);

      svg.append('text')
        .attr('x', x(a.year))
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('fill', Utils.colors.textTertiary)
        .attr('font-size', '9px')
        .text(a.label);
    }
  });
}

// ============================================
// Reason Impact on Survival
// ============================================
function renderReasonSurvival() {
  const container = document.getElementById('overview-reason-survival');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 20, right: 20, bottom: 80, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Prepare data - avg survival by reason
  const reasonData = Object.entries(DATA.byReason)
    .map(([reason, data]) => ({
      reason: reason,
      avgSurvival: data.avgSurvival,
      count: data.count
    }))
    .sort((a, b) => a.avgSurvival - b.avgSurvival);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleBand()
    .domain(reasonData.map(d => d.reason))
    .range([0, innerWidth])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(reasonData, d => d.avgSurvival) * 1.1])
    .range([innerHeight, 0]);

  // Grid lines
  svg.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(''))
    .selectAll('line')
    .attr('stroke', Utils.colors.border)
    .attr('stroke-opacity', 0.5);
  svg.selectAll('.grid .domain').remove();

  // Average line
  const avgSurvival = DATA.summary.avgSurvivalYears;
  svg.append('line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', y(avgSurvival))
    .attr('y2', y(avgSurvival))
    .attr('stroke', Utils.colors.amber)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5,5');

  svg.append('text')
    .attr('x', innerWidth - 5)
    .attr('y', y(avgSurvival) - 5)
    .attr('text-anchor', 'end')
    .attr('fill', Utils.colors.amber)
    .attr('font-size', '10px')
    .text(`Avg: ${avgSurvival.toFixed(1)} yrs`);

  // Bars
  svg.selectAll('rect')
    .data(reasonData)
    .join('rect')
    .attr('x', d => x(d.reason))
    .attr('y', d => y(d.avgSurvival))
    .attr('width', x.bandwidth())
    .attr('height', d => innerHeight - y(d.avgSurvival))
    .attr('fill', d => d.avgSurvival < avgSurvival ? Utils.colors.coral : Utils.colors.emerald)
    .attr('fill-opacity', 0.8)
    .attr('rx', 2)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('fill-opacity', 1);
      const diff = d.avgSurvival - avgSurvival;
      const html = `
        <div class="tooltip-title">${d.reason}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Survival</span>
          <span class="tooltip-value">${d.avgSurvival.toFixed(1)} yrs</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">vs Average</span>
          <span style="color: ${diff < 0 ? Utils.colors.coral : Utils.colors.emerald}">${diff >= 0 ? '+' : ''}${diff.toFixed(1)} yrs</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Startups</span>
          <span>${d.count}</span>
        </div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('fill-opacity', 0.8);
      Utils.hideTooltip();
    });

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));
  xAxis.selectAll('text')
    .attr('transform', 'rotate(-45)')
    .attr('text-anchor', 'end')
    .attr('dx', '-0.5em')
    .attr('dy', '0.5em')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '9px')
    .text(d => Utils.truncate(d, 12));
  xAxis.selectAll('line, path').attr('stroke', Utils.colors.border);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + ' yrs'));
  Utils.styleAxis(yAxis);
}

// ============================================
// Funding Distribution Histogram
// ============================================
function renderFundingDistribution() {
  const container = document.getElementById('overview-funding-dist');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Prepare data - funding amounts
  const fundings = DATA.startups
    .map(s => s.funding)
    .filter(f => f > 0);

  // Create bins
  const bins = [0, 10, 25, 50, 100, 250, 500, 1000, 5000];
  const binData = bins.slice(0, -1).map((bin, i) => {
    const nextBin = bins[i + 1];
    const count = fundings.filter(f => f >= bin && f < nextBin).length;
    return {
      range: `$${bin}-${nextBin}M`,
      min: bin,
      max: nextBin,
      count: count
    };
  });
  // Add 5000+ bin
  binData.push({
    range: '$5B+',
    min: 5000,
    max: Infinity,
    count: fundings.filter(f => f >= 5000).length
  });

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleBand()
    .domain(binData.map(d => d.range))
    .range([0, innerWidth])
    .padding(0.15);

  const y = d3.scaleLinear()
    .domain([0, d3.max(binData, d => d.count) * 1.1])
    .range([innerHeight, 0]);

  // Grid
  svg.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(''))
    .selectAll('line')
    .attr('stroke', Utils.colors.border)
    .attr('stroke-opacity', 0.5);
  svg.selectAll('.grid .domain').remove();

  // Bars with gradient
  svg.selectAll('rect')
    .data(binData)
    .join('rect')
    .attr('x', d => x(d.range))
    .attr('y', d => y(d.count))
    .attr('width', x.bandwidth())
    .attr('height', d => innerHeight - y(d.count))
    .attr('fill', (d, i) => d3.interpolate(Utils.colors.cyan, Utils.colors.coral)(i / (binData.length - 1)))
    .attr('fill-opacity', 0.8)
    .attr('rx', 2)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('fill-opacity', 1);
      const pct = ((d.count / fundings.length) * 100).toFixed(1);
      const html = `
        <div class="tooltip-title">${d.range}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Startups</span>
          <span class="tooltip-value">${d.count}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">% of Total</span>
          <span>${pct}%</span>
        </div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('fill-opacity', 0.8);
      Utils.hideTooltip();
    });

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));
  xAxis.selectAll('text')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '9px');
  xAxis.selectAll('line, path').attr('stroke', Utils.colors.border);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5));
  Utils.styleAxis(yAxis);
}

// ============================================
// Sector Breakdown Donut Chart
// ============================================
function renderSectorPie() {
  const container = document.getElementById('overview-sector-pie');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const radius = Math.min(width, height) / 2 - 20;

  // Prepare data
  const sectorData = Object.entries(DATA.bySector)
    .map(([sector, data]) => ({
      sector: sector,
      count: data.count,
      funding: data.totalFunding
    }))
    .sort((a, b) => b.count - a.count);

  const total = d3.sum(sectorData, d => d.count);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);

  // Pie layout
  const pie = d3.pie()
    .value(d => d.count)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(radius * 0.5)
    .outerRadius(radius);

  const arcHover = d3.arc()
    .innerRadius(radius * 0.5)
    .outerRadius(radius + 8);

  // Draw slices
  const slices = svg.selectAll('path')
    .data(pie(sectorData))
    .join('path')
    .attr('d', arc)
    .attr('fill', (d, i) => Utils.getColor(i))
    .attr('fill-opacity', 0.85)
    .attr('stroke', Utils.colors.bgMain)
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('d', arcHover)
        .attr('fill-opacity', 1);
      const pct = ((d.data.count / total) * 100).toFixed(1);
      const html = `
        <div class="tooltip-title">${d.data.sector}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Failures</span>
          <span class="tooltip-value">${d.data.count}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">% of Total</span>
          <span>${pct}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Capital Lost</span>
          <span>${Utils.formatMoney(d.data.funding)}</span>
        </div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('d', arc)
        .attr('fill-opacity', 0.85);
      Utils.hideTooltip();
    });

  // Center text
  svg.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '-0.2em')
    .attr('fill', Utils.colors.text)
    .attr('font-size', '24px')
    .attr('font-weight', '600')
    .text(sectorData.length);

  svg.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '1.2em')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '12px')
    .text('sectors');

  // Legend
  const legendG = svg.append('g')
    .attr('transform', `translate(${radius + 15}, ${-radius + 10})`);

  sectorData.slice(0, 6).forEach((d, i) => {
    const g = legendG.append('g')
      .attr('transform', `translate(0, ${i * 18})`);

    g.append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('rx', 2)
      .attr('fill', Utils.getColor(i));

    g.append('text')
      .attr('x', 15)
      .attr('y', 9)
      .attr('fill', Utils.colors.textTertiary)
      .attr('font-size', '10px')
      .text(Utils.truncate(d.sector, 15));
  });
}

// ============================================
// Failure Complexity (Reason Count Distribution)
// ============================================
function renderReasonCountDist() {
  const container = document.getElementById('overview-reason-count');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Count reasons per startup
  const reasonCounts = DATA.startups.map(s => s.reasonCount);
  const countDist = {};
  reasonCounts.forEach(c => {
    countDist[c] = (countDist[c] || 0) + 1;
  });

  const data = Object.entries(countDist)
    .map(([count, num]) => ({
      reasons: parseInt(count),
      startups: num
    }))
    .sort((a, b) => a.reasons - b.reasons);

  const total = DATA.startups.length;
  const avgReasons = (d3.sum(reasonCounts) / total).toFixed(1);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleBand()
    .domain(data.map(d => d.reasons))
    .range([0, innerWidth])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.startups) * 1.1])
    .range([innerHeight, 0]);

  // Grid
  svg.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(''))
    .selectAll('line')
    .attr('stroke', Utils.colors.border)
    .attr('stroke-opacity', 0.5);
  svg.selectAll('.grid .domain').remove();

  // Bars
  svg.selectAll('rect')
    .data(data)
    .join('rect')
    .attr('x', d => x(d.reasons))
    .attr('y', d => y(d.startups))
    .attr('width', x.bandwidth())
    .attr('height', d => innerHeight - y(d.startups))
    .attr('fill', (d, i) => {
      // Color intensity based on count
      const colors = [Utils.colors.emerald, Utils.colors.lime, Utils.colors.amber, Utils.colors.orange, Utils.colors.coral];
      return colors[Math.min(d.reasons - 1, colors.length - 1)];
    })
    .attr('fill-opacity', 0.8)
    .attr('rx', 2)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('fill-opacity', 1);
      const pct = ((d.startups / total) * 100).toFixed(1);
      const html = `
        <div class="tooltip-title">${d.reasons} Failure Reason${d.reasons > 1 ? 's' : ''}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Startups</span>
          <span class="tooltip-value">${d.startups}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">% of Total</span>
          <span>${pct}%</span>
        </div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('fill-opacity', 0.8);
      Utils.hideTooltip();
    });

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d => d + ' reason' + (d > 1 ? 's' : '')));
  xAxis.selectAll('text')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '10px');
  xAxis.selectAll('line, path').attr('stroke', Utils.colors.border);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5));
  Utils.styleAxis(yAxis);

  // Average annotation
  svg.append('text')
    .attr('x', innerWidth)
    .attr('y', 0)
    .attr('text-anchor', 'end')
    .attr('fill', Utils.colors.textSecondary)
    .attr('font-size', '11px')
    .text(`Avg: ${avgReasons} reasons`);
}

// ============================================
// Sankey Flow Diagram
// ============================================
function renderSankeyFlow() {
  const container = document.getElementById('overview-sankey');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Build nodes and links for Sankey
  const tiers = ['Unfunded', 'Seed', 'Series A', 'Series B+'];
  const reasons = ['Giants', 'Competition', 'No Budget', 'Poor Market Fit', 'Other'];
  const survivalBuckets = ['<3 yrs', '3-7 yrs', '7+ yrs'];

  const nodes = [
    ...tiers.map(t => ({ name: t, category: 'tier' })),
    ...reasons.map(r => ({ name: r, category: 'reason' })),
    ...survivalBuckets.map(s => ({ name: s, category: 'survival' }))
  ];

  const nodeIndex = {};
  nodes.forEach((n, i) => nodeIndex[n.name] = i);

  // Build links from data
  const linkMap = {};
  DATA.startups.forEach(s => {
    // Tier category
    let tier = 'Unfunded';
    if (s.fundingAmount > 0 && s.fundingAmount < 10) tier = 'Seed';
    else if (s.fundingAmount >= 10 && s.fundingAmount < 50) tier = 'Series A';
    else if (s.fundingAmount >= 50) tier = 'Series B+';

    // Primary reason
    let reason = s.primaryReason || 'Other';
    if (!reasons.includes(reason)) reason = 'Other';

    // Survival bucket
    let survival = '<3 yrs';
    if (s.survivalYears >= 3 && s.survivalYears < 7) survival = '3-7 yrs';
    else if (s.survivalYears >= 7) survival = '7+ yrs';

    // Tier -> Reason
    const key1 = `${tier}->${reason}`;
    linkMap[key1] = (linkMap[key1] || 0) + 1;

    // Reason -> Survival
    const key2 = `${reason}->${survival}`;
    linkMap[key2] = (linkMap[key2] || 0) + 1;
  });

  const links = Object.entries(linkMap).map(([key, value]) => {
    const [source, target] = key.split('->');
    return { source: nodeIndex[source], target: nodeIndex[target], value };
  }).filter(l => l.source !== undefined && l.target !== undefined);

  // Simple Sankey-like visualization using paths
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Position columns
  const colWidth = innerWidth / 3;
  const tierY = d3.scaleBand().domain(tiers).range([0, innerHeight]).padding(0.1);
  const reasonY = d3.scaleBand().domain(reasons).range([0, innerHeight]).padding(0.1);
  const survivalY = d3.scaleBand().domain(survivalBuckets).range([0, innerHeight]).padding(0.1);

  // Draw tier nodes
  svg.selectAll('.tier-node')
    .data(tiers)
    .join('rect')
    .attr('class', 'tier-node')
    .attr('x', 0)
    .attr('y', d => tierY(d))
    .attr('width', 15)
    .attr('height', tierY.bandwidth())
    .attr('fill', Utils.colors.cyan)
    .attr('rx', 3);

  // Draw reason nodes
  svg.selectAll('.reason-node')
    .data(reasons)
    .join('rect')
    .attr('class', 'reason-node')
    .attr('x', colWidth - 7.5)
    .attr('y', d => reasonY(d))
    .attr('width', 15)
    .attr('height', reasonY.bandwidth())
    .attr('fill', Utils.colors.coral)
    .attr('rx', 3);

  // Draw survival nodes
  svg.selectAll('.survival-node')
    .data(survivalBuckets)
    .join('rect')
    .attr('class', 'survival-node')
    .attr('x', innerWidth - 15)
    .attr('y', d => survivalY(d))
    .attr('width', 15)
    .attr('height', survivalY.bandwidth())
    .attr('fill', Utils.colors.emerald)
    .attr('rx', 3);

  // Draw simplified flow paths
  const maxFlow = d3.max(links, l => l.value);
  links.forEach(link => {
    const sourceNode = nodes[link.source];
    const targetNode = nodes[link.target];

    let x1, y1, x2, y2;
    if (sourceNode.category === 'tier') {
      x1 = 15;
      y1 = tierY(sourceNode.name) + tierY.bandwidth() / 2;
      x2 = colWidth - 7.5;
      y2 = reasonY(targetNode.name) + reasonY.bandwidth() / 2;
    } else {
      x1 = colWidth + 7.5;
      y1 = reasonY(sourceNode.name) + reasonY.bandwidth() / 2;
      x2 = innerWidth - 15;
      y2 = survivalY(targetNode.name) + survivalY.bandwidth() / 2;
    }

    svg.append('path')
      .attr('d', `M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`)
      .attr('fill', 'none')
      .attr('stroke', sourceNode.category === 'tier' ? Utils.colors.cyan : Utils.colors.coral)
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', Math.max(1, (link.value / maxFlow) * 15));
  });

  // Labels
  svg.selectAll('.tier-label')
    .data(tiers)
    .join('text')
    .attr('x', 20)
    .attr('y', d => tierY(d) + tierY.bandwidth() / 2)
    .attr('dominant-baseline', 'middle')
    .attr('fill', Utils.colors.textSecondary)
    .attr('font-size', '9px')
    .text(d => d);

  svg.selectAll('.reason-label')
    .data(reasons)
    .join('text')
    .attr('x', colWidth + 12)
    .attr('y', d => reasonY(d) + reasonY.bandwidth() / 2)
    .attr('dominant-baseline', 'middle')
    .attr('fill', Utils.colors.textSecondary)
    .attr('font-size', '9px')
    .text(d => Utils.truncate(d, 10));

  svg.selectAll('.survival-label')
    .data(survivalBuckets)
    .join('text')
    .attr('x', innerWidth - 20)
    .attr('y', d => survivalY(d) + survivalY.bandwidth() / 2)
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'end')
    .attr('fill', Utils.colors.textSecondary)
    .attr('font-size', '9px')
    .text(d => d);
}

// ============================================
// Parallel Coordinates
// ============================================
function renderParallelCoordinates() {
  const container = document.getElementById('overview-parallel');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 30, right: 20, bottom: 20, left: 20 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const dimensions = ['Funding', 'Survival', 'Reasons', 'Sector'];

  const data = DATA.startups.slice(0, 150).map(s => ({
    Funding: Math.log10(s.fundingAmount + 1),
    Survival: s.survivalYears,
    Reasons: s.totalFailureReasons,
    Sector: Object.keys(DATA.bySector).indexOf(s.sector),
    sectorName: s.sector,
    name: s.name
  }));

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales for each dimension
  const y = {};
  dimensions.forEach(dim => {
    y[dim] = d3.scaleLinear()
      .domain(d3.extent(data, d => d[dim]))
      .range([innerHeight, 0]);
  });

  const x = d3.scalePoint()
    .domain(dimensions)
    .range([0, innerWidth]);

  // Draw lines
  const line = d3.line();

  svg.selectAll('.dataline')
    .data(data)
    .join('path')
    .attr('class', 'dataline')
    .attr('d', d => line(dimensions.map(dim => [x(dim), y[dim](d[dim])])))
    .attr('fill', 'none')
    .attr('stroke', d => Utils.getSectorColor(d.sectorName))
    .attr('stroke-opacity', 0.3)
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('stroke-opacity', 1).attr('stroke-width', 2);
      const html = `
        <div class="tooltip-title">${d.name}</div>
        <div class="tooltip-row"><span class="tooltip-label">Sector</span><span>${d.sectorName}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Funding</span><span>$${Math.pow(10, d.Funding).toFixed(0)}M</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Survival</span><span>${d.Survival} yrs</span></div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('stroke-opacity', 0.3).attr('stroke-width', 1);
      Utils.hideTooltip();
    });

  // Draw axes
  dimensions.forEach(dim => {
    const axis = svg.append('g')
      .attr('transform', `translate(${x(dim)},0)`);

    axis.call(d3.axisLeft(y[dim]).ticks(5));
    axis.selectAll('text').attr('fill', Utils.colors.textTertiary).attr('font-size', '8px');
    axis.selectAll('line, path').attr('stroke', Utils.colors.border);

    axis.append('text')
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', Utils.colors.textSecondary)
      .attr('font-size', '10px')
      .text(dim);
  });
}

// ============================================
// Bubble Matrix (Sector × Decade)
// ============================================
function renderBubbleMatrix() {
  const container = document.getElementById('overview-bubble-matrix');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 40, right: 20, bottom: 20, left: 100 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const sectors = Object.keys(DATA.bySector);
  const decades = ['1990', '2000', '2010', '2020'];

  // Build matrix data
  const matrixData = [];
  sectors.forEach(sector => {
    decades.forEach(decade => {
      const startups = DATA.startups.filter(s =>
        s.sector === sector && s.failureDecade === parseInt(decade)
      );
      matrixData.push({
        sector,
        decade,
        count: startups.length,
        avgFunding: startups.length ? d3.mean(startups, s => s.fundingAmount) : 0
      });
    });
  });

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(decades).range([0, innerWidth]).padding(0.1);
  const y = d3.scaleBand().domain(sectors).range([0, innerHeight]).padding(0.1);
  const r = d3.scaleSqrt().domain([0, d3.max(matrixData, d => d.count)]).range([0, Math.min(x.bandwidth(), y.bandwidth()) / 2 - 2]);
  const color = d3.scaleSequential().domain([0, d3.max(matrixData, d => d.avgFunding)]).interpolator(d3.interpolate(Utils.colors.bgElevated, Utils.colors.amber));

  // Draw bubbles
  svg.selectAll('circle')
    .data(matrixData)
    .join('circle')
    .attr('cx', d => x(d.decade) + x.bandwidth() / 2)
    .attr('cy', d => y(d.sector) + y.bandwidth() / 2)
    .attr('r', d => r(d.count))
    .attr('fill', d => color(d.avgFunding))
    .attr('stroke', Utils.colors.border)
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('stroke', Utils.colors.lime).attr('stroke-width', 2);
      const html = `
        <div class="tooltip-title">${d.sector} (${d.decade}s)</div>
        <div class="tooltip-row"><span class="tooltip-label">Failures</span><span class="tooltip-value">${d.count}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Avg Funding</span><span>$${d.avgFunding.toFixed(0)}M</span></div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('stroke', Utils.colors.border).attr('stroke-width', 1);
      Utils.hideTooltip();
    });

  // X axis
  svg.append('g')
    .selectAll('text')
    .data(decades)
    .join('text')
    .attr('x', d => x(d) + x.bandwidth() / 2)
    .attr('y', -10)
    .attr('text-anchor', 'middle')
    .attr('fill', Utils.colors.textSecondary)
    .attr('font-size', '10px')
    .text(d => d + 's');

  // Y axis
  svg.append('g')
    .selectAll('text')
    .data(sectors)
    .join('text')
    .attr('x', -8)
    .attr('y', d => y(d) + y.bandwidth() / 2)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'middle')
    .attr('fill', Utils.colors.textSecondary)
    .attr('font-size', '9px')
    .text(d => Utils.truncate(d, 15));
}

// ============================================
// Violin Plot (Survival by Primary Reason)
// ============================================
function renderViolinPlot() {
  const container = document.getElementById('overview-violin');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 20, right: 20, bottom: 60, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Get top 6 reasons
  const topReasons = Object.entries(DATA.byReason)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(d => d[0]);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(topReasons).range([0, innerWidth]).padding(0.2);
  const y = d3.scaleLinear().domain([0, 25]).range([innerHeight, 0]);

  // For each reason, create a violin shape
  topReasons.forEach(reason => {
    const values = DATA.startups
      .filter(s => s.primaryReason === reason)
      .map(s => s.survivalYears);

    if (values.length < 3) return;

    // Create histogram bins for violin shape
    const bins = d3.bin().domain([0, 25]).thresholds(15)(values);
    const maxBinLength = d3.max(bins, b => b.length);
    const violinWidth = x.bandwidth() / 2;

    // Area generator for violin
    const area = d3.area()
      .x0(d => x(reason) + x.bandwidth() / 2 - (d.length / maxBinLength) * violinWidth)
      .x1(d => x(reason) + x.bandwidth() / 2 + (d.length / maxBinLength) * violinWidth)
      .y(d => y((d.x0 + d.x1) / 2))
      .curve(d3.curveCatmullRom);

    svg.append('path')
      .datum(bins)
      .attr('d', area)
      .attr('fill', Utils.getReasonColor(reason))
      .attr('fill-opacity', 0.7)
      .attr('stroke', Utils.getReasonColor(reason))
      .attr('stroke-width', 1);

    // Median line
    const median = d3.median(values);
    svg.append('line')
      .attr('x1', x(reason) + 5)
      .attr('x2', x(reason) + x.bandwidth() - 5)
      .attr('y1', y(median))
      .attr('y2', y(median))
      .attr('stroke', Utils.colors.bgMain)
      .attr('stroke-width', 2);
  });

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));
  xAxis.selectAll('text')
    .attr('transform', 'rotate(-35)')
    .attr('text-anchor', 'end')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '9px')
    .text(d => Utils.truncate(d, 12));
  xAxis.selectAll('line, path').attr('stroke', Utils.colors.border);

  // Y axis
  const yAxis = svg.append('g').call(d3.axisLeft(y).ticks(5));
  Utils.styleAxis(yAxis);

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -30)
    .attr('text-anchor', 'middle')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '10px')
    .text('Survival Years');
}
