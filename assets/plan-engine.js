// First Ultra plan engine, copied unchanged from the original web planner (claude.ai artifact 7cV1mwnMAfNJp5154xqrWf).
// FirstUltra/Core/Plan.swift in the app matches this buildPlan. Don't change the plan maths here without changing the app too.
'use strict';
/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = d => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
const weeksBetween = (a, b) => Math.round((mondayOf(b) - mondayOf(a)) / 6048e5);
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const fmtD = (d, o = {month:'short', day:'numeric'}) => d.toLocaleDateString(undefined, o);
const todayISO = () => iso(new Date());
const fmtMin = m => { m = Math.round(m || 0); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r}` : `${h} h`; };
const r5 = x => Math.max(5, Math.round(x / 5) * 5);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/* ---------- training model ---------- */
// Targets are in minutes of time on feet. Ultra training for a new runner is time-based:
// pace varies wildly on trails, and tendons care about time and impact, not split times.
const DIST = {
  '50k':  {label:'50K',     peakVol:420, longCap:240, b2bCap:60,  b2bRatio:.3, taper:2, minWeeks:{none:36, short:30, base:22, solid:16}},
  '50mi': {label:'50 mile', peakVol:540, longCap:300, b2bCap:150, b2bRatio:.5, taper:3, minWeeks:{none:52, short:44, base:34, solid:26}},
  '100k': {label:'100K',    peakVol:600, longCap:330, b2bCap:180, b2bRatio:.5, taper:3, minWeeks:{none:60, short:52, base:42, solid:32}},
  '100mi':{label:'100 mile',peakVol:720, longCap:360, b2bCap:210, b2bRatio:.55,taper:3, minWeeks:{none:78, short:70, base:58, solid:44}},
};
const LEVELS = {
  none:  {label:"I don't run yet", hint:'Starts with 8–12 weeks of run/walk', fWeeks:8, startVol:150},
  short: {label:'I can run 20 min nonstop', hint:'Starts with 4–6 weeks of run/walk', fWeeks:4, startVol:150},
  base:  {label:'I run 10–20 mi a week', hint:'Starts at about 3 h a week', fWeeks:0, startVol:180},
  solid: {label:'I run 20+ mi a week', hint:'Starts at about 4½ h a week', fWeeks:0, startVol:270},
};
// Run/walk ladder for the Foundation phase: reps × (run min + walk min)
const LADDER = [
  {reps:8, run:1, walk:2}, {reps:8, run:1.5, walk:2}, {reps:7, run:2, walk:1.5}, {reps:6, run:3, walk:1.5},
  {reps:5, run:4, walk:1}, {reps:4, run:6, walk:1}, {reps:3, run:8, walk:1}, {reps:2, run:12, walk:1},
];
// Joint-protection ladder: starts walk-heavy, 12 rungs instead of 8.
const LADDER_GENTLE = [
  {reps:10, run:.5, walk:1.5}, {reps:8, run:1, walk:2}, {reps:9, run:1, walk:2}, {reps:8, run:1.5, walk:2},
  {reps:7, run:2, walk:2}, {reps:7, run:2, walk:1.5}, {reps:6, run:3, walk:1.5}, {reps:6, run:3, walk:1},
  {reps:5, run:4, walk:1}, {reps:4, run:5, walk:1}, {reps:4, run:6, walk:1}, {reps:3, run:8, walk:1},
];
const fmtDur = m => m < 1 ? `${Math.round(m * 60)} s` : `${m} min`;
const recWeeks = p => Math.round(DIST[p.distance].minWeeks[p.level] * (p.gentle ? 1.25 : 1));
// Which weekday (0 = Mon) holds which run. Q quality, E easy, L long, E2 easy or back-to-back.
const RUN_SLOTS = {
  sat: {3:{1:'Q',3:'E',5:'L'}, 4:{1:'Q',3:'E',5:'L',6:'E2'}, 5:{1:'Q',2:'E',3:'E',5:'L',6:'E2'}},
  sun: {3:{2:'Q',4:'E',6:'L'}, 4:{1:'Q',3:'E',5:'E2',6:'L'}, 5:{1:'Q',2:'E',3:'E',5:'E2',6:'L'}},
};
const LIFT_DAYS = { sat:{1:[0], 2:[0,3], 3:[0,2,4]}, sun:{1:[2], 2:[0,3], 3:[0,2,4]} };
// Exercise library. basis = which 5-rep max sets the starting weight; eq = bar | db | cable | bw (bodyweight) | time.
const EX = {
  squat:    {name:'Back squat', basis:'squat', eq:'bar', how:'Bar on your upper back, feet shoulder-width. Sit down between your heels to just below parallel, then drive up.'},
  tbdl:     {name:'Trap-bar deadlift', basis:'dead', eq:'bar', how:'Use the high handles if the bar has them. Push the floor away, stand tall, lower under control.'},
  rdl:      {name:'Romanian deadlift', basis:'dead', eq:'bar', how:'Soft knees. Push your hips back until you feel your hamstrings stretch, keeping the bar against your legs.'},
  bss:      {name:'Bulgarian split squat', basis:'squat', eq:'db', per:'per hand', side:'leg', how:'Rear foot on a bench, front shin close to vertical. Lower until your back knee nearly touches the floor.'},
  sllp:     {name:'Single-leg leg press', basis:'squat', eq:'machine', side:'leg', how:'One foot in the middle of the platform. Lower only as deep as feels good on your knee (aim for about 90°), then press up without locking out. Weight is plates added, not the sled. Machines vary a lot, so treat your first session as a test and adjust.'},
  stepup:   {name:'Dumbbell step-up', basis:'squat', eq:'db', per:'per hand', side:'leg', how:'Knee-height box. Drive up through the top foot without pushing off the bottom one.'},
  calf:     {name:'Single-leg calf raise', basis:'squat', eq:'db', per:'in one hand', side:'leg', how:'Ball of one foot on a step, hold a rail with your free hand. Full stretch at the bottom, 1 s pause at the top, 3 s down.'},
  tib:      {name:'Tibialis raise', eq:'bw', how:'Back against a wall, heels 1–2 ft out from it. Lift your toes as high as you can, then lower slowly. Protects your shins.'},
  dbrow:    {name:'One-arm dumbbell row', basis:'bench', eq:'db', side:'arm', how:'One knee and hand on a bench. Pull the dumbbell to your hip without twisting your torso.'},
  bench:    {name:'Bench press', basis:'bench', eq:'bar', how:'Shoulder blades pinched, feet planted. Lower to mid-chest, press up and slightly back.'},
  pulldown: {name:'Lat pulldown', basis:'bench', eq:'cable', how:'Grip just wider than shoulders. Pull the bar to your upper chest, control it back up.'},
  ohp:      {name:'Standing overhead press', basis:'press', eq:'bar', how:'Squeeze your glutes, press straight up and move your head through at the top.'},
  cablerow: {name:'Seated cable row', basis:'bench', eq:'cable', how:'Sit tall, pull the handle to your lower ribs, pause, return slowly.'},
  incdb:    {name:'Incline dumbbell press', basis:'bench', eq:'db', per:'per hand', how:'Bench at about 30°. Lower the dumbbells to upper-chest level, press up.'},
  facepull: {name:'Cable face pull', basis:'bench', eq:'cable', how:'Rope at face height. Pull toward your eyes with elbows high and wide.'},
  carry:    {name:"Farmer's carry", basis:'dead', eq:'db', per:'per hand', rUnit:'m', how:'Heavy dumbbells at your sides. Walk tall with short, quick steps. Builds the trunk you need late in a race.'},
  goblet:   {name:'Goblet squat', basis:'squat', eq:'db', how:'Hold one dumbbell against your chest and sit down between your heels.'},
  deadbug:  {name:'Dead bug', eq:'bw', side:'side', how:'On your back, low back pressed into the floor. Slowly extend the opposite arm and leg, then switch.'},
  sideplank:{name:'Side plank', eq:'time', side:'side', rUnit:'s', how:'Straight line from head to feet. Keep your hips from sagging.'},
  kneeraise:{name:'Hanging knee raise', eq:'bw', how:'Hang from a pull-up bar and curl your knees to your chest without swinging.'},
  pushup:   {name:'Push-up', eq:'bw', how:'Body in a straight line, chest to just above the floor.'},
};
// Sessions: [exercise, sets, reps (or seconds / metres), share of estimated 1-rep max]. Loads leave about 3 reps in reserve.
const LIFT = {
  lower:     {title:'Strength A · lower body', min:50, ex:[['squat',3,6,.72],['rdl',3,8,.5],['sllp',3,10,.4],['calf',3,12,.08],['tib',2,20],['dbrow',3,10,.25]]},
  lowerHeavy:{title:'Strength A · heavy and short', min:40, ex:[['tbdl',3,4,.82],['stepup',2,8,.1],['calf',3,12,.08],['tib',2,20],['dbrow',3,8,.27]]},
  upper:     {title:'Strength B · upper body + core', min:45, ex:[['bench',3,6,.75],['pulldown',3,10,.45],['ohp',3,8,.68],['cablerow',3,10,.45],['deadbug',3,10],['sideplank',3,30]]},
  upperOnly: {title:'Strength C · upper body + carries', min:35, ex:[['incdb',3,10,.25],['dbrow',3,10,.25],['facepull',3,15,.15],['carry',3,40,.2],['kneeraise',3,10]]},
  maint:     {title:'Strength · maintenance', min:30, ex:[['tbdl',2,5,.75],['bench',2,5,.75],['dbrow',2,8,.27],['calf',2,12,.08],['sideplank',2,30]]},
  light:     {title:'Strength · light', min:30, ex:[['goblet',2,8,.15],['pushup',2,10],['dbrow',2,10,.22],['deadbug',2,10]]},
};
const LIFT_NOTE = 'Leave about 3 reps in the tank on every set. Rest 2–3 min after sets of the first lift and 60–90 s on the rest. Tap an exercise for form cues.';
const PHASES = {
  foundation:{name:'Foundation', ph:'--ph-foundation', blurb:'Run/walk intervals and long hikes. Your muscles are strong from lifting, but tendons and bones adapt to impact far more slowly. Repeat a week if anything aches.'},
  base:      {name:'Base', ph:'--ph-base', blurb:'Mostly easy running. Weekly time grows a few percent a week, with a lighter week every fourth. Lifting stays, with less leg volume.'},
  build:     {name:'Build', ph:'--ph-build', blurb:'Longer long runs, hill work and back-to-back days. Leg lifting turns heavy but short so it supports the running.'},
  peak:      {name:'Peak', ph:'--ph-peak', blurb:'Your biggest weeks. Rehearse race shoes, pack, food and pacing on terrain like the course.'},
  taper:     {name:'Taper', ph:'--ph-taper', blurb:'Volume drops so you arrive fresh. Keep a little intensity. Feeling restless is normal.'},
  race:      {name:'Race week', ph:'--ph-race', blurb:'Short, easy shakeouts. Sleep, eat well and lay out your gear early.'},
};
const KIND = {runwalk:'Run/walk', hike:'Long', run:'Easy', quality:'Quality', long:'Long', b2b:'Back-to-back', strength:'Lift', race:'Race', rest:'Recovery', cross:'Cross-train'};
const crossTrain = min => ({kind:'cross', title:'Low-impact cardio', min, detail:'Bike, elliptical, rower or incline treadmill walk at easy effort (RPE 3–4). Builds your aerobic engine without the pounding.'});

const easy = min => ({kind:'run', title:'Easy run', min, detail:'Conversational effort (RPE 3–4). Walk breaks are fine. Trails or grass when you can.'});
const strides = min => ({kind:'run', title:'Easy run + strides', min, detail:'Easy running, then 6 × 20 s strides: quick and relaxed, with full recovery between.'});
function quality(phase, cut, j, min) {
  if (cut || phase === 'base') return strides(min);
  if (phase === 'peak') return {kind:'quality', title:'Race-specific hills', min, detail:'Hilly route at race effort. Run the flats and downhills, power-hike steep climbs with hands on knees.'};
  return j % 2 === 0
    ? {kind:'quality', title:'Hill repeats', min, detail:'15 min easy, then 6–10 × 60–90 s hard uphill (RPE 7–8), walking back down to recover. Easy running to finish.'}
    : {kind:'quality', title:'Steady run', min, detail:'15 min easy, then 20–30 min comfortably hard (RPE 6), then easy to finish.'};
}
function longRun(phase, min, cut, gentle) {
  let d = phase === 'base' || phase === 'taper' ? 'Easy effort the whole way. Walk the uphills.' : 'Trails or hills like your race. Wear race shoes and pack, and walk the climbs.';
  if (gentle) d += ' Run/walk the whole way (for example run 4 min, walk 1 min) and hike every climb.';
  if (min >= 90) d += ' Eat from 45 min on: about 200–300 calories and 500 ml of fluid per hour.';
  return {kind:'long', title: cut ? 'Long run (shorter)' : 'Long run', min, detail:d};
}
const b2bRun = (min, sat) => ({kind:'b2b', title: sat ? 'Back-to-back · day 2' : 'Back-to-back · day 1', min,
  detail: sat ? 'Easy run on legs tired from yesterday. That is the point: it teaches you to keep moving late in a race.'
              : "Steady, easy run. Tomorrow's long run then starts on tired legs, like the back half of an ultra."});

function addStrength(days, phase, cut, p) {
  const key = p.longDay === 'sun' ? 'sun' : 'sat';
  let count = +p.strengthDays;
  if (phase === 'peak') count = Math.min(count, 2);
  if (phase === 'taper') count = Math.min(count, 1);
  if (phase === 'race') count = 0;
  const slots = LIFT_DAYS[key][+p.strengthDays].slice(0, count);
  let seq = phase === 'taper' ? ['light'] : phase === 'peak' ? ['maint', 'upper'] : [phase === 'build' ? 'lowerHeavy' : 'lower', 'upper', 'upperOnly'];
  // With a Sunday long run, keep the leg session off Monday.
  if (key === 'sun' && count >= 2 && seq.length > 1) seq = [seq[1], seq[0], ...seq.slice(2)];
  slots.forEach((d, i) => {
    const k = seq[i] || 'upperOnly', S = LIFT[k];
    days[d].push({kind:'strength', title:S.title, min:S.min, lift:k, cut, detail:(cut ? 'Recovery week: one set fewer on everything. ' : '') + LIFT_NOTE});
  });
}

function buildPlan(p) {
  const D = DIST[p.distance], L = LEVELS[p.level];
  if (!D || !L) return {error:'Pick a race distance and a starting level in Setup.'};
  const start = mondayOf(parse(p.startDate)), race = parse(p.raceDate);
  const N = weeksBetween(start, race) + 1;
  if (!(N >= 6)) return {error:'Set a race date at least 6 weeks after the plan start.'};
  const notes = [];
  const sat = p.longDay !== 'sun';
  const key = sat ? 'sat' : 'sun';
  const runDays = clamp(+p.runDays || 4, 3, 5);
  const gentle = !!p.gentle;
  const rec = recWeeks(p);
  if (gentle) notes.push({sev:'info', text:'Joint protection is on: a longer run/walk start, smaller weekly increases (about 6%), a lighter week every third week, and a lower running peak. With 4+ run days, one easy run a week becomes low-impact cardio.'});
  if (N < rec) notes.push({id:'runway', sev: N < rec * .75 ? 'bad' : 'warn', text:`Your race is ${N} weeks out. From where you are now, ${rec}+ weeks is a safer runway for a ${D.label}. This plan compresses to fit, which raises injury risk. Consider a later race${p.distance !== '50k' ? ' or a 50K first' : ''}.`});
  if (p.distance === '100mi' && (p.level === 'none' || p.level === 'short')) notes.push({sev:'warn', text:'Most coaches suggest finishing a 50K or 50-mile race before a first 100-miler. A 50K about halfway through this plan makes a good stepping stone.'});
  if (runDays === 3 && p.distance !== '50k') notes.push({sev:'info', text:'For 50 miles and up, 4 run days a week allows back-to-back long runs, which this plan adds in the Build phase.'});

  const blank = () => Array.from({length:7}, () => []);
  const weeks = [];
  const ladder = gentle ? LADDER_GENTLE : LADDER;
  let fWeeks = Math.round(L.fWeeks * ladder.length / LADDER.length);
  const taper = D.taper;
  let M = N - fWeeks - taper;
  if (M < 4 && fWeeks) {
    const cut = Math.min(fWeeks, 4 - M); fWeeks -= cut; M += cut;
    if (cut) notes.push({sev:'warn', text:`The run/walk Foundation phase was shortened by ${cut} week${cut > 1 ? 's' : ''} to fit before race day.`});
  }

  // Foundation: run/walk ladder on 3 days, whatever the run-day setting.
  const firstStep = ladder.length - fWeeks;
  for (let i = 0; i < fWeeks; i++) {
    const step = firstStep + i, s = ladder[step];
    const days = blank();
    for (const [d, k] of Object.entries(RUN_SLOTS[key][3])) {
      if (k === 'L') days[+d].push({kind:'hike', title:'Long hike + run intervals', min:r5(40 + 35 * step / (ladder.length - 1)),
        detail:`Brisk hike on trails or hills. Every 5 min, run ${fmtDur(s.run)}. Practise drinking and snacking on the move.`});
      else days[+d].push({kind:'runwalk', title:'Run/walk', min:Math.round(s.reps * (s.run + s.walk) + 10),
        detail:`5 min walk, then ${s.reps} × (run ${fmtDur(s.run)}, walk ${fmtDur(s.walk)}), then 5 min walk. Run slowly enough to talk.`});
    }
    if (gentle && runDays >= 4) days[sat ? 2 : 1].push(crossTrain(clamp(25 + 2 * step, 25, 45)));
    addStrength(days, 'base', false, p);
    weeks.push({phase:'foundation', cut:false, days});
  }

  // Base → Build → Peak: weekly time grows geometrically toward the peak, every 4th week a cutback.
  const hold = M >= 10 ? 2 : M >= 6 ? 1 : 0;
  const cutEvery = gentle ? 3 : 4;
  const isCut = j => (j + 1) % cutEvery === 0 && j < M - hold;
  const peakTarget = D.peakVol * (gentle ? .8 : 1);
  const maxRate = gentle ? 1.06 : 1.09;
  let K = 0; for (let j = 0; j < M - hold; j++) if (!isCut(j)) K++;
  let rate = K > 0 ? Math.pow(peakTarget / L.startVol, 1 / K) : 1;
  let capped = false;
  if (rate > maxRate) { rate = maxRate; capped = true; }
  if (rate < 1) rate = 1;
  let lvl = L.startVol;
  const baseEnd = Math.round((M - hold) * .55);
  for (let j = 0; j < M; j++) {
    const peak = j >= M - hold;
    const phase = peak ? 'peak' : j < baseEnd ? 'base' : 'build';
    const cut = isCut(j);
    let vol;
    if (peak) vol = lvl; else if (cut) vol = lvl * .72; else { vol = lvl; lvl *= rate; }
    vol = Math.min(vol, peakTarget);
    const prog = M > 1 ? j / (M - 1) : 1;
    // With joint protection the long run takes a bigger share: it is run/walk and hiking, so lower impact per minute.
    const long = Math.min(D.longCap, r5(vol * (peak ? (gentle ? .62 : .55) : .32 + (gentle ? .26 : .2) * prog)));
    const useB2B = runDays >= 4 && !cut && (phase === 'build' || phase === 'peak');
    const slots = Object.entries(RUN_SLOTS[key][runDays]);
    const xtDay = gentle && runDays >= 4 ? (slots.find(([, k]) => k === 'E') || [])[0] : undefined;
    const nonLong = slots.filter(([d, k]) => k !== 'L' && d !== xtDay).length;
    const b2b = useB2B ? Math.min(D.b2bCap, Math.max(r5(long * D.b2bRatio), r5((vol - long) / Math.max(1, nonLong)))) : 0;
    const others = slots.filter(([d, k]) => k !== 'L' && !(k === 'E2' && useB2B) && d !== xtDay).length;
    const per = clamp(r5((vol - long - b2b) / Math.max(1, others)), 20, 75);
    const days = blank();
    for (const [d, k] of slots) {
      if (k === 'L') days[+d].push(longRun(phase, long, cut, gentle));
      else if (d === xtDay) days[+d].push(crossTrain(clamp(per + 10, 30, 75)));
      else if (k === 'E2' && useB2B) days[+d].push(b2bRun(b2b, sat));
      else if (k === 'Q') days[+d].push(quality(phase, cut, j, per));
      else days[+d].push(easy(per));
    }
    addStrength(days, phase, cut, p);
    weeks.push({phase, cut, days});
  }
  const runMin = w => w.days.flat().filter(s => !['strength', 'race', 'cross'].includes(s.kind)).reduce((a, s) => a + s.min, 0);
  const crossMin = w => w.days.flat().filter(s => s.kind === 'cross').reduce((a, s) => a + s.min, 0);
  const longMin = w => Math.max(0, ...w.days.flat().filter(s => s.kind === 'long' || s.kind === 'hike').map(s => s.min));
  const peakVol = Math.max(L.startVol, ...weeks.map(runMin));
  const peakLong = Math.max(60, ...weeks.map(longMin));
  if (capped) notes.push({sev:'warn', text:`To keep weekly increases under about ${Math.round((maxRate - 1) * 100)}%, your biggest running week reaches ${fmtMin(peakVol)} instead of the ${fmtMin(peakTarget)} target. A later race date would let it build fully.`});

  // Taper
  const fr = taper === 3 ? [.75, .55] : [.65];
  fr.forEach((f, i) => {
    const vol = peakVol * f;
    const long = r5(peakLong * (fr.length === 2 && i === 0 ? .6 : .45));
    const slots = Object.entries(RUN_SLOTS[key][runDays]);
    const per = clamp(r5((vol - long) / Math.max(1, slots.length - 1)), 20, 60);
    const days = blank();
    for (const [d, k] of slots) {
      if (k === 'L') days[+d].push(longRun('taper', long, false, gentle));
      else if (k === 'Q') days[+d].push(strides(per));
      else days[+d].push(easy(per));
    }
    addStrength(days, 'taper', false, p);
    weeks.push({phase:'taper', cut:false, days});
  });

  // Race week
  const rw = blank(), ri = (race.getDay() + 6) % 7;
  if (ri >= 3) rw[1].push({kind:'run', title:'Shakeout + strides', min:30, detail:'30 min easy with 4 × 20 s strides. Legs should feel springy, not tired.'});
  if (ri >= 5) rw[3].push({kind:'run', title:'Shakeout', min:20, detail:'20 min very easy. Lay out race gear tonight, not the night before.'});
  rw[ri].push({kind:'race', title:`Race day · ${D.label}`, min:0, detail:'Start slower than feels right. Eat from the first 30–45 min and keep eating. Hike the climbs. Smile at the aid stations.'});
  for (let d = ri + 1; d < 7; d++) rw[d].push({kind:'rest', title:'Recovery', min:0, detail:'Walk, eat, sleep. No running for a few days.'});
  weeks.push({phase:'race', cut:false, days:rw});

  weeks.forEach((w, i) => {
    w.index = i;
    w.start = iso(addDays(start, i * 7));
    w.total = runMin(w);
    w.cross = crossMin(w);
    w.long = longMin(w);
  });
  return {weeks, notes, N, start:iso(start), peakVol, peakLong, D, raceIdx:ri};
}
