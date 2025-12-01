/* Funding Tab - Capital Analysis */

let fundingInitialized = false;

function initFunding() {
  if (fundingInitialized) return;
  fundingInitialized = true;

  renderFundingTiers();
  renderFundingScatter();
  renderTopFunded();
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
