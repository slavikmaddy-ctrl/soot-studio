
(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  const PAGE_URLS = ['index.html', 'work.html', 'about.html', 'capabilities.html', 'process.html', 'order.html', 'contact.html'];
  const rebound = document.body.dataset.page | 0;          // 0..4
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // site entry detector: the first page load of this browsing session plays
  // the title card; hops between our own pages do not (session flag dies with the tab)
  const siteEntry = (() => {
    try {
      const seen = sessionStorage.getItem('soot-seen');
      sessionStorage.setItem('soot-seen', '1');
      return !seen;
    } catch (e) { return true; }
  })();
  const wipe    = $('#wipe');
  const track   = $('#track');
  const audioOK = { gate: false };

  let AC = null;
  function cue(type) {
    if (!audioOK.gate) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const t = AC.currentTime;
      const beep = (f0, f1, dur, wave, vol) => {
        const o = AC.createOscillator(), g = AC.createGain();
        o.type = wave; o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + .02);
      };
      if (type === 'shot') beep(620, 180, .1, 'square', .05);
      if (type === 'click') beep(340, 520, .09, 'square', .05);
      if (type === 'parry') beep(880, 1400, .16, 'triangle', .07);
      if (type === 'type') beep(1500, 1050, .03, 'square', .03);
      if (type === 'boom') {
        const b = AC.createBuffer(1, 4410, 44100), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
        const s = AC.createBufferSource(), g = AC.createGain();
        s.buffer = b; g.gain.value = .2;
        s.connect(g).connect(AC.destination); s.start(t);
      }
    } catch (e) {  }
  }
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, () => {
      audioOK.gate = true;
      if (window.__projWake) window.__projWake();   // projector rattle starts after first gesture
      if (window.__onairWake) window.__onairWake(); // the jazz resumes after an internal hop
    }, { passive: true }));

    const reelEl = $('#reelCounter');
  // pages marked data-page="x" (the 404) keep their own cheeky counter
  if (reelEl && !isNaN(parseInt(document.body.dataset.page, 10))) reelEl.innerHTML = 'REEL 0' + (rebound + 1) + '<i>/0' + PAGE_URLS.length + '</i>';

    const wipeBlob = $('#wipeBlob');
  function aimWipe(cx, cy) {    // the ink blooms from where you acted, not from screen centre.
    if (!wipeBlob) return;      // NB: move the BLOB inside the svg, never the svg itself — the
    const px = isFinite(cx) ? cx : window.innerWidth / 2;   // svg is the clip box: shift it and
    const py = isFinite(cy) ? cy : window.innerHeight / 2;  // the far corner of the screen loses
    const dx = (px - window.innerWidth / 2) * 100 / window.innerWidth;   // screen px → viewBox
    const dy = (py - window.innerHeight / 2) * 100 / window.innerHeight; // units (anisotropic map)
    wipeBlob.style.transform = 'translate(' + dx.toFixed(3) + 'px,' + dy.toFixed(3) + 'px)';
  }
  function storedPoint() {
    return [parseFloat(sessionStorage.getItem('soot-ink-x')), parseFloat(sessionStorage.getItem('soot-ink-y'))];
  }
  function inkGone() {
    wipe.classList.remove('on', 'wipe--out');
    if (wipeBlob) wipeBlob.style.transform = '';              // park the blob back at centre
    document.documentElement.classList.remove('ink-cover');   // hand the screen back to the paper
  }
  function reveal() {      // dissolve: the blobOut 'from' is scale(3.4), so the same paint that
    document.documentElement.classList.remove('ink-cover'); // brings back the paper still has the
    wipe.classList.add('wipe--out');                        // blob covering everything — it then
  }                                                         // visibly melts away over the page
  function coveredNow() {
    const p = storedPoint();
    aimWipe(p[0], p[1]);
    wipe.classList.add('on');
    wipe.classList.remove('wipe--in', 'wipe--out');
  }
  window.addEventListener('pageshow', (e) => {  // bfcache return: freeze-frame left mid-wipe
    if (e.persisted && !sessionStorage.getItem('soot-ink')) {
      coveredNow();
      setTimeout(() => {
        reveal();
        setTimeout(inkGone, 380);
      }, 80);
    }
  });
  if (sessionStorage.getItem('soot-ink') === '1') {
    coveredNow();                           // arrival: the new document wakes up already under the ink
    sessionStorage.removeItem('soot-ink');
    setTimeout(() => {
      reveal();
      setTimeout(inkGone, 380);
    }, 80);
    document.body.classList.add('enter-stage');
  }
  $$('a[data-page]').forEach(a => {
    a.addEventListener('click', (e) => {
      const i = +a.dataset.page;
      // "same page" means the SAME document (path + query), not the same section id
      const dest = new URL(a.href);
      if (dest.origin === location.origin &&
          dest.pathname === location.pathname &&
          dest.search === location.search) { e.preventDefault(); return; }
      e.preventDefault();
      audioOK.gate = true;
      cue('click');
      const cx = e.clientX || window.innerWidth / 2;
      const cy = e.clientY || window.innerHeight / 2;
      sessionStorage.setItem('soot-ink', '1');
      sessionStorage.setItem('soot-ink-x', cx);
      sessionStorage.setItem('soot-ink-y', cy);
      aimWipe(cx, cy);
      wipe.classList.add('on', 'wipe--in');
      setTimeout(() => { location.href = PAGE_URLS[i]; }, reduced ? 20 : 300);
    });
  });

    let x = 0, xTarget = 0, maxX = 0, dragging = false, dragSX = 0, dragX0 = 0;
    const touchScroll = matchMedia('(pointer:coarse)').matches || matchMedia('(hover:none)').matches;

  function measure() {
    const railW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail')) || 78;
    maxX = Math.max(0, track.scrollWidth - (window.innerWidth - railW));
  }
  function seek(t) {
    const v = Math.min(maxX, Math.max(0, t));
    if (touchScroll) track.scrollLeft = v;
    else xTarget = v;
  }
  function frame() {
    const prev = x;
    if (touchScroll) {
      x = xTarget = track.scrollLeft;
      skewT = 0;
      track.style.transform = 'none';
    } else {
      x += (xTarget - x) * (reduced ? 1 : .11);
      if (Math.abs(xTarget - x) < .4) x = xTarget;
      skewT = skewT + (Math.max(-1.6, Math.min(1.6, -((x - prev) * .022))) - skewT) * .18;
      if (reduced) skewT = 0;
      track.style.transform = 'translate3d(' + (-x) + 'px,0,0)' + (skewT ? ' skewX(' + skewT.toFixed(3) + 'deg)' : '');
    }
    const vel = x - prev;
    revealPass();
    if (extrasFrame) extrasFrame(vel);
    if (scrubTick) scrubTick();
    requestAnimationFrame(frame);
  }
  let skewT = 0;
  let extrasFrame = null;   // set by the EXTRAS section below (runner/watchers)

  window.addEventListener('wheel', (e) => {
    if (touchScroll) return;
    if (document.getElementById('intro')) return;
    const panel = e.target && e.target.closest ? e.target.closest('.panel') : null;
    if (panel && panel.scrollHeight > panel.clientHeight + 4) {
      const down = e.deltaY > 0;
      const canScroll = down ? panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1 : panel.scrollTop > 1;
      if (canScroll) return;          // panel still has vertical room: native scroll wins
    }
    if (maxX <= 0) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    xTarget = Math.min(maxX, Math.max(0, xTarget + d));
    e.preventDefault();
  }, { passive: false });

  track.addEventListener('pointerdown', (e) => {
    if (touchScroll) return;
    if (e.target.closest('a,button,input,textarea,video,form')) return;
    dragging = true; dragSX = e.clientX; dragX0 = x; track.setPointerCapture(e.pointerId);
    track.classList.add('is-drag');
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging || maxX <= 0) return;
    xTarget = Math.min(maxX, Math.max(0, dragX0 + (dragSX - e.clientX) * 1.6));
  });
  function endDrag() { dragging = false; track.classList.remove('is-drag'); }
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', (e) => {
    if (document.getElementById('intro')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); seek(x + window.innerWidth * .8); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp')   { e.preventDefault(); seek(x - window.innerWidth * .8); }
    if (e.key === 'Home') { seek(0) }
    if (e.key === 'End')  { seek(maxX) }
  });

    const rvs  = $$('.rv');
  const lazy = $$('[data-src]');
  const driftEls = $$('[data-drift]');
  const finePointer = matchMedia('(pointer:fine)').matches;
  let pmx = 0, pmy = 0;                                     // smoothed cursor offset (-.5…+.5)

  function revealPass() {
    const L = -160, R = window.innerWidth + 160;
    for (const el of rvs) {
      if (el.classList.contains('is-in')) continue;
      const r = el.getBoundingClientRect();
      if (r.left < R && r.right > L) el.classList.add('is-in');
    }
    for (const img of lazy) {
      if (img.dataset.done) continue;
      const r = img.getBoundingClientRect();
      if (r.left < R && r.right > L && r.top < window.innerHeight + 160 && r.bottom > -160) {
        if (img.tagName === 'VIDEO') {
          if (img.dataset.poster) img.poster = img.dataset.poster;
          if (img.dataset.src) img.src = img.dataset.src;
        } else {
          img.src = img.dataset.src;
        }
        img.dataset.done = '1';
      }
    }
    if (finePointer && !reduced) {              // cursor parallax: deeper figures swing wider
      pmx += ((mouse.x / window.innerWidth - .5) - pmx) * .07;
      pmy += ((mouse.y / window.innerHeight - .5) - pmy) * .07;
    }
    for (const el of driftEls) {
      const r = el.getBoundingClientRect();
      if (r.right > 0 && r.left < window.innerWidth) {
        const f = +el.dataset.drift || .1;
        el.style.translate = (-(x) * f - pmx * f * 90).toFixed(1) + 'px ' +
                             (-pmy * f * 55).toFixed(1) + 'px';   // reel drift + mouse parallax
      }
    }
  }
  requestAnimationFrame(frame);
  window.addEventListener('resize', () => { measure(); xTarget = Math.min(xTarget, maxX); });
  measure();
  // the reel's length shifts as fonts (and lazy content) settle — keep maxX honest
  const remeasure = () => { measure(); xTarget = Math.min(xTarget, maxX); };
  if (window.ResizeObserver) {
    const panelRO = new ResizeObserver(remeasure);
    $$('#track .panel').forEach(p => panelRO.observe(p));
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  window.addEventListener('load', remeasure);
  [800, 2000, 4000].forEach(ms => setTimeout(remeasure, ms));

    const form = $('#telegramForm');
  
  const wireList = $('#wireLog');
  function renderWires(rows) {
    if (!wireList) return;
    wireList.textContent = '';                    // textContent only — guest words are never HTML
    rows.forEach((w) => {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = '№' + String(w.id).padStart(3, '0') + ' · ' + w.name + (w.email ? ' · ' + w.email : '');
      const p = document.createElement('p');
      p.textContent = w.body;
      const t = document.createElement('time');
      t.textContent = new Date(w.created_at).toLocaleString();
      li.append(b, p, t);
      wireList.appendChild(li);
    });
  }
  async function loadWires() {
    if (!wireList) return;
    try {
      const r = await fetch('/api/wire');
      if (!r.ok) return;
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length) renderWires(rows);
    } catch (e) {  }
  }
  loadWires();
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const data = {
      name: form.elements.name.value,
      email: form.elements.email.value,
      body: (form.elements.kind && form.elements.kind.value ? '[' + form.elements.kind.value + '] ' : '') + form.elements.message.value
    };   // captured before the reset
    const ok = $('#tgOk'); ok.hidden = false;
    cue('parry');
    document.body.classList.add('reel-shake');
    setTimeout(() => document.body.classList.remove('reel-shake'), 380);
    form.reset();
    setTimeout(() => { ok.hidden = true; }, 6000);
    fetch('/api/wire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => {
      if (r.ok) loadWires();
      else megSay(r.status === 429
        ? 'EASY WITH THE KEY, OPERATOR — THREE WIRES A MINUTE, HOUSE RULES.'
        : 'THE WIRE DESK IS COOLING DOWN — TRY AGAIN SHORTLY.');
    }).catch(() => {
      megSay('THE WIRE DESK IS UNREACHABLE — THE VAULT ONLY HEARS THE DOOR AT http://localhost:3188.');
    });
  });

    const FILMS = {
    'snow-white': {
      title: '“Snow-White”',
      studio: 'Max Fleischer Studios',
      year: '1933',
      meta: '1-reel · rotoscope · Cab Calloway · public domain',
      yt: '6INnkk3lSJI', img: 'https://i.ytimg.com/vi/6INnkk3lSJI/hqdefault.jpg',
      tick: 'Runtime 7 min · rotoscope dance · Cab Calloway sings St. James Infirmary',
      body: [
        ['Why this reel is pinned above our desks',
          ['The rotoscope dance was refilmed frame-by-frame from live footage — a lesson: trace real motion, then exaggerate it.',
           'The woods scene morphs endlessly in one take — transitions drawn straight between poses, no cutting.',
           'The ghost sings "St. James Infirmary" in a long full-body pan: one character, one line of ink, one camera move.']],
        ['What we borrow in our own shorts',
          ['Water-torture legs and tube-limbs for walk cycles.',
           'A jazz number placed *under* the climax, not over it.',
           'Never cutting on a gag — stretching through it.']],
      ],
      fact: '★ HOUSE FACT — Calloway’s dance was filmed live, then traced frame-by-frame: find the truth first, exaggerate it after.',
      dossier: [
        ['PREMIERE', '1933 · Paramount short'],
        ['TECHNIQUE', 'Rotoscope · unbroken morphs'],
        ['MUSIC', 'St. James Infirmary — Cab Calloway'],
        ['SHEET STATUS', 'public domain']
      ],
      cast: ['Mae Questel — Betty Boop', 'Cab Calloway — Koko’s voice & moves',
        'Seymour Kneitel · Roland Crandall — animation', 'Dave Fleischer — director'],
      trivia: [
        'The ghost’s cabaret pan is one character, one line of ink, one camera move.',
        'The rock-and-tree morph chain never cuts — poses are drawn straight into each other.',
        'The same rotoscope trick returns a year later as the ghost walrus in “Minnie the Moocher”.'
      ],
      verdict: { grade: 'A', stamp: 'CERTIFIED HOUSE CLASSIC', line: 'Motion first, gags second — the reel our walk cycles are traced from.' }
    },
    'steamboat-willie': {
      title: '“Steamboat Willie”',
      studio: 'Walt Disney / Ub Iwerks',
      year: '1928',
      meta: 'first Mickey with sound-sync · public domain',
      yt: 'ah9pPXyZBGI', img: 'https://i.ytimg.com/vi/ah9pPXyZBGI/hqdefault.jpg',
      tick: 'Runtime 8 min · 1928 premiere · synchronised steam-whistle music',
      body: [
        ['The breakthrough of the reel',
          ['Sound is not decoration — every squeak on the boat is a musical instrument. The cartoon *is* the soundtrack.',
           'Iwerks’ line: rubber arms, squash-and-stretch goatees, mince-stepping gait drawn in three drawings.']],
        ['What we borrow',
          ['The whole scene-as-instrument approach: our pitches always start from the sound cue.',
           'Tight silhouette poses — you can read every punch in grey tones.']],
      ],
      fact: '★ HOUSE FACT — the title is a nod to the 1911 novelty song “Steamboat Bill” — the same tune Buster Keaton’s feature is named after.',
      dossier: [
        ['PREMIERE', 'Nov 18, 1928 · Colony Theatre, NYC'],
        ['TECHNIQUE', 'Sound-sync on every squeak'],
        ['MUSIC', 'Steamboat Bill · Turkey in the Straw'],
        ['SHEET STATUS', 'public domain (since 2024)']
      ],
      cast: ['Ub Iwerks — nearly every frame', 'Walt Disney — Mickey’s voice',
        'Wilfred Jackson — music bedding', 'Pete — the actual captain'],
      trivia: [
        'Iwerks cranked up to 700 drawings a day for weeks — one man, one line, one boat.',
        'The whistle gag became the studio’s signature: three notes, whole picture sold.',
        'The cow udder played as bagpipes — silhouette first, detail never.'
      ],
      verdict: { grade: 'A+', stamp: 'THE ONE THAT STARTED THE TALKIES', line: 'The cartoon IS the soundtrack — every squeak is an instrument.' }
    },
    'sindbad': {
      title: '“Sindbad the Sailor”',
      studio: 'Fleischer Studios · Popeye Color Special',
      year: '1936',
      meta: '2-reel Technicolor · Oscar nominee · public domain',
      yt: 'epjCeqz5LDc', img: 'https://i.ytimg.com/vi/epjCeqz5LDc/hqdefault.jpg',
      tick: 'Runtime 16 min · 2-reel Technicolor · Bluto vs Popeye on the rocks',
      body: [
        ['A two-reel epic',
          ['Stereoscopic 3-D backgrounds (the Multiplane cousin) — the island walks *around* the characters.',
           'Everything breathes: dragons’ bellies, saguaro ribs, Sindbad’s beard — secondary motion added on every line.',
           'Colour mixed in Technicolor’s three-strip palette, the same 5-pigment discipline we keep in the ledger.']],
        ['What we borrow',
          ['Rooftop-sized villains: scale read through the background layout, not size alone.',
           'Fights choreographed to a chorus line — every punch lands on the downbeat.']],
      ],
      fact: '★ HOUSE FACT — the 3-D “setback” stages slid BETWEEN exposures: the background literally walks around the cast.',
      dossier: [
        ['PREMIERE', '1936 · Paramount Color Special'],
        ['TECHNIQUE', 'Setback 3-D backgrounds · Technicolor'],
        ['MUSIC', 'I’m Sindbad the Sailor — Gus Wickie'],
        ['SHEET STATUS', 'public domain']
      ],
      cast: ['Gus Wickie — Sindbad / Bluto', 'Jack Mercer — Popeye',
        'Mae Questel — Olive Oyl', 'Dave Fleischer — director'],
      trivia: [
        'Academy Award nominee — the year it lost, the whole town talked about its scale.',
        'The island is built in layers of glass cels — paper-theatre depth, decades before the multiplane.',
        'Everything breathes on its own line: the Roc’s feathers, Sindbad’s beard, the dragon’s belly.'
      ],
      verdict: { grade: 'A', stamp: 'TWO REELS OF PURE SCALE', line: 'Villain size is read through the layout, not through the ruler.' }
    },
    'minnie-moocher': {
      title: '“Minnie the Moocher”',
      studio: 'Fleischer Studios · Betty Boop Talkartoon',
      year: '1932',
      meta: 'ghost walrus · Cab Calloway · public domain',
      yt: 'gVzA-Q502t8', img: 'https://i.ytimg.com/vi/gVzA-Q502t8/hqdefault.jpg',
      tick: 'Runtime 8 min · Cab Calloway on vocals · the paper-full ghost chorus',
      body: [
        ['The haunted singalong',
          ['The cave scene: ink-wash acid backgrounds — a drugstore ghost show drawn pure white on black.',
           'Objects morph in rhythm: skeletons’ skulls, walrus cabooses, everything on the beat.',
           'Cab Calloway’s scat is the storyboard: the animators literally animated his call-and-response.']],
        ['What we borrow',
          ['First cut to sound, then design the picture.',
           'White-on-black night scenes for our smoke — no grey mush.']],
      ],
      fact: '★ HOUSE FACT — the ghost walrus is Cab Calloway in costume: live footage, traced, exaggerated, inked white on black.',
      dossier: [
        ['PREMIERE', '1932 · Paramount Talkartoon'],
        ['TECHNIQUE', 'White-on-black ink wash · rotoscope'],
        ['MUSIC', 'Minnie the Moocher — Cab Calloway'],
        ['SHEET STATUS', 'public domain']
      ],
      cast: ['Mae Questel — Betty Boop', 'Cab Calloway — the ghost walrus',
        'Bimbo — on the run', 'Dave Fleischer — director'],
      trivia: [
        'Cab’s scat IS the storyboard — the chorus animates his call-and-response beat for beat.',
        'The film mocks its own chorus with the “you can’t follow him” subtitle gag.',
        'Ink-wash cave backgrounds: pure white on black, not a grey in sight.'
      ],
      verdict: { grade: 'A', stamp: 'THE HAUNTED SINGALONG', line: 'Cut to the sound first, then design the picture around it.' }
    },
    'balloon-land': {
      title: '“Balloon Land”',
      studio: 'Ub Iwerks · ComiColor Cartoons',
      year: '1935',
      meta: 'pincushion man · Cinecolor · public domain',
      yt: '1bduw0CO2Nc', img: 'https://i.ytimg.com/vi/1bduw0CO2Nc/hqdefault.jpg',
      tick: 'Runtime 7 min · a whole city of physics gone rubber',
      body: [
        ['One rule, whole world',
          ['Everything *is* a balloon: the city, the citizens, Laurel & Hardy in latex. One constraint — infinite gags.',
           'The Pincushion Man walks with a rolling-uphill cycle: heavy villain, bouncing world.',
           'The balloon alarm babies — a siren as a comic prop, reused as a percussion break.']],
        ['What we borrow',
          ['Pick ONE premise, exhaust it honestly before the ending.',
           'Physics as comedy: whatever inflates must pop in the third act.']],
      ],
      fact: '★ HOUSE FACT — one constraint, endless comedy: when everything is a balloon, every prop is a gag.',
      dossier: [
        ['PREMIERE', '1935 · ComiColor series'],
        ['TECHNIQUE', 'Two-strip colour · rubber physics'],
        ['MUSIC', 'Original Iwerks score'],
        ['SHEET STATUS', 'public domain']
      ],
      cast: ['Ub Iwerks — studio & animation', 'The Pincushion Man — one pin, all doom',
        'Laurel & Hardy — balloon cameos', 'The balloon baby — alarm siren'],
      trivia: [
        'A whole city built on a single premise — and the premise never runs dry.',
        'The siren baby doubles as a percussion break: the score pops with the balloons.',
        'The villain walks a rolling-uphill cycle — heavy creature, bouncy world.'
      ],
      verdict: { grade: 'A−', stamp: 'ONE RULE, WHOLE WORLD', line: 'Whatever inflates must pop in the third act.' }
    },
    'night-school': {
      title: '“Night School”',
      studio: 'Soot Studio studies (orig. © StudioMDHR)',
      year: '1934 (reel)',
      meta: 'studio vault · 0:23 · from the official game reels',
      yt: null, img: '/assets/work-cagney-fight.png?v=40', mp4: '/assets/work-gameover-reel.mp4?v=40',
      tick: 'Runtime 0:23 · our study reel · film presented in original resolution',
      body: [
        ['What the cups study after hours',
          ['A 23-second study of the Game Over sequence: how StudioMDHR stages despair in three poses.',
           'The smoke is drawn in 12 drawings on 24 fps twos — the same flow as ours.',
           'Note the pink parry flash timed *before* the impact — that anticipation trick we teach first.']],
        ['House exercise',
          ['Every new animator redraws this reel by hand before touching a client picture. The kettle grades it.']]
      ],
      fact: '★ HOUSE FACT — the smoke in the reel is 12 drawings looped on twos: half the frames, all of the flow.',
      dossier: [
        ['SHELF', 'Vault · study exhibit'],
        ['REEL', '0:23 · official game footage'],
        ['TECHNIQUE', '12 drawings on 24 fps twos'],
        ['SHEET STATUS', '© StudioMDHR — study use']
      ],
      cast: ['Cuphead & Mugman — the night shift', 'The Kettle — grades your copies',
        'The smoke — 12 drawings of despair', 'You — first exercise'],
      trivia: [
        'Three poses carry the whole Game Over emotion — staging over quantity.',
        'The pink parry flashes BEFORE the impact — anticipation first, hit second.',
        'Every new animator redraws this reel by hand before touching a client picture.'
      ],
      verdict: { grade: 'S', stamp: 'HOUSE FINAL EXAM', line: 'Trace the flow, not the lines — then earn your inkwell.' }
    }
  };

  const caseBody = $('#filmArticle');
  if (caseBody) {
    const raw = new URLSearchParams(location.search).get('f');
    const slug = FILMS[raw] ? raw : 'snow-white';   // bad/missing ?f= falls back — key stays honest
    const f = FILMS[slug];
    $('#caseKicker').textContent = (f.studio + ' · ' + f.year).toUpperCase();
    $('#caseTitle').textContent = f.title;
    $('#caseMeta').textContent = f.meta;
    $('#caseRuntime').textContent = f.tick;
    const frame = $('#caseFrame');
    if (f.yt) {
      frame.innerHTML = '<img referrerpolicy="no-referrer" src="' + f.img + '" alt="' + f.title + '">'
        + '<button class="film-play" data-yt="' + f.yt + '" style="position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:var(--red);border:3px solid var(--ink);color:var(--cream);font-size:18px;box-shadow:3px 3px 0 var(--ink)">▶</button>';
      $('#caseWatch').href = 'https://www.youtube.com/watch?v=' + f.yt;
    } else {
      frame.innerHTML = '<video controls loop muted playsinline src="' + (f.mp4 || f.img) + '"></video>';
      $('#caseWatch').parentElement.style.display = 'none';
    }
    const bd = $('#caseBody');
    if (f.dossier) {                       // index-card chips: premiere / technique / music / status
      const dz = document.createElement('div');
      dz.className = 'case-dossier';
      dz.innerHTML = f.dossier.map(d => '<div class="case-chip"><i>' + d[0] + '</i><span>' + d[1] + '</span></div>').join('');
      bd.parentNode.insertBefore(dz, bd);
    }
    (f.body || []).forEach(sec => {
      const h = document.createElement('h4');
      h.textContent = sec[0].toUpperCase();
      const ul = document.createElement('ul');
      sec[1].forEach(li => { const el = document.createElement('li'); el.textContent = li; ul.appendChild(el); });
      bd.appendChild(h); bd.appendChild(ul);
    });
    if (f.cast) {
      const h = document.createElement('h4');
      h.textContent = 'CAST & CREW';
      const ul = document.createElement('ul');
      f.cast.forEach(name => { const el = document.createElement('li'); el.textContent = name; ul.appendChild(el); });
      bd.appendChild(h); bd.appendChild(ul);
    }
    if (f.verdict) bd.insertAdjacentHTML('beforeend',
      '<div class="case-verdict"><b class="vg">' + f.verdict.grade + '</b><div><i>' + f.verdict.stamp +
      '</i><span>' + f.verdict.line + '</span></div></div>');
    bd.insertAdjacentHTML('beforeend',
      '<p style="font-size:11px;color:#5a4f3d;margin-top:18px">Soot Studio keeps this reel as a study exhibit — all rights to the original picture belong to its studio.</p>');

    // UP NEXT — every other reel in the vault
    const list = $('#nextList');
    if (list) Object.keys(FILMS).forEach(k => {
      if (k === slug) return;
      const o = FILMS[k];
      const card = document.createElement('div');
      card.className = 'next-card rv';
      card.style.setProperty('--tilt', (Math.random() * 4 - 2).toFixed(1) + 'deg');
      card.setAttribute('data-film-link', k);
      card.innerHTML = '<img referrerpolicy="no-referrer" src="' + o.img + '" alt="" loading="lazy" decoding="async">'
        + '<span>' + o.title + '<i>' + o.year + ' · ' + (o.yt ? 'watch reel' : 'our vault') + '</i></span>';
      list.appendChild(card);
    });

    // per-film side material: fact, trivia, exhibit placard
    const factEl = $('#caseFact');
    if (factEl && f.fact) factEl.textContent = f.fact;
    const tv = $('#caseTrivia');
    if (tv) tv.innerHTML = '<b>INKWELL TRIVIA</b><ul>' +
      (f.trivia || []).map(t => '<li>' + t + '</li>').join('') + '</ul>';
    const pl = $('#casePlacard');
    if (pl) {
      const no = Object.keys(FILMS).indexOf(slug) + 1;
      pl.innerHTML = 'EXHIBIT №' + (no < 10 ? '0' + no : no) + ' · SHELF B' + no +
        '<b>THE SOOT VAULT</b>RESTORED PRINTS DEPT';
    }
  }
    $$('.film[data-film]').forEach(card => {
    const slug = card.dataset.film;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.film-play, .film-watch, video, iframe, a')) return;
      cue('click');
      sessionStorage.setItem('soot-ink', '1');
      sessionStorage.setItem('soot-ink-x', e.clientX || window.innerWidth / 2);
      sessionStorage.setItem('soot-ink-y', e.clientY || window.innerHeight / 2);
      aimWipe(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2);
      wipe.classList.add('on', 'wipe--in');
      setTimeout(() => { location.href = 'film.html?f=' + slug; }, reduced ? 20 : 300);
    });
    const play = card.querySelector('.film-play');
    if (play && play.dataset.yt) play.addEventListener('click', (e) => {
      e.stopPropagation();
      cue('shot');
      play.style.display = 'none';
      const img = card.querySelector('.film-frame img');
      if (img) img.remove();
      const frame = card.querySelector('.film-frame');
      frame.insertAdjacentHTML('beforeend',
        '<iframe class="film-player" src="https://www.youtube.com/embed/' + play.dataset.yt +
        '?autoplay=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen title="reel"></iframe>');
    });
  });
  const vaultV = $('#vault');
  if (vaultV) vaultV.addEventListener('click', (e) => e.stopPropagation());

  $$('[data-film-link]').forEach(el => el.addEventListener('click', (e) => {
    e.preventDefault();
    cue('click');
    sessionStorage.setItem('soot-ink', '1');
    sessionStorage.setItem('soot-ink-x', e.clientX || window.innerWidth / 2);
    sessionStorage.setItem('soot-ink-y', e.clientY || window.innerHeight / 2);
    aimWipe(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2);
    wipe.classList.add('on', 'wipe--in');
    setTimeout(() => { location.href = 'film.html?f=' + el.dataset.filmLink; }, reduced ? 20 : 300);
  }));

    (function typewriterCaret() {
    $$('.telegraph input, .telegraph textarea').forEach(inp => {
      const wrap = document.createElement('span'); wrap.className = 'tt-wrap';
      inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
      const caret = document.createElement('span'); caret.className = 'tt-caret'; wrap.appendChild(caret);
      const mirror = document.createElement('div'); mirror.className = 'tt-mirror'; wrap.appendChild(mirror);
      const cs = getComputedStyle(inp);
      const bL = parseFloat(cs.borderLeftWidth) || 0, bT = parseFloat(cs.borderTopWidth) || 0;
      const pL = parseFloat(cs.paddingLeft) || 0,  pT = parseFloat(cs.paddingTop) || 0;
      const pR = parseFloat(cs.paddingRight) || 0;

      function update() {
        mirror.style.font = cs.font; mirror.style.letterSpacing = cs.letterSpacing;
        mirror.style.lineHeight = cs.lineHeight;
        mirror.style.whiteSpace = cs.whiteSpace === 'pre-wrap' ? 'pre-wrap' : 'pre';
        mirror.style.width = (inp.clientWidth - pL - pR) + 'px';
        mirror.style.left = (bL + pL) + 'px';
        mirror.style.top = (bT + pT) + 'px';
        const pos = inp.selectionStart == null ? inp.value.length : inp.selectionStart;
        mirror.textContent = inp.value.slice(0, pos);
        const m = document.createElement('span'); m.textContent = '\u200b';
        mirror.appendChild(m);
        const mr = m.getBoundingClientRect(), mir = mirror.getBoundingClientRect();
        let cx = mr.left - mir.left - inp.scrollLeft;
        let cy = mr.top - mir.top - inp.scrollTop;
        cx = Math.max(0, Math.min(cx, inp.clientWidth - pL - pR - 12));
        caret.style.left = (bL + pL + cx) + 'px';
        caret.style.top = (bT + pT + cy) + 'px';
      }
      ['focus', 'input', 'click', 'keyup'].forEach(ev =>
        inp.addEventListener(ev, () => { caret.classList.add('on'); update(); }));
      inp.addEventListener('blur', () => caret.classList.remove('on'));
      inp.addEventListener('keydown', (e) => {
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') cue('type');
        setTimeout(update, 0);
      });
      document.addEventListener('selectionchange', () => { if (document.activeElement === inp) update(); });
      window.addEventListener('resize', () => { if (document.activeElement === inp) update(); });
    });
  })();

  const LS = {
    get(k, d) {
      try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }
      catch (e) { return d; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  const STAMP_DEFS = [
    ['p0', 'MAIN PAGE'], ['p1', 'SHOWREEL'], ['p2', 'THE TEAM'],
    ['p3', 'INKWELL'], ['p4', 'ASSEMBLY'], ['p5', 'PRICE LIST'], ['p6', 'TELEGRAPH'],
    ['parry', 'PARRY!'], ['wire', 'WIRE SENT'],
    ['proj', 'PROJECTOR'], ['whack', 'WHACKER']
  ];
  const stamps = new Set(LS.get('soot-stamps', []));

  function renderStamps() {
    const box = $('#railStamps');
    if (!box) return;
    box.innerHTML = STAMP_DEFS.map(d =>
      '<i class="' + (stamps.has(d[0]) ? 'got' : '') + '" title="' + d[1] + '"></i>').join('');
  }

  function toastStamp(name) {
    const t = document.createElement('div');
    t.className = 'stamp-toast';
    t.textContent = '★ STAMP EARNED — ' + name;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('on'));
    setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 500); }, 2600);
  }

  function koShow(text) {
    if ($('.ko-screen')) return;
    cue('boom');
    const scr = document.createElement('div');
    scr.className = 'ko-screen';
    let pts = '', inner = '';
    for (let i = 0; i < 24; i++) {
      const a = Math.PI * i / 12 - Math.PI / 2;
      const ro = i % 2 ? 62 : 97, ri = i % 2 ? 44 : 74;
      pts += (100 + ro * Math.cos(a)).toFixed(1) + ',' + (100 + ro * Math.sin(a)).toFixed(1) + ' ';
      inner += (100 + ri * Math.cos(a)).toFixed(1) + ',' + (100 + ri * Math.sin(a)).toFixed(1) + ' ';
    }
    scr.innerHTML =
      '<svg class="ko-burst" viewBox="0 0 200 200" aria-hidden="true">' +
      '<polygon points="' + pts.trim() + '" fill="var(--gold)" stroke="var(--ink)" stroke-width="2.5"/>' +
      '<polygon points="' + inner.trim() + '" fill="var(--cream)" stroke="var(--ink)" stroke-width="1.5"/>' +
      '</svg><b>' + text + '</b>';
    const CONF = ['var(--red)', 'var(--gold)', 'var(--teal)', 'var(--cream)'];
    for (let i = 0; i < 26; i++) {
      const c = document.createElement('i');
      c.className = 'ko-conf';
      c.textContent = '★';
      c.style.left = (Math.random() * 100).toFixed(1) + 'vw';
      c.style.animationDelay = (Math.random() * .8).toFixed(2) + 's';
      c.style.color = CONF[i % CONF.length];
      scr.appendChild(c);
    }
    document.body.appendChild(scr);
    setTimeout(() => scr.classList.add('ko-out'), 1700);
    setTimeout(() => scr.remove(), 2150);
  }

  function award(id, name) {
    if (stamps.has(id)) return;
    stamps.add(id);
    LS.set('soot-stamps', [...stamps]);
    renderStamps();
    const def = STAMP_DEFS.find(d => d[0] === id);
    toastStamp(name || (def && def[1]) || id);
    megSay(pick(MEG_LINES.stamp));
    cue('parry');
    if (stamps.size === STAMP_DEFS.length && !LS.get('soot-gold', 0)) {
      LS.set('soot-gold', 1);
      setTimeout(() => koShow('GOLDEN CELLS — ALL STAMPS!'), 900);
    }
  }

  const MEG_LINES = {
    idle: [
      'PSST — the dice in the rail are rigged for fun. Roll ’em.',
      'REEL 02 holds six case files. SIX. Read them all, I’m counting.',
      'Try the OLD PROJECTOR button. I dare you. I double-dare you.',
      'Click anything. Really. Anything at all.',
      'Ten whacks earns a stamp. The furniture is insured.',
      'Every stamp is a story. Go get the whole set.'
    ],
    stamp: [
      'THAT’S ONE FOR THE ALBUM!',
      'A COLLECTOR IS BORN!',
      'Pin it to the payroll board!',
      'The Kettle saw that. She approves.'
    ],
    parry: [
      'RIGHT ON THE BEAT!',
      'THE PINK ONE PAYS!',
      'HOT STUFF, KID!',
      'JAZZ HANDS! KEEP IT UP!'
    ],
    whack: [
      'EASY ON THE FURNITURE!',
      'THAT’S COMING OUT OF YOUR PAY!',
      'FIVE MORE AND THE ALBUM GROWS!'
    ],
    dice: [
      'WELL, WELL — MR. KING DICE HIMSELF!',
      'THE MANAGER IS IN. THE DEALS ARE STILL ON!',
      'THE DICE SENT THEIR OWN CHAPERONE.'
    ],
    secret: 'NINETEEN THIRTY — THE HOUSE YEAR. YOU FOUND THE KNOCK.'
  };
  const megBox = document.createElement('div');
  megBox.className = 'megaphone';
  megBox.innerHTML = '<b>MR. MEGAPHONE</b><span>—</span>';
  document.body.appendChild(megBox);
  let megHideT = null;
  function pick(arr) { return arr[Math.random() * arr.length | 0]; }
  function megSay(text, hold) {
    if (reduced || document.getElementById('intro')) return;
    megBox.querySelector('span').textContent = text;
    megBox.classList.add('on');
    clearTimeout(megHideT);
    megHideT = setTimeout(() => megBox.classList.remove('on'), hold || 4200);
  }
  (function megIdle() {
    setTimeout(() => {
      if (!document.hidden && !document.getElementById('intro') &&
          !megBox.classList.contains('on') && !$('.ko-screen')) megSay(pick(MEG_LINES.idle));
      megIdle();
    }, 44000 + Math.random() * 34000);
  })();

  let yearBuf = '';
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('intro')) return;
    if (e.key.length !== 1 || /^(input|textarea|select)$/i.test(e.target.tagName || '')) return;
    yearBuf = (yearBuf + e.key).slice(-4);
    const isYear = yearBuf === '1930', isDice = yearBuf.toUpperCase() === 'DICE';
    if (!isYear && !isDice) return;
    yearBuf = '';
    if (isYear) { cue('boom'); starPop(); megSay(MEG_LINES.secret, 5200); }
    else diceWalk();
  });
  
  function diceWalk() {
    if ($('.kingdice')) return;
    const d = document.createElement('div');
    d.className = 'kingdice';
    d.innerHTML = '<img src="assets/work-kingdice-body.png?v=40" alt="" draggable="false">';
    document.body.appendChild(d);
    megSay(pick(MEG_LINES.dice), 4600);
    cue('parry');
    setTimeout(() => d.remove(), 5200);
  }
  function starPop() {
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('i');
      s.className = 'pop-star';
      s.textContent = '★';
      s.style.left = (6 + Math.random() * 88).toFixed(1) + 'vw';
      s.style.fontSize = (13 + Math.random() * 12).toFixed(0) + 'px';
      s.style.animationDelay = (Math.random() * .55).toFixed(2) + 's';
      s.style.color = ['var(--red)', 'var(--gold)', 'var(--teal)'][i % 3];
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 2800);
    }
  }

  (function inkTrail() {
    if (reduced) return;
    let lx = -1, ly = -1, last = 0;
    document.addEventListener('mousemove', (e) => {
      if (document.getElementById('intro')) return;
      const now = performance.now();
      if (now - last < 70) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      if (dx * dx + dy * dy < 9000) return;
      last = now;
      const d = document.createElement('i');
      d.className = 'ink-drop';
      d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
      d.style.setProperty('--ir', (2 + Math.random() * 2.4).toFixed(1) + 'px');
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 640);
    }, { passive: true });
  })();

  const cameoForce = (function cameo() {
    if (reduced || !track) return () => {};
    let last = Date.now(), el = null;
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'].forEach(ev =>
      document.addEventListener(ev, () => { last = Date.now(); }, { passive: true }));
    setInterval(() => {
      if (el || document.hidden || document.getElementById('intro')) return;
      if (Date.now() - last < 24000) return;
      el = document.createElement('div');
      el.className = 'cameo';
      el.innerHTML = '<img src="assets/hero-cuphead-body.png?v=40" alt="" draggable="false">';
      document.body.appendChild(el);
      setTimeout(() => { el.remove(); el = null; last = Date.now(); }, 4400);
    }, 4000);
    return () => { last = 0; };
  })();

  (function reelRoll() {
    const el = $('#reelCounter');
    if (!el || reduced) return;
    const m = el.textContent.match(/^(REEL\s+)(\d+)(.*)$/);
    if (!m) return;
    const N = PAGE_URLS.length;
    let cur = (+m[2] + 2) % N || N, flips = 0;
    const iv = setInterval(() => {
      cur = cur % N + 1;
      el.innerHTML = m[1] + cur + '<i>' + m[3] + '</i>';
      if (++flips >= N) { clearInterval(iv); el.innerHTML = m[1] + m[2] + '<i>' + m[3] + '</i>'; }
    }, 64);
  })();

  (function nightShift() {
    const h = new Date().getHours();
    if (h >= 20 || h < 6) document.documentElement.classList.add('night-shift');
  })();

  (function onair() {
    const btn = $('#onairBtn');
    if (!btn) return;
    let el = null, armed = false;
    const setFlag = (v) => { try { sessionStorage.setItem('soot-onair', v ? '1' : '0'); } catch (e) {} };
    function start() {
      const paint = (cls) => {
        document.body.classList.remove('onair', 'onair-armed');
        document.body.classList.add(cls);
        btn.setAttribute('aria-pressed', cls === 'onair' ? 'true' : 'false');
      };
      try {
        el = el || new Audio('/assets/onair-jazz.mp3?v=40');
        el.loop = true; el.volume = .42;
        const p = el.play();
        if (p && p.then) p.then(() => { armed = false; paint('onair'); })
                        .catch(() => paint('onair-armed'));   // needs a real gesture — lamp waits, dimly lit
        else paint('onair');
      } catch (e) { paint('onair-armed'); }
    }
    function stop() {
      if (el) { try { el.pause(); } catch (e) {} }
      armed = false;
      document.body.classList.remove('onair', 'onair-armed');
      btn.setAttribute('aria-pressed', 'false');
    }
    btn.addEventListener('click', () => {
      audioOK.gate = true;
      if (document.body.classList.contains('onair')) { setFlag(0); stop(); cue('click'); return; }
      setFlag(1); armed = true;                   // optimistic: start() clears it when playback really begins
      start(); cue('parry');
      if (!LS.get('soot-onair-ever', 0)) {
        LS.set('soot-onair-ever', 1);
        megSay('THE BAND IS IN! A 1917 SHELLAC, FRESH FROM THE VAULT SHELF.');
      }
    });
    try { armed = sessionStorage.getItem('soot-onair') === '1'; } catch (e) {}
    if (armed) {         // carried over an internal hop — waits for one gesture on this page
      document.body.classList.add('onair-armed');
      btn.setAttribute('aria-pressed', 'true');
    }
    window.__onairWake = () => { if (armed && !document.body.classList.contains('onair')) start(); };
    window.__onairState = () => ({ on: document.body.classList.contains('onair'),
      armed: document.body.classList.contains('onair-armed'), t: el ? el.currentTime : 0 });
  })();

  (function filmLeader() {
    const el = $('#leader');
    if (!el) return;
    if (reduced) { el.remove(); return; }
    try {
      if (sessionStorage.getItem('soot-leader')) { el.remove(); return; }
      sessionStorage.setItem('soot-leader', '1');
    } catch (e) {  }
    const num = $('#leaderNum');
    let n = 3;
    const done = () => {
      if (!el.isConnected) return;
      el.classList.add('leader-out');
      setTimeout(() => el.remove(), 480);
    };
    el.addEventListener('click', done);
    document.addEventListener('keydown', done, { once: true });
    const tick = setInterval(() => {
      n--;
      if (n < 1) { clearInterval(tick); done(); return; }
      num.textContent = n;
      cue('type');
    }, 540);
  })();

  (function sinceLedger() {
    const el = $('#sinceCount');
    if (!el) return;
    const p2 = (n) => String(n).padStart(2, '0');
    const paint = () => {
      const now = new Date();
      const months = (now.getFullYear() - 1934) * 12 + now.getMonth();
      el.textContent = Math.floor(months / 12) + ' YEARS ' + (months % 12) + ' MONTHS ' +
        (now.getDate() - 1) + ' DAYS · ' + p2(now.getHours()) + ':' + p2(now.getMinutes()) + ':' + p2(now.getSeconds());
    };
    paint();
    setInterval(paint, 1000);
    
    const guest = $('#guestNo');
    if (guest) {
      try {
        let sid = LS.get('soot-session', '');
        if (!/^[a-zA-Z0-9-]{8,64}$/.test(sid)) {
          sid = window.crypto && crypto.randomUUID ? crypto.randomUUID() : 's' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
          LS.set('soot-session', sid);
        }
        fetch('/api/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sid }),
        }).then((r) => r.ok ? r.json() : null).then((j) => {
          if (j && j.admits) {
            guest.textContent = 'GUEST №' + String(j.admits).padStart(6, '0');
            guest.hidden = false;
          }
        }).catch(() => {  });
      } catch (e) {  }
    }
  })();

  let runTick = null, watchTick = null;
  if (track) {
    const strip = document.createElement('div');
    strip.className = 'film-strip';
    strip.setAttribute('aria-hidden', 'true');
    const runner = document.createElement('div');
    runner.className = 'film-runner';
    runner.setAttribute('aria-hidden', 'true');
    runner.innerHTML = '<span class="flip"><img src="assets/hero-cuphead-body.png?v=40" alt="" draggable="false"></span>';
    document.body.appendChild(strip);
    document.body.appendChild(runner);
    const flip = runner.querySelector('.flip');
    let dir = 1;
    runTick = function (vel) {
      const span = Math.max(1, maxX);
      const p = Math.min(1, Math.max(0, x / span));
      runner.style.transform = 'translateX(' + (p * (window.innerWidth - 96)).toFixed(1) + 'px)';
      strip.style.backgroundPosition = (Math.round(x) % 32) + 'px 7px';
      if (Math.abs(vel) > .8) dir = vel > 0 ? 1 : -1;
      runner.classList.toggle('is-run', Math.abs(vel) > .8 && !reduced);
      flip.classList.toggle('is-back', dir < 0);
    };
  }

  const watchers = $$('[data-watch]').map(el => ({ el, k: parseFloat(el.dataset.watch) || .1 }));
  const mouse = { x: innerWidth / 2, y: innerHeight * .4 };
  addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  if (watchers.length) {
    watchTick = function () {
      for (const w of watchers) {
        const r = w.el.getBoundingClientRect();
        const dx = mouse.x - (r.left + r.width / 2);
        const dy = mouse.y - (r.top + r.height / 2);
        const tx = Math.max(-9, Math.min(9, dx * .022 * w.k * 8));
        const ty = Math.max(-6, Math.min(6, dy * .014 * w.k * 8));
        const rot = Math.max(-5, Math.min(5, dx * .006 * w.k * 8));
        w.el.style.translate = tx.toFixed(1) + 'px ' + ty.toFixed(1) + 'px';
        w.el.style.rotate = rot.toFixed(2) + 'deg';
      }
    };
  }

  extrasFrame = function (vel) {
    if (runTick) runTick(vel);
    if (watchTick) watchTick();
  };

  let combo = 0, comboT = null;
  
  fetch('/api/parry').then((r) => r.ok ? r.json() : null).catch(() => null);
  function parryReport(s) {
    if (s < 2) return;
    fetch('/api/parry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: s }),
    }).then((r) => r.ok ? r.json() : null).then((j) => {
      if (j && j.best && j.best <= s) {
        megSay('A NEW HOUSE RECORD — ' + j.best + ' IN A ROW! THE FRAME GOES ON THE WALL!');
      }
    }).catch(() => {  });
  }
  function parryScored(cx, cy) {
    combo++;
    clearTimeout(comboT);
    comboT = setTimeout(() => { parryReport(combo); combo = 0; }, 5000);
    if (combo > LS.get('soot-parry-best', 0)) LS.set('soot-parry-best', combo);
    cue('parry');
    award('parry');
    if (combo % 4 === 0) megSay(pick(MEG_LINES.parry));
    const tag = document.createElement('div');
    tag.className = 'parry-hit';
    tag.style.left = cx + 'px';
    tag.style.top = cy + 'px';
    tag.textContent = 'PARRY! ×' + combo;
    document.body.appendChild(tag);
    setTimeout(() => tag.remove(), 900);
  }

  function spawnBullet() {
    if (document.querySelector('.parry-bullet')) return;
    const fromLeft = Math.random() < .5;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'parry-bullet';
    b.setAttribute('aria-label', 'Parry!');
    b.innerHTML = '<img src="assets/egg-parried-bullet.png?v=40" alt="" draggable="false">';
    b.style.top = Math.round(innerHeight * (.15 + Math.random() * .65)) + 'px';
    b.style.transform = 'translateX(' + (fromLeft ? -44 : innerWidth + 44) + 'px)';
    document.body.appendChild(b);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      b.style.transform = 'translateX(' + (fromLeft ? innerWidth + 44 : -44) + 'px)';
    }));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = b.getBoundingClientRect();
      parryScored(r.left + r.width / 2, r.top);
      b.remove();
    });
    b.addEventListener('transitionend', () => b.remove());
    setTimeout(() => { if (b.isConnected) b.remove(); }, 4300);
  }

  (function bulletLoop() {
    setTimeout(() => {
      if (!document.hidden && !document.getElementById('intro')) spawnBullet();
      bulletLoop();
    }, 6000 + Math.random() * 6000);
  })();

  const pinky = $('#parryEgg');
  if (pinky) {
    pinky.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = pinky.getBoundingClientRect();
      parryScored(r.left + r.width / 2, r.top);
      pinky.classList.remove('on'); void pinky.offsetWidth; pinky.classList.add('on');
    });
    (function invite() {                    // the rail pinky pulses now and then
      setTimeout(() => {
        pinky.classList.add('on');
        setTimeout(() => pinky.classList.remove('on'), 6500);
        invite();
      }, 9000 + Math.random() * 8000);
    })();
  }

  const WHACKS = ['POW!', 'BOINK!', 'WHACK!', 'BAP!', 'ZLOPP!', 'KA-POW!', 'SOCK!'];
  let whacks = 0;
  document.addEventListener('click', (e) => {
    if (document.getElementById('intro')) return;
    if (e.target.closest('a,button,input,textarea,select,video,iframe,label,.rail,.film,.parry-bullet,.ko-screen,.tt-wrap,.leader')) return;
    const card = e.target.closest('.card,.ease,.wall-card,.mate,.cap,.next-card,.case-sheet,figure');
    const tag = document.createElement('div');
    tag.className = 'whack-tag';
    tag.style.setProperty('--wrot', (Math.random() * 16 - 8).toFixed(1) + 'deg');
    tag.style.left = e.clientX + 'px';
    tag.style.top = e.clientY + 'px';
    tag.textContent = WHACKS[Math.random() * WHACKS.length | 0];
    document.body.appendChild(tag);
    setTimeout(() => tag.remove(), 700);
    if (card) {
      card.classList.remove('whacked'); void card.offsetWidth;
      card.classList.add('whacked');
      setTimeout(() => card.classList.remove('whacked'), 340);
    }
    if (++whacks === 5) megSay(pick(MEG_LINES.whack));
    if (whacks === 10) award('whack');
  });

  let rattle = null;
  function rattleOn() {
    if (rattle || !audioOK.gate || reduced) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const len = AC.sampleRate * 2;
      const buf = AC.createBuffer(1, len, AC.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * .6;
      const src = AC.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filt = AC.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 320;
      const g = AC.createGain(); g.gain.value = .035;
      src.connect(filt); filt.connect(g); g.connect(AC.destination);
      src.start();
      rattle = {
        stop() {
          try { g.gain.setTargetAtTime(0, AC.currentTime, .12); } catch (e) {}
          setTimeout(() => { try { src.stop(); } catch (e) {} }, 400);
        }
      };
    } catch (e) {  }
  }
  function projOverlays() {
    if ($('.proj-vig')) return;
    const mk = (cls) => { const d = document.createElement('div'); d.className = cls; document.body.appendChild(d); };
    mk('proj-vig'); mk('proj-flick'); mk('proj-scr proj-scr1'); mk('proj-scr proj-scr2');
  }
  function projSet(on) {
    document.body.classList.toggle('old-proj', !!on);
    const btn = $('#projBtn');
    if (btn) btn.classList.toggle('on', !!on);
    if (on) { projOverlays(); rattleOn(); }
    else if (rattle) { rattle.stop(); rattle = null; }
    LS.set('soot-proj', on ? 1 : 0);
  }
  const projBtn = $('#projBtn');
  if (projBtn) {
    if (LS.get('soot-proj', 0)) projSet(true);          // remembered mode
    projBtn.addEventListener('click', () => {
      audioOK.gate = true;
      const on = !document.body.classList.contains('old-proj');
      projSet(on);
      cue('click');
      if (on) award('proj');
    });
  }
  window.__projWake = () => {
    if (document.body.classList.contains('old-proj') && !rattle) rattleOn();
  };

  const diceBtn = $('#diceBtn');
  if (diceBtn) {
    const mkDie = () => { const d = document.createElement('span'); d.className = 'die-face'; return d; };
    const dieA = mkDie(), dieB = mkDie();
    diceBtn.appendChild(dieA); diceBtn.appendChild(dieB);
    const PIP = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    const setPips = (el, v) => {
      el.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const p = document.createElement('i');
        if (PIP[v].includes(i)) p.classList.add('on');
        el.appendChild(p);
      }
    };
    setPips(dieA, 6); setPips(dieB, 3);
    diceBtn.addEventListener('click', () => {
      audioOK.gate = true;
      if (diceBtn.dataset.busy) return;
      diceBtn.dataset.busy = '1';
      cue('click');
      dieA.classList.add('rolling'); dieB.classList.add('rolling');
      const shake = setInterval(() => {
        setPips(dieA, 1 + (Math.random() * 6 | 0));
        setPips(dieB, 1 + (Math.random() * 6 | 0));
      }, 90);
      setTimeout(() => {
        clearInterval(shake);
        dieA.classList.remove('rolling'); dieB.classList.remove('rolling');
        const a = 1 + (Math.random() * 6 | 0), b = 1 + (Math.random() * 6 | 0);
        setPips(dieA, a); setPips(dieB, b);
        const keys = Object.keys(FILMS);
        const slug = keys[(a + b - 2) % keys.length];
        cue('parry');
        const tag = document.createElement('div');
        tag.className = 'dice-verdict';
        tag.innerHTML = 'THE DICE DEMAND…<b>' + FILMS[slug].title + '</b><i>' +
          a + ' + ' + b + ' = ' + (a + b) + ' · OFF TO THE VAULT</i>';
        document.body.appendChild(tag);
        requestAnimationFrame(() => tag.classList.add('on'));
        setTimeout(() => {
          tag.classList.remove('on');
          sessionStorage.setItem('soot-ink', '1');
          sessionStorage.setItem('soot-ink-x', (window.innerWidth - 130).toFixed(0));
          sessionStorage.setItem('soot-ink-y', (window.innerHeight / 2).toFixed(0));
          aimWipe(window.innerWidth - 130, window.innerHeight / 2);
          wipe.classList.add('on', 'wipe--in');
          setTimeout(() => { location.href = 'film.html?f=' + slug; }, reduced ? 20 : 300);
        }, 1500);
      }, 950);
    });
  }

  const tgForm = $('#telegramForm');
  if (tgForm) tgForm.addEventListener('submit', (e) => {
    e.preventDefault();                     // the wire is sent theatrically — no page reload
    award('wire', 'WIRE SENT');
    setTimeout(() => {
      koShow('A KNOCKOUT!');
      tgForm.reset();                       // fresh paper for the next guest
    }, 420);
  });

  renderStamps();
  if (!isNaN(parseInt(document.body.dataset.page, 10))) award('p' + rebound);   // visit stamp for real pages only

  window.__extrasDebug = {
    spawnBullet, projSet, koShow, award, parryScored,
    meg: megSay, cameoForce, diceWalk, onair: window.__onairState,
    scroll: () => ({ x: Math.round(x), xt: Math.round(xTarget), mx: Math.round(maxX) }),
    state: () => ({
      stamps: [...stamps], combo, whacks,
      proj: document.body.classList.contains('old-proj'),
      runner: !!$('.film-runner'), bullets: $$('.parry-bullet').length
    })
  };

  const BOOM = ['/assets/boom-post-1.png?v=40', '/assets/boom-post-2.png?v=40', '/assets/boom-post-3.png?v=40'];
  const introTimers = [];
  const intro = $('#intro');
  if (intro && !siteEntry) {
    intro.remove();                       // hopping inside the studio — straight to the reels
  } else if (intro) {
    const t = (ms, fn) => introTimers.push(setTimeout(() => {
      // the reel may have been skipped already — never act on removed nodes
      if (document.body.contains(intro) || fn === finish) fn();
    }, ms));
    const shoot = () => {
      const field = $('#iField');
      const pea = document.createElement('span');
      pea.className = 'i-pea';
      field.appendChild(pea);
      cue('shot');
      setTimeout(() => {                      // hit!
        pea.remove();
        const flower = $('#iFlower'), boom = $('#iBoom');
        if (!flower || !boom) return;         // the intro was skipped mid-flight
        flower.classList.remove('shake'); void flower.offsetWidth;
        flower.classList.add('shake');
        // visible hit-flash on the flower
        boom.src = '/assets/boom-pre.png?v=40';
        boom.style.display = '';
        boom.style.opacity = '1';
        boom.style.transition = 'none';
        boom.style.transform = 'scale(.42) rotate(-10deg)';
        t(160, () => { if (flower.style.display !== 'none') boom.style.display = 'none'; });
      }, 410);
    };
    const detonate = () => {
      const flower = $('#iFlower'), boom = $('#iBoom'), flash = $('#iFlash');
      cue('boom');
      flower.style.display = 'none';
      boom.style.display = '';
      boom.style.opacity = '1';
      boom.style.transition = 'none';
      boom.src = '/assets/boom-pre.png?v=40';
      boom.style.transform = 'scale(1)';
      flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
      document.body.classList.add('reel-shake');
      t(400, () => document.body.classList.remove('reel-shake'));
      BOOM.forEach((src, i) => t(i * 110, () => {
        boom.src = src;
        boom.style.transform = 'scale(' + (1.05 + i * .2) + ') rotate(' + ((i % 2) ? 6 : -8) + 'deg)';
      }));
      t(BOOM.length * 110 + 160, () => {
        boom.style.animation = 'none';
        boom.style.opacity = '0';
        boom.style.transition = 'opacity .25s';
        t(240, () => $('#iLogo').classList.add('go'));
        t(900, () => { $('#rollBtn').style.display = ''; });
        t(2100, () => finish());            // the reel rolls on by itself
      });
    };
    function finish() {
      if (intro.dataset.done) return;       // roll button + auto + skip all safe
      intro.dataset.done = '1';
      intro.classList.add('intro-fadeout');
      setTimeout(() => {
        try { intro.remove(); } catch (e) {}
        // main page steps out of the ink at once — every panel revealed,
        // so the hero (and anything reached by scroll) is never left blank
        $$('.rv').forEach(el => el.classList.add('is-in'));
      }, 480);
      measure();
      window.dispatchEvent(new Event('resize'));
    }
    if (reduced) {
      t(500, () => { $('#iFlower').style.display = 'none'; $('#iLogo').classList.add('go'); $('#rollBtn').style.display = ''; });
      t(1400, () => finish());
    } else {
      t(300, () => $('#skipBtn').style.display = '');
      t(600, shoot);
      t(1250, shoot);
      t(1900, shoot);
      t(2350, detonate);
    }
    $('#skipBtn').addEventListener('click', () => { audioOK.gate = true; cue('click'); finish(); });
    $('#rollBtn').addEventListener('click', () => { audioOK.gate = true; cue('click'); finish(); });
    // debug hook: lets the whole sequence be driven/inspected from outside
    window.__introDebug = { shoot, detonate, finish, state: () => ({
      flower: ($('#iFlower') || { style: {} }).style.display || null,
      logo: ($('#iLogo') || {}).className || '',
      roll: $('#rollBtn') ? getComputedStyle($('#rollBtn')).display : 'gone',
      gone: !document.body.contains(intro)
    }) };
  }

  (function cascade() {
    $$('.panel').forEach((p) => {
      $$('.rv', p).forEach((el, i) => {
        if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', (i * 0.07).toFixed(2) + 's');
      });
    });
  })();

  (function toolshed() {
    const tail = $('.rail-tail');
    if (!tail) return;
    const pop = document.createElement('div');
    pop.className = 'rail-pop';
    pop.id = 'railPop';
    pop.setAttribute('aria-label', 'The workbench');
    ['projBtn', 'diceBtn', 'onairBtn', 'parryEgg'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) pop.appendChild(el);
    });
    const btn = document.createElement('button');
    btn.className = 'rail-tools';
    btn.id = 'toolsBtn';
    btn.type = 'button';
    btn.title = 'The workbench — projector, dice, jazz, eggs, lamps';
    btn.setAttribute('aria-label', 'Open the workbench');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'railPop');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>';
    tail.appendChild(btn);
    document.body.appendChild(pop);
    let taught = false;
    const paint = (open) => {
      pop.classList.toggle('on', open);
      btn.classList.toggle('on', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      cue('click');
      const open = !pop.classList.contains('on');
      paint(open);
      if (open && !taught) {
        taught = true;
        megSay('THE WORKBENCH — every toy still lives here, just tidier.');
      }
    });
    document.addEventListener('click', (e) => {
      if (pop.classList.contains('on') && !pop.contains(e.target) && e.target !== btn) paint(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') paint(false);
    });
  })();

  (function daynight() {
    const tail = $('.rail-tail');
    if (!tail) return;
    const btn = document.createElement('button');
    btn.className = 'rail-night';
    btn.type = 'button';
    btn.title = 'DAY / NIGHT — switch the shop lamps';
    btn.setAttribute('aria-label', 'Toggle day or night look');
    const shed = document.getElementById('railPop');
    (shed || tail).appendChild(btn);
    const paint = () => {
      const on = document.documentElement.classList.contains('night-shift');
      btn.textContent = on ? '☼' : '☾';
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    const saved = LS.get('soot-night', null);
    if (saved != null) {
      document.documentElement.classList.toggle('night-shift', saved === 1);
    } else {
      const h = new Date().getHours();
      document.documentElement.classList.toggle('night-shift', h >= 20 || h < 6);
    }
    paint();
    let taught = false;
    btn.addEventListener('click', () => {
      cue('click');
      const on = document.documentElement.classList.toggle('night-shift');
      LS.set('soot-night', on ? 1 : 0);
      paint();
      if (!taught) {
        taught = true;
        megSay(on ? 'NIGHT SHIFT! THE PAPER CHANGES ITS INK TONE.' : 'DAY SHIFT! MORNING PUTS THE PAPER BACK.', 4600);
      }
    });
  })();

  let scrubTick = null;
  (function scrub() {
    const bar = document.createElement('div');
    bar.className = 'film-scrub';
    bar.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('i');
    bar.appendChild(fill);
    document.body.appendChild(bar);
    const up = document.createElement('button');
    up.className = 'film-top';
    up.type = 'button';
    up.innerHTML = '<b>⌃</b> REWIND TO REEL №01';
    document.body.appendChild(up);
    let shown = false;
    scrubTick = function () {
      const p = maxX > 400 ? Math.min(1, Math.max(0, x / maxX)) : 0;
      bar.classList.toggle('on', p > 0.12);
      fill.style.width = (p * 100).toFixed(2) + '%';
      const want = p > 0.25;
      if (want !== shown) { shown = want; up.classList.toggle('on', want); }
    };
    up.addEventListener('click', () => {
      cue('click');
      seek(0);
    });
  })();

  (function rackFilter() {
    const list = $('#wireLog');
    const inp = $('#wireSearch');
    if (!list || !inp) return;
    const paint = renderWires;
    let rows = [];
    renderWires = function (r) {
      rows = Array.isArray(r) ? r : [];
      draw();
    };
    function draw() {
      const q = inp.value.trim().toLowerCase();
      if (!rows.length) return;
      const hit = !q ? rows : rows.filter((w) =>
        String(w.name || '').toLowerCase().indexOf(q) !== -1 ||
        String(w.body || '').toLowerCase().indexOf(q) !== -1 ||
        String(w.email || '').toLowerCase().indexOf(q) !== -1);
      if (hit.length) { paint(hit); return; }
      list.textContent = '';
      const li = document.createElement('li');
      li.className = 'wire-empty';
      li.textContent = 'no wire on the rack matches — loosen the sift';
      list.appendChild(li);
    }
    inp.addEventListener('input', draw);
  })();

  (function faqOpen() {
    $$('.faq-q').forEach((b) => {
      b.addEventListener('click', () => {
        const item = b.closest('.faq');
        const nowOpen = item.classList.toggle('open');
        b.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
        if (nowOpen) cue('type');
      });
    });
  })();

  (function peek() {
    const cards = $$('.film[data-film]');
    if (!cards.length) return;
    let scr = null;
    function close() {
      if (!scr) return;
      const node = scr;
      node.classList.remove('on');
      setTimeout(() => { try { node.remove(); } catch (e) {} }, 280);
      document.removeEventListener('keydown', esc);
      scr = null;
    }
    function esc(e) { if (e.key === 'Escape') close(); }
    function open(slug) {
      const f = FILMS[slug];
      if (!f) return;
      close();
      const backdrop = document.createElement('div');
      backdrop.className = 'peek-screen';
      const pts = (f.body && f.body[0] && f.body[0][1]) ? f.body[0][1].slice(0, 3) : [];
      backdrop.innerHTML =
        '<div class="peek-card">' +
        '<div class="peek-kick">' + (f.studio + ' · ' + f.year).toUpperCase() + '</div>' +
        '<h3 class="peek-title">' + f.title + '</h3>' +
        '<p class="peek-meta">' + f.meta + '</p>' +
        '<div class="peek-frame">' + (f.yt
          ? '<img referrerpolicy="no-referrer" src="' + f.img + '" alt="' + f.title + '">'
          : '<video controls loop muted playsinline src="' + f.mp4 + '"></video>') +
        '</div>' +
        (pts.length ? '<ul class="peek-list">' + pts.map((t) => '<li>' + t + '</li>').join('') + '</ul>' : '') +
        (f.verdict ? '<div class="case-verdict"><b class="vg">' + f.verdict.grade + '</b><div><i>' + f.verdict.stamp + '</i><span>' + f.verdict.line + '</span></div></div>' : '') +
        '<div class="peek-foot"><a class="btn btn--red" href="film.html?f=' + slug + '">FULL CASE FILE <span class="arr">→</span></a>' +
        '<button class="btn peek-close" type="button">CLOSE ×</button></div>';
      scr = backdrop;
      document.body.appendChild(backdrop);
      requestAnimationFrame(() => backdrop.classList.add('on'));
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
      backdrop.querySelector('.peek-close').addEventListener('click', close);
      document.addEventListener('keydown', esc);
      cue('click');
      megSay('A QUICK PEEK — THE FULL DOSSIER LIVES ONE REEL DEEPER.');
    }
    cards.forEach((card) => {
      const slug = card.dataset.film;
      const b = document.createElement('button');
      b.className = 'film-peek';
      b.type = 'button';
      b.textContent = 'peek';
      b.setAttribute('aria-label', 'Quick look');
      card.appendChild(b);
      b.addEventListener('click', (e) => { e.stopPropagation(); open(slug); });
    });
  })();
})();
