// Plan builder page. The plan itself comes from plan-engine.js (buildPlan), unchanged from the app.
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// The app's wording, so people who don't lift never read about lifting (Phase.blurb(lifting:) in Plan.swift).
// Base also names the right recovery rhythm: every third week with joint protection (cutEvery in buildPlan).
const BLURB = {
  foundation: () => 'Run/walk intervals and long hikes. Muscles adapt to new work within weeks, but tendons and bones adapt to impact far more slowly, so this phase builds gradually. Repeat a week if anything aches.',
  base: (l, g) => `Mostly easy running. Weekly time grows a few percent a week, with a lighter week every ${g ? 'third' : 'fourth'}.` + (l ? ' Your strength sessions continue, with less leg volume.' : ''),
  build: l => 'Longer long runs, hill work and back-to-back days.' + (l ? ' Leg strength work turns heavy but short so it supports the running.' : ''),
  peak: () => PHASES.peak.blurb, taper: () => PHASES.taper.blurb, race: () => PHASES.race.blurb,
};
const NOTE_LABEL = {info:'Note', warn:'Heads up', bad:'Tight'};

function defaults() {
  const start = addDays(mondayOf(new Date()), 7);
  const p = {distance:'50k', startDate:iso(start), level:'none', runDays:4, strengthDays:0, longDay:'sat', gentle:true};
  // First visit: a Saturday race at the suggested runway, so the sample plan isn't flagged as tight.
  return {...p, raceDate:iso(addDays(start, (recWeeks(p) - 1) * 7 + 5))};
}
// Settings live in the URL so a plan can be bookmarked or shared.
const KEYS = {distance:'d', raceDate:'race', startDate:'start', level:'lvl', runDays:'rd', strengthDays:'sd', longDay:'ld', gentle:'jp'};
function fromURL() {
  const p = defaults(), q = new URLSearchParams(location.search);
  if (DIST[q.get('d')]) p.distance = q.get('d');
  if (/^\d{4}-\d\d-\d\d$/.test(q.get('race'))) p.raceDate = q.get('race');
  if (/^\d{4}-\d\d-\d\d$/.test(q.get('start'))) p.startDate = q.get('start');
  if (LEVELS[q.get('lvl')]) p.level = q.get('lvl');
  if (['3', '4', '5'].includes(q.get('rd'))) p.runDays = +q.get('rd');
  if (['0', '1', '2', '3'].includes(q.get('sd'))) p.strengthDays = +q.get('sd');
  if (['sat', 'sun'].includes(q.get('ld'))) p.longDay = q.get('ld');
  if (q.has('jp')) p.gentle = q.get('jp') === '1';
  return p;
}
function toURL(p) {
  const q = new URLSearchParams();
  for (const [k, s] of Object.entries(KEYS)) q.set(s, k === 'gentle' ? (p.gentle ? '1' : '0') : p[k]);
  history.replaceState(null, '', '?' + q);
}

// The engine schedules 1–3 strength days. With none, build as usual and leave the strength sessions out:
// running minutes don't depend on strength days, so the running plan is the same as the app's.
function makePlan(p) {
  const P = buildPlan({...p, strengthDays: p.strengthDays || 1});
  if (!P.error && !p.strengthDays) P.weeks.forEach(w => { w.days = w.days.map(d => d.filter(s => s.kind !== 'strength')); });
  return P;
}

/* ---------- form ---------- */
const f = $('#pf');
const radios = (el, name, opts) => { el.innerHTML = opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}"><span>${l}</span></label>`).join(''); };
$('#pf-level').innerHTML = Object.entries(LEVELS).map(([k, l]) => `<label><input type="radio" name="level" value="${k}"><b>${l.label}</b><small>${l.hint}</small></label>`).join('');
radios($('#pf-rd'), 'runDays', [[3, 3], [4, 4], [5, 5]]);
radios($('#pf-ld'), 'longDay', [['sat', 'Sat'], ['sun', 'Sun']]);
radios($('#pf-sd'), 'strengthDays', [[0, 'None'], [1, 1], [2, 2], [3, 3]]);

function writeForm(p) {
  $('#pf-dist').value = p.distance; $('#pf-race').value = p.raceDate; $('#pf-start').value = p.startDate; $('#pf-gentle').checked = p.gentle;
  for (const n of ['level', 'runDays', 'longDay', 'strengthDays']) { const r = f.querySelector(`input[name="${n}"][value="${p[n]}"]`); if (r) r.checked = true; }
}
function readForm() {
  const v = n => (f.querySelector(`input[name="${n}"]:checked`) || {}).value;
  return {distance:$('#pf-dist').value, raceDate:$('#pf-race').value, startDate:$('#pf-start').value, level:v('level'),
    runDays:+v('runDays'), strengthDays:+v('strengthDays'), longDay:v('longDay'), gentle:$('#pf-gentle').checked};
}

/* ---------- output ---------- */
const phaseTag = ph => `<span class="phase" style="--ph:var(${PHASES[ph].ph})">${PHASES[ph].name}</span>`;
const repText = (E, n) => `${n}${E.rUnit === 's' ? ' s' : E.rUnit === 'm' ? ' m' : ''}${E.side ? '/' + E.side : ''}`;
// The app's lifting note mentions tapping an exercise for form cues; the list here isn't tappable.
function sessHTML(s) {
  let extra = '';
  if (s.kind === 'strength' && s.lift) extra = `<ul class="exlist">${LIFT[s.lift].ex.map(([id, sets, reps]) => `<li>${EX[id].name} <span class="num">${s.cut ? Math.max(1, sets - 1) : sets} × ${repText(EX[id], reps)}</span></li>`).join('')}</ul>`;
  return `<div class="sess k-${s.kind}"><div class="sess-top"><span class="tag">${KIND[s.kind] || ''}</span><b>${esc(s.title)}</b>${s.min ? `<span class="mins num">${fmtMin(s.min)}</span>` : ''}</div><p>${esc(s.detail.replace(' Tap an exercise for form cues.', ''))}</p>${extra}</div>`;
}
function weekHTML(w, i, lifting, gentle) {
  const ws = parse(w.start);
  const days = w.days.map((day, d) => `<li class="day"><div class="dd"><span class="dow">${DOW[d]}</span><span class="dom">${addDays(ws, d).getDate()}</span></div>
    <div class="sessions">${day.length ? day.map(sessHTML).join('') : '<div class="rest">Rest day. Walk, stretch, sleep.</div>'}</div></li>`).join('');
  return `<details class="wk" id="w${i + 1}"${i === 0 ? ' open' : ''}><summary>
      <span class="wk-n num">${i + 1}</span>
      <span class="wk-main"><b>${fmtD(ws)} – ${fmtD(addDays(ws, 6))}</b><span>${phaseTag(w.phase)}${w.cut ? ' <span class="tag">Recovery week</span>' : ''}</span></span>
      <span class="wk-stats num">${w.phase === 'race' ? 'Race' : fmtMin(w.total + (w.cross || 0))}<small>${w.long ? 'long ' + fmtMin(w.long) : ''}</small></span>
    </summary>
    <p class="wk-tip">${w.cut ? 'Lighter week on purpose. This is when your body absorbs the work of the last few weeks. ' : ''}${BLURB[w.phase](lifting, gentle)}${w.cross ? ` Running ${fmtMin(w.total)} + low-impact cardio ${fmtMin(w.cross)}.` : ''}</p>
    <ol class="days">${days}</ol></details>`;
}
function runwayHTML(p, P) {
  const rec = recWeeks(p), D = DIST[p.distance];
  const sev = P.N >= rec ? 'ok' : P.N >= rec * .75 ? 'warn' : 'bad';
  const best = addDays(mondayOf(parse(p.startDate)), (rec - 1) * 7 + 5);
  const fix = sev === 'ok' ? (P.N === rec ? 'Right on the suggested runway. A later race date would leave room for missed weeks or setbacks.' : `You have ${P.N - rec} week${P.N - rec === 1 ? '' : 's'} of slack for missed weeks or setbacks.`)
    : `A race on or after <b>${fmtD(best, {weekday:'short', month:'short', day:'numeric', year:'numeric'})}</b> gives you the full runway. <button class="btn small" type="button" data-date="${iso(best)}">Use that date</button>`;
  return `<div class="runway ${sev}">
    <div class="runway-top"><span class="verdict">${{ok:'Enough runway', warn:'Tight', bad:'Too short'}[sev]}</span><span><b class="num">${P.N}</b> weeks to race day · suggested <b class="num">${rec}+</b> for a ${D.label} from your level${p.gentle ? ' with joint protection' : ''}</span></div>
    <div class="bar"><i style="width:${clamp(P.N / rec * 100, 4, 100)}%"></i></div>
    <p>${fix}</p></div>`;
}
function render() {
  const p = readForm(), out = $('#out');
  if (!p.raceDate || !p.startDate) { out.innerHTML = '<div class="note info"><b>Dates</b><span>Pick a race date and a start week.</span></div>'; return; }
  const P = makePlan(p);
  if (P.error) { out.innerHTML = `<div class="note bad"><b>Dates</b><span>${esc(P.error)}</span></div>`; return; }
  toURL(p);
  const lifting = p.strengthDays > 0;
  const spans = [];
  P.weeks.forEach((w, i) => { const l = spans[spans.length - 1]; if (l && l.phase === w.phase) l.to = i; else spans.push({phase:w.phase, from:i, to:i}); });
  const notes = P.notes.filter(n => n.id !== 'runway').map(n => `<div class="note ${n.sev}"><b>${NOTE_LABEL[n.sev]}</b><span>${esc(n.text)}</span></div>`).join('');
  out.innerHTML = `
  <section class="psec">${runwayHTML(p, P)}${notes ? `<div class="notes">${notes}</div>` : ''}</section>
  <section class="psec">
    <div class="tiles">
      <div class="tile"><b class="num">${P.weeks.length}</b><span>weeks, starting ${fmtD(parse(P.start), {month:'short', day:'numeric'})}</span></div>
      <div class="tile"><b class="num">${fmtMin(P.peakVol)}</b><span>biggest running week</span></div>
      <div class="tile"><b class="num">${fmtMin(P.peakLong)}</b><span>longest run</span></div>
      <div class="tile"><b>${P.D.label}</b><span>${fmtD(parse(p.raceDate), {weekday:'short', month:'short', day:'numeric', year:'numeric'})}</span></div>
    </div>
  </section>
  <section class="psec">
    <h2 class="display">The climb to race day</h2>
    <div class="chartbox"><div class="legend"><span><i style="background:var(--accent)"></i>Weekly running</span><span><i style="background:var(--ink);opacity:.55"></i>Long run</span></div><div id="chart-wrap"></div></div>
    <p class="hint">Plans are in time on your feet, not miles: on trails, pace varies, and your joints count minutes of impact, not split times. Tap the chart to jump to a week.</p>
  </section>
  <section class="psec">
    <h2 class="display">Phases</h2>
    <div class="phases">${spans.map(s => `<div>${phaseTag(s.phase)}<span class="eyebrow">${s.from === s.to ? `Week ${s.from + 1}` : `Weeks ${s.from + 1}–${s.to + 1}`}</span><p>${BLURB[s.phase](lifting, p.gentle)}</p></div>`).join('')}</div>
  </section>
  <section class="psec">
    <div class="psec-head"><h2 class="display">Week by week</h2>
      <div class="actions"><button class="btn small" type="button" data-act="all">Open all</button><button class="btn small" type="button" data-act="print">Print</button><button class="btn small" type="button" data-act="copy">Copy link</button></div></div>
    <div class="weeks">${P.weeks.map((w, i) => weekHTML(w, i, lifting, p.gentle)).join('')}</div>
    <p class="hint">${lifting ? 'Strength sessions are shown for a gym. The app swaps in dumbbell or bodyweight moves and sets your weights from what you log. ' : ''}First Ultra is a training planner, not medical advice. Check with a doctor before starting, and stop if something hurts.</p>
  </section>`;
  out._plan = P;
  drawProfile(P);
}

// Weekly running as an elevation profile (drawProfile in the original planner, without the logging layers).
function drawProfile(P) {
  const wrap = $('#chart-wrap'); if (!wrap) return;
  const W8 = P.weeks, n = W8.length;
  const W = Math.max(300, wrap.clientWidth || 800), H = W < 500 ? 230 : 270;
  const pl = 38, pr = 14, pt = 22, pb = 52;
  const maxM = Math.max(60, ...W8.map(w => w.total));
  const step = maxM > 600 ? 4 : 2;
  const yMax = Math.ceil(maxM / 60 / step) * step * 60;
  const bw = (W - pl - pr) / n;
  const x = i => pl + (i + .5) * bw;
  const y = m => pt + (H - pt - pb) * (1 - m / yMax);
  let s = '';
  for (let h = 0; h * 60 <= yMax; h += step) s += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y(h * 60)}" y2="${y(h * 60)}"/><text x="${pl - 6}" y="${y(h * 60) + 4}" text-anchor="end">${h} h</text>`;
  const vals = W8.map((w, i) => w.phase === 'race' ? (W8[i - 1] ? W8[i - 1].total * .5 : 0) : w.total);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const x0 = pl.toFixed(1), x1 = (W - pr).toFixed(1);
  s += `<path class="area" d="M${x0},${y(0)} L${x0},${y(vals[0]).toFixed(1)} L${pts.join(' L')} L${x1},${y(vals[n - 1]).toFixed(1)} L${x1},${y(0)} Z"/>`;
  s += `<polyline class="ridge" points="${x0},${y(vals[0]).toFixed(1)} ${pts.join(' ')} ${x1},${y(vals[n - 1]).toFixed(1)}"/>`;
  s += `<polyline class="longline" points="${W8.map((w, i) => w.long ? `${x(i).toFixed(1)},${y(w.long).toFixed(1)}` : '').filter(Boolean).join(' ')}"/>`;
  const sy = H - pb + 10, spans = [];
  W8.forEach((w, i) => { const l = spans[spans.length - 1]; if (l && l.phase === w.phase) l.to = i; else spans.push({phase:w.phase, from:i, to:i}); });
  spans.forEach(sp => {
    const xa = pl + sp.from * bw, wd = (sp.to - sp.from + 1) * bw;
    s += `<rect x="${xa + .5}" y="${sy}" width="${Math.max(1, wd - 1)}" height="7" rx="2" style="fill:var(${PHASES[sp.phase].ph})"/>`;
    if (wd > 54) s += `<text class="phlbl" x="${xa + 2}" y="${sy + 22}">${sp.phase === 'race' ? '' : PHASES[sp.phase].name}</text>`;
  });
  const fx = x(n - 1), fy = y(vals[n - 1]);
  s += `<line class="pole" x1="${fx}" x2="${fx}" y1="${fy}" y2="${fy - 26}"/><path class="flag" d="M${fx},${fy - 26} l-14,5 l14,5 z"/>`;
  W8.forEach((w, i) => { s += `<rect class="hit" data-week="${i + 1}" x="${pl + i * bw}" y="${pt}" width="${bw}" height="${sy - pt}"><title>Week ${i + 1} · ${PHASES[w.phase].name} · ${w.phase === 'race' ? 'race week' : fmtMin(w.total) + ' running'}${w.long ? ' · long ' + fmtMin(w.long) : ''}</title></rect>`; });
  wrap.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly running time across ${n} weeks, rising to ${fmtMin(P.peakVol)} before the taper">${s}</svg>`;
}

/* ---------- events ---------- */
f.addEventListener('input', render);
f.addEventListener('change', render);
document.addEventListener('click', e => {
  const t = e.target.closest('[data-date],[data-week],[data-act]'); if (!t) return;
  if (t.dataset.date) { $('#pf-race').value = t.dataset.date; render(); return; }
  if (t.dataset.week) { const d = $('#w' + t.dataset.week); if (d) { d.open = true; d.scrollIntoView({behavior:'smooth', block:'start'}); } return; }
  const act = t.dataset.act;
  if (act === 'all') { const all = [...document.querySelectorAll('details.wk')], open = !all.every(d => d.open); all.forEach(d => { d.open = open; }); t.textContent = open ? 'Close all' : 'Open all'; }
  if (act === 'print') window.print();
  if (act === 'copy') navigator.clipboard?.writeText(location.href).then(() => { t.textContent = 'Link copied'; setTimeout(() => { t.textContent = 'Copy link'; }, 2000); }, () => {});
});
window.addEventListener('beforeprint', () => document.querySelectorAll('details.wk').forEach(d => { d.open = true; }));
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if ($('#out')._plan) drawProfile($('#out')._plan); }, 120); });

writeForm(fromURL());
render();
})();
