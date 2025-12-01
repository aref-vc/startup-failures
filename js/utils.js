/* Startup Failures Dashboard - Utility Functions */

const Utils = {
  // ============================================
  // DOM Helpers
  // ============================================

  $(selector) {
    return document.querySelector(selector);
  },

  $$(selector) {
    return document.querySelectorAll(selector);
  },

  // ============================================
  // Number Formatting
  // ============================================

  formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return new Intl.NumberFormat().format(Math.round(num));
  },

  formatMoney(num) {
    if (num >= 1000) return '$' + (num / 1000).toFixed(1) + 'B';
    return '$' + num.toFixed(0) + 'M';
  },

  formatPercent(num, decimals = 1) {
    return num.toFixed(decimals) + '%';
  },

  formatYears(num) {
    return num.toFixed(1) + ' yrs';
  },

  // ============================================
  // Color Palette
  // ============================================

  colors: {
    lime: '#BEFF00',
    cyan: '#00BAFE',
    amber: '#FFC000',
    emerald: '#00DE71',
    coral: '#F04E50',
    purple: '#9B59B6',
    blue: '#3498DB',
    orange: '#E67E22',
    text: '#FFFFE3',
    textSecondary: '#E6E6CE',
    textTertiary: '#B3B3A3',
    bgMain: '#10100E',
    bgElevated: '#1A1A18',
    bgAccent: '#242422',
    border: '#2A2A28',
    borderLight: '#3A3A38'
  },

  // Chart color scales
  chartColors: ['#BEFF00', '#00BAFE', '#FFC000', '#00DE71', '#F04E50', '#9B59B6', '#3498DB', '#E67E22'],

  // Sector-specific colors
  sectorColors: {
    'Finance and Insurance': '#00DE71',
    'Food Services': '#FFC000',
    'Health Care': '#F04E50',
    'Manufacturing': '#9B59B6',
    'Retail Trade': '#00BAFE',
    'Information Tech': '#BEFF00'
  },

  // Failure reason colors (gradient from green to red based on severity)
  reasonColors: {
    'Giants': '#F04E50',
    'Competition': '#E67E22',
    'No Budget': '#FFC000',
    'Poor Market Fit': '#FF6B6B',
    'Execution Flaws': '#9B59B6',
    'Monetization Failure': '#3498DB',
    'Trend Shifts': '#00BAFE',
    'Niche Limits': '#00DE71',
    'Acquisition Stagnation': '#BEFF00',
    'Platform Dependency': '#95A5A6',
    'Toxicity/Trust Issues': '#E74C3C',
    'Regulatory Pressure': '#8E44AD',
    'Overhype': '#F39C12'
  },

  getColor(index) {
    return this.chartColors[index % this.chartColors.length];
  },

  getSectorColor(sector) {
    return this.sectorColors[sector] || this.colors.lime;
  },

  getReasonColor(reason) {
    return this.reasonColors[reason] || this.colors.lime;
  },

  // ============================================
  // Tooltip
  // ============================================

  tooltip: null,

  initTooltip() {
    if (this.tooltip) return;

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip';
    document.body.appendChild(this.tooltip);
  },

  showTooltip(html, x, y) {
    if (!this.tooltip) this.initTooltip();

    this.tooltip.innerHTML = html;
    this.tooltip.classList.add('visible');

    // Position with bounds checking
    const rect = this.tooltip.getBoundingClientRect();
    const padding = 12;

    let left = x + padding;
    let top = y + padding;

    if (left + rect.width > window.innerWidth - padding) {
      left = x - rect.width - padding;
    }
    if (top + rect.height > window.innerHeight - padding) {
      top = y - rect.height - padding;
    }
    if (left < padding) left = padding;
    if (top < padding) top = padding;

    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';
  },

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.classList.remove('visible');
    }
  },

  // ============================================
  // Tab Navigation
  // ============================================

  currentTab: 'overview',

  initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });
  },

  switchTab(tab) {
    this.currentTab = tab;

    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tab);
    });

    // Trigger tab-specific init if not already initialized
    const initFn = window[`init${tab.charAt(0).toUpperCase() + tab.slice(1)}`];
    if (initFn && typeof initFn === 'function') {
      initFn();
    }
  },

  // ============================================
  // Animated Counter
  // ============================================

  animateCounter(element, target, duration = 1500, format = 'number') {
    const start = 0;
    const startTime = performance.now();

    const formatValue = (val) => {
      switch (format) {
        case 'money': return this.formatMoney(val);
        case 'years': return this.formatYears(val);
        case 'percent': return this.formatPercent(val);
        default: return this.formatNumber(val);
      }
    };

    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;

      element.textContent = formatValue(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  },

  // ============================================
  // D3 Helpers
  // ============================================

  // Standard margins for charts
  margin: { top: 30, right: 20, bottom: 40, left: 50 },
  marginSmall: { top: 20, right: 15, bottom: 30, left: 40 },

  // Get dimensions for a chart container
  getChartDimensions(container, small = false) {
    const rect = container.getBoundingClientRect();
    const m = small ? this.marginSmall : this.margin;
    return {
      width: rect.width,
      height: rect.height,
      innerWidth: rect.width - m.left - m.right,
      innerHeight: rect.height - m.top - m.bottom,
      margin: m
    };
  },

  // Create SVG with standard setup
  createSvg(container, width, height, margin) {
    const m = margin || this.margin;
    d3.select(container).selectAll('svg').remove();

    return d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${m.left},${m.top})`);
  },

  // Standard axis styling
  styleAxis(axis) {
    axis.selectAll('line').attr('stroke', this.colors.border);
    axis.selectAll('path').attr('stroke', this.colors.border);
    axis.selectAll('text')
      .attr('fill', this.colors.textTertiary)
      .style('font-size', '10px');
  },

  // Add grid lines
  addGridLines(svg, xScale, yScale, width, height) {
    // Horizontal grid
    svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale)
        .tickSize(-width)
        .tickFormat('')
      )
      .selectAll('line')
      .attr('stroke', this.colors.border)
      .attr('stroke-opacity', 0.5);

    svg.selectAll('.grid .domain').remove();
  },

  // ============================================
  // Data Helpers
  // ============================================

  // Group array by key
  groupBy(array, key) {
    return array.reduce((result, item) => {
      const k = typeof key === 'function' ? key(item) : item[key];
      (result[k] = result[k] || []).push(item);
      return result;
    }, {});
  },

  // Get unique values
  unique(array, key) {
    if (key) {
      return [...new Set(array.map(item => item[key]))];
    }
    return [...new Set(array)];
  },

  // Sort by key
  sortBy(array, key, desc = false) {
    return [...array].sort((a, b) => {
      const va = typeof key === 'function' ? key(a) : a[key];
      const vb = typeof key === 'function' ? key(b) : b[key];
      return desc ? vb - va : va - vb;
    });
  },

  // Sum values
  sum(array, key) {
    return array.reduce((sum, item) => {
      const val = typeof key === 'function' ? key(item) : item[key];
      return sum + (val || 0);
    }, 0);
  },

  // Average values
  avg(array, key) {
    if (array.length === 0) return 0;
    return this.sum(array, key) / array.length;
  },

  // Truncate text
  truncate(str, maxLen = 20) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '...' : str;
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  Utils.initTooltip();
  Utils.initTabs();
});
