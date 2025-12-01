/* Timeline Tab - Temporal Analysis */

let timelineInitialized = false;

function initTimeline() {
  if (timelineInitialized) return;
  timelineInitialized = true;

  renderTimelineMain();
  renderDecadeComparison();
  renderSurvivalTrend();
  renderFailureAcceleration();
  renderStreamGraph();
  renderCalendarHeatmap();
  renderDecadeTrajectory();
  renderHorizonChart();
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

// ============================================
// Failure Acceleration (YoY Change)
// ============================================
function renderFailureAcceleration() {
  const container = document.getElementById('timeline-acceleration');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Calculate year-over-year change
  const years = Object.keys(DATA.byFailureYear).map(Number).sort((a, b) => a - b);
  const yoyData = [];

  for (let i = 1; i < years.length; i++) {
    const prevYear = years[i - 1];
    const currYear = years[i];
    const prevCount = DATA.byFailureYear[prevYear].count;
    const currCount = DATA.byFailureYear[currYear].count;
    const change = prevCount > 0 ? ((currCount - prevCount) / prevCount) * 100 : 0;

    yoyData.push({
      year: currYear,
      count: currCount,
      prevCount,
      change
    });
  }

  const svg = Utils.createSvg(container, width, height, margin);

  // Scales
  const x = d3.scaleLinear()
    .domain(d3.extent(yoyData, d => d.year))
    .range([0, innerWidth]);

  const yMax = Math.max(Math.abs(d3.min(yoyData, d => d.change)), Math.abs(d3.max(yoyData, d => d.change)));
  const y = d3.scaleLinear()
    .domain([-yMax * 1.1, yMax * 1.1])
    .range([innerHeight, 0]);

  // Zero line
  svg.append('line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', y(0))
    .attr('y2', y(0))
    .attr('stroke', Utils.colors.textTertiary)
    .attr('stroke-width', 1);

  // Grid lines
  svg.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(''))
    .selectAll('line')
    .attr('stroke', Utils.colors.border)
    .attr('stroke-opacity', 0.3);
  svg.selectAll('.grid .domain').remove();

  // Bars
  const barWidth = innerWidth / yoyData.length * 0.7;
  svg.selectAll('rect')
    .data(yoyData)
    .join('rect')
    .attr('x', d => x(d.year) - barWidth / 2)
    .attr('y', d => d.change >= 0 ? y(d.change) : y(0))
    .attr('width', barWidth)
    .attr('height', d => Math.abs(y(d.change) - y(0)))
    .attr('fill', d => d.change >= 0 ? Utils.colors.coral : Utils.colors.emerald)
    .attr('fill-opacity', 0.8)
    .attr('rx', 2)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('fill-opacity', 1);
      const html = `
        <div class="tooltip-title">${d.year}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Failures</span>
          <span class="tooltip-value">${d.count}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">vs ${d.year - 1}</span>
          <span style="color: ${d.change >= 0 ? Utils.colors.coral : Utils.colors.emerald}">
            ${d.change >= 0 ? '+' : ''}${d.change.toFixed(0)}%
          </span>
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
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('d')));
  Utils.styleAxis(xAxis);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + '%'));
  Utils.styleAxis(yAxis);

  // Labels
  svg.append('text')
    .attr('x', 5)
    .attr('y', 15)
    .attr('fill', Utils.colors.coral)
    .attr('font-size', '9px')
    .text('More failures');

  svg.append('text')
    .attr('x', 5)
    .attr('y', innerHeight - 5)
    .attr('fill', Utils.colors.emerald)
    .attr('font-size', '9px')
    .text('Fewer failures');
}

// ============================================
// Funding Trend Over Time
// ============================================
function renderFundingTrend() {
  const container = document.getElementById('timeline-funding-trend');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Calculate average funding per year
  const yearData = Object.entries(DATA.byFailureYear)
    .map(([year, data]) => ({
      year: parseInt(year),
      avgFunding: data.avgFunding || 0,
      count: data.count,
      totalFunding: data.totalFunding
    }))
    .filter(d => d.count >= 2) // At least 2 failures for meaningful average
    .sort((a, b) => a.year - b.year);

  const svg = Utils.createSvg(container, width, height, margin);

  // Scales
  const x = d3.scaleLinear()
    .domain(d3.extent(yearData, d => d.year))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(yearData, d => d.avgFunding) * 1.1])
    .range([innerHeight, 0]);

  // Grid
  Utils.addGridLines(svg, x, y, innerWidth, innerHeight);

  // Area
  const area = d3.area()
    .x(d => x(d.year))
    .y0(innerHeight)
    .y1(d => y(d.avgFunding))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(yearData)
    .attr('fill', Utils.colors.amber)
    .attr('fill-opacity', 0.2)
    .attr('d', area);

  // Line
  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.avgFunding))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(yearData)
    .attr('fill', 'none')
    .attr('stroke', Utils.colors.amber)
    .attr('stroke-width', 2)
    .attr('d', line);

  // Dots
  svg.selectAll('circle')
    .data(yearData)
    .join('circle')
    .attr('cx', d => x(d.year))
    .attr('cy', d => y(d.avgFunding))
    .attr('r', 4)
    .attr('fill', Utils.colors.amber)
    .attr('stroke', Utils.colors.bgMain)
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('r', 6);
      const html = `
        <div class="tooltip-title">${d.year}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Funding</span>
          <span class="tooltip-value">$${d.avgFunding.toFixed(0)}M</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Total Lost</span>
          <span>${Utils.formatMoney(d.totalFunding)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Failures</span>
          <span>${d.count}</span>
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
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('d')));
  Utils.styleAxis(xAxis);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => '$' + d + 'M'));
  Utils.styleAxis(yAxis);

  // Trend annotation
  const firstAvg = yearData[0].avgFunding;
  const lastAvg = yearData[yearData.length - 1].avgFunding;
  const trend = ((lastAvg - firstAvg) / firstAvg * 100).toFixed(0);

  svg.append('text')
    .attr('x', innerWidth)
    .attr('y', 15)
    .attr('text-anchor', 'end')
    .attr('fill', lastAvg > firstAvg ? Utils.colors.coral : Utils.colors.emerald)
    .attr('font-size', '10px')
    .text(`${trend > 0 ? '+' : ''}${trend}% since ${yearData[0].year}`);
}

// ============================================
// Survival Trend Over Time
// ============================================
function renderSurvivalTrend() {
  const container = document.getElementById('timeline-survival-trend');
  if (!container) return;

  const { width, height, margin, innerWidth, innerHeight } = Utils.getChartDimensions(container);

  // Calculate average survival per founding decade (cohort analysis)
  const decades = [1990, 2000, 2010, 2020];
  const cohortData = decades.map(decade => {
    const startups = DATA.startups.filter(s =>
      s.foundingYear >= decade && s.foundingYear < decade + 10 && s.survivalYears > 0
    );
    return {
      decade: decade + 's',
      avgSurvival: startups.length > 0 ? Utils.avg(startups, 'survivalYears') : 0,
      count: startups.length
    };
  }).filter(d => d.count >= 5);

  const svg = Utils.createSvg(container, width, height, margin);

  // Scales
  const x = d3.scaleBand()
    .domain(cohortData.map(d => d.decade))
    .range([0, innerWidth])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(cohortData, d => d.avgSurvival) * 1.2])
    .range([innerHeight, 0]);

  // Grid
  Utils.addGridLines(svg, x, y, innerWidth, innerHeight);

  // Overall average
  const overallAvg = DATA.summary.avgSurvivalYears;
  svg.append('line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', y(overallAvg))
    .attr('y2', y(overallAvg))
    .attr('stroke', Utils.colors.textTertiary)
    .attr('stroke-dasharray', '4,4')
    .attr('opacity', 0.6);

  svg.append('text')
    .attr('x', innerWidth - 5)
    .attr('y', y(overallAvg) - 5)
    .attr('text-anchor', 'end')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '9px')
    .text(`Overall: ${overallAvg.toFixed(1)} yrs`);

  // Bars
  svg.selectAll('rect')
    .data(cohortData)
    .join('rect')
    .attr('x', d => x(d.decade))
    .attr('y', d => y(d.avgSurvival))
    .attr('width', x.bandwidth())
    .attr('height', d => innerHeight - y(d.avgSurvival))
    .attr('fill', d => d.avgSurvival >= overallAvg ? Utils.colors.emerald : Utils.colors.coral)
    .attr('fill-opacity', 0.8)
    .attr('rx', 3)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('fill-opacity', 1);
      const diff = d.avgSurvival - overallAvg;
      const html = `
        <div class="tooltip-title">${d.decade} Cohort</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Survival</span>
          <span class="tooltip-value">${d.avgSurvival.toFixed(1)} yrs</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">vs Overall</span>
          <span style="color: ${diff >= 0 ? Utils.colors.emerald : Utils.colors.coral}">
            ${diff >= 0 ? '+' : ''}${diff.toFixed(1)} yrs
          </span>
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

  // Value labels
  svg.selectAll('text.value')
    .data(cohortData)
    .join('text')
    .attr('class', 'value')
    .attr('x', d => x(d.decade) + x.bandwidth() / 2)
    .attr('y', d => y(d.avgSurvival) - 5)
    .attr('text-anchor', 'middle')
    .attr('fill', d => d.avgSurvival >= overallAvg ? Utils.colors.emerald : Utils.colors.coral)
    .attr('font-size', '11px')
    .attr('font-weight', '500')
    .text(d => d.avgSurvival.toFixed(1) + 'y');

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));
  Utils.styleAxis(xAxis);

  // Y axis
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + ' yrs'));
  Utils.styleAxis(yAxis);
}

// ============================================
// Decade Statistics
// ============================================
function renderDecadeStats() {
  const container = document.getElementById('timeline-decade-stats');
  if (!container) return;

  const decades = Object.keys(DATA.byDecade).map(Number).sort();

  const decadeMetrics = decades.map(decade => {
    const data = DATA.byDecade[decade];
    const startups = DATA.startups.filter(s => s.failureYear >= decade && s.failureYear < decade + 10);
    const avgFunding = Utils.avg(startups.filter(s => s.fundingAmount > 0), 'fundingAmount');

    // Top reason
    const topReason = Object.entries(data.reasonCounts)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      decade: decade + 's',
      count: data.count,
      avgSurvival: data.avgSurvival,
      avgFunding: avgFunding || 0,
      topReason: topReason ? topReason[0] : 'N/A',
      topReasonPct: topReason ? ((topReason[1] / data.count) * 100).toFixed(0) : 0
    };
  });

  container.innerHTML = `
    <div style="overflow-y: auto; height: 100%;">
      <table style="width: 100%; font-size: 0.6875rem; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border);">
            <th style="text-align: left; padding: 6px 4px; color: var(--text-tertiary);">Era</th>
            <th style="text-align: right; padding: 6px 4px; color: var(--text-tertiary);">Fails</th>
            <th style="text-align: right; padding: 6px 4px; color: var(--text-tertiary);">Surv</th>
            <th style="text-align: right; padding: 6px 4px; color: var(--text-tertiary);">Avg $</th>
            <th style="text-align: left; padding: 6px 4px; color: var(--text-tertiary);">Top Reason</th>
          </tr>
        </thead>
        <tbody>
          ${decadeMetrics.map(m => `
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 6px 4px; color: var(--lime); font-weight: 500;">${m.decade}</td>
              <td style="text-align: right; padding: 6px 4px; color: var(--text-secondary);">${m.count}</td>
              <td style="text-align: right; padding: 6px 4px; color: var(--text-secondary);">${m.avgSurvival.toFixed(1)}y</td>
              <td style="text-align: right; padding: 6px 4px; color: var(--text-secondary);">$${m.avgFunding.toFixed(0)}M</td>
              <td style="padding: 6px 4px; color: var(--text-tertiary); font-size: 0.625rem;">
                ${Utils.truncate(m.topReason, 12)} <span style="color: var(--amber);">(${m.topReasonPct}%)</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top: 12px; padding: 10px; background: var(--bg-accent); border-radius: 6px;">
        <div style="font-size: 0.625rem; color: var(--text-tertiary); margin-bottom: 6px;">KEY INSIGHT</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary);">
          ${(() => {
            const recentDecade = decadeMetrics[decadeMetrics.length - 1];
            const oldDecade = decadeMetrics[0];
            const survivalChange = ((recentDecade.avgSurvival - oldDecade.avgSurvival) / oldDecade.avgSurvival * 100).toFixed(0);
            const fundingChange = oldDecade.avgFunding > 0
              ? ((recentDecade.avgFunding - oldDecade.avgFunding) / oldDecade.avgFunding * 100).toFixed(0)
              : 'N/A';
            return `Startups in the ${recentDecade.decade} ${survivalChange > 0 ? 'survived' : 'failed'}
              ${Math.abs(survivalChange)}% ${survivalChange > 0 ? 'longer' : 'faster'} than ${oldDecade.decade},
              despite raising ${fundingChange}% more capital.`;
          })()}
        </div>
      </div>
    </div>
  `;
}

// ============================================
// Stream Graph (Reason Evolution Over Time)
// ============================================
function renderStreamGraph() {
  const container = document.getElementById('timeline-stream');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 20, right: 100, bottom: 30, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Build data by year and reason
  const years = Object.keys(DATA.byFailureYear).map(Number).sort((a, b) => a - b);
  const topReasons = Object.entries(DATA.byReason)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(d => d[0]);

  const data = years.map(year => {
    const row = { year };
    topReasons.forEach(reason => {
      row[reason] = DATA.startups.filter(s =>
        s.failureYear === year && s.failureReasons[reason]
      ).length;
    });
    return row;
  });

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const stack = d3.stack()
    .keys(topReasons)
    .offset(d3.stackOffsetWiggle);

  const series = stack(data);

  const x = d3.scaleLinear()
    .domain(d3.extent(years))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(series, s => d3.min(s, d => d[0])),
      d3.max(series, s => d3.max(s, d => d[1]))
    ])
    .range([innerHeight, 0]);

  const area = d3.area()
    .x(d => x(d.data.year))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveCardinal);

  svg.selectAll('path')
    .data(series)
    .join('path')
    .attr('d', area)
    .attr('fill', d => Utils.getReasonColor(d.key))
    .attr('fill-opacity', 0.8)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('fill-opacity', 1);
      const total = d3.sum(d, v => v[1] - v[0]);
      const html = `
        <div class="tooltip-title">${d.key}</div>
        <div class="tooltip-row"><span class="tooltip-label">Total</span><span class="tooltip-value">${total}</span></div>
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
    .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format('d')));
  Utils.styleAxis(xAxis);

  // Legend
  const legend = svg.append('g')
    .attr('transform', `translate(${innerWidth + 10}, 0)`);

  topReasons.forEach((reason, i) => {
    const g = legend.append('g')
      .attr('transform', `translate(0, ${i * 16})`);
    g.append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('fill', Utils.getReasonColor(reason));
    g.append('text')
      .attr('x', 14)
      .attr('y', 9)
      .attr('fill', Utils.colors.textTertiary)
      .attr('font-size', '8px')
      .text(Utils.truncate(reason, 10));
  });
}

// ============================================
// Calendar Heatmap
// ============================================
function renderCalendarHeatmap() {
  const container = document.getElementById('timeline-calendar');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 30, right: 20, bottom: 20, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Get year range
  const years = Object.keys(DATA.byFailureYear).map(Number).sort((a, b) => a - b);
  const minYear = Math.max(years[0], 1995);
  const maxYear = years[years.length - 1];

  // Filter to recent years that fit
  const yearRange = maxYear - minYear + 1;
  const cellSize = Math.min(innerWidth / yearRange - 1, innerHeight / 6);

  // Create year buckets with counts
  const yearCounts = {};
  years.forEach(y => {
    if (y >= minYear) {
      yearCounts[y] = DATA.byFailureYear[y].count;
    }
  });

  const maxCount = d3.max(Object.values(yearCounts));

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const colorScale = d3.scaleSequential()
    .domain([0, maxCount])
    .interpolator(d3.interpolate('#1A1A18', Utils.colors.coral));

  // Draw cells
  const cols = Math.floor(innerWidth / (cellSize + 2));
  const displayYears = Object.keys(yearCounts).map(Number).sort((a, b) => a - b);

  displayYears.forEach((year, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    svg.append('rect')
      .attr('x', col * (cellSize + 2))
      .attr('y', row * (cellSize + 2))
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('fill', colorScale(yearCounts[year]))
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event) {
        d3.select(this).attr('stroke', Utils.colors.lime).attr('stroke-width', 2);
        const html = `
          <div class="tooltip-title">${year}</div>
          <div class="tooltip-row"><span class="tooltip-label">Failures</span><span class="tooltip-value">${yearCounts[year]}</span></div>
        `;
        Utils.showTooltip(html, event.pageX, event.pageY);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('stroke', 'none');
        Utils.hideTooltip();
      });

    // Add year label for start of each row
    if (col === 0) {
      svg.append('text')
        .attr('x', -8)
        .attr('y', row * (cellSize + 2) + cellSize / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', Utils.colors.textTertiary)
        .attr('font-size', '9px')
        .text(year);
    }
  });

  // Legend
  const legendWidth = 100;
  const legendHeight = 10;
  const legend = svg.append('g')
    .attr('transform', `translate(${innerWidth - legendWidth}, -20)`);

  const legendScale = d3.scaleLinear()
    .domain([0, maxCount])
    .range([0, legendWidth]);

  const defs = svg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', 'calendar-gradient');

  gradient.selectAll('stop')
    .data([0, 0.5, 1])
    .join('stop')
    .attr('offset', d => d * 100 + '%')
    .attr('stop-color', d => colorScale(d * maxCount));

  legend.append('rect')
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .attr('fill', 'url(#calendar-gradient)')
    .attr('rx', 2);

  legend.append('text')
    .attr('x', 0)
    .attr('y', -3)
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '8px')
    .text('0');

  legend.append('text')
    .attr('x', legendWidth)
    .attr('y', -3)
    .attr('text-anchor', 'end')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '8px')
    .text(maxCount);
}

// ============================================
// Decade Trajectory (Connected Scatter)
// ============================================
function renderDecadeTrajectory() {
  const container = document.getElementById('timeline-trajectory');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 30, right: 30, bottom: 50, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Calculate decade averages
  const decades = ['1990s', '2000s', '2010s', '2020s'];
  const decadeStarts = [1990, 2000, 2010, 2020];

  const data = decadeStarts.map((start, i) => {
    const startups = DATA.startups.filter(s => s.failureDecade === start);
    return {
      decade: decades[i],
      avgFunding: d3.mean(startups, s => s.fundingAmount) || 0,
      avgSurvival: d3.mean(startups, s => s.survivalYears) || 0,
      count: startups.length
    };
  }).filter(d => d.count > 0);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.avgFunding) * 1.2])
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.avgSurvival) * 1.2])
    .range([innerHeight, 0]);

  // Draw connecting line
  const line = d3.line()
    .x(d => x(d.avgFunding))
    .y(d => y(d.avgSurvival))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(data)
    .attr('d', line)
    .attr('fill', 'none')
    .attr('stroke', Utils.colors.lime)
    .attr('stroke-width', 2)
    .attr('stroke-opacity', 0.6);

  // Draw arrow head on last segment
  if (data.length > 1) {
    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    const angle = Math.atan2(
      y(last.avgSurvival) - y(prev.avgSurvival),
      x(last.avgFunding) - x(prev.avgFunding)
    );

    svg.append('polygon')
      .attr('points', '-6,-4 0,0 -6,4')
      .attr('fill', Utils.colors.lime)
      .attr('transform', `translate(${x(last.avgFunding)},${y(last.avgSurvival)}) rotate(${angle * 180 / Math.PI})`);
  }

  // Draw points
  svg.selectAll('circle')
    .data(data)
    .join('circle')
    .attr('cx', d => x(d.avgFunding))
    .attr('cy', d => y(d.avgSurvival))
    .attr('r', d => Math.sqrt(d.count) + 5)
    .attr('fill', Utils.colors.lime)
    .attr('fill-opacity', 0.7)
    .attr('stroke', Utils.colors.bgMain)
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('fill-opacity', 1);
      const html = `
        <div class="tooltip-title">${d.decade}</div>
        <div class="tooltip-row"><span class="tooltip-label">Avg Funding</span><span class="tooltip-value">$${d.avgFunding.toFixed(0)}M</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Avg Survival</span><span>${d.avgSurvival.toFixed(1)} yrs</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Count</span><span>${d.count}</span></div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('fill-opacity', 0.7);
      Utils.hideTooltip();
    });

  // Labels
  svg.selectAll('.decade-label')
    .data(data)
    .join('text')
    .attr('x', d => x(d.avgFunding))
    .attr('y', d => y(d.avgSurvival) - Math.sqrt(d.count) - 10)
    .attr('text-anchor', 'middle')
    .attr('fill', Utils.colors.textSecondary)
    .attr('font-size', '10px')
    .attr('font-weight', '500')
    .text(d => d.decade);

  // Axes
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => '$' + d + 'M'));
  Utils.styleAxis(xAxis);

  svg.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 35)
    .attr('text-anchor', 'middle')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '10px')
    .text('Avg Funding');

  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5));
  Utils.styleAxis(yAxis);

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -35)
    .attr('text-anchor', 'middle')
    .attr('fill', Utils.colors.textTertiary)
    .attr('font-size', '10px')
    .text('Avg Survival (years)');
}

// ============================================
// Horizon Chart (Multi-Metric Time Series)
// ============================================
function renderHorizonChart() {
  const container = document.getElementById('timeline-horizon');
  if (!container) return;

  const { width, height } = Utils.getChartDimensions(container);
  const margin = { top: 20, right: 20, bottom: 30, left: 80 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Metrics to display
  const metrics = [
    { key: 'count', label: 'Failures', color: Utils.colors.coral },
    { key: 'funding', label: 'Capital Lost', color: Utils.colors.amber },
    { key: 'avgSurvival', label: 'Avg Survival', color: Utils.colors.emerald }
  ];

  const bandHeight = innerHeight / metrics.length;

  // Prepare data
  const years = Object.keys(DATA.byFailureYear).map(Number).sort((a, b) => a - b);
  const data = years.map(year => ({
    year,
    count: DATA.byFailureYear[year].count,
    funding: DATA.byFailureYear[year].totalFunding,
    avgSurvival: DATA.byFailureYear[year].avgSurvival || 0
  }));

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain(d3.extent(years))
    .range([0, innerWidth]);

  metrics.forEach((metric, i) => {
    const g = svg.append('g')
      .attr('transform', `translate(0, ${i * bandHeight})`);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d[metric.key])])
      .range([bandHeight - 5, 0]);

    const area = d3.area()
      .x(d => x(d.year))
      .y0(bandHeight - 5)
      .y1(d => y(d[metric.key]))
      .curve(d3.curveMonotoneX);

    // Draw area with layered bands for horizon effect
    [0.3, 0.5, 0.7, 1].forEach((opacity, j) => {
      const threshold = (j + 1) / 4;
      g.append('path')
        .datum(data)
        .attr('d', area)
        .attr('fill', metric.color)
        .attr('fill-opacity', opacity * 0.3)
        .attr('clip-path', `inset(${(1 - threshold) * 100}% 0 0 0)`);
    });

    // Line on top
    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d[metric.key]))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', metric.color)
      .attr('stroke-width', 1.5);

    // Label
    g.append('text')
      .attr('x', -8)
      .attr('y', bandHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', metric.color)
      .attr('font-size', '10px')
      .text(metric.label);

    // Separator line
    if (i < metrics.length - 1) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', bandHeight)
        .attr('y2', bandHeight)
        .attr('stroke', Utils.colors.border)
        .attr('stroke-opacity', 0.5);
    }
  });

  // X axis
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format('d')));
  Utils.styleAxis(xAxis);
}
