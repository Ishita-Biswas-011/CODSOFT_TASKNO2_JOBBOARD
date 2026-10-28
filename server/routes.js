const r = require('express').Router(), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const multer = require('multer'), fs = require('fs'), path = require('path');
const { User, Job, Application } = require('./models'), mail = require('./mail');
fs.mkdirSync('uploads', { recursive: true });
const upload = multer({ dest: 'uploads/', limits: { fileSize: 5e6 },
  fileFilter: (q, f, cb) => /\.(pdf|docx?)$/i.test(f.originalname) ? cb(null, true) : cb(new Error('Resume must be PDF or DOC')) });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sign = u => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = u => ({ id: u._id, name: u.name, email: u.email, role: u.role, company: u.company, headline: u.headline, skills: u.skills });
const auth = role => (req, res, next) => {
  try {
    req.user = jwt.verify((req.headers.authorization || '').split(' ')[1], process.env.JWT_SECRET);
    if (role && req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch { res.status(401).json({ error: 'Please log in' }); }
};

// ---- Auth
r.post('/auth/register', wrap(async (req, res) => {
  const { name, email, password, role, company } = req.body;
  if (!name || !email || !password || password.length < 8 || !['employer', 'candidate'].includes(role))
    return res.status(400).json({ error: 'Valid name, email, role and 8+ char password required' });
  if (await User.findOne({ email })) return res.status(400).json({ error: 'Email already registered' });
  const u = await User.create({ name, email, role, company: role === 'employer' ? company : undefined, password: await bcrypt.hash(password, 12) });
  mail(email, 'Welcome to JobBoard', `Hi ${name}, your account is ready.`);
  res.json({ token: sign(u), user: pub(u) });
}));
r.post('/auth/login', wrap(async (req, res) => {
  const u = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.password))) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: sign(u), user: pub(u) });
}));
r.get('/me', auth(), wrap(async (req, res) => res.json(pub(await User.findById(req.user.id)))));
r.put('/me', auth(), wrap(async (req, res) => {
  const { name, headline, skills, company } = req.body;
  res.json(pub(await User.findByIdAndUpdate(req.user.id, { name, headline, skills, company }, { new: true })));
}));

// ---- Jobs (public)
r.get('/jobs', wrap(async (req, res) => {
  const { q = '', type = '' } = req.query, f = {};
  if (q) { const re = new RegExp(esc(String(q)), 'i'); f.$or = [{ title: re }, { company: re }, { location: re }, { description: re }]; }
  if (type) f.type = String(type);
  res.json(await Job.find(f).sort('-createdAt').limit(100));
}));
r.get('/jobs/featured', wrap(async (req, res) => {
  let j = await Job.find({ featured: true }).sort('-createdAt').limit(6);
  if (!j.length) j = await Job.find().sort('-createdAt').limit(6);
  res.json(j);
}));
r.get('/jobs/:id', wrap(async (req, res) => res.json(await Job.findById(req.params.id))));

// ---- Employer
r.post('/jobs', auth('employer'), wrap(async (req, res) => {
  const { title, location, type, salary, description, featured } = req.body, u = await User.findById(req.user.id);
  if (!title || !description) return res.status(400).json({ error: 'Title and description required' });
  res.json(await Job.create({ title, location, type, salary, description, featured: !!featured, company: u.company || u.name, employer: u._id }));
}));
r.get('/my/jobs', auth('employer'), wrap(async (req, res) => res.json(await Job.find({ employer: req.user.id }).sort('-createdAt'))));
r.delete('/jobs/:id', auth('employer'), wrap(async (req, res) => {
  await Job.deleteOne({ _id: req.params.id, employer: req.user.id }); res.json({ ok: true });
}));
r.get('/jobs/:id/applications', auth('employer'), wrap(async (req, res) => {
  if (!(await Job.findOne({ _id: req.params.id, employer: req.user.id }))) return res.status(403).json({ error: 'Forbidden' });
  res.json(await Application.find({ job: req.params.id }).populate('candidate', 'name email headline skills').sort('-createdAt'));
}));
r.patch('/applications/:id', auth('employer'), wrap(async (req, res) => {
  const a = await Application.findById(req.params.id).populate('candidate job');
  if (!a || String(a.job.employer) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  a.status = req.body.status; await a.save();
  mail(a.candidate.email, `Application update: ${a.job.title}`, `Your application status is now: ${a.status}.`);
  res.json(a);
}));
r.get('/applications/:id/resume', auth('employer'), wrap(async (req, res) => {
  const a = await Application.findById(req.params.id).populate('job');
  if (!a || String(a.job.employer) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  res.sendFile(path.resolve(a.resume));
}));

// ---- Candidate
r.post('/jobs/:id/apply', auth('candidate'), upload.single('resume'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Resume required' });
  const job = await Job.findById(req.params.id).populate('employer');
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (await Application.findOne({ job: job._id, candidate: req.user.id })) return res.status(400).json({ error: 'Already applied' });
  const me = await User.findById(req.user.id);
  const a = await Application.create({ job: job._id, candidate: me._id, coverLetter: req.body.coverLetter, resume: req.file.path });
  mail(me.email, `Application received: ${job.title}`, `Thanks ${me.name}, we sent your application to ${job.company}.`);
  mail(job.employer.email, `New applicant: ${job.title}`, `${me.name} (${me.email}) applied. Review it in your dashboard.`);
  res.json(a);
}));
r.get('/my/applications', auth('candidate'), wrap(async (req, res) =>
  res.json(await Application.find({ candidate: req.user.id }).populate('job', 'title company').sort('-createdAt'))));

module.exports = r;