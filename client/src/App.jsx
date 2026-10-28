import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { api, tok, BASE } from './api';

const Ctx = createContext(); const useAuth = () => useContext(Ctx);
const TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'];

function Nav() {
  const { user, logout } = useAuth();
  return <header><Link to="/" className="logo">JobBoard</Link><nav><Link to="/jobs">Jobs</Link>
    {user ? <><Link to="/dashboard">Dashboard</Link><button className="sec" onClick={logout}>Logout</button></>
      : <><Link to="/login">Login</Link><Link to="/register">Sign up</Link></>}</nav></header>;
}
const JobCard = ({ j }) => <Link to={'/jobs/' + j._id} className="card"><h3>{j.title}</h3>
  <p>{j.company} · {j.location}</p><p><span className="tag">{j.type}</span> {j.salary}</p></Link>;

function SearchBar({ init = '', onGo }) {
  const [q, setQ] = useState(init);
  return <form className="search" onSubmit={e => { e.preventDefault(); onGo(q); }}>
    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Job title, company or location" /><button>Search</button></form>;
}
function Home() {
  const [jobs, setJobs] = useState([]); const nav = useNavigate();
  useEffect(() => { api('/jobs/featured').then(setJobs).catch(() => {}); }, []);
  return <main><section className="hero"><h1>Find your next opportunity</h1><p>Search openings or hire top talent.</p>
    <SearchBar onGo={q => nav('/jobs?q=' + encodeURIComponent(q))} /></section>
    <h2>Featured jobs</h2><div className="grid">{jobs.map(j => <JobCard key={j._id} j={j} />)}</div></main>;
}
function Jobs() {
  const [sp, setSp] = useSearchParams(); const [jobs, setJobs] = useState([]);
  const q = sp.get('q') || '', type = sp.get('type') || '';
  useEffect(() => { api(`/jobs?q=${encodeURIComponent(q)}&type=${type}`).then(setJobs).catch(() => {}); }, [q, type]);
  return <main><SearchBar init={q} onGo={v => setSp({ q: v, type })} />
    <select value={type} onChange={e => setSp({ q, type: e.target.value })}><option value="">All types</option>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
    <div className="grid">{jobs.map(j => <JobCard key={j._id} j={j} />)}</div>{!jobs.length && <p>No jobs found.</p>}</main>;
}
function JobDetail() {
  const { id } = useParams(); const { user } = useAuth(); const [j, setJ] = useState(); const [msg, setMsg] = useState('');
  useEffect(() => { api('/jobs/' + id).then(setJ).catch(() => {}); }, [id]);
  const apply = async e => { e.preventDefault(); try { await api(`/jobs/${id}/apply`, { method: 'POST', body: new FormData(e.target) }); setMsg('Application sent! Check your email.'); } catch (x) { setMsg(x.message); } };
  if (!j) return <main>Loading…</main>;
  return <main><h1>{j.title}</h1><p>{j.company} · {j.location} · <span className="tag">{j.type}</span> {j.salary}</p>
    <div className="desc">{j.description}</div>
    {user?.role === 'candidate' ? <form onSubmit={apply} className="form"><h3>Apply for this job</h3>
      <textarea name="coverLetter" rows="5" placeholder="Cover letter" /><input type="file" name="resume" accept=".pdf,.doc,.docx" required /><button>Submit application</button></form>
      : !user && <p><Link to="/login"><b>Log in</b></Link> as a candidate to apply.</p>}<p>{msg}</p></main>;
}
function AuthForm({ mode }) {
  const { setUser } = useAuth(); const nav = useNavigate(); const [f, setF] = useState({ role: 'candidate' }); const [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const go = async e => { e.preventDefault(); try { const d = await api('/auth/' + mode, { method: 'POST', body: f }); localStorage.setItem('t', d.token); setUser(d.user); nav('/dashboard'); } catch (x) { setErr(x.message); } };
  return <main><form className="form" onSubmit={go}><h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
    {mode === 'register' && <><input placeholder="Full name" onChange={set('name')} required />
      <select onChange={set('role')}><option value="candidate">I'm looking for jobs</option><option value="employer">I'm hiring</option></select>
      {f.role === 'employer' && <input placeholder="Company name" onChange={set('company')} required />}</>}
    <input type="email" placeholder="Email" onChange={set('email')} required />
    <input type="password" placeholder="Password (min 8 characters)" minLength="8" onChange={set('password')} required />
    <button>Submit</button><p className="err">{err}</p></form></main>;
}
function Employer() {
  const [jobs, setJobs] = useState([]); const [apps, setApps] = useState({}); const [f, setF] = useState({ type: 'Full-time' });
  const load = () => api('/my/jobs').then(setJobs); useEffect(() => { load(); }, []);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const post = async e => { e.preventDefault(); await api('/jobs', { method: 'POST', body: f }); e.target.reset(); setF({ type: 'Full-time' }); load(); };
  const show = async id => setApps({ ...apps, [id]: await api(`/jobs/${id}/applications`) });
  const status = async (jid, a, s) => { await api('/applications/' + a, { method: 'PATCH', body: { status: s } }); show(jid); };
  const resume = async id => { const r = await fetch(BASE + `/applications/${id}/resume`, { headers: { Authorization: 'Bearer ' + tok() } }); window.open(URL.createObjectURL(await r.blob())); };
  return <main><h2>Post a job</h2><form className="form" style={{ margin: 0, maxWidth: 'none' }} onSubmit={post}>
    <input placeholder="Job title" onChange={set('title')} required /><input placeholder="Location" onChange={set('location')} />
    <select onChange={set('type')}>{TYPES.map(t => <option key={t}>{t}</option>)}</select><input placeholder="Salary (e.g. ₹8–12 LPA)" onChange={set('salary')} />
    <textarea rows="5" placeholder="Description & requirements" onChange={set('description')} required />
    <label><input type="checkbox" style={{ width: 'auto' }} onChange={e => setF({ ...f, featured: e.target.checked })} /> Feature on home page</label><button>Publish job</button></form>
    <h2>Your jobs</h2>{jobs.map(j => <div className="box" key={j._id} style={{ marginBottom: 10 }}><div className="row"><b>{j.title}</b>
      <span><button className="sec" onClick={() => show(j._id)}>Applicants</button> <button className="sec" onClick={async () => { await api('/jobs/' + j._id, { method: 'DELETE' }); load(); }}>Delete</button></span></div>
      {apps[j._id]?.map(a => <div key={a._id} className="row" style={{ borderTop: '1px solid #eee', paddingTop: 8, marginTop: 8 }}>
        <span>{a.candidate.name} ({a.candidate.email}) <button className="sec" onClick={() => resume(a._id)}>Resume</button></span>
        <select style={{ width: 'auto' }} value={a.status} onChange={e => status(j._id, a._id, e.target.value)}>{['Applied', 'Reviewed', 'Shortlisted', 'Rejected', 'Hired'].map(s => <option key={s}>{s}</option>)}</select></div>)}
      {apps[j._id]?.length === 0 && <p>No applicants yet.</p>}</div>)}</main>;
}
function Candidate() {
  const { user, setUser } = useAuth(); const [apps, setApps] = useState([]); const [f, setF] = useState(user); const [ok, setOk] = useState('');
  useEffect(() => { api('/my/applications').then(setApps); }, []);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async e => { e.preventDefault(); setUser(await api('/me', { method: 'PUT', body: f })); setOk('Saved'); };
  return <main><h2>My profile</h2><form className="form" style={{ margin: 0, maxWidth: 'none' }} onSubmit={save}>
    <input value={f.name || ''} onChange={set('name')} placeholder="Name" /><input value={f.headline || ''} onChange={set('headline')} placeholder="Headline (e.g. React Developer)" />
    <input value={f.skills || ''} onChange={set('skills')} placeholder="Skills (comma separated)" /><button>Save profile</button><span>{ok}</span></form>
    <h2>My applications</h2>{apps.map(a => <div className="box row" key={a._id} style={{ marginBottom: 10 }}>
      <Link to={'/jobs/' + a.job?._id}><b>{a.job?.title}</b> · {a.job?.company}</Link><span className="tag">{a.status}</span></div>)}
    {!apps.length && <p>You haven't applied to any jobs yet.</p>}</main>;
}
function Dashboard() { const { user } = useAuth(); return user.role === 'employer' ? <Employer /> : <Candidate />; }

export default function App() {
  const [user, setUser] = useState(null); const [ready, setReady] = useState(false);
  useEffect(() => { (tok() ? api('/me').then(setUser).catch(() => localStorage.removeItem('t')) : Promise.resolve()).finally(() => setReady(true)); }, []);
  const logout = () => { localStorage.removeItem('t'); setUser(null); };
  if (!ready) return null;
  return <Ctx.Provider value={{ user, setUser, logout }}><BrowserRouter><Nav /><Routes>
    <Route path="/" element={<Home />} /><Route path="/jobs" element={<Jobs />} /><Route path="/jobs/:id" element={<JobDetail />} />
    <Route path="/login" element={<AuthForm mode="login" />} /><Route path="/register" element={<AuthForm mode="register" />} />
    <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} /></Routes></BrowserRouter></Ctx.Provider>;
}