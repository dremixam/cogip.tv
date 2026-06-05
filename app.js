'use strict';

const PROFILES_URL    = 'https://linkstack.cogip.tv/api/profiles';
const LIVE_STATUS_URL = './live-status.json';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Escape text for safe HTML insertion. */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip HTML tags and decode entities from API strings. */
function stripHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.innerHTML = str;
  return div.textContent || div.innerText || '';
}

/** Extract the Twitch login from a full URL, lower-cased. */
function twitchLogin(url) {
  if (!url) return null;
  const login = url.replace(/\/+$/, '').split('/').pop().toLowerCase();
  return login || null;
}

/** Format viewer count: 1 234 → "1.2k". */
function fmtViewers(n) {
  if (n == null) return '';
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

const PALETTES = [
  ['#e8501a', '#f5a623'],
  ['#9b59b6', '#3498db'],
  ['#2ecc71', '#16a085'],
  ['#e74c3c', '#c0392b'],
  ['#3498db', '#1abc9c'],
  ['#f39c12', '#e67e22'],
  ['#8e44ad', '#2980b9'],
  ['#27ae60', '#2ecc71'],
];

function avatarPalette(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTES[Math.abs(h) % PALETTES.length];
}

function initials(name) {
  return (name || '?')
    .split(/[\s_\-\.]+/)
    .map(w => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function avatarHTML(profile) {
  const name = profile.display_name || profile.name;
  if (profile.avatar) {
    return `<img src="${esc(profile.avatar)}" alt="${esc(name)}" loading="lazy"
              onerror="this.replaceWith(document.createTextNode('${esc(initials(name))}'))">`;
  }
  const [c1, c2] = avatarPalette(name);
  return `<span style="
    display:flex; align-items:center; justify-content:center;
    width:100%; height:100%; border-radius:50%;
    background: linear-gradient(135deg, ${c1}, ${c2});
    font-family: 'Righteous', cursive; font-size: 1.1rem; color: #fff;
  ">${esc(initials(name))}</span>`;
}

const ICON = {
  globe: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93
      0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1
      H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>`,

  twitch: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24
      l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
  </svg>`,

  eye: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z
      M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3
      3-1.34 3-3-1.34-3-3-3z"/>
  </svg>`,

  dot: `<svg width="7" height="7" viewBox="0 0 7 7" aria-hidden="true">
    <circle cx="3.5" cy="3.5" r="3.5" fill="currentColor"/>
  </svg>`,
};

async function fetchProfiles() {
  const res = await fetch(PROFILES_URL);
  if (!res.ok) throw new Error(`profiles ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.profiles) ? data.profiles : [];
}

async function fetchLiveStatus() {
  try {
    // Cache-bust so the browser doesn't serve a stale file.
    const res = await fetch(`${LIVE_STATUS_URL}?_=${Date.now()}`);
    if (!res.ok) return { live: [], streams: {} };
    return await res.json();
  } catch {
    return { live: [], streams: {} };
  }
}

function renderLiveSection(profiles, liveStatus) {
  const section = document.getElementById('live-section');
  const content = document.getElementById('live-content');

  const liveSet = new Set((liveStatus.live || []).map(u => u.toLowerCase()));

  const liveProfiles = profiles.filter(p => {
    const login = twitchLogin(p.twitch);
    return login && liveSet.has(login);
  });

  if (liveProfiles.length === 0) {
    section.style.display = 'none';
    return;
  }

  // Sort by current viewer count desc.
  liveProfiles.sort((a, b) => {
    const av = (liveStatus.streams[twitchLogin(a.twitch)] || {}).viewer_count || 0;
    const bv = (liveStatus.streams[twitchLogin(b.twitch)] || {}).viewer_count || 0;
    return bv - av;
  });

  section.style.display = 'block';

  const parent   = window.location.hostname || 'localhost';
  const featured = liveProfiles[Math.floor(Math.random() * liveProfiles.length)];
  const login    = twitchLogin(featured.twitch);
  const streamMeta = liveStatus.streams[login] || {};

  const html = `
    <div class="live-featured">
      <div class="live-embed-wrap">
        <iframe
          src="https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=${encodeURIComponent(parent)}&autoplay=true"
          allowfullscreen
          allow="autoplay; fullscreen"
          title="Stream de ${esc(featured.display_name || featured.name)}"
          loading="lazy"
        ></iframe>
      </div>
      <div class="live-stream-meta">
        <span class="live-badge">${ICON.dot} LIVE</span>
        <span class="live-stream-name">${esc(featured.display_name || featured.name)}</span>
        ${streamMeta.title
          ? `<span class="live-stream-title">${esc(streamMeta.title)}</span>`
          : ''}
        <a href="https://twitch.tv/${encodeURIComponent(login)}" class="card-btn card-btn-live"
           target="_blank" rel="noopener noreferrer">
          ${ICON.twitch} Regarder sur Twitch
        </a>
        ${streamMeta.viewer_count != null
          ? `<span class="viewer-pill">${ICON.eye} ${fmtViewers(streamMeta.viewer_count)}</span>`
          : ''}
      </div>
    </div>
  `;

  content.innerHTML = html;
}

function buildCard(profile, liveStatus, animIndex) {
  const login   = twitchLogin(profile.twitch);
  const liveSet = new Set((liveStatus.live || []).map(u => u.toLowerCase()));
  const isLive  = Boolean(login && liveSet.has(login));
  const stream  = isLive ? (liveStatus.streams[login] || {}) : null;
  const name    = profile.display_name || profile.name;

  return `
    <article
      class="streamer-card${isLive ? ' is-live' : ''}"
      role="listitem"
      style="--card-anim-delay: ${animIndex * 60}ms"
    >
      <div class="card-header">
        <div class="card-avatar-wrap">
          <div class="card-avatar-ring" aria-hidden="true"></div>
          <div class="card-avatar">${avatarHTML(profile)}</div>
        </div>
        <div class="card-identity">
          <div class="card-name">
            ${esc(name)}
            ${isLive ? `<span class="card-live-badge">${ICON.dot} LIVE</span>` : ''}
          </div>
          ${isLive && stream?.viewer_count != null
            ? `<div class="card-viewers">${ICON.eye} ${fmtViewers(stream.viewer_count)} spectateurs</div>`
            : ''}
        </div>
      </div>

      ${profile.description
        ? `<p class="card-desc">${esc(stripHtml(profile.description))}</p>`
        : ''}

      <div class="card-links">
        ${profile.twitch
          ? `<a href="${esc(profile.twitch)}" class="card-btn ${isLive ? 'card-btn-live' : 'card-btn-twitch'}"
               target="_blank" rel="noopener noreferrer">
               ${ICON.twitch} ${isLive ? 'Regarder' : 'Twitch'}
             </a>`
          : ''}
        ${profile.url
          ? `<a href="${esc(profile.url)}" class="card-btn card-btn-profile"
               target="_blank" rel="noopener noreferrer">
               ${ICON.globe} Liens
             </a>`
          : ''}
      </div>
    </article>
  `;
}

function renderStreamersGrid(profiles, liveStatus) {
  const grid   = document.getElementById('streamers-grid');
  const liveSet = new Set((liveStatus.live || []).map(u => u.toLowerCase()));

  const live    = [];
  const offline = [];

  profiles.forEach(p => {
    const login = twitchLogin(p.twitch);
    if (login && liveSet.has(login)) {
      live.push(p);
    } else {
      offline.push(p);
    }
  });

  // Live sorted by viewers desc, offline randomised.
  live.sort((a, b) => {
    const av = (liveStatus.streams[twitchLogin(a.twitch)] || {}).viewer_count || 0;
    const bv = (liveStatus.streams[twitchLogin(b.twitch)] || {}).viewer_count || 0;
    return bv - av;
  });

  const ordered = [...live, ...shuffle(offline)];

  if (ordered.length === 0) {
    grid.innerHTML = `
      <div class="state-empty">
        <strong>Aucun streamer trouvé</strong>
        <span>Impossible de charger les profils pour le moment.</span>
      </div>`;
    return;
  }

  grid.innerHTML = ordered.map((p, i) => buildCard(p, liveStatus, i)).join('');
}

function createStarfield() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const frag = document.createDocumentFragment();
  for (let i = 0; i < 90; i++) {
    const el  = document.createElement('div');
    const sz  = Math.random() * 1.8 + 0.6;
    const dur = (2.5 + Math.random() * 4).toFixed(1);
    const del = (Math.random() * 5).toFixed(1);
    el.className = 'star';
    el.style.cssText = [
      `width:${sz}px`, `height:${sz}px`,
      `left:${(Math.random() * 100).toFixed(2)}%`,
      `top:${(Math.random() * 100).toFixed(2)}%`,
      `opacity:${(Math.random() * 0.5 + 0.1).toFixed(2)}`,
      `--dur:${dur}s`, `--del:${del}s`,
    ].join(';');
    frag.appendChild(el);
  }
  canvas.appendChild(frag);
}

async function init() {
  const grid = document.getElementById('streamers-grid');

  // Show spinner while fetching.
  grid.innerHTML = `
    <div class="state-loading">
      <div class="spinner"></div>
      <span>Chargement des streamers…</span>
    </div>`;

  try {
    const [profiles, liveStatus] = await Promise.all([
      fetchProfiles(),
      fetchLiveStatus(),
    ]);

    renderLiveSection(profiles, liveStatus);
    renderStreamersGrid(profiles, liveStatus);
  } catch (err) {
    console.error('[COGIP.TV]', err);
    grid.innerHTML = `
      <div class="state-empty">
        <strong>Erreur de chargement</strong>
        <span>Impossible de récupérer les streamers. Réessaie plus tard.</span>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  createStarfield();
  init();
});
