# Startup Failures Dashboard - Architecture

## Overview

A comprehensive tabbed dashboard analyzing 403+ failed startups across multiple dimensions using the Dark Electric theme. Features 5 analysis tabs with 8 charts each, providing deep analytical insights. Works without localhost (file:// protocol) with embedded data.

## Technical Stack

- **Visualization**: D3.js v7 (treemaps, scatter plots, force graphs, bar charts, area charts, etc.)
- **Styling**: Pure CSS with custom properties and CSS Grid layouts
- **Data**: Pre-processed and embedded via build script
- **No Build Tools Required**: Just Node.js for data processing

## Project Structure

```
Startup Failures/
├── Data/                    # Source CSV files (7 files, 403 startups)
├── css/
│   └── styles.css           # Dark Electric theme + grid layouts
├── js/
│   ├── data.js              # Generated embedded data
│   ├── utils.js             # Shared utilities
│   └── tabs/
│       ├── overview.js      # Tab 1: Key metrics & distributions (8 charts)
│       ├── patterns.js      # Tab 2: Deep pattern analysis (8 charts)
│       ├── sectors.js       # Tab 3: Sector breakdown (8 charts)
│       ├── funding.js       # Tab 4: Funding analysis (8 charts)
│       └── timeline.js      # Tab 5: Temporal analysis (8 charts)
├── build-data.js            # Node.js data processor
├── index.html               # Main entry point
├── ARCHITECTURE.md          # This file
└── README.md                # Project documentation
```

## Data Pipeline

### Source Files
- 7 CSV files with startup data across sectors
- Core fields: Name, Sector, Years of Operation
- Extended fields: Funding, 13 binary failure reason flags, Takeaway

### Build Process
```bash
node build-data.js
```

Transforms:
1. Parses "Years of Operation" → foundingYear, failureYear, survivalYears
2. Parses "How Much They Raised" → fundingAmount (normalized to millions)
3. Normalizes sector names and failure reason columns
4. Generates aggregations by sector, reason, funding tier, year, decade
5. Creates co-occurrence matrix for failure reasons
6. Outputs embedded `js/data.js` module

### Data Schema (DATA object)

```javascript
DATA = {
  startups: [...],           // All 403 startups with full details
  failureReasons: [...],     // 13 reason names
  bySector: {...},           // Aggregations by sector
  byReason: {...},           // Aggregations by failure reason
  coOccurrence: {...},       // 13x13 reason co-occurrence matrix
  byFundingTier: {...},      // Aggregations by funding tier
  byFailureYear: {...},      // Aggregations by year
  byDecade: {...},           // Aggregations by decade
  topFunded: [...],          // Top 30 most funded failures
  notableFailures: [...],    // Case study candidates
  summary: {...}             // Quick stats
}
```

## Dashboard Layout

### Hero Section
- Total startups analyzed
- Total capital lost
- Average survival years
- Peak failure year

### Tab Navigation
5 tabs with lazy initialization for performance. Each tab contains 8 charts in a grid layout.

## Dashboard Tabs (40 Charts Total)

### Tab 1: Overview (grid-2x4)
| Chart | Description |
|-------|-------------|
| Hero Stats | Total startups, capital lost, avg survival, peak year |
| Failure Treemap | 13 reasons sized by frequency with color coding |
| Co-occurrence Heatmap | Which failure reasons appear together |
| Yearly Timeline | Failures over time with trend visualization |
| Reason-Survival Analysis | Bar chart showing avg survival by failure reason |
| Funding Distribution | Histogram of funding amounts in bins |
| Sector Breakdown | Donut chart of sector distribution |
| Reason Count Distribution | Failure complexity (reasons per startup) |

### Tab 2: Patterns (grid-4x2)
| Chart | Description |
|-------|-------------|
| Correlation Analysis | Reason co-occurrence patterns |
| Survival Curves | Distribution curves by factor |
| Combination Analysis | Common failure reason combinations |
| Funding-Survival Scatter | Log-scale scatter with trend regression (R²) |
| Sector-Reason Matrix | Which sectors fail for which reasons |
| Efficiency Analysis | Funding efficiency metrics |
| Reason Network | Force-directed graph of reason clusters |
| Key Insights | Analytical takeaways |

### Tab 3: Sectors (grid-2x4)
| Chart | Description |
|-------|-------------|
| Sector Summary | Count, avg funding, avg survival cards |
| Radar Chart | Failure profiles overlaid by sector |
| Survival Box Plots | Survival distribution by sector |
| Horizontal Bars | Sector comparison by failure count |
| Funding Treemap | Capital raised by sector |
| Stacked Timeline | Sector failures over time |
| Reason Dominance | Primary failure reason per sector |
| Sector Comparison Table | Side-by-side metrics comparison |

### Tab 4: Funding (grid-2x4)
| Chart | Description |
|-------|-------------|
| Funding Tier Cards | 7 tiers from Unfunded to Mega |
| Funding-Survival Scatter | Log scale with R² trend line |
| Top Funded List | Ranked failures by capital raised |
| Cumulative Area Chart | Capital lost over time |
| Tier Survival Analysis | Grouped bar comparing survival by tier |
| Funding by Reason | Which reasons affect well-funded startups |
| Outlier Analysis | Insight cards for funding anomalies |
| Funding ROI | Efficiency histogram (funding per survival year) |

### Tab 5: Timeline (grid-2x4)
| Chart | Description |
|-------|-------------|
| Main Timeline | Scatter plot by year, sized by funding |
| Decade Comparison | Stacked bars showing reason evolution |
| Era Cards | Dot-com, Web 2.0, Mobile, Pandemic stats |
| Notable Failures | Case studies with takeaways |
| Failure Acceleration | Year-over-year change rate |
| Funding Trend | Area chart of capital lost over time |
| Survival Trend | Cohort analysis by founding year |
| Decade Statistics | Comparative table with key insights |

## Design System

### Color Palette
```css
--bg-main: #10100E;
--lime: #BEFF00;      /* Primary accent */
--cyan: #00BAFE;      /* Secondary accent */
--amber: #FFC000;     /* Warning/money */
--emerald: #00DE71;   /* Success */
--coral: #F04E50;     /* Danger/failure */
--purple: #9B59B6;    /* Tertiary */
```

### Sector Colors
- Finance: Emerald (#00DE71)
- Food Services: Amber (#FFC000)
- Health Care: Coral (#F04E50)
- Manufacturing: Purple (#9B59B6)
- Retail Trade: Cyan (#00BAFE)
- Information Tech: Lime (#BEFF00)

### Grid Layouts
```css
.grid-2x4  /* 2 columns, 4 rows */
.grid-4x2  /* 4 columns, 2 rows */
.grid-3x2  /* 3 columns, 2 rows */
```

## Key Insights Available

1. **Most deadly failure reasons**: Giants (competition) dominates
2. **Sector vulnerability profiles**: Which industries fail for which reasons
3. **Money paradox**: R² shows weak correlation between funding and survival
4. **Era patterns**: How failure reasons evolved over decades
5. **Co-occurrence clusters**: Which failure reasons travel together (network graph)
6. **Outlier spotlight**: Most spectacular failures and lessons learned
7. **Funding efficiency**: ROI analysis and tier comparisons
8. **Temporal acceleration**: When failure rates increased most dramatically

## Usage

1. Open `index.html` directly in browser (file:// protocol works)
2. Click tabs to navigate between analysis views
3. Hover over charts for detailed tooltips
4. Drag nodes in network graphs for exploration
5. All data is embedded - works offline

## Regenerating Data

If CSV files are updated:
```bash
node build-data.js
```
Then refresh the browser.

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- D3.js v7 requires ES6+ support
- CSS Grid for layouts
- No polyfills required for current browser versions
