# Startup Failures Dashboard

An interactive data visualization dashboard analyzing 403+ failed startups, exploring patterns in failure reasons, funding, sectors, and temporal trends.

![Dark Electric Theme](https://img.shields.io/badge/theme-Dark%20Electric-10100E)
![D3.js v7](https://img.shields.io/badge/D3.js-v7-orange)
![No Server Required](https://img.shields.io/badge/server-not%20required-green)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/startup-failures.git

# Open directly in browser (no server needed)
open index.html
```

That's it. The dashboard works with the `file://` protocol - no localhost required.

## Features

- **40 Interactive Charts** across 5 analysis tabs
- **Dark Electric Theme** with lime/cyan accent colors
- **Offline-Ready** - all data embedded, no external dependencies
- **Responsive Grid Layouts** - 2x4 and 4x2 chart arrangements
- **Interactive Visualizations** - tooltips, draggable force graphs, hover effects

## Dashboard Sections

### Overview
Key metrics, failure reason treemap, co-occurrence heatmap, and distribution charts.

### Patterns
Deep analytical views including correlation analysis, survival curves, funding-survival scatter plots with R² regression, and force-directed reason network graphs.

### Sectors
Industry breakdown with radar charts comparing failure profiles, survival distributions, funding treemaps, and sector-specific failure reason analysis.

### Funding
Capital analysis with tier breakdowns, scatter plots, outlier detection, ROI histograms, and temporal funding trends.

### Timeline
Temporal analysis showing failure acceleration, decade comparisons, era-based statistics, and notable case studies.

## Data

The dashboard analyzes 403 failed startups from 7 CSV source files:

| Field | Description |
|-------|-------------|
| Name | Startup name |
| Sector | Industry category (6 sectors) |
| Years of Operation | Founding to failure year |
| Funding | Capital raised (normalized to millions) |
| Failure Reasons | 13 binary flags for failure causes |
| Takeaway | Lessons learned |

### Failure Reasons Tracked
1. Giants (competition from large players)
2. Product-Market Fit
3. Cash Burn
4. Expansion Issues
5. Legal/Regulatory
6. Team Problems
7. Business Model
8. Technical Issues
9. Market Timing
10. Customer Acquisition
11. Pivoting Failures
12. External Factors
13. Fraud/Misconduct

## Regenerating Data

If you update the source CSV files in `Data/`:

```bash
node build-data.js
```

Then refresh the browser.

## Tech Stack

- **D3.js v7** - All visualizations
- **Pure CSS** - No frameworks, custom properties for theming
- **Vanilla JavaScript** - No build tools required
- **Node.js** - Data preprocessing only (one-time build)

## Project Structure

```
├── Data/              # Source CSV files
├── css/styles.css     # Dark Electric theme
├── js/
│   ├── data.js        # Generated embedded data
│   ├── utils.js       # Shared utilities
│   └── tabs/          # Tab-specific chart code
├── index.html         # Entry point
└── build-data.js      # Data processor
```

## Browser Support

Modern browsers with ES6+ and CSS Grid support:
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Related

This project is part of a data visualization series exploring datasets through interactive dashboards with the Dark Electric theme.
