/* Sectors Tab - Industry Analysis */

let sectorsInitialized = false;

function initSectors() {
  if (sectorsInitialized) return;
  sectorsInitialized = true;

  renderSectorsSummary();
  renderSectorRadar();
  renderSectorSurvival();
  renderSectorBars();
}

// ============================================
// Sector Summary Cards
// ============================================
function renderSectorsSummary() {
  const container = document.getElementById('sectors-summary');
  if (!container) return;

  const sectors = Object.entries(DATA.bySector)
    .sort((a, b) => b[1].count - a[1].count);

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; height: 100%; align-content: start;">
      ${sectors.map(([name, data], i) => `
        <div class="stat-card" style="background: var(--bg-accent); border-left: 3px solid ${Utils.getSectorColor(name)};">
          <div style="font-size: 1.25rem; font-weight: 500; color: ${Utils.getSectorColor(name)}; margin-bottom: 4px;">
            ${data.count}
          </div>
          <div style="font-size: 0.6875rem; color: var(--text-secondary); margin-bottom: 8px;">
            ${Utils.truncate(name, 18)}
          </div>
          <div style="display: flex; gap: 12px; font-size: 0.625rem; color: var(--text-tertiary);">
            <span>$${data.avgFunding.toFixed(0)}M avg</span>
            <span>${data.avgSurvival.toFixed(1)} yrs</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================
// Radar Chart - Failure Profiles by Sector
// ============================================
function renderSectorRadar() {
  const container = document.getElementById('sectors-radar');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 60;

  const reasons = DATA.failureReasons;
  const angleSlice = (2 * Math.PI) / reasons.length;

  // Normalize data for each sector
  const sectors = Object.entries(DATA.bySector).slice(0, 6); // Top 6 sectors

  // Find max for each reason across all sectors for normalization
  const maxPerReason = {};
  reasons.forEach(r => {
    maxPerReason[r] = Math.max(...sectors.map(([_, data]) => data.reasonCounts[r] || 0));
  });

  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${centerX},${centerY})`);

  // Draw circular grid
  const levels = 5;
  for (let i = 1; i <= levels; i++) {
    svg.append('circle')
      .attr('r', (radius / levels) * i)
      .attr('fill', 'none')
      .attr('stroke', Utils.colors.border)
      .attr('stroke-opacity', 0.5);
  }

  // Draw axes
  reasons.forEach((reason, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    svg.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', x)
      .attr('y2', y)
      .attr('stroke', Utils.colors.border)
      .attr('stroke-opacity', 0.5);

    // Labels
    const labelX = Math.cos(angle) * (radius + 15);
    const labelY = Math.sin(angle) * (radius + 15);

    svg.append('text')
      .attr('x', labelX)
      .attr('y', labelY)
      .attr('text-anchor', labelX < 0 ? 'end' : labelX > 0 ? 'start' : 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', Utils.colors.textTertiary)
      .attr('font-size', '8px')
      .text(Utils.truncate(reason, 8));
  });

  // Draw sector polygons
  const line = d3.lineRadial()
    .radius(d => d.value)
    .angle((d, i) => i * angleSlice)
    .curve(d3.curveLinearClosed);

  sectors.forEach(([sectorName, sectorData], sectorIndex) => {
    const dataPoints = reasons.map(reason => {
      const count = sectorData.reasonCounts[reason] || 0;
      const normalized = maxPerReason[reason] > 0 ? count / maxPerReason[reason] : 0;
      return {
        reason,
        value: normalized * radius
      };
    });

    const color = Utils.getSectorColor(sectorName);

    svg.append('path')
      .datum(dataPoints)
      .attr('d', line)
      .attr('fill', color)
      .attr('fill-opacity', 0.15)
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.8)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event) {
        d3.select(this)
          .attr('fill-opacity', 0.3)
          .attr('stroke-width', 3);

        const topReasons = Object.entries(sectorData.reasonCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([r, c]) => `${Utils.truncate(r, 12)}: ${c}`)
          .join('<br>');

        const html = `
          <div class="tooltip-title" style="color: ${color}">${sectorName}</div>
          <div style="margin-top: 6px; font-size: 0.6875rem;">${topReasons}</div>
        `;
        Utils.showTooltip(html, event.pageX, event.pageY);
      })
      .on('mouseleave', function() {
        d3.select(this)
          .attr('fill-opacity', 0.15)
          .attr('stroke-width', 2);
        Utils.hideTooltip();
      });
  });

  // Legend
  const legend = svg.append('g')
    .attr('transform', `translate(${-radius - 40}, ${-radius + 20})`);

  sectors.forEach(([name, _], i) => {
    const g = legend.append('g')
      .attr('transform', `translate(0, ${i * 14})`);

    g.append('rect')
      .attr('width', 8)
      .attr('height', 8)
      .attr('fill', Utils.getSectorColor(name))
      .attr('rx', 2);

    g.append('text')
      .attr('x', 12)
      .attr('y', 7)
      .attr('fill', Utils.colors.textTertiary)
      .attr('font-size', '8px')
      .text(Utils.truncate(name, 12));
  });
}

// ============================================
// Survival Distribution by Sector
// ============================================
function renderSectorSurvival() {
  const container = document.getElementById('sectors-survival');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Get survival data per sector
  const sectors = Object.keys(DATA.bySector).sort((a, b) =>
    DATA.bySector[b].avgSurvival - DATA.bySector[a].avgSurvival
  );

  const survivalBySector = {};
  sectors.forEach(s => {
    survivalBySector[s] = DATA.startups
      .filter(startup => startup.sector === s)
      .map(startup => startup.survivalYears)
      .filter(y => y > 0);
  });

  // Create SVG
  const svg = Utils.createSvg(container, width, height, margin);

  // Scales
  const x = d3.scaleBand()
    .domain(sectors)
    .range([0, innerWidth])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(DATA.startups, d => d.survivalYears) + 2])
    .range([innerHeight, 0]);

  // Add grid
  Utils.addGridLines(svg, x, y, innerWidth, innerHeight);

  // Draw box plots
  sectors.forEach(sector => {
    const values = survivalBySector[sector].sort((a, b) => a - b);
    if (values.length === 0) return;

    const q1 = d3.quantile(values, 0.25);
    const median = d3.quantile(values, 0.5);
    const q3 = d3.quantile(values, 0.75);
    const min = d3.min(values);
    const max = d3.max(values);
    const iqr = q3 - q1;
    const whiskerMin = Math.max(min, q1 - 1.5 * iqr);
    const whiskerMax = Math.min(max, q3 + 1.5 * iqr);

    const xPos = x(sector) + x.bandwidth() / 2;
    const boxWidth = x.bandwidth() * 0.6;
    const color = Utils.getSectorColor(sector);

    // Whiskers
    svg.append('line')
      .attr('x1', xPos)
      .attr('x2', xPos)
      .attr('y1', y(whiskerMin))
      .attr('y2', y(whiskerMax))
      .attr('stroke', color)
      .attr('stroke-opacity', 0.6);

    // Box
    svg.append('rect')
      .attr('x', xPos - boxWidth / 2)
      .attr('y', y(q3))
      .attr('width', boxWidth)
      .attr('height', y(q1) - y(q3))
      .attr('fill', color)
      .attr('fill-opacity', 0.3)
      .attr('stroke', color)
      .attr('rx', 2);

    // Median line
    svg.append('line')
      .attr('x1', xPos - boxWidth / 2)
      .attr('x2', xPos + boxWidth / 2)
      .attr('y1', y(median))
      .attr('y2', y(median))
      .attr('stroke', color)
      .attr('stroke-width', 2);

    // Whisker caps
    [whiskerMin, whiskerMax].forEach(val => {
      svg.append('line')
        .attr('x1', xPos - boxWidth / 4)
        .attr('x2', xPos + boxWidth / 4)
        .attr('y1', y(val))
        .attr('y2', y(val))
        .attr('stroke', color)
        .attr('stroke-opacity', 0.6);
    });

    // Hover area
    svg.append('rect')
      .attr('x', x(sector))
      .attr('y', 0)
      .attr('width', x.bandwidth())
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseenter', function(event) {
        const html = `
          <div class="tooltip-title" style="color: ${color}">${sector}</div>
          <div class="tooltip-row"><span class="tooltip-label">Median</span><span>${median.toFixed(1)} yrs</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Q1-Q3</span><span>${q1.toFixed(1)}-${q3.toFixed(1)} yrs</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Range</span><span>${whiskerMin.toFixed(0)}-${whiskerMax.toFixed(0)} yrs</span></div>
        `;
        Utils.showTooltip(html, event.pageX, event.pageY);
      })
      .on('mouseleave', () => Utils.hideTooltip());
  });

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d => Utils.truncate(d, 8)));
  Utils.styleAxis(xAxis);
  xAxis.selectAll('text')
    .attr('transform', 'rotate(-30)')
    .attr('text-anchor', 'end')
    .attr('dx', '-0.5em')
    .attr('dy', '0.5em');

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + ' yrs'));
  Utils.styleAxis(yAxis);
}

// ============================================
// Sector Horizontal Bars
// ============================================
function renderSectorBars() {
  const container = document.getElementById('sectors-bars');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Sort sectors by count
  const sectors = Object.entries(DATA.bySector)
    .sort((a, b) => b[1].count - a[1].count);

  // Create SVG
  const svg = Utils.createSvg(container, width, height, { ...margin, left: 120 });
  const adjustedInnerWidth = innerWidth - 70;

  // Scales
  const y = d3.scaleBand()
    .domain(sectors.map(d => d[0]))
    .range([0, innerHeight])
    .padding(0.2);

  const x = d3.scaleLinear()
    .domain([0, d3.max(sectors, d => d[1].count)])
    .range([0, adjustedInnerWidth]);

  // Bars
  sectors.forEach(([name, data]) => {
    const color = Utils.getSectorColor(name);

    // Background bar
    svg.append('rect')
      .attr('x', 0)
      .attr('y', y(name))
      .attr('width', adjustedInnerWidth)
      .attr('height', y.bandwidth())
      .attr('fill', Utils.colors.border)
      .attr('rx', 3);

    // Value bar
    svg.append('rect')
      .attr('x', 0)
      .attr('y', y(name))
      .attr('width', x(data.count))
      .attr('height', y.bandwidth())
      .attr('fill', color)
      .attr('fill-opacity', 0.8)
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event) {
        d3.select(this).attr('fill-opacity', 1);

        const topReason = Object.entries(data.reasonCounts)
          .sort((a, b) => b[1] - a[1])[0];

        const html = `
          <div class="tooltip-title" style="color: ${color}">${name}</div>
          <div class="tooltip-row"><span class="tooltip-label">Startups</span><span class="tooltip-value">${data.count}</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Avg Funding</span><span>$${data.avgFunding.toFixed(0)}M</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Avg Survival</span><span>${data.avgSurvival.toFixed(1)} yrs</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Top Reason</span><span>${topReason[0]}</span></div>
        `;
        Utils.showTooltip(html, event.pageX, event.pageY);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('fill-opacity', 0.8);
        Utils.hideTooltip();
      });

    // Label
    svg.append('text')
      .attr('x', -8)
      .attr('y', y(name) + y.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', Utils.colors.textSecondary)
      .attr('font-size', '10px')
      .text(Utils.truncate(name, 14));

    // Value
    svg.append('text')
      .attr('x', x(data.count) + 6)
      .attr('y', y(name) + y.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .attr('fill', color)
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .text(data.count);
  });
}
