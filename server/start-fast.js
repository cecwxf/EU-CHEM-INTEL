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
const PORT = 5173;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// API Routes (same as index.js)
app.get('/api/intel', (req, res) => {
  const { tag, topic, search, page = 1, limit = 50 } = req.query;
  const items = db.getIntelItems({ tag, topic, search, page: parseInt(page), limit: parseInt(limit) });
  res.json(items);
});
app.get('/api/kpi', (req, res) => { res.json(db.getKPI()); });
app.get('/api/tags', (req, res) => { res.json(taggingService.getTagDefinitions()); });
app.get('/api/reports', (req, res) => {
  const { type } = req.query;
  res.json(db.getReports(type || 'all'));
});
app.get('/api/reports/:id', (req, res) => {
  const report = db.getReportById(req.params.id);
  if (!report) return res.status(404).json({ error: 'Not found' });
  res.json(report);
});
app.get('/api/companies', (req, res) => { res.json(db.getCompanyUpdates()); });
app.get('/api/products', (req, res) => { res.json(db.getProductUpdates()); });
app.get('/api/regulatory', (req, res) => { res.json(db.getRegulatoryUpdates()); });
app.get('/api/action-tracker', (req, res) => { res.json(db.getActionTracker()); });
app.post('/api/scrape', async (req, res) => {
  try {
    const results = await scraperService.scrapeAll();
    res.json({ success: true, items: results.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/reports/generate', async (req, res) => {
  try {
    const { type, period } = req.body;
    const report = await reportService.generateReport(type || 'weekly', period);
    res.json({ success: true, report });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/intel/:id/tags', (req, res) => {
  const { tags } = req.body;
  db.updateItemTags(req.params.id, tags);
  res.json({ success: true });
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

// Start immediately, init in background
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server ready on 0.0.0.0:' + PORT);
});

// Async init
(async () => {
  await db.initialize();
  await seedData.seedIfEmpty();
  console.log('Init done');
})();
