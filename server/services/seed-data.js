const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const tagger = require('./tagger');
const reportGen = require('./report-generator');

const SEED_INTEL = [
  {
    id: 'seed-001',
    title: 'CBAM Goes Live: EU Carbon Border Tax Takes Effect January 1, 2026',
    summary: 'The Carbon Border Adjustment Mechanism (CBAM) officially entered into force on January 1, 2026, marking a historic shift in EU trade policy. Importers of cement, iron and steel, aluminium, fertilisers, electricity, and hydrogen must now report embedded emissions and purchase CBAM certificates. The full financial obligations phase in from 2027.',
    source_name: 'European Commission',
    source_url: 'https://ec.europa.eu/commission/presscorner/detail/en/ip_26_0101',
    published_date: '2026-01-01',
    topic_category: 'Policy',
    signal_level: 'Critical',
    signal_confidence: 'Confirmed',
    tags: ['Critical', 'Confirmed', 'Policy', 'CBAM', 'Cost Structure'],
    raw_content: 'CBAM regulation takes effect. Carbon border tax applies to imports. Full phase-in from 2027.'
  },
  {
    id: 'seed-002',
    title: 'SABIC Exits Western Polymers in $950M Dual Deal with Aequita and Mutares',
    summary: 'SABIC announced the sale of its Western polymer operations in a landmark $950 million dual transaction. The deal splits its portfolio: $500M in commodity polymer assets go to Aequita, while $450M in engineering thermoplastics (ETP) assets are acquired by Mutares. This represents a major restructuring of European polymer ownership.',
    source_name: 'Reuters',
    source_url: 'https://www.reuters.com/business/sabic-sells-western-polymers-950m-2026-01-08/',
    published_date: '2026-01-08',
    topic_category: 'M&A',
    signal_level: 'Critical',
    signal_confidence: 'Confirmed',
    tags: ['Critical', 'Confirmed', 'M&A', 'SABIC', 'Capacity'],
    raw_content: 'SABIC exits Western polymers via $950M deal. $500M commodity to Aequita. $450M ETP to Mutares. Major restructuring of European polymer ownership.'
  },
  {
    id: 'seed-003',
    title: 'INEOS Announces Gladbeck Complex Closure: 650KT Capacity Impact',
    summary: 'INEOS has announced the permanent closure of its Gladbeck petrochemical complex in Germany, affecting approximately 650,000 tonnes of annual production capacity. The closure, driven by persistently high European energy costs and weak downstream demand, will result in significant job losses. This follows earlier closures at Rheinberg and Hull.',
    source_name: 'ICIS',
    source_url: 'https://www.icis.com/explore/news/ineos-gladbeck-closure-650kt',
    published_date: '2026-02-01',
    topic_category: 'Capacity',
    signal_level: 'Critical',
    signal_confidence: 'Confirmed',
    tags: ['Critical', 'Confirmed', 'Capacity', 'INEOS', 'Cost Structure'],
    raw_content: 'INEOS Gladbeck closure. 650KT capacity impact. European energy costs. Following Rheinberg and Hull.'
  },
  {
    id: 'seed-004',
    title: 'ExxonMobil Closes Mossmorran Ethylene Plant: 430 Jobs Affected',
    summary: 'ExxonMobil has permanently closed its Mossmorran ethylene cracker in Scotland, resulting in the loss of 430 jobs. The facility, which had been operating at reduced rates, was deemed uncompetitive amid high North Sea gas feedstock costs and increasing competition from more efficient Middle Eastern and Asian producers.',
    source_name: 'Financial Times',
    source_url: 'https://www.ft.com/content/exxonmobil-mossmorran-closure-2026',
    published_date: '2026-02-02',
    topic_category: 'Capacity',
    signal_level: 'Critical',
    signal_confidence: 'Confirmed',
    tags: ['Critical', 'Confirmed', 'Capacity', 'Cost Structure'],
    raw_content: 'ExxonMobil closes Mossmorran ethylene plant. 430 jobs affected. North Sea gas costs. Competition from Middle East and Asia.'
  },
  {
    id: 'seed-005',
    title: 'EU Imposes 52-143% Anti-Dumping Duties on Chinese Chemical Imports',
    summary: 'The European Commission imposed definitive anti-dumping duties ranging from 52% to 143% on certain chemical products imported from China, effective February 4, 2026. The duties target products including epoxy resins, titanium dioxide, and specific polymer grades. The measures follow a year-long investigation into unfair pricing practices.',
    source_name: 'European Commission',
    source_url: 'https://ec.europa.eu/trade/policy/defence/anti-dumping/',
    published_date: '2026-02-04',
    topic_category: 'Policy',
    signal_level: 'Priority',
    signal_confidence: 'Confirmed',
    tags: ['Priority', 'Confirmed', 'Policy', 'Cost Structure'],
    raw_content: 'EU imposes 52-143% anti-dumping duties on Chinese chemicals. Epoxy resins, TiO2, polymers targeted. Year-long investigation.'
  },
  {
    id: 'seed-006',
    title: 'Ratcliffe Energy & Chemical Hub Restructuring: 101 Sites, 75K Jobs Under Review',
    summary: 'A comprehensive review of the Ratcliffe energy and chemical industrial cluster has been initiated, encompassing 101 industrial sites and approximately 75,000 direct and indirect jobs. The review, prompted by UK government industrial strategy reforms, aims to chart a transition path toward low-carbon chemical and energy production.',
    source_name: 'Chemweek',
    source_url: 'https://www.chemweek.com/ratcliffe-restructuring-2026',
    published_date: '2026-02-11',
    topic_category: 'Policy',
    signal_level: 'Priority',
    signal_confidence: 'Strong Signal',
    tags: ['Priority', 'Strong Signal', 'Policy', 'Capacity'],
    raw_content: 'Ratcliffe energy and chemical hub restructuring. 101 sites, 75K jobs. UK industrial strategy reforms. Low-carbon transition.'
  },
  {
    id: 'seed-007',
    title: 'Goldman Sachs Upgrades European Chemicals Sector to Overweight',
    summary: 'Goldman Sachs upgraded the European chemicals sector from Neutral to Overweight on February 10, 2026, citing improving demand outlook in key end-markets, easing energy costs from 2025 peaks, and attractive valuations following the prolonged downturn. The upgrade specifically highlighted BASF, Covestro, and Solvay as top picks.',
    source_name: 'Goldman Sachs Research',
    source_url: 'https://www.goldmansachs.com/research/european-chemicals-upgrade-2026',
    published_date: '2026-02-10',
    topic_category: 'Market',
    signal_level: 'High',
    signal_confidence: 'Strong Signal',
    tags: ['High', 'Strong Signal', 'Market'],
    raw_content: 'Goldman Sachs upgrades European chemicals to Overweight. Improving demand, easing energy costs. BASF, Covestro, Solvay top picks.'
  },
  {
    id: 'seed-008',
    title: 'Additional Anti-Dumping Duties on Chinese Chemical Products Announced',
    summary: 'The EU announced a second wave of anti-dumping duties on February 12, 2026, targeting additional Chinese chemical imports including specialty polymers and intermediates. Combined with the February 4 measures, this represents the most significant trade defence action in the chemical sector in over a decade.',
    source_name: 'European Commission',
    source_url: 'https://ec.europa.eu/trade/policy/defence/',
    published_date: '2026-02-12',
    topic_category: 'Policy',
    signal_level: 'High',
    signal_confidence: 'Confirmed',
    tags: ['High', 'Confirmed', 'Policy'],
    raw_content: 'Second wave of anti-dumping duties on Chinese chemicals. Specialty polymers and intermediates. Most significant trade defence in chemical sector in decade.'
  },
  {
    id: 'seed-009',
    title: 'Honeywell Slashes Johnson Matthey Bid Price by 26%',
    summary: 'Honeywell has reduced its acquisition offer for Johnson Matthey by 26%, from the original bid to approximately £4.2 billion, citing revised valuation analysis and integration costs. The move signals increased buyer caution in mega-deal chemical M&A amid macroeconomic uncertainty.',
    source_name: 'Financial Times',
    source_url: 'https://www.ft.com/content/honeywell-johnson-matthey-bid-cut-2026',
    published_date: '2026-02-23',
    topic_category: 'M&A',
    signal_level: 'High',
    signal_confidence: 'Strong Signal',
    tags: ['High', 'Strong Signal', 'M&A'],
    raw_content: 'Honeywell cuts Johnson Matthey bid by 26%. £4.2B. Revised valuation. Increased buyer caution in chemical M&A.'
  },
  {
    id: 'seed-010',
    title: 'IAA Launches "Made in Europe" Initiative for Automotive Chemicals',
    summary: 'The International Automobile Association (IAA) launched a "Made in Europe" initiative on February 26, 2026, aimed at strengthening European automotive chemical supply chains. The initiative promotes local sourcing of polymer components, coatings, adhesives, and battery materials to reduce dependency on imports.',
    source_name: 'Chemical & Engineering News',
    source_url: 'https://cen.acs.org/business/IAA-made-in-europe-initiative-2026',
    published_date: '2026-02-26',
    topic_category: 'Market',
    signal_level: 'High',
    signal_confidence: 'Strong Signal',
    tags: ['High', 'Strong Signal', 'Market', 'Policy'],
    raw_content: 'IAA "Made in Europe" initiative. Automotive chemical supply chains. Local sourcing. Polymer components, coatings, battery materials.'
  },
  {
    id: 'seed-011',
    title: 'BASF Announces €500M Investment in Ludwigshafen Green Hydrogen Hub',
    summary: 'BASF announced plans to invest €500 million in a green hydrogen production hub at its flagship Ludwigshafen site in Germany. The hub will use electrolysis powered by offshore wind energy to produce green hydrogen for ammonia and methanol production, replacing natural gas-based processes. Expected operational by 2028.',
    source_name: 'BASF Press Release',
    source_url: 'https://www.basf.com/global/en/media/news-releases/2026/hydrogen-hub-ludwigshafen',
    published_date: '2026-02-15',
    topic_category: 'Technology',
    signal_level: 'High',
    signal_confidence: 'Confirmed',
    tags: ['High', 'Confirmed', 'Technology', 'BASF', 'Cost Structure'],
    raw_content: 'BASF €500M green hydrogen hub at Ludwigshafen. Offshore wind electrolysis. Green ammonia and methanol. Replace natural gas. Operational by 2028.'
  },
  {
    id: 'seed-012',
    title: 'Arlanxeo and Trinseo Announce Strategic Exits from European Synthetic Rubber Market',
    summary: 'Arlanxeo (a Saudi Aramco subsidiary) and Trinseo have both announced plans to exit portions of their European synthetic rubber operations, citing structural overcapacity and declining automotive demand. The combined exits represent approximately 400KT of annual capacity rationalization.',
    source_name: 'ICIS',
    source_url: 'https://www.icis.com/news/arlanxeo-trinseo-europe-exit-2026',
    published_date: '2026-02-18',
    topic_category: 'M&A',
    signal_level: 'High',
    signal_confidence: 'Strong Signal',
    tags: ['High', 'Strong Signal', 'M&A', 'Capacity'],
    raw_content: 'Arlanxeo and Trinseo exit European synthetic rubber. 400KT capacity rationalization. Structural overcapacity. Declining automotive demand.'
  },
  {
    id: 'seed-013',
    title: 'EU Horizon Europe Launches €1.2B Circular Chemistry Research Program',
    summary: 'The European Commission launched a €1.2 billion research program under Horizon Europe focused on circular chemistry. The program targets chemical recycling scale-up, bio-based platform chemicals, CO2-to-chemicals conversion, and sustainable polymer design. First call for proposals opens March 2026.',
    source_name: 'European Commission',
    source_url: 'https://ec.europa.eu/horizon-europe/circular-chemistry-2026',
    published_date: '2026-02-20',
    topic_category: 'Technology',
    signal_level: 'High',
    signal_confidence: 'Confirmed',
    tags: ['High', 'Confirmed', 'Technology', 'Policy'],
    raw_content: 'Horizon Europe €1.2B circular chemistry program. Chemical recycling, bio-based, CO2-to-chemicals. First call March 2026.'
  },
  {
    id: 'seed-014',
    title: 'ECHA Identifies 5 New SVHC Candidates Including Specialty Silicones',
    summary: 'The European Chemicals Agency (ECHA) added five new Substances of Very High Concern (SVHC) candidates to the REACH candidate list, including two specialty silicone intermediates and a widely used flame retardant. Companies manufacturing or importing these substances face new notification and information obligations.',
    source_name: 'ECHA',
    source_url: 'https://echa.europa.eu/-/five-new-svhc-candidates-added-2026',
    published_date: '2026-02-08',
    topic_category: 'Policy',
    signal_level: 'High',
    signal_confidence: 'Confirmed',
    tags: ['High', 'Confirmed', 'Policy', 'REACH', 'SVHC'],
    raw_content: 'ECHA adds 5 new SVHC candidates. Two specialty silicones, one flame retardant. REACH candidate list update. New notification obligations.'
  },
  {
    id: 'seed-015',
    title: 'Neste and TotalEnergies Form Bio-Chemicals Joint Venture in Rotterdam',
    summary: 'Neste and TotalEnergies announced a 50:50 joint venture to build a bio-based chemicals production facility at the Port of Rotterdam. The €350 million investment will produce bio-naphtha and bio-propylene from renewable feedstocks, targeting the growing demand for sustainable plastic precursors.',
    source_name: 'Reuters',
    source_url: 'https://www.reuters.com/business/neste-total-energies-bio-chemicals-jv-2026',
    published_date: '2026-02-14',
    topic_category: 'Technology',
    signal_level: 'High',
    signal_confidence: 'Confirmed',
    tags: ['High', 'Confirmed', 'Technology', 'M&A'],
    raw_content: 'Neste and TotalEnergies bio-chemicals JV in Rotterdam. €350M. Bio-naphtha and bio-propylene. Renewable feedstocks. Sustainable plastics.'
  },
  {
    id: 'seed-016',
    title: 'EU Natural Gas Prices Rise 15% Amid Cold Weather and Supply Concerns',
    summary: 'European natural gas benchmark prices (TTF) rose by 15% in early February 2026, reaching €42/MWh, driven by a late-winter cold snap and concerns over LNG supply availability following Asian demand competition. The price spike adds further cost pressure on energy-intensive chemical producers.',
    source_name: 'Financial Times',
    source_url: 'https://www.ft.com/content/eu-gas-prices-feb-2026',
    published_date: '2026-02-09',
    topic_category: 'Cost Structure',
    signal_level: 'Priority',
    signal_confidence: 'Confirmed',
    tags: ['Priority', 'Confirmed', 'Cost Structure'],
    raw_content: 'EU gas prices rise 15% to €42/MWh. Cold weather. LNG supply concerns. Asian competition. Cost pressure on chemical producers.'
  },
  {
    id: 'seed-017',
    title: 'EVOH Capacity Expansion Announced by Leading Japanese Producer',
    summary: 'A major Japanese chemical producer announced plans to expand EVOH (ethylene vinyl alcohol copolymer) production capacity in Europe by 30%, targeting growing demand for high-barrier food packaging materials. The investment of approximately €200 million includes a new production line at an existing European site.',
    source_name: 'Chemical & Engineering News',
    source_url: 'https://cen.acs.org/business/evoh-capacity-expansion-europe-2026',
    published_date: '2026-02-19',
    topic_category: 'Capacity',
    signal_level: 'High',
    signal_confidence: 'Strong Signal',
    tags: ['High', 'Strong Signal', 'Capacity', 'Technology', 'EVOH'],
    raw_content: 'EVOH capacity expansion in Europe. 30% increase. €200M investment. Food packaging barrier materials. New production line.'
  },
  {
    id: 'seed-018',
    title: 'Avantium Secures €85M Funding for Commercial-Scale PEF Production',
    summary: 'Avantium has secured €85 million in additional funding to accelerate commercial-scale production of PEF (polyethylene furanoate), a 100% bio-based alternative to PET. The funding, from a consortium of European investors and the EU Innovation Fund, will support construction of a 50KT annual capacity plant in the Netherlands.',
    source_name: 'Avantium Press Release',
    source_url: 'https://www.avantium.com/press-releases/pef-funding-2026',
    published_date: '2026-02-25',
    topic_category: 'Technology',
    signal_level: 'High',
    signal_confidence: 'Confirmed',
    tags: ['High', 'Confirmed', 'Technology', 'PEF', 'M&A'],
    raw_content: 'Avantium €85M funding for commercial PEF production. 100% bio-based PET alternative. 50KT annual capacity. Netherlands. EU Innovation Fund.'
  }
];

const MONITORED_COMPANIES = [
  'BASF', 'Covestro', 'Evonik', 'Huntsman', 'Mitsui Chemicals', 'Arkema',
  'Lubrizol', 'Cray Valley', 'Avantium', 'INEOS', 'Amcor', 'Sealed Air',
  'Nouryon', 'Lanxess', 'Solvay', 'Syensqo', 'Clariant', 'Croda International',
  'DSM-Firmenich', 'Givaudan', 'Neste', 'Borealis', 'TotalEnergies', 'SABIC',
  'LyondellBasell', 'OMV', 'Repsol'
];

const MONITORED_PRODUCTS = [
  'Rhamnolipids', 'Polysulfone', 'PSU/PPSU', 'PEF', 'PCTG/PETG',
  'Methionine', 'Carbomer', 'K-Resin', 'Styrolution', 'PEBA', 'EVOH',
  'PVDC', 'COC/COP', 'MQ silicone resin', 'Isocyanates'
];

const REGULATIONS = ['REACH / SVHC', 'PFAS restriction', '6PPD tire chemical regulation', 'BPA regulation'];

async function seedIfEmpty() {
  const count = db.getIntelCount();
  if (count > 0) {
    console.log(`[SEED] Database already contains ${count} items, skipping seed.`);
    return;
  }

  console.log('[SEED] Seeding database with sample intelligence data...');

  // Insert seed intel items
  for (const item of SEED_INTEL) {
    item.tags = item.tags || [];
    db.insertIntelItem(item);
  }

  // Insert action tracker items
  const actions = [
    { id: 'act-001', title: 'Monitor CBAM implementation and impact on import costs', description: 'Track CBAM certificate pricing and reporting compliance as phase-in progresses', priority: 'Critical' },
    { id: 'act-002', title: 'Watch for further plant closures in energy-intensive sectors', description: 'INEOS Gladbeck and ExxonMobil Mossmorran closures may trigger domino effect', priority: 'Priority' },
    { id: 'act-003', title: 'Track anti-dumping duty impact on epoxy resin and TiO2 supply', description: '52-143% duties will significantly reshape import economics', priority: 'Priority' },
    { id: 'act-004', title: 'Monitor SABIC-Aequita-Mutares deal integration', description: '$950M dual deal reshapes European polymer landscape', priority: 'High' },
    { id: 'act-005', title: 'Watch ECHA SVHC candidate list updates', description: 'New specialty silicone and flame retardant classifications may affect downstream users', priority: 'Monitor' }
  ];
  for (const action of actions) {
    db.addActionItem(action);
  }

  // Generate initial weekly report
  await reportGen.generateReport('weekly', 'seed_period');

  console.log('[SEED] Database seeded with 18 intel items, 5 action items, and 1 weekly report.');
}

module.exports = { seedIfEmpty };
