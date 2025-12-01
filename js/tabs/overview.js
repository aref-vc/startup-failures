/* Overview Tab - Failure Landscape */

let overviewInitialized = false;

function initOverview() {
  if (overviewInitialized) return;
  overviewInitialized = true;

  renderOverviewStats();
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
