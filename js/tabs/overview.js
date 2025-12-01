/* Overview Tab - Failure Landscape */

let overviewInitialized = false;

function initOverview() {
  if (overviewInitialized) return;
  overviewInitialized = true;

  renderReasonSurvival();
  renderFailureTreemap();
  renderCoOccurrenceHeatmap();
  renderYearlyTimeline();
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
