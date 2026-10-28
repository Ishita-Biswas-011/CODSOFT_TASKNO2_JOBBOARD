const m = require('mongoose');
const id = { type: m.Schema.Types.ObjectId };
const User = m.model('User', new m.Schema({
  name: String, email: { type: String, unique: true, lowercase: true }, password: String,
  role: { type: String, enum: ['employer', 'candidate'] }, company: String, headline: String, skills: String
}, { timestamps: true }));
const Job = m.model('Job', new m.Schema({
  title: String, company: String, location: String, type: { type: String, default: 'Full-time' },
  salary: String, description: String, featured: { type: Boolean, default: false },
  employer: { ...id, ref: 'User' }
}, { timestamps: true }));
const Application = m.model('Application', new m.Schema({
  job: { ...id, ref: 'Job' }, candidate: { ...id, ref: 'User' }, coverLetter: String, resume: String,
  status: { type: String, default: 'Applied', enum: ['Applied', 'Reviewed', 'Shortlisted', 'Rejected', 'Hired'] }
}, { timestamps: true }));
module.exports = { User, Job, Application };