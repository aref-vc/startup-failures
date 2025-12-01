/* Hero Section - Visual and Animations */

function initHero() {
  renderHeroVisual();
  animateHeroStats();
}

// Animated bubble chart showing failure reasons
function renderHeroVisual() {
  const container = document.getElementById('hero-visual');
  if (!container) return;

  const width = container.offsetWidth;
  const height = container.offsetHeight;

  // Prepare data - failure reasons as bubbles
  const reasonData = Object.entries(DATA.byReason)
    .map(([reason, data]) => ({
      name: reason,
      value: data.count,
      percentage: data.percentage,
      avgFunding: data.avgFunding,
      avgSurvival: data.avgSurvival
    }))
    .sort((a, b) => b.value - a.value);

  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Create bubble pack layout
  const pack = d3.pack()
    .size([width, height])
    .padding(8);

  const root = d3.hierarchy({ children: reasonData })
    .sum(d => d.value);

  const nodes = pack(root).leaves();

  // Draw bubbles
  const bubbles = svg.selectAll('g')
    .data(nodes)
    .join('g')
    .attr('transform', d => `translate(${d.x},${d.y})`);

  // Circles
  bubbles.append('circle')
    .attr('r', 0)
    .attr('fill', d => Utils.getReasonColor(d.data.name))
    .attr('fill-opacity', 0.7)
    .attr('stroke', d => Utils.getReasonColor(d.data.name))
    .attr('stroke-width', 2)
    .attr('stroke-opacity', 0.9)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('fill-opacity', 0.9)
        .attr('transform', 'scale(1.1)');

      const html = `
        <div class="tooltip-title">${d.data.name}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Startups</span>
          <span class="tooltip-value">${d.data.value}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">% of Total</span>
          <span>${d.data.percentage}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Funding</span>
          <span>$${d.data.avgFunding.toFixed(0)}M</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Survival</span>
          <span>${d.data.avgSurvival.toFixed(1)} yrs</span>
        </div>
      `;
      Utils.showTooltip(html, event.pageX, event.pageY);
    })
    .on('mouseleave', function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('fill-opacity', 0.7)
        .attr('transform', 'scale(1)');
      Utils.hideTooltip();
    })
    .transition()
    .duration(800)
    .delay((d, i) => i * 50)
    .attr('r', d => d.r);

  // Labels for larger bubbles
  bubbles.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', Utils.colors.bgMain)
    .attr('font-size', d => Math.min(d.r / 3, 14) + 'px')
    .attr('font-weight', '500')
    .attr('opacity', 0)
    .text(d => d.r > 35 ? Utils.truncate(d.data.name, 10) : '')
    .transition()
    .duration(600)
    .delay((d, i) => 400 + i * 50)
    .attr('opacity', 1);

  // Value labels
  bubbles.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('y', d => d.r > 50 ? 14 : 0)
    .attr('fill', Utils.colors.bgMain)
    .attr('font-size', d => Math.min(d.r / 4, 12) + 'px')
    .attr('font-weight', '600')
    .attr('opacity', 0)
    .text(d => d.r > 25 ? d.data.value : '')
    .transition()
    .duration(600)
    .delay((d, i) => 500 + i * 50)
    .attr('opacity', 0.8);
}

// Animate hero stat numbers
function animateHeroStats() {
  const stats = [
    { id: 'hero-startups', value: DATA.summary.totalStartups, format: 'number' },
    { id: 'hero-funding', value: DATA.summary.totalFundingLost, format: 'money' },
    { id: 'hero-years', value: DATA.summary.avgSurvivalYears, format: 'decimal' },
    { id: 'hero-count', value: DATA.summary.totalStartups, format: 'number' }
  ];

  stats.forEach(stat => {
    const el = document.getElementById(stat.id);
    if (!el) return;

    animateValue(el, stat.value, stat.format);
  });
}

function animateValue(element, target, format) {
  const duration = 2000;
  const start = 0;
  const startTime = performance.now();

  const formatValue = (val) => {
    switch (format) {
      case 'money':
        return '$' + (val / 1000).toFixed(val >= 1000 ? 0 : 1) + 'B';
      case 'decimal':
        return val.toFixed(1);
      default:
        return Math.round(val).toLocaleString();
    }
  };

  const update = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;

    element.textContent = formatValue(current);

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  };

  requestAnimationFrame(update);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initHero);
