/* Patterns Tab - Deep Analytical Charts */

let patternsInitialized = false;

function initPatterns() {
  if (patternsInitialized) return;
  patternsInitialized = true;

  renderCorrelationMatrix();
  renderReasonNetwork();
  renderReasonCombinations();
  renderFundingSurvivalScatter();
}

// ============================================
// Correlation Matrix
// ============================================
function renderCorrelationMatrix() {
  const container = document.getElementById('patterns-correlation');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 60, right: 20, bottom: 20, left: 100 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Variables to correlate
  const variables = ['Funding', 'Survival', 'Giants', 'Competition', 'No Budget', 'Poor Market Fit', 'Execution Flaws'];

  // Calculate correlation matrix
  const data = DATA.startups.filter(s => s.fundingAmount > 0 && s.survivalYears > 0);

  const getValues = (varName) => {
    return data.map(s => {
      if (varName === 'Funding') return Math.log10(s.fundingAmount + 1);
      if (varName === 'Survival') return s.survivalYears;
      return s.failureReasons[varName] || 0;
    });
  };

  const correlate = (x, y) => {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);

    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return den === 0 ? 0 : num / den;
  };

  const correlations = [];
  variables.forEach((v1, i) => {
    variables.forEach((v2, j) => {
      const vals1 = getValues(v1);
      const vals2 = getValues(v2);
      correlations.push({
        x: v1,
        y: v2,
        value: correlate(vals1, vals2)
      });
    });
  });

  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const cellSize = Math.min(innerWidth / variables.length, innerHeight / variables.length);

  // Scales
  const x = d3.scaleBand()
    .domain(variables)
    .range([0, cellSize * variables.length])
    .padding(0.05);

  const y = d3.scaleBand()
    .domain(variables)
    .range([0, cellSize * variables.length])
    .padding(0.05);

  const colorScale = d3.scaleSequential()
    .domain([-1, 1])
    .interpolator(d3.interpolateRdYlGn);

  // Draw cells
  svg.selectAll('rect')
    .data(correlations)
    .join('rect')
    .attr('x', d => x(d.x))
    .attr('y', d => y(d.y))
    .attr('width', x.bandwidth())
    .attr('height', y.bandwidth())
    .attr('fill', d => colorScale(d.value))
    .attr('rx', 3)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      const html = `
        <div class="tooltip-title">${d.x} × ${d.y}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Correlation</span>
          <span class="tooltip-value" style="color: ${d.value > 0 ? Utils.colors.emerald : Utils.colors.coral}">${d.value.toFixed(3)}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 4px;">
          ${Math.abs(d.value) > 0.3 ? 'Moderate' : Math.abs(d.value) > 0.5 ? 'Strong' : 'Weak'} ${d.value > 0 ? 'positive' : 'negative'}
        </div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', () => Utils.hideTooltip());

  // Correlation values in cells
  svg.selectAll('text.value')
    .data(correlations)
    .join('text')
    .attr('class', 'value')
    .attr('x', d => x(d.x) + x.bandwidth() / 2)
    .attr('y', d => y(d.y) + y.bandwidth() / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', d => Math.abs(d.value) > 0.5 ? '#000' : Utils.colors.textPrimary)
    .attr('font-size', '11px')
    .attr('font-weight', '500')
    .text(d => d.value.toFixed(2));

  // X axis labels
  svg.selectAll('text.x-label')
    .data(variables)
    .join('text')
    .attr('class', 'x-label')
    .attr('x', d => x(d) + x.bandwidth() / 2)
    .attr('y', -10)
    .attr('text-anchor', 'middle')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '10px')
    .text(d => Utils.truncate(d, 10));

  // Y axis labels
  svg.selectAll('text.y-label')
    .data(variables)
    .join('text')
    .attr('class', 'y-label')
    .attr('x', -10)
    .attr('y', d => y(d) + y.bandwidth() / 2)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'middle')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '10px')
    .text(d => Utils.truncate(d, 12));
}

// ============================================
// Survival Curves by Funding Tier
// ============================================
function renderSurvivalCurves() {
  const container = document.getElementById('patterns-survival');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Group startups by funding tier and calculate survival distribution
  const tiers = ['Seed', 'Series A', 'Series B', 'Series C+', 'Mega'];
  const tierColors = {
    'Seed': Utils.colors.cyan,
    'Series A': Utils.colors.emerald,
    'Series B': Utils.colors.lime,
    'Series C+': Utils.colors.amber,
    'Mega': Utils.colors.coral
  };

  // Calculate survival percentages at each year
  const maxYears = 20;
  const survivalData = tiers.map(tier => {
    const startups = DATA.startups.filter(s => s.fundingTier === tier && s.survivalYears > 0);
    const total = startups.length;

    const curve = [];
    for (let year = 0; year <= maxYears; year++) {
      const surviving = startups.filter(s => s.survivalYears >= year).length;
      curve.push({
        year,
        survival: total > 0 ? (surviving / total) * 100 : 0
      });
    }
    return { tier, curve, total };
  }).filter(d => d.total >= 5); // Only tiers with enough data

  // Create SVG
  const svg = Utils.createSvg(container, width, height, margin);

  // Scales
  const x = d3.scaleLinear()
    .domain([0, maxYears])
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, 100])
    .range([innerHeight, 0]);

  // Add grid
  Utils.addGridLines(svg, x, y, innerWidth, innerHeight);

  // Line generator
  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.survival))
    .curve(d3.curveStepAfter);

  // Draw curves
  survivalData.forEach(({ tier, curve }) => {
    const color = tierColors[tier];

    svg.append('path')
      .datum(curve)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2.5)
      .attr('d', line);

    // End label
    const lastPoint = curve[curve.length - 1];
    svg.append('text')
      .attr('x', innerWidth + 5)
      .attr('y', y(lastPoint.survival))
      .attr('dominant-baseline', 'middle')
      .attr('fill', color)
      .attr('font-size', '10px')
      .text(tier);
  });

  // Add 50% line
  svg.append('line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', y(50))
    .attr('y2', y(50))
    .attr('stroke', Utils.colors.textTertiary)
    .attr('stroke-dasharray', '4,4')
    .attr('opacity', 0.5);

  svg.append('text')
    .attr('x', 5)
    .attr('y', y(50) - 5)
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '9px')
    .text('50% survival');

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d => d + ' yrs'));
  Utils.styleAxis(xAxis);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + '%'));
  Utils.styleAxis(yAxis);
}

// ============================================
// Reason Combinations (Most Deadly Pairs)
// ============================================
function renderReasonCombinations() {
  const container = document.getElementById('patterns-combinations');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Find all reason pair combinations
  const reasons = DATA.failureReasons;
  const pairs = [];

  for (let i = 0; i < reasons.length; i++) {
    for (let j = i + 1; j < reasons.length; j++) {
      const r1 = reasons[i];
      const r2 = reasons[j];
      const count = DATA.startups.filter(s =>
        s.failureReasons[r1] === 1 && s.failureReasons[r2] === 1
      ).length;

      if (count > 0) {
        pairs.push({
          r1,
          r2,
          label: `${Utils.truncate(r1, 10)} + ${Utils.truncate(r2, 10)}`,
          count,
          avgSurvival: Utils.avg(
            DATA.startups.filter(s => s.failureReasons[r1] === 1 && s.failureReasons[r2] === 1),
            'survivalYears'
          )
        });
      }
    }
  }

  // Sort by count and take top 12
  const topPairs = pairs.sort((a, b) => b.count - a.count).slice(0, 12);

  // Create SVG
  const svg = Utils.createSvg(container, width, height, { ...margin, left: 140 });
  const adjWidth = innerWidth - 90;

  // Scales
  const y = d3.scaleBand()
    .domain(topPairs.map(d => d.label))
    .range([0, innerHeight])
    .padding(0.2);

  const x = d3.scaleLinear()
    .domain([0, d3.max(topPairs, d => d.count)])
    .range([0, adjWidth]);

  // Bars
  topPairs.forEach((pair, i) => {
    const barY = y(pair.label);

    // Background
    svg.append('rect')
      .attr('x', 0)
      .attr('y', barY)
      .attr('width', adjWidth)
      .attr('height', y.bandwidth())
      .attr('fill', Utils.colors.border)
      .attr('rx', 3);

    // Value bar
    svg.append('rect')
      .attr('x', 0)
      .attr('y', barY)
      .attr('width', x(pair.count))
      .attr('height', y.bandwidth())
      .attr('fill', Utils.colors.coral)
      .attr('fill-opacity', 0.8)
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event) {
        d3.select(this).attr('fill-opacity', 1);
        const html = `
          <div class="tooltip-title">${pair.r1} + ${pair.r2}</div>
          <div class="tooltip-row"><span class="tooltip-label">Startups</span><span class="tooltip-value">${pair.count}</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Avg Survival</span><span>${pair.avgSurvival.toFixed(1)} yrs</span></div>
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
      .attr('y', barY + y.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', Utils.colors.textSecondary)
      .attr('font-size', '10px')
      .text(pair.label);

    // Value
    svg.append('text')
      .attr('x', x(pair.count) + 6)
      .attr('y', barY + y.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .attr('fill', Utils.colors.coral)
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .text(pair.count);
  });
}

// ============================================
// Sector x Reason Heatmap
// ============================================
function renderSectorReasonHeatmap() {
  const container = document.getElementById('patterns-sector-reason');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 80, right: 20, bottom: 20, left: 110 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const sectors = Object.keys(DATA.bySector);
  const reasons = DATA.failureReasons.slice(0, 10); // Top 10 reasons

  // Calculate percentages
  const data = [];
  let maxVal = 0;

  sectors.forEach(sector => {
    const sectorData = DATA.bySector[sector];
    reasons.forEach(reason => {
      const pct = sectorData.count > 0
        ? (sectorData.reasonCounts[reason] / sectorData.count) * 100
        : 0;
      data.push({ sector, reason, value: pct });
      if (pct > maxVal) maxVal = pct;
    });
  });

  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const cellWidth = innerWidth / reasons.length;
  const cellHeight = innerHeight / sectors.length;

  // Scales
  const x = d3.scaleBand()
    .domain(reasons)
    .range([0, innerWidth])
    .padding(0.05);

  const y = d3.scaleBand()
    .domain(sectors)
    .range([0, innerHeight])
    .padding(0.05);

  const colorScale = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(d3.interpolate('#1A1A18', '#F04E50'));

  // Draw cells
  svg.selectAll('rect')
    .data(data)
    .join('rect')
    .attr('x', d => x(d.reason))
    .attr('y', d => y(d.sector))
    .attr('width', x.bandwidth())
    .attr('height', y.bandwidth())
    .attr('fill', d => colorScale(d.value))
    .attr('rx', 2)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('stroke', Utils.colors.lime).attr('stroke-width', 2);
      const html = `
        <div class="tooltip-title">${d.sector}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">${d.reason}</span>
          <span class="tooltip-value">${d.value.toFixed(1)}%</span>
        </div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('stroke', 'none');
      Utils.hideTooltip();
    });

  // X axis labels (rotated)
  svg.selectAll('text.x-label')
    .data(reasons)
    .join('text')
    .attr('class', 'x-label')
    .attr('x', d => x(d) + x.bandwidth() / 2)
    .attr('y', -8)
    .attr('text-anchor', 'start')
    .attr('transform', d => `rotate(-45, ${x(d) + x.bandwidth() / 2}, -8)`)
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '9px')
    .text(d => Utils.truncate(d, 10));

  // Y axis labels
  svg.selectAll('text.y-label')
    .data(sectors)
    .join('text')
    .attr('class', 'y-label')
    .attr('x', -8)
    .attr('y', d => y(d) + y.bandwidth() / 2)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'middle')
    .attr('fill', Utils.colors.textSecondary)
    .attr('font-size', '10px')
    .text(d => Utils.truncate(d, 14));
}

// ============================================
// Funding Efficiency ($ per year survived)
// ============================================
function renderFundingEfficiency() {
  const container = document.getElementById('patterns-efficiency');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Calculate efficiency by sector
  const sectorEfficiency = Object.entries(DATA.bySector).map(([sector, data]) => {
    const startups = DATA.startups.filter(s => s.sector === sector && s.fundingAmount > 0 && s.survivalYears > 0);
    const totalFunding = Utils.sum(startups, 'fundingAmount');
    const totalYears = Utils.sum(startups, 'survivalYears');
    const efficiency = totalYears > 0 ? totalFunding / totalYears : 0;

    return {
      sector,
      efficiency,
      count: startups.length,
      avgFunding: Utils.avg(startups, 'fundingAmount'),
      avgSurvival: Utils.avg(startups, 'survivalYears')
    };
  }).sort((a, b) => b.efficiency - a.efficiency);

  // Create SVG
  const svg = Utils.createSvg(container, width, height, { ...margin, left: 120 });
  const adjWidth = innerWidth - 70;

  // Scales
  const y = d3.scaleBand()
    .domain(sectorEfficiency.map(d => d.sector))
    .range([0, innerHeight])
    .padding(0.25);

  const x = d3.scaleLinear()
    .domain([0, d3.max(sectorEfficiency, d => d.efficiency)])
    .range([0, adjWidth]);

  // Bars
  sectorEfficiency.forEach(d => {
    const color = Utils.getSectorColor(d.sector);

    svg.append('rect')
      .attr('x', 0)
      .attr('y', y(d.sector))
      .attr('width', x(d.efficiency))
      .attr('height', y.bandwidth())
      .attr('fill', color)
      .attr('fill-opacity', 0.8)
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event) {
        d3.select(this).attr('fill-opacity', 1);
        const html = `
          <div class="tooltip-title" style="color: ${color}">${d.sector}</div>
          <div class="tooltip-row"><span class="tooltip-label">Cost/Year</span><span class="tooltip-value">$${d.efficiency.toFixed(1)}M</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Avg Funding</span><span>$${d.avgFunding.toFixed(0)}M</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Avg Survival</span><span>${d.avgSurvival.toFixed(1)} yrs</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Startups</span><span>${d.count}</span></div>
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
      .attr('y', y(d.sector) + y.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', Utils.colors.textSecondary)
      .attr('font-size', '10px')
      .text(Utils.truncate(d.sector, 14));

    // Value
    svg.append('text')
      .attr('x', x(d.efficiency) + 6)
      .attr('y', y(d.sector) + y.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .attr('fill', color)
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .text('$' + d.efficiency.toFixed(0) + 'M/yr');
  });

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => '$' + d + 'M'));
  Utils.styleAxis(xAxis);
}

// ============================================
// Key Insights (Statistical Findings)
// ============================================
function renderKeyInsights() {
  const container = document.getElementById('patterns-insights');
  if (!container) return;

  // Calculate insights
  const startups = DATA.startups;

  // 1. Funding-Survival correlation
  const fundedStartups = startups.filter(s => s.fundingAmount > 0 && s.survivalYears > 0);
  const fundingValues = fundedStartups.map(s => Math.log10(s.fundingAmount + 1));
  const survivalValues = fundedStartups.map(s => s.survivalYears);

  const correlate = (x, y) => {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return den === 0 ? 0 : num / den;
  };

  const fundingSurvivalCorr = correlate(fundingValues, survivalValues);

  // 2. Most deadly reason (lowest avg survival)
  const reasonSurvival = DATA.failureReasons.map(reason => {
    const affected = startups.filter(s => s.failureReasons[reason] === 1);
    return {
      reason,
      avgSurvival: Utils.avg(affected, 'survivalYears'),
      count: affected.length
    };
  }).filter(r => r.count >= 10).sort((a, b) => a.avgSurvival - b.avgSurvival);

  const deadliestReason = reasonSurvival[0];

  // 3. Sector with highest failure rate (by funding lost)
  const sectorByFunding = Object.entries(DATA.bySector)
    .map(([sector, data]) => ({ sector, funding: data.totalFunding, count: data.count }))
    .sort((a, b) => b.funding - a.funding);

  // 4. Multi-reason failure rate
  const multiReasonRate = startups.filter(s => s.totalFailureReasons >= 3).length / startups.length * 100;

  // 5. Average reasons per failure
  const avgReasons = Utils.avg(startups, 'totalFailureReasons');

  const insights = [
    {
      title: 'Funding ≠ Survival',
      value: `r = ${fundingSurvivalCorr.toFixed(2)}`,
      detail: `Weak correlation between funding raised and years survived`,
      color: Math.abs(fundingSurvivalCorr) < 0.3 ? Utils.colors.coral : Utils.colors.emerald
    },
    {
      title: 'Deadliest Reason',
      value: Utils.truncate(deadliestReason.reason, 15),
      detail: `Only ${deadliestReason.avgSurvival.toFixed(1)} years avg survival (${deadliestReason.count} startups)`,
      color: Utils.colors.coral
    },
    {
      title: 'Multi-Factor Failures',
      value: `${multiReasonRate.toFixed(0)}%`,
      detail: `of startups failed due to 3+ reasons (avg: ${avgReasons.toFixed(1)} reasons)`,
      color: Utils.colors.amber
    },
    {
      title: 'Biggest Capital Sink',
      value: Utils.truncate(sectorByFunding[0].sector, 12),
      detail: `$${Utils.formatNumber(sectorByFunding[0].funding)}M lost across ${sectorByFunding[0].count} startups`,
      color: Utils.getSectorColor(sectorByFunding[0].sector)
    }
  ];

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px; height: 100%; overflow-y: auto;">
      ${insights.map(insight => `
        <div style="background: var(--bg-accent); border-left: 3px solid ${insight.color}; border-radius: 4px; padding: 12px;">
          <div style="font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
            ${insight.title}
          </div>
          <div style="font-size: 1.25rem; font-weight: 600; color: ${insight.color}; margin-bottom: 4px;">
            ${insight.value}
          </div>
          <div style="font-size: 0.8125rem; color: var(--text-secondary);">
            ${insight.detail}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================
// Funding vs Survival Scatter Plot
// ============================================
function renderFundingSurvivalScatter() {
  const container = document.getElementById('patterns-scatter');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Filter startups with valid data
  const data = DATA.startups
    .filter(s => s.fundingAmount > 0 && s.survivalYears > 0)
    .map(s => ({
      name: s.name,
      funding: s.fundingAmount,
      survival: s.survivalYears,
      sector: s.sector,
      reasons: s.totalFailureReasons
    }));

  const svg = Utils.createSvg(container, width, height, margin);

  // Scales (log for funding)
  const x = d3.scaleLog()
    .domain([d3.min(data, d => d.funding) * 0.8, d3.max(data, d => d.funding) * 1.2])
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.survival) * 1.1])
    .range([innerHeight, 0]);

  // Add grid
  Utils.addGridLines(svg, x, y, innerWidth, innerHeight);

  // Trend line (linear regression on log-transformed data)
  const logData = data.map(d => ({ x: Math.log10(d.funding), y: d.survival }));
  const n = logData.length;
  const sumX = logData.reduce((a, b) => a + b.x, 0);
  const sumY = logData.reduce((a, b) => a + b.y, 0);
  const sumXY = logData.reduce((a, b) => a + b.x * b.y, 0);
  const sumX2 = logData.reduce((a, b) => a + b.x * b.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const xDomain = x.domain();
  const trendLine = [
    { x: xDomain[0], y: intercept + slope * Math.log10(xDomain[0]) },
    { x: xDomain[1], y: intercept + slope * Math.log10(xDomain[1]) }
  ];

  svg.append('line')
    .attr('x1', x(trendLine[0].x))
    .attr('y1', y(Math.max(0, trendLine[0].y)))
    .attr('x2', x(trendLine[1].x))
    .attr('y2', y(Math.max(0, trendLine[1].y)))
    .attr('stroke', Utils.colors.amber)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '6,4')
    .attr('opacity', 0.7);

  // Draw points
  svg.selectAll('circle')
    .data(data)
    .join('circle')
    .attr('cx', d => x(d.funding))
    .attr('cy', d => y(d.survival))
    .attr('r', d => 3 + d.reasons)
    .attr('fill', d => Utils.getSectorColor(d.sector))
    .attr('fill-opacity', 0.6)
    .attr('stroke', d => Utils.getSectorColor(d.sector))
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this)
        .attr('fill-opacity', 1)
        .attr('r', 4 + d.reasons);
      const html = `
        <div class="tooltip-title">${d.name}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Funding</span>
          <span class="tooltip-value">$${d.funding.toFixed(0)}M</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Survival</span>
          <span>${d.survival.toFixed(1)} years</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Sector</span>
          <span>${d.sector}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Failure Reasons</span>
          <span>${d.reasons}</span>
        </div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function(event, d) {
      d3.select(this)
        .attr('fill-opacity', 0.6)
        .attr('r', 3 + d.reasons);
      Utils.hideTooltip();
    });

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => '$' + Utils.formatNumber(d) + 'M'));
  Utils.styleAxis(xAxis);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => d + ' yrs'));
  Utils.styleAxis(yAxis);

  // Trend label
  svg.append('text')
    .attr('x', innerWidth - 5)
    .attr('y', 15)
    .attr('text-anchor', 'end')
    .attr('fill', Utils.colors.amber)
    .attr('font-size', '10px')
    .text(`Trend: ${slope > 0 ? '+' : ''}${slope.toFixed(2)} yrs/10x funding`);
}

// ============================================
// Reason Network (Force-Directed Graph)
// ============================================
function renderReasonNetwork() {
  const container = document.getElementById('patterns-network');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);

  // Build nodes and links from co-occurrence
  const reasons = DATA.failureReasons;
  const nodes = reasons.map(r => ({
    id: r,
    count: DATA.byReason[r].count
  }));

  const links = [];
  for (let i = 0; i < reasons.length; i++) {
    for (let j = i + 1; j < reasons.length; j++) {
      const count = DATA.coOccurrence[reasons[i]][reasons[j]];
      if (count >= 5) { // Only significant connections
        links.push({
          source: reasons[i],
          target: reasons[j],
          value: count
        });
      }
    }
  }

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Node size scale
  const nodeScale = d3.scaleSqrt()
    .domain([0, d3.max(nodes, d => d.count)])
    .range([8, 25]);

  // Link thickness scale
  const linkScale = d3.scaleLinear()
    .domain([5, d3.max(links, d => d.value)])
    .range([1, 6]);

  // Force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => nodeScale(d.count) + 5));

  // Draw links
  const link = svg.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', Utils.colors.border)
    .attr('stroke-width', d => linkScale(d.value))
    .attr('stroke-opacity', 0.6);

  // Draw nodes
  const node = svg.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .style('cursor', 'pointer')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

  node.append('circle')
    .attr('r', d => nodeScale(d.count))
    .attr('fill', d => Utils.getReasonColor(d.id))
    .attr('fill-opacity', 0.8)
    .attr('stroke', d => Utils.getReasonColor(d.id))
    .attr('stroke-width', 2);

  node.append('text')
    .text(d => Utils.truncate(d.id, 8))
    .attr('text-anchor', 'middle')
    .attr('dy', d => nodeScale(d.count) + 12)
    .attr('fill', Utils.colors.textSecondary)
    .attr('font-size', '9px');

  node.on('mouseenter', function(event, d) {
    const connections = links.filter(l => l.source.id === d.id || l.target.id === d.id);
    const html = `
      <div class="tooltip-title">${d.id}</div>
      <div class="tooltip-row">
        <span class="tooltip-label">Startups</span>
        <span class="tooltip-value">${d.count}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Connected to</span>
        <span>${connections.length} reasons</span>
      </div>
    `;
    Utils.showTooltip(html, event.pageX, event.pageY);
  }).on('mouseleave', () => Utils.hideTooltip());

  // Update positions on tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
}
