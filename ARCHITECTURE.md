# Startup Failures Dashboard - Architecture

## Overview

A 2x2 tabbed dashboard analyzing 403+ failed startups across multiple dimensions using the Dark Electric theme. Works without localhost (file:// protocol) with embedded data.

## Technical Stack

- **Visualization**: D3.js v7
- **Styling**: Pure CSS with custom properties
- **Data**: Pre-processed and embedded via build script
- **No Build Tools Required**: Just Node.js for data processing

## Project Structure

```
Startup Failures/
├── Data/                    # Source CSV files (7 files, 403 startups)
├── css/
│   └── styles.css           # Dark Electric theme
├── js/
│   ├── data.js              # Generated embedded data
│   ├── utils.js             # Shared utilities
│   └── tabs/
│       ├── overview.js      # Tab 1: Key metrics, treemap, heatmap
│       ├── sectors.js       # Tab 2: Radar chart, box plots, bars
│       ├── funding.js       # Tab 3: Scatter plot, top funded, area
│       └── timeline.js      # Tab 4: Timeline, decades, case studies
├── build-data.js            # Node.js data processor
├── index.html               # Main entry point
└── ARCHITECTURE.md          # This file
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

## Dashboard Tabs

### Tab 1: Overview
- **Hero Stats**: Total startups, capital lost, avg survival, peak year
- **Failure Reasons Treemap**: 13 reasons sized by frequency
- **Co-occurrence Heatmap**: Which reasons appear together
- **Yearly Timeline**: Failures over time with annotations

### Tab 2: Sectors
- **Sector Summary Cards**: Count, avg funding, avg survival per sector
- **Radar Chart**: Failure profiles overlaid by sector
- **Survival Box Plots**: Distribution by sector
- **Horizontal Bars**: Sector comparison by count

### Tab 3: Funding
- **Funding Tier Cards**: 7 tiers from Unfunded to Mega
- **Scatter Plot**: Funding vs Survival (log scale) with R² trend
- **Top Funded List**: Ranked failures by capital raised
- **Cumulative Area Chart**: Capital lost over time

### Tab 4: Timeline
- **Main Timeline**: Scatter plot by failure year, sized by funding
- **Decade Comparison**: Stacked bars showing reason evolution
- **Era Cards**: Dot-com, Web 2.0, Mobile Era, Pandemic stats
- **Notable Failures**: Case studies with takeaways

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

## Key Insights Available

1. **Most deadly failure reasons**: Giants (competition) dominates
2. **Sector vulnerability profiles**: Which industries fail for which reasons
3. **Money paradox**: R² shows weak correlation between funding and survival
4. **Era patterns**: How failure reasons evolved over decades
5. **Co-occurrence clusters**: Which failure reasons travel together
6. **Outlier spotlight**: Most spectacular failures and lessons learned

## Usage

1. Open `index.html` directly in browser (file:// protocol works)
2. Click tabs to navigate between analysis views
3. Hover over charts for detailed tooltips
4. All data is embedded - works offline

## Regenerating Data

If CSV files are updated:
```bash
node build-data.js
```
Then refresh the browser.
