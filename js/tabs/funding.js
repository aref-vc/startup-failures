/* Funding Tab - Capital Analysis */

let fundingInitialized = false;

function initFunding() {
  if (fundingInitialized) return;
  fundingInitialized = true;

  renderTierSurvival();
  renderFundingScatter();
  renderFundingByReason();
  renderFundingYearly();
}

// ============================================
// Funding Tier Cards
// ============================================
function renderFundingTiers() {
  const container = document.getElementById('funding-tiers');
  if (!container) return;

  const tiers = ['Unfunded', 'Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Mega'];
  const tierColors = {
    'Unfunded': Utils.colors.textTertiary,
    'Pre-Seed': Utils.colors.cyan,
    'Seed': Utils.colors.emerald,
    'Series A': Utils.colors.lime,
    'Series B': Utils.colors.amber,
    'Series C+': Utils.colors.orange,
    'Mega': Utils.colors.coral
  };

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; height: 100%; align-content: start;">
      ${tiers.map(tier => {
        const data = DATA.byFundingTier[tier] || { count: 0, avgSurvival: 0, topReason: 'N/A' };
        return `
          <div class="stat-card" style="background: var(--bg-accent); padding: 10px; border-top: 2px solid ${tierColors[tier]};">
            <div style="font-size: 1.125rem; font-weight: 500; color: ${tierColors[tier]}; margin-bottom: 2px;">
              ${data.count}
            </div>
            <div style="font-size: 0.625rem; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">
              ${tier}
            </div>
            <div style="font-size: 0.5625rem; color: var(--text-tertiary);">
              <div>${data.avgSurvival.toFixed(1)} yrs avg</div>
              <div style="margin-top: 2px;">${Utils.truncate(data.topReason || 'N/A', 10)}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ============================================
// Scatter Plot - Funding vs Survival
// ============================================
function renderFundingScatter() {
  const container = document.getElementById('funding-scatter');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Filter startups with valid data
  const data = DATA.startups
    .filter(s => s.fundingAmount > 0 && s.survivalYears > 0)
    .map(s => ({
      ...s,
      fundingLog: Math.log10(s.fundingAmount + 1)
    }));

  // Create SVG
  const svg = Utils.createSvg(container, width, height, margin);

  // Scales
  const x = d3.scaleLog()
    .domain([0.1, d3.max(data, d => d.fundingAmount) * 1.2])
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.survivalYears) + 2])
    .range([innerHeight, 0]);

  // Add grid
  Utils.addGridLines(svg, x, y, innerWidth, innerHeight);

  // Draw dots
  svg.selectAll('circle')
    .data(data)
    .join('circle')
    .attr('cx', d => x(d.fundingAmount))
    .attr('cy', d => y(d.survivalYears))
    .attr('r', 5)
    .attr('fill', d => Utils.getSectorColor(d.sector))
    .attr('fill-opacity', 0.7)
    .attr('stroke', Utils.colors.bgMain)
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this)
        .attr('r', 8)
        .attr('fill-opacity', 1)
        .attr('stroke-width', 2);

      const html = `
        <div class="tooltip-title">${d.name}</div>
        <div style="color: ${Utils.getSectorColor(d.sector)}; font-size: 0.625rem; margin-bottom: 6px;">
          ${d.sector}
        </div>
        <div class="tooltip-row"><span class="tooltip-label">Funding</span><span class="tooltip-value">$${d.fundingAmount.toFixed(0)}M</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Survival</span><span>${d.survivalYears} years</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Years</span><span>${d.foundingYear}-${d.failureYear}</span></div>
        ${d.primaryReason ? `<div class="tooltip-row"><span class="tooltip-label">Reason</span><span>${d.primaryReason}</span></div>` : ''}
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this)
        .attr('r', 5)
        .attr('fill-opacity', 0.7)
        .attr('stroke-width', 1);
      Utils.hideTooltip();
    });

  // X axis (log scale)
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x)
      .tickValues([0.1, 1, 10, 100, 1000])
      .tickFormat(d => {
        if (d >= 1000) return '$' + (d/1000) + 'B';
        return '$' + d + 'M';
      }));
  Utils.styleAxis(xAxis);

  // X axis label
  svg.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 35)
    .attr('text-anchor', 'middle')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '10px')
    .text('Funding Raised (log scale)');

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + ' yrs'));
  Utils.styleAxis(yAxis);

  // Y axis label
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -40)
    .attr('text-anchor', 'middle')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '10px')
    .text('Survival (years)');

  // Add trend line (simple linear regression on log-transformed x)
  const xMean = d3.mean(data, d => d.fundingLog);
  const yMean = d3.mean(data, d => d.survivalYears);
  let num = 0, den = 0;
  data.forEach(d => {
    num += (d.fundingLog - xMean) * (d.survivalYears - yMean);
    den += (d.fundingLog - xMean) ** 2;
  });
  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;

  // Calculate R-squared
  const yPred = data.map(d => slope * d.fundingLog + intercept);
  const ssRes = data.reduce((sum, d, i) => sum + (d.survivalYears - yPred[i]) ** 2, 0);
  const ssTot = data.reduce((sum, d) => sum + (d.survivalYears - yMean) ** 2, 0);
  const rSquared = 1 - ssRes / ssTot;

  // Draw trend line
  const xExtent = d3.extent(data, d => d.fundingAmount);
  const lineData = [
    { x: xExtent[0], y: slope * Math.log10(xExtent[0] + 1) + intercept },
    { x: xExtent[1], y: slope * Math.log10(xExtent[1] + 1) + intercept }
  ];

  svg.append('line')
    .attr('x1', x(lineData[0].x))
    .attr('y1', y(Math.max(0, lineData[0].y)))
    .attr('x2', x(lineData[1].x))
    .attr('y2', y(Math.max(0, lineData[1].y)))
    .attr('stroke', Utils.colors.textTertiary)
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4')
    .attr('opacity', 0.6);

  // R-squared annotation
  svg.append('text')
    .attr('x', innerWidth - 10)
    .attr('y', 10)
    .attr('text-anchor', 'end')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '9px')
    .text(`R² = ${rSquared.toFixed(3)}`);
}

// ============================================
// Top Funded Failures List
// ============================================
function renderTopFunded() {
  const container = document.getElementById('funding-top');
  if (!container) return;

  const top = DATA.topFunded.slice(0, 12);
  const maxFunding = d3.max(top, d => d.fundingAmount);

  container.innerHTML = `
    <div style="overflow-y: auto; height: 100%;">
      ${top.map((s, i) => `
        <div class="list-item" style="flex-direction: column; align-items: stretch; padding: 8px 10px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="list-rank">#${i + 1}</span>
            <span class="list-name" style="font-size: 0.75rem;">${Utils.truncate(s.name, 18)}</span>
            <span class="list-value" style="margin-left: auto;">$${s.fundingAmount >= 1000 ? (s.fundingAmount/1000).toFixed(1) + 'B' : s.fundingAmount + 'M'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.5625rem; color: var(--text-tertiary);">
            <span style="color: ${Utils.getSectorColor(s.sector)}">${Utils.truncate(s.sector, 12)}</span>
            <span>${s.survivalYears} yrs</span>
            <span>${s.primaryReason ? Utils.truncate(s.primaryReason, 10) : ''}</span>
          </div>
          <div class="list-bar" style="width: ${(s.fundingAmount / maxFunding * 100).toFixed(0)}%; margin-top: 4px;"></div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================
// Capital Lost by Year (Area Chart)
// ============================================
function renderFundingYearly() {
  const container = document.getElementById('funding-yearly');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Prepare cumulative data
  const yearData = Object.entries(DATA.byFailureYear)
    .map(([year, data]) => ({
      year: parseInt(year),
      funding: data.totalFunding
    }))
    .sort((a, b) => a.year - b.year);

  // Calculate cumulative
  let cumulative = 0;
  const cumulativeData = yearData.map(d => {
    cumulative += d.funding;
    return {
      year: d.year,
      funding: d.funding,
      cumulative: cumulative
    };
  });

  // Create SVG
  const svg = Utils.createSvg(container, width, height, margin);

  // Scales
  const x = d3.scaleLinear()
    .domain(d3.extent(cumulativeData, d => d.year))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(cumulativeData, d => d.cumulative) * 1.1])
    .range([innerHeight, 0]);

  // Add grid
  Utils.addGridLines(svg, x, y, innerWidth, innerHeight);

  // Area
  const area = d3.area()
    .x(d => x(d.year))
    .y0(innerHeight)
    .y1(d => y(d.cumulative))
    .curve(d3.curveMonotoneX);

  // Gradient
  const gradient = svg.append('defs')
    .append('linearGradient')
    .attr('id', 'fundingGradient')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');

  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', Utils.colors.amber)
    .attr('stop-opacity', 0.5);

  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', Utils.colors.amber)
    .attr('stop-opacity', 0.1);

  svg.append('path')
    .datum(cumulativeData)
    .attr('fill', 'url(#fundingGradient)')
    .attr('d', area);

  // Line
  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.cumulative))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(cumulativeData)
    .attr('fill', 'none')
    .attr('stroke', Utils.colors.amber)
    .attr('stroke-width', 2)
    .attr('d', line);

  // Interactive overlay
  const bisect = d3.bisector(d => d.year).left;

  const focus = svg.append('g')
    .style('display', 'none');

  focus.append('circle')
    .attr('r', 5)
    .attr('fill', Utils.colors.amber)
    .attr('stroke', Utils.colors.bgMain)
    .attr('stroke-width', 2);

  focus.append('line')
    .attr('class', 'focus-line')
    .attr('y1', 0)
    .attr('stroke', Utils.colors.amber)
    .attr('stroke-dasharray', '3,3')
    .attr('opacity', 0.5);

  svg.append('rect')
    .attr('width', innerWidth)
    .attr('height', innerHeight)
    .attr('fill', 'transparent')
    .on('mouseenter', () => focus.style('display', null))
    .on('mouseleave', () => {
      focus.style('display', 'none');
      Utils.hideTooltip();
    })
    .on('mousemove', function(event) {
      const x0 = x.invert(d3.pointer(event)[0]);
      const i = bisect(cumulativeData, x0, 1);
      const d0 = cumulativeData[i - 1];
      const d1 = cumulativeData[i];
      const d = d1 && (x0 - d0.year > d1.year - x0) ? d1 : d0;

      if (!d) return;

      focus.attr('transform', `translate(${x(d.year)},${y(d.cumulative)})`);
      focus.select('.focus-line')
        .attr('y2', innerHeight - y(d.cumulative));

      const html = `
        <div class="tooltip-title">${d.year}</div>
        <div class="tooltip-row"><span class="tooltip-label">Year Lost</span><span>$${Utils.formatNumber(d.funding)}M</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Cumulative</span><span class="tooltip-value">${Utils.formatMoney(d.cumulative)}</span></div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    });

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('d')));
  Utils.styleAxis(xAxis);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => Utils.formatMoney(d)));
  Utils.styleAxis(yAxis);

  // Current total annotation
  const lastPoint = cumulativeData[cumulativeData.length - 1];
  svg.append('text')
    .attr('x', innerWidth)
    .attr('y', y(lastPoint.cumulative) - 10)
    .attr('text-anchor', 'end')
    .attr('fill', Utils.colors.amber)
    .attr('font-size', '11px')
    .attr('font-weight', '500')
    .text(Utils.formatMoney(lastPoint.cumulative));
}

// ============================================
// Tier Survival (Grouped Bar Chart)
// ============================================
function renderTierSurvival() {
  const container = document.getElementById('funding-tier-survival');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  const tiers = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Mega'];
  const tierColors = {
    'Pre-Seed': Utils.colors.cyan,
    'Seed': Utils.colors.emerald,
    'Series A': Utils.colors.lime,
    'Series B': Utils.colors.amber,
    'Series C+': Utils.colors.orange,
    'Mega': Utils.colors.coral
  };

  const tierData = tiers.map(tier => {
    const data = DATA.byFundingTier[tier] || { avgSurvival: 0, count: 0 };
    return {
      tier,
      avgSurvival: data.avgSurvival || 0,
      count: data.count || 0,
      color: tierColors[tier]
    };
  }).filter(d => d.count > 0);

  const svg = Utils.createSvg(container, width, height, margin);

  // Scales
  const x = d3.scaleBand()
    .domain(tierData.map(d => d.tier))
    .range([0, innerWidth])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(tierData, d => d.avgSurvival) * 1.1])
    .range([innerHeight, 0]);

  // Grid
  Utils.addGridLines(svg, x, y, innerWidth, innerHeight);

  // Average line
  const avgSurvival = DATA.summary.avgSurvivalYears;
  svg.append('line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', y(avgSurvival))
    .attr('y2', y(avgSurvival))
    .attr('stroke', Utils.colors.textTertiary)
    .attr('stroke-dasharray', '4,4')
    .attr('opacity', 0.6);

  svg.append('text')
    .attr('x', innerWidth - 5)
    .attr('y', y(avgSurvival) - 5)
    .attr('text-anchor', 'end')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '9px')
    .text(`Overall avg: ${avgSurvival.toFixed(1)} yrs`);

  // Bars
  svg.selectAll('rect')
    .data(tierData)
    .join('rect')
    .attr('x', d => x(d.tier))
    .attr('y', d => y(d.avgSurvival))
    .attr('width', x.bandwidth())
    .attr('height', d => innerHeight - y(d.avgSurvival))
    .attr('fill', d => d.color)
    .attr('fill-opacity', 0.8)
    .attr('rx', 3)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('fill-opacity', 1);
      const diff = d.avgSurvival - avgSurvival;
      const html = `
        <div class="tooltip-title" style="color: ${d.color}">${d.tier}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Survival</span>
          <span class="tooltip-value">${d.avgSurvival.toFixed(1)} yrs</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">vs Overall</span>
          <span style="color: ${diff >= 0 ? Utils.colors.emerald : Utils.colors.coral}">${diff >= 0 ? '+' : ''}${diff.toFixed(1)} yrs</span>
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

  // Value labels on top
  svg.selectAll('text.value')
    .data(tierData)
    .join('text')
    .attr('class', 'value')
    .attr('x', d => x(d.tier) + x.bandwidth() / 2)
    .attr('y', d => y(d.avgSurvival) - 5)
    .attr('text-anchor', 'middle')
    .attr('fill', d => d.color)
    .attr('font-size', '10px')
    .attr('font-weight', '500')
    .text(d => d.avgSurvival.toFixed(1));

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
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + ' yrs'));
  Utils.styleAxis(yAxis);
}

// ============================================
// Funding by Reason (Horizontal Bar Chart)
// ============================================
function renderFundingByReason() {
  const container = document.getElementById('funding-by-reason');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Calculate avg funding for each reason
  const reasonFunding = DATA.failureReasons.map(reason => {
    const affected = DATA.startups.filter(s => s.failureReasons[reason] === 1 && s.fundingAmount > 0);
    return {
      reason,
      avgFunding: affected.length > 0 ? Utils.avg(affected, 'fundingAmount') : 0,
      count: affected.length
    };
  }).filter(r => r.count >= 5).sort((a, b) => b.avgFunding - a.avgFunding);

  const svg = Utils.createSvg(container, width, height, { ...margin, left: 100 });
  const adjWidth = innerWidth - 50;

  // Scales
  const y = d3.scaleBand()
    .domain(reasonFunding.map(d => d.reason))
    .range([0, innerHeight])
    .padding(0.2);

  const x = d3.scaleLinear()
    .domain([0, d3.max(reasonFunding, d => d.avgFunding) * 1.1])
    .range([0, adjWidth]);

  // Overall average line
  const overallAvg = Utils.avg(DATA.startups.filter(s => s.fundingAmount > 0), 'fundingAmount');
  svg.append('line')
    .attr('x1', x(overallAvg))
    .attr('x2', x(overallAvg))
    .attr('y1', 0)
    .attr('y2', innerHeight)
    .attr('stroke', Utils.colors.amber)
    .attr('stroke-dasharray', '4,4')
    .attr('opacity', 0.6);

  // Bars
  reasonFunding.forEach(d => {
    const color = Utils.getReasonColor(d.reason);

    svg.append('rect')
      .attr('x', 0)
      .attr('y', y(d.reason))
      .attr('width', x(d.avgFunding))
      .attr('height', y.bandwidth())
      .attr('fill', color)
      .attr('fill-opacity', 0.8)
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event) {
        d3.select(this).attr('fill-opacity', 1);
        const diff = d.avgFunding - overallAvg;
        const html = `
          <div class="tooltip-title">${d.reason}</div>
          <div class="tooltip-row">
            <span class="tooltip-label">Avg Funding</span>
            <span class="tooltip-value">$${d.avgFunding.toFixed(0)}M</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">vs Overall</span>
            <span style="color: ${diff >= 0 ? Utils.colors.coral : Utils.colors.emerald}">${diff >= 0 ? '+' : ''}$${diff.toFixed(0)}M</span>
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

    // Label
    svg.append('text')
      .attr('x', -8)
      .attr('y', y(d.reason) + y.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', Utils.colors.textSecondary)
      .attr('font-size', '9px')
      .text(Utils.truncate(d.reason, 12));

    // Value
    svg.append('text')
      .attr('x', x(d.avgFunding) + 5)
      .attr('y', y(d.reason) + y.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .attr('fill', color)
      .attr('font-size', '9px')
      .text('$' + d.avgFunding.toFixed(0) + 'M');
  });
}

// ============================================
// Funding Outliers
// ============================================
function renderFundingOutliers() {
  const container = document.getElementById('funding-outliers');
  if (!container) return;

  const fundedStartups = DATA.startups.filter(s => s.fundingAmount > 0 && s.survivalYears > 0);

  // Calculate efficiency (funding / survival)
  const withEfficiency = fundedStartups.map(s => ({
    ...s,
    efficiency: s.fundingAmount / s.survivalYears
  }));

  // Find outliers
  const sortedByEfficiency = [...withEfficiency].sort((a, b) => b.efficiency - a.efficiency);
  const sortedBySurvival = [...withEfficiency].sort((a, b) => a.survivalYears - b.survivalYears);
  const sortedByFunding = [...withEfficiency].sort((a, b) => b.fundingAmount - a.fundingAmount);

  const insights = [
    {
      title: 'Biggest Burn Rate',
      startup: sortedByEfficiency[0],
      stat: `$${sortedByEfficiency[0].efficiency.toFixed(0)}M/yr`,
      detail: `$${sortedByEfficiency[0].fundingAmount}M raised, lasted ${sortedByEfficiency[0].survivalYears} years`,
      color: Utils.colors.coral
    },
    {
      title: 'Best Efficiency',
      startup: sortedByEfficiency[sortedByEfficiency.length - 1],
      stat: `$${sortedByEfficiency[sortedByEfficiency.length - 1].efficiency.toFixed(1)}M/yr`,
      detail: `$${sortedByEfficiency[sortedByEfficiency.length - 1].fundingAmount}M over ${sortedByEfficiency[sortedByEfficiency.length - 1].survivalYears} years`,
      color: Utils.colors.emerald
    },
    {
      title: 'Fastest Failure',
      startup: sortedBySurvival[0],
      stat: `${sortedBySurvival[0].survivalYears} year${sortedBySurvival[0].survivalYears !== 1 ? 's' : ''}`,
      detail: `$${sortedBySurvival[0].fundingAmount}M raised before failing`,
      color: Utils.colors.amber
    },
    {
      title: 'Biggest Bet Lost',
      startup: sortedByFunding[0],
      stat: Utils.formatMoney(sortedByFunding[0].fundingAmount),
      detail: `${sortedByFunding[0].survivalYears} years, ${sortedByFunding[0].sector}`,
      color: Utils.colors.coral
    }
  ];

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 10px; height: 100%; overflow-y: auto;">
      ${insights.map(insight => `
        <div style="background: var(--bg-accent); border-radius: 6px; padding: 10px; border-left: 3px solid ${insight.color};">
          <div style="font-size: 0.625rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px;">
            ${insight.title}
          </div>
          <div style="font-size: 0.875rem; font-weight: 500; color: ${insight.color}; margin-bottom: 2px;">
            ${Utils.truncate(insight.startup.name, 20)}
          </div>
          <div style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 3px;">
            ${insight.stat}
          </div>
          <div style="font-size: 0.6875rem; color: var(--text-tertiary);">
            ${insight.detail}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================
// Funding ROI (Capital Efficiency Distribution)
// ============================================
function renderFundingROI() {
  const container = document.getElementById('funding-roi');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Calculate efficiency for each startup
  const data = DATA.startups
    .filter(s => s.fundingAmount > 0 && s.survivalYears > 0)
    .map(s => ({
      name: s.name,
      efficiency: s.fundingAmount / s.survivalYears,
      sector: s.sector,
      funding: s.fundingAmount,
      survival: s.survivalYears
    }))
    .sort((a, b) => b.efficiency - a.efficiency);

  // Create bins
  const bins = [0, 10, 25, 50, 100, 250, 500, 1000];
  const binData = bins.slice(0, -1).map((bin, i) => {
    const nextBin = bins[i + 1];
    const count = data.filter(d => d.efficiency >= bin && d.efficiency < nextBin).length;
    return {
      range: `$${bin}-${nextBin}M/yr`,
      min: bin,
      max: nextBin,
      count
    };
  });
  binData.push({
    range: '$1B+/yr',
    min: 1000,
    max: Infinity,
    count: data.filter(d => d.efficiency >= 1000).length
  });

  const svg = Utils.createSvg(container, width, height, margin);

  // Scales
  const x = d3.scaleBand()
    .domain(binData.map(d => d.range))
    .range([0, innerWidth])
    .padding(0.15);

  const y = d3.scaleLinear()
    .domain([0, d3.max(binData, d => d.count) * 1.1])
    .range([innerHeight, 0]);

  // Grid
  Utils.addGridLines(svg, x, y, innerWidth, innerHeight);

  // Bars
  svg.selectAll('rect')
    .data(binData)
    .join('rect')
    .attr('x', d => x(d.range))
    .attr('y', d => y(d.count))
    .attr('width', x.bandwidth())
    .attr('height', d => innerHeight - y(d.count))
    .attr('fill', (d, i) => d3.interpolate(Utils.colors.emerald, Utils.colors.coral)(i / (binData.length - 1)))
    .attr('fill-opacity', 0.8)
    .attr('rx', 3)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('fill-opacity', 1);
      const pct = ((d.count / data.length) * 100).toFixed(1);
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
    .attr('transform', 'rotate(-35)')
    .attr('text-anchor', 'end')
    .attr('dx', '-0.5em')
    .attr('dy', '0.5em')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '8px');
  xAxis.selectAll('line, path').attr('stroke', Utils.colors.border);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5));
  Utils.styleAxis(yAxis);

  // Median annotation
  const median = data[Math.floor(data.length / 2)].efficiency;
  svg.append('text')
    .attr('x', innerWidth)
    .attr('y', 10)
    .attr('text-anchor', 'end')
    .attr('fill', Utils.colors.textSecondary)
    .attr('font-size', '10px')
    .text(`Median: $${median.toFixed(0)}M/yr`);
}
