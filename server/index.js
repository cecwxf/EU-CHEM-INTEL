const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const scraperService = require('./services/scraper');
const taggingService = require('./services/tagger');
const reportService = require('./services/report-generator');
const db = require('./services/database');
const seedData = require('./services/seed-data');

const app = express();
const PORT = process.env.PORT || 5173;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// ============ API Routes ============

// Intelligence Feed
app.get('/api/intel', (req, res) => {
  const { tag, topic, search, page = 1, limit = 50 } = req.query;
  const items = db.getIntelItems({ tag, topic, search, page: parseInt(page), limit: parseInt(limit) });
  res.json(items);
});

// KPI Summary
app.get('/api/kpi', (req, res) => {
  const kpi = db.getKPI();
  res.json(kpi);
});

// Tags
app.get('/api/tags', (req, res) => {
  res.json(taggingService.getTagDefinitions());
});

// Reports
app.get('/api/reports', (req, res) => {
  const { type } = req.query;
  const reports = db.getReports(type || 'all');
  res.json(reports);
});

app.get('/api/reports/:id', (req, res) => {
  const report = db.getReportById(req.params.id);
  if (!report) return res.status(404).json({ error: 'Not found' });
  res.json(report);
});

// Company monitoring
app.get('/api/companies', (req, res) => {
  const companies = db.getCompanyUpdates();
  res.json(companies);
});

// Product monitoring
app.get('/api/products', (req, res) => {
  const products = db.getProductUpdates();
  res.json(products);
});

// Regulatory tracking
app.get('/api/regulatory', (req, res) => {
  const regulatory = db.getRegulatoryUpdates();
  res.json(regulatory);
});

// Action tracker
app.get('/api/action-tracker', (req, res) => {
  res.json(db.getActionTracker());
});

// Trigger manual scrape
app.post('/api/scrape', async (req, res) => {
  try {
    const results = await scraperService.scrapeAll();
    res.json({ success: true, items: results.length, message: `Scraped ${results.length} items` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate report
app.post('/api/reports/generate', async (req, res) => {
  try {
    const { type, period } = req.body;
    const report = await reportService.generateReport(type || 'weekly', period);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update tag
app.put('/api/intel/:id/tags', (req, res) => {
  const { tags } = req.body;
  db.updateItemTags(req.params.id, tags);
  res.json({ success: true });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

// ============ Scheduled Tasks ============

// Scrape every 2 hours
cron.schedule('0 */2 * * *', async () => {
  console.log('[CRON] Running scheduled scrape...');
  try { await scraperService.scrapeAll(); } catch(e) { console.error('Scrape error:', e.message); }
});

// Daily report at 23:00
cron.schedule('0 23 * * *', async () => {
  console.log('[CRON] Generating daily report...');
  try { await reportService.generateReport('daily', 'today'); } catch(e) { console.error('Daily report error:', e.message); }
});

// Weekly report Sunday at 22:00
cron.schedule('0 22 * * 0', async () => {
  console.log('[CRON] Generating weekly report...');
  try { await reportService.generateReport('weekly', 'this_week'); } catch(e) { console.error('Weekly report error:', e.message); }
});

// ============ Init & Start ============
app.listen(PORT, () => {
  console.log(`EU-CHEM INTEL Server running on http://localhost:${PORT}`);
});

// Run init in background
(async () => {
  await db.initialize();
  await seedData.seedIfEmpty();
  console.log('[INIT] System ready');
})();
