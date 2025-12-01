// Build script to process Startup Failures CSV files into embedded JavaScript data
const fs = require('fs');
const path = require('path');

// Standardized failure reason columns
const FAILURE_REASONS = [
  'Giants',
  'No Budget',
  'Competition',
  'Poor Market Fit',
  'Acquisition Stagnation',
  'Platform Dependency',
  'Monetization Failure',
  'Niche Limits',
  'Execution Flaws',
  'Trend Shifts',
  'Toxicity/Trust Issues',
  'Regulatory Pressure',
  'Overhype'
];

// Parse CSV handling quoted fields
function parseCSV(content) {
  const lines = content.replace(/\r/g, '').trim().split('\n');
  const headers = parseCSVLine(lines[0]);

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = values[i] ? values[i].trim() : '';
    });
    return row;
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Parse "Years of Operation" - handles both formats:
// - "2 (2010-2012)" -> { survivalYears: 2, foundingYear: 2010, failureYear: 2012 }
// - "2010-2023" -> { survivalYears: 13, foundingYear: 2010, failureYear: 2023 }
function parseYearsOfOperation(str) {
  if (!str) return { survivalYears: 0, foundingYear: null, failureYear: null };

  // Format: "N (YYYY-YYYY)"
  const match1 = str.match(/(\d+)\s*\((\d{4})-(\d{4})\)/);
  if (match1) {
    return {
      survivalYears: parseInt(match1[1]),
      foundingYear: parseInt(match1[2]),
      failureYear: parseInt(match1[3])
    };
  }

  // Format: "YYYY-YYYY"
  const match2 = str.match(/(\d{4})-(\d{4})/);
  if (match2) {
    const foundingYear = parseInt(match2[1]);
    const failureYear = parseInt(match2[2]);
    return {
      survivalYears: failureYear - foundingYear,
      foundingYear,
      failureYear
    };
  }

  return { survivalYears: 0, foundingYear: null, failureYear: null };
}

// Parse funding amounts - handles: "$655M", "$1B", "$1.5M (est.)", "$0 (Coinbase-funded)"
function parseFunding(str) {
  if (!str) return { fundingAmount: 0, isEstimate: false, isCorporateFunded: false };

  const isEstimate = str.toLowerCase().includes('est.');
  const isCorporateFunded = str.includes('-funded)') || str.includes('funded)');

  // Handle corporate funded as $0
  if (isCorporateFunded && str.includes('$0')) {
    return { fundingAmount: 0, isEstimate: false, isCorporateFunded: true };
  }

  // Extract number and unit
  const match = str.match(/\$?([\d.]+)\s*(B|M|K)?/i);
  if (!match) return { fundingAmount: 0, isEstimate, isCorporateFunded };

  let amount = parseFloat(match[1]);
  const unit = (match[2] || 'M').toUpperCase();

  // Convert to millions
  if (unit === 'B') amount *= 1000;
  else if (unit === 'K') amount /= 1000;

  return { fundingAmount: amount, isEstimate, isCorporateFunded };
}

// Categorize funding into tiers
function getFundingTier(amount) {
  if (amount === 0) return 'Unfunded';
  if (amount < 1) return 'Pre-Seed';
  if (amount < 10) return 'Seed';
  if (amount < 50) return 'Series A';
  if (amount < 100) return 'Series B';
  if (amount < 500) return 'Series C+';
  return 'Mega';
}

// Read all sector-specific CSV files
const dataDir = './Data';
const sectorFiles = [
  'Startup Failure (Finance and Insurance).csv',
  'Startup Failure (Food and services).csv',
  'Startup Failure (Health Care).csv',
  'Startup Failure (Manufactures).csv',
  'Startup Failure (Retail Trade).csv',
  'Startup Failures (Information Sector).csv'
];

console.log('Processing startup failures data...\n');

const allStartups = [];
const seenNames = new Set();

sectorFiles.forEach(file => {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Warning: ${file} not found`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);

  console.log(`Processing ${file}: ${rows.length} startups`);

  rows.forEach(row => {
    // Skip duplicates
    if (seenNames.has(row.Name)) return;
    seenNames.add(row.Name);

    // Parse dates
    const years = parseYearsOfOperation(row['Years of Operation']);

    // Parse funding
    const funding = parseFunding(row['How Much They Raised']);

    // Normalize sector name
    let sector = row.Sector || '';
    if (sector === 'Accommodation and Food Services') sector = 'Food Services';
    if (sector === 'Information') sector = 'Information Tech';

    // Extract failure reasons (handle Food Services different column name)
    const failureReasons = {};
    let totalReasons = 0;

    FAILURE_REASONS.forEach(reason => {
      let value = 0;

      // Handle "High Operational Costs" -> "No Budget" mapping for Food Services
      if (reason === 'No Budget' && row['High Operational Costs'] !== undefined) {
        value = parseInt(row['High Operational Costs']) || 0;
      } else {
        value = parseInt(row[reason]) || 0;
      }

      failureReasons[reason] = value;
      totalReasons += value;
    });

    // Build startup record
    const startup = {
      name: row.Name,
      sector: sector,
      survivalYears: years.survivalYears,
      foundingYear: years.foundingYear,
      failureYear: years.failureYear,
      foundingDecade: years.foundingYear ? Math.floor(years.foundingYear / 10) * 10 : null,
      failureDecade: years.failureYear ? Math.floor(years.failureYear / 10) * 10 : null,
      whatTheyDid: row['What They Did'] || '',
      fundingAmount: funding.fundingAmount,
      fundingTier: getFundingTier(funding.fundingAmount),
      fundingRaw: row['How Much They Raised'] || '',
      isEstimate: funding.isEstimate,
      isCorporateFunded: funding.isCorporateFunded,
      whyTheyFailed: row['Why They Failed'] || '',
      takeaway: row['Takeaway'] || '',
      failureReasons: failureReasons,
      totalFailureReasons: totalReasons,
      primaryReason: null // Will be computed below
    };

    // Find primary reason (first one that's 1)
    for (const reason of FAILURE_REASONS) {
      if (failureReasons[reason] === 1) {
        startup.primaryReason = reason;
        break;
      }
    }

    allStartups.push(startup);
  });
});

console.log(`\nTotal unique startups: ${allStartups.length}`);

// ============================================
// AGGREGATIONS
// ============================================

// By Sector
const bySector = {};
allStartups.forEach(s => {
  if (!bySector[s.sector]) {
    bySector[s.sector] = {
      sector: s.sector,
      count: 0,
      totalFunding: 0,
      totalSurvival: 0,
      startups: [],
      reasonCounts: {}
    };
    FAILURE_REASONS.forEach(r => bySector[s.sector].reasonCounts[r] = 0);
  }
  bySector[s.sector].count++;
  bySector[s.sector].totalFunding += s.fundingAmount;
  bySector[s.sector].totalSurvival += s.survivalYears;
  bySector[s.sector].startups.push(s.name);
  FAILURE_REASONS.forEach(r => {
    bySector[s.sector].reasonCounts[r] += s.failureReasons[r];
  });
});

// Compute averages
Object.values(bySector).forEach(s => {
  s.avgFunding = s.count > 0 ? +(s.totalFunding / s.count).toFixed(2) : 0;
  s.avgSurvival = s.count > 0 ? +(s.totalSurvival / s.count).toFixed(2) : 0;
  delete s.startups; // Remove for smaller output
});

// By Failure Reason
const byReason = {};
FAILURE_REASONS.forEach(reason => {
  const affected = allStartups.filter(s => s.failureReasons[reason] === 1);
  byReason[reason] = {
    reason: reason,
    count: affected.length,
    percentage: +(affected.length / allStartups.length * 100).toFixed(1),
    avgFunding: affected.length > 0
      ? +(affected.reduce((sum, s) => sum + s.fundingAmount, 0) / affected.length).toFixed(2)
      : 0,
    avgSurvival: affected.length > 0
      ? +(affected.reduce((sum, s) => sum + s.survivalYears, 0) / affected.length).toFixed(2)
      : 0,
    bySector: {}
  };

  // Count by sector for this reason
  Object.keys(bySector).forEach(sector => {
    byReason[reason].bySector[sector] = affected.filter(s => s.sector === sector).length;
  });
});

// Co-occurrence matrix (which reasons appear together)
const coOccurrence = {};
FAILURE_REASONS.forEach(r1 => {
  coOccurrence[r1] = {};
  FAILURE_REASONS.forEach(r2 => {
    const count = allStartups.filter(s =>
      s.failureReasons[r1] === 1 && s.failureReasons[r2] === 1
    ).length;
    coOccurrence[r1][r2] = count;
  });
});

// By Funding Tier
const fundingTiers = ['Unfunded', 'Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Mega'];
const byFundingTier = {};
fundingTiers.forEach(tier => {
  const startups = allStartups.filter(s => s.fundingTier === tier);
  byFundingTier[tier] = {
    tier: tier,
    count: startups.length,
    avgSurvival: startups.length > 0
      ? +(startups.reduce((sum, s) => sum + s.survivalYears, 0) / startups.length).toFixed(2)
      : 0,
    totalFunding: startups.reduce((sum, s) => sum + s.fundingAmount, 0),
    topReason: null
  };

  // Find top reason for this tier
  const reasonCounts = {};
  FAILURE_REASONS.forEach(r => reasonCounts[r] = 0);
  startups.forEach(s => {
    FAILURE_REASONS.forEach(r => reasonCounts[r] += s.failureReasons[r]);
  });
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
  byFundingTier[tier].topReason = topReason ? topReason[0] : null;
});

// By Year (failure year)
const byFailureYear = {};
allStartups.forEach(s => {
  if (!s.failureYear) return;
  if (!byFailureYear[s.failureYear]) {
    byFailureYear[s.failureYear] = {
      year: s.failureYear,
      count: 0,
      totalFunding: 0,
      startups: []
    };
  }
  byFailureYear[s.failureYear].count++;
  byFailureYear[s.failureYear].totalFunding += s.fundingAmount;
  byFailureYear[s.failureYear].startups.push(s.name);
});

// By Decade
const byDecade = {};
allStartups.forEach(s => {
  if (!s.failureDecade) return;
  if (!byDecade[s.failureDecade]) {
    byDecade[s.failureDecade] = {
      decade: s.failureDecade,
      count: 0,
      totalFunding: 0,
      reasonCounts: {}
    };
    FAILURE_REASONS.forEach(r => byDecade[s.failureDecade].reasonCounts[r] = 0);
  }
  byDecade[s.failureDecade].count++;
  byDecade[s.failureDecade].totalFunding += s.fundingAmount;
  FAILURE_REASONS.forEach(r => {
    byDecade[s.failureDecade].reasonCounts[r] += s.failureReasons[r];
  });
});

// Top funded failures
const topFunded = [...allStartups]
  .sort((a, b) => b.fundingAmount - a.fundingAmount)
  .slice(0, 30)
  .map(s => ({
    name: s.name,
    sector: s.sector,
    fundingAmount: s.fundingAmount,
    survivalYears: s.survivalYears,
    primaryReason: s.primaryReason,
    takeaway: s.takeaway
  }));

// Notable failures (for case studies)
const notableFailures = allStartups
  .filter(s => s.fundingAmount >= 50 || s.survivalYears >= 10 || s.takeaway.length > 10)
  .map(s => ({
    name: s.name,
    sector: s.sector,
    fundingAmount: s.fundingAmount,
    fundingTier: s.fundingTier,
    survivalYears: s.survivalYears,
    foundingYear: s.foundingYear,
    failureYear: s.failureYear,
    whatTheyDid: s.whatTheyDid,
    whyTheyFailed: s.whyTheyFailed,
    takeaway: s.takeaway,
    primaryReason: s.primaryReason,
    totalFailureReasons: s.totalFailureReasons
  }));

// Summary stats
const totalFunding = allStartups.reduce((sum, s) => sum + s.fundingAmount, 0);
const avgSurvival = allStartups.reduce((sum, s) => sum + s.survivalYears, 0) / allStartups.length;
const yearsWithData = Object.keys(byFailureYear).map(Number).sort((a, b) => a - b);
const peakYear = Object.entries(byFailureYear).sort((a, b) => b[1].count - a[1].count)[0];

const summary = {
  totalStartups: allStartups.length,
  totalFundingLost: Math.round(totalFunding),
  avgSurvivalYears: +avgSurvival.toFixed(2),
  minYear: yearsWithData[0],
  maxYear: yearsWithData[yearsWithData.length - 1],
  peakFailureYear: peakYear ? { year: peakYear[0], count: peakYear[1].count } : null,
  sectorCount: Object.keys(bySector).length,
  topReason: Object.entries(byReason).sort((a, b) => b[1].count - a[1].count)[0][0]
};

console.log('\nSummary:');
console.log(`  Total startups: ${summary.totalStartups}`);
console.log(`  Total funding lost: $${summary.totalFundingLost}M`);
console.log(`  Avg survival: ${summary.avgSurvivalYears} years`);
console.log(`  Date range: ${summary.minYear}-${summary.maxYear}`);
console.log(`  Peak year: ${summary.peakFailureYear?.year} (${summary.peakFailureYear?.count} failures)`);
console.log(`  Top reason: ${summary.topReason}`);

// ============================================
// OUTPUT
// ============================================

const output = `// Startup Failures Dashboard - Data Module
// Generated from sector-specific CSV files
// ${allStartups.length} startups from ${summary.minYear} to ${summary.maxYear}

const DATA = {
  // All startups with full details
  startups: ${JSON.stringify(allStartups, null, 2)},

  // Failure reason definitions
  failureReasons: ${JSON.stringify(FAILURE_REASONS, null, 2)},

  // Aggregations by sector
  bySector: ${JSON.stringify(bySector, null, 2)},

  // Aggregations by failure reason
  byReason: ${JSON.stringify(byReason, null, 2)},

  // Co-occurrence matrix (which reasons appear together)
  coOccurrence: ${JSON.stringify(coOccurrence, null, 2)},

  // Aggregations by funding tier
  byFundingTier: ${JSON.stringify(byFundingTier, null, 2)},

  // Aggregations by failure year
  byFailureYear: ${JSON.stringify(byFailureYear, null, 2)},

  // Aggregations by decade
  byDecade: ${JSON.stringify(byDecade, null, 2)},

  // Top 30 most funded failures
  topFunded: ${JSON.stringify(topFunded, null, 2)},

  // Notable failures for case studies
  notableFailures: ${JSON.stringify(notableFailures, null, 2)},

  // Summary statistics
  summary: ${JSON.stringify(summary, null, 2)}
};

// Export for use in other modules
if (typeof module !== 'undefined') module.exports = DATA;
`;

fs.writeFileSync('./js/data.js', output);
console.log('\nGenerated js/data.js');
