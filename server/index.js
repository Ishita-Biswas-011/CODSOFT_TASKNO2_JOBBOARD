require('dotenv').config();
const express = require('express'), mongoose = require('mongoose'), cors = require('cors');
const helmet = require('helmet'), rate = require('express-rate-limit');
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', rate({ windowMs: 15 * 60 * 1000, max: 50 }));
app.get('/', (q, s) => s.send('JobBoard API running'));
app.use('/api', require('./routes'));
app.use((err, q, s, n) => s.status(400).json({ error: err.message }));
mongoose.connect(process.env.MONGO_URI).then(() =>
  app.listen(process.env.PORT || 5000, () => console.log('API on port', process.env.PORT || 5000)));