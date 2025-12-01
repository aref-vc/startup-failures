/* Timeline Tab - Temporal Analysis */

let timelineInitialized = false;

function initTimeline() {
  if (timelineInitialized) return;
  timelineInitialized = true;

  renderTimelineMain();
  renderDecadeComparison();
  renderEraCards();
  renderNotableFailures();
}

// ============================================
// Main Timeline Chart
// ============================================
function renderTimelineMain() {
  const container = document.getElementById('timeline-main');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Prepare data - each startup as a point
  const data = DATA.startups
    .filter(s => s.failureYear && s.fundingAmount >= 0)
    .map(s => ({
      ...s,
      radius: Math.max(3, Math.min(15, Math.sqrt(s.fundingAmount) / 2))
    }));

  // Create SVG
  const svg = Utils.createSvg(container, width, height, margin);

  // Scales
  const x = d3.scaleLinear()
    .domain([1990, 2025])
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.survivalYears) + 2])
    .range([innerHeight, 0]);

  // Add grid
  Utils.addGridLines(svg, x, y, innerWidth, innerHeight);

  // Draw dots with jitter to reduce overlap
  svg.selectAll('circle')
    .data(data)
    .join('circle')
    .attr('cx', d => x(d.failureYear) + (Math.random() - 0.5) * 15)
    .attr('cy', d => y(d.survivalYears) + (Math.random() - 0.5) * 10)
    .attr('r', d => d.radius)
    .attr('fill', d => Utils.getSectorColor(d.sector))
    .attr('fill-opacity', 0.6)
    .attr('stroke', Utils.colors.bgMain)
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this)
        .attr('fill-opacity', 1)
        .attr('stroke-width', 2)
        .raise();

      const html = `
        <div class="tooltip-title">${d.name}</div>
        <div style="color: ${Utils.getSectorColor(d.sector)}; font-size: 0.625rem; margin-bottom: 6px;">
          ${d.sector}
        </div>
        <div class="tooltip-row"><span class="tooltip-label">Years</span><span>${d.foundingYear}-${d.failureYear}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Survived</span><span>${d.survivalYears} years</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Funding</span><span class="tooltip-value">${d.fundingAmount > 0 ? '$' + d.fundingAmount + 'M' : 'N/A'}</span></div>
        ${d.whatTheyDid ? `<div style="margin-top: 6px; font-size: 0.625rem; color: var(--text-tertiary);">${Utils.truncate(d.whatTheyDid, 50)}</div>` : ''}
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this)
        .attr('fill-opacity', 0.6)
        .attr('stroke-width', 1);
      Utils.hideTooltip();
    });

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format('d')));
  Utils.styleAxis(xAxis);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + ' yrs'));
  Utils.styleAxis(yAxis);

  // Era annotations
  const eras = [
    { start: 1999, end: 2002, label: 'Dot-com Bust', color: Utils.colors.coral },
    { start: 2008, end: 2010, label: 'Financial Crisis', color: Utils.colors.amber },
    { start: 2020, end: 2022, label: 'Pandemic', color: Utils.colors.purple }
  ];

  eras.forEach(era => {
    svg.append('rect')
      .attr('x', x(era.start))
      .attr('y', 0)
      .attr('width', x(era.end) - x(era.start))
      .attr('height', innerHeight)
      .attr('fill', era.color)
      .attr('fill-opacity', 0.1);

    svg.append('text')
      .attr('x', x((era.start + era.end) / 2))
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .attr('fill', era.color)
      .attr('font-size', '8px')
      .attr('opacity', 0.8)
      .text(era.label);
  });

  // Size legend
  const legendGroup = svg.append('g')
    .attr('transform', `translate(${innerWidth - 60}, 10)`);

  legendGroup.append('text')
    .attr('x', 0)
    .attr('y', 0)
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '8px')
    .text('Size = Funding');

  [5, 10, 15].forEach((r, i) => {
    legendGroup.append('circle')
      .attr('cx', 10 + i * 20)
      .attr('cy', 15)
      .attr('r', r / 2)
      .attr('fill', Utils.colors.textTertiary)
      .attr('fill-opacity', 0.5);
  });
}

// ============================================
// Decade Comparison (Stacked Bar)
// ============================================
function renderDecadeComparison() {
  const container = document.getElementById('timeline-decades');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Prepare data by decade
  const decades = Object.keys(DATA.byDecade).map(Number).sort();
  const reasons = DATA.failureReasons.slice(0, 8); // Top 8 reasons for clarity

  const decadeData = decades.map(decade => {
    const data = DATA.byDecade[decade];
    const total = data.count;
    const result = { decade };

    reasons.forEach(reason => {
      result[reason] = (data.reasonCounts[reason] || 0) / total * 100;
    });

    return result;
  });

  // Create SVG
  const svg = Utils.createSvg(container, width, height, margin);

  // Stack the data
  const stack = d3.stack()
    .keys(reasons)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const series = stack(decadeData);

  // Scales
  const x = d3.scaleBand()
    .domain(decades.map(d => d + 's'))
    .range([0, innerWidth])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, 100])
    .range([innerHeight, 0]);

  // Draw stacked bars
  const groups = svg.selectAll('g.series')
    .data(series)
    .join('g')
    .attr('class', 'series')
    .attr('fill', (d, i) => Utils.getReasonColor(reasons[i]));

  groups.selectAll('rect')
    .data(d => d)
    .join('rect')
    .attr('x', d => x(d.data.decade + 's'))
    .attr('y', d => y(d[1]))
    .attr('height', d => y(d[0]) - y(d[1]))
    .attr('width', x.bandwidth())
    .attr('opacity', 0.8)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('opacity', 1);

      const reason = d3.select(this.parentNode).datum().key;
      const value = (d[1] - d[0]).toFixed(1);

      const html = `
        <div class="tooltip-title">${d.data.decade}s</div>
        <div class="tooltip-row">
          <span class="tooltip-label">${reason}</span>
          <span class="tooltip-value">${value}%</span>
        </div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('opacity', 0.8);
      Utils.hideTooltip();
    });

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));
  Utils.styleAxis(xAxis);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + '%'));
  Utils.styleAxis(yAxis);

  // Compact legend
  const legendGroup = svg.append('g')
    .attr('transform', `translate(0, ${-20})`);

  reasons.forEach((reason, i) => {
    const col = Math.floor(i / 2);
    const row = i % 2;

    const g = legendGroup.append('g')
      .attr('transform', `translate(${col * 80}, ${row * 10})`);

    g.append('rect')
      .attr('width', 8)
      .attr('height', 8)
      .attr('fill', Utils.getReasonColor(reason))
      .attr('rx', 1);

    g.append('text')
      .attr('x', 11)
      .attr('y', 7)
      .attr('fill', Utils.colors.textTertiary)
      .attr('font-size', '7px')
      .text(Utils.truncate(reason, 8));
  });
}

// ============================================
// Era Cards
// ============================================
function renderEraCards() {
  const container = document.getElementById('timeline-eras');
  if (!container) return;

  // Define eras
  const eras = [
    {
      name: 'Dot-com Bust',
      years: '1999-2002',
      color: Utils.colors.coral,
      filter: s => s.failureYear >= 1999 && s.failureYear <= 2002
    },
    {
      name: 'Web 2.0',
      years: '2005-2010',
      color: Utils.colors.cyan,
      filter: s => s.failureYear >= 2005 && s.failureYear <= 2010
    },
    {
      name: 'Mobile Era',
      years: '2012-2017',
      color: Utils.colors.emerald,
      filter: s => s.failureYear >= 2012 && s.failureYear <= 2017
    },
    {
      name: 'Pandemic',
      years: '2020-2023',
      color: Utils.colors.purple,
      filter: s => s.failureYear >= 2020 && s.failureYear <= 2023
    }
  ];

  // Calculate stats for each era
  const eraStats = eras.map(era => {
    const startups = DATA.startups.filter(era.filter);
    const count = startups.length;
    const totalFunding = Utils.sum(startups, 'fundingAmount');
    const avgSurvival = Utils.avg(startups, 'survivalYears');

    // Top reason
    const reasonCounts = {};
    startups.forEach(s => {
      Object.entries(s.failureReasons).forEach(([reason, val]) => {
        if (val === 1) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
    });
    const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      ...era,
      count,
      totalFunding,
      avgSurvival,
      topReason: topReason ? topReason[0] : 'N/A'
    };
  });

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; height: 100%;">
      ${eraStats.map(era => `
        <div class="stat-card" style="background: var(--bg-accent); border-left: 3px solid ${era.color}; padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <div style="font-size: 0.8125rem; font-weight: 500; color: ${era.color};">${era.name}</div>
              <div style="font-size: 0.625rem; color: var(--text-tertiary);">${era.years}</div>
            </div>
            <div style="font-size: 1.25rem; font-weight: 500; color: ${era.color};">${era.count}</div>
          </div>
          <div style="font-size: 0.5625rem; color: var(--text-tertiary); line-height: 1.6;">
            <div>$${Utils.formatNumber(era.totalFunding)}M lost</div>
            <div>${era.avgSurvival.toFixed(1)} yrs avg survival</div>
            <div style="margin-top: 4px;">Top: ${Utils.truncate(era.topReason, 15)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================
// Notable Failures List
// ============================================
function renderNotableFailures() {
  const container = document.getElementById('timeline-notable');
  if (!container) return;

  // Get notable failures sorted by funding
  const notable = DATA.notableFailures
    .sort((a, b) => b.fundingAmount - a.fundingAmount)
    .slice(0, 10);

  container.innerHTML = `
    <div style="overflow-y: auto; height: 100%;">
      ${notable.map(s => `
        <div class="list-item" style="flex-direction: column; align-items: stretch; padding: 10px 12px; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 0.8125rem; font-weight: 500; color: var(--text-primary);">${Utils.truncate(s.name, 20)}</span>
            <span style="font-size: 0.75rem; color: var(--lime); font-weight: 500;">$${s.fundingAmount >= 1000 ? (s.fundingAmount/1000).toFixed(1) + 'B' : s.fundingAmount + 'M'}</span>
          </div>
          <div style="font-size: 0.625rem; color: var(--text-tertiary); margin-bottom: 4px;">
            ${s.whatTheyDid ? Utils.truncate(s.whatTheyDid, 45) : ''}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.5625rem; color: var(--text-tertiary);">
            <span style="color: ${Utils.getSectorColor(s.sector)}">${Utils.truncate(s.sector, 12)}</span>
            <span>${s.foundingYear}-${s.failureYear}</span>
            <span>${s.survivalYears} yrs</span>
          </div>
          ${s.takeaway ? `
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border); font-size: 0.5625rem; color: var(--amber); font-style: italic;">
              "${Utils.truncate(s.takeaway, 40)}"
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}
