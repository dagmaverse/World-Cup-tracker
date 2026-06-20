const DATA_URL = 'https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.json';
const REFRESH_INTERVAL = 1000 * 60 * 5; // 5 minutes

const teamIso = {
  Argentina: 'ar', Australia: 'au', Austria: 'at', Belgium: 'be', Brazil: 'br', Canada: 'ca',
  Croatia: 'hr', Colombia: 'co', CostaRica: 'cr', Ecuador: 'ec', England: 'gb-eng', France: 'fr',
  Germany: 'de', Ghana: 'gh', Morocco: 'ma', Mexico: 'mx', Netherlands: 'nl', NewZealand: 'nz',
  Panama: 'pa', Paraguay: 'py', Portugal: 'pt', Qatar: 'qa', SaudiArabia: 'sa', Scotland: 'gb-sct',
  Senegal: 'sn', SouthAfrica: 'za', SouthKorea: 'kr', Spain: 'es', Sweden: 'se', Switzerland: 'ch',
  Tunisia: 'tn', Turkey: 'tr', USA: 'us', Uruguay: 'uy', Japan: 'jp', Iran: 'ir', Iraq: 'iq',
  Egypt: 'eg', Canada: 'ca', Costa: 'cr', Australia: 'au', Belgium: 'be', Brazil: 'br',
  'Czech Republic': 'cz', 'Cape Verde': 'cv', 'DR Congo': 'cd', 'Haiti': 'ht', 'Ivory Coast': 'ci',
  'New Zealand': 'nz', 'South Korea': 'kr', 'Saudi Arabia': 'sa', 'United States': 'us',
  USA: 'us', 'Bosnia & Herzegovina': 'ba', 'Curaçao': 'cw', 'Wales': 'gb-wls', 'Northern Ireland': 'gb-nir'
};

const $liveSection = document.getElementById('liveSection');
const $upcomingSection = document.getElementById('upcomingSection');
const $standingsSection = document.getElementById('standingsSection');
const $knockoutSection = document.getElementById('knockoutSection');
const $lastUpdated = document.getElementById('lastUpdated');
const $refreshButton = document.getElementById('refreshButton');

$refreshButton.addEventListener('click', () => fetchMatches(true));

function getFlagUrl(country) {
  const code = teamIso[country] || teamIso[country.replace(/\s+/g, '')];
  if (code) {
    if (code.includes('gb-')) {
      return `https://flagcdn.com/w40/${code.split('-')[1]}.png`;
    }
    return `https://flagcdn.com/w40/${code}.png`;
  }
  const safeName = encodeURIComponent(country.replace(/\s+/g, '-').toLowerCase());
  return `https://countryflagsapi.com/png/${safeName}`;
}

function parseMatchDate(date, time) {
  if (!time) {
    return new Date(date);
  }
  const formatted = time.replace('UTC', 'GMT');
  const value = `${date} ${formatted}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(date) : parsed;
}

function formatTeams(team1, team2, score) {
  const score1 = score?.ft?.[0];
  const score2 = score?.ft?.[1];
  return `
    <div class="team-row">
      <div class="team-meta">
        <img src="${getFlagUrl(team1)}" alt="${team1} flag" onerror="this.style.opacity='0.3'" />
        <span class="team-name">${team1}</span>
      </div>
      <div class="team-score">${score1 != null ? score1 : '-'}</div>
    </div>
    <div class="team-row">
      <div class="team-meta">
        <img src="${getFlagUrl(team2)}" alt="${team2} flag" onerror="this.style.opacity='0.3'" />
        <span class="team-name">${team2}</span>
      </div>
      <div class="team-score">${score2 != null ? score2 : '-'}</div>
    </div>
  `;
}

function buildMatchCard(match, label) {
  const time = parseMatchDate(match.date, match.time);
  const dateText = time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeText = time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const status = match.score?.ft?.length === 2 ? 'Finished' : 'Upcoming';
  return `
    <article class="match-card">
      <div class="match-body">
        <div class="match-meta">
          <span>${match.group || match.round || 'Group stage'}</span>
          <span>${dateText} · ${timeText}</span>
          <span class="status-chip">${status}</span>
        </div>
        <div class="team-list">${formatTeams(match.team1, match.team2, match.score)}</div>
        <div class="match-map">${match.ground || 'Venue TBA'}</div>
      </div>
      <div class="match-insight">
        <strong>${label}</strong>
        <p>${match.round || 'Group stage fixture'}</p>
      </div>
    </article>
  `;
}

function groupMatches(matches) {
  const now = new Date();
  const upcoming = [];
  const finished = [];
  const knockout = [];

  matches.forEach((match) => {
    const isFinished = Array.isArray(match.score?.ft) && match.score.ft.length === 2;
    const isKnockout = !match.group && /Round|Final|Semi|Quarter|Play-off/i.test(match.round || '');
    const start = parseMatchDate(match.date, match.time);

    if (isKnockout) {
      knockout.push(match);
      return;
    }

    if (isFinished) {
      finished.push(match);
      return;
    }

    upcoming.push(match);
  });

  finished.sort((a, b) => parseMatchDate(b.date, b.time) - parseMatchDate(a.date, a.time));
  upcoming.sort((a, b) => parseMatchDate(a.date, a.time) - parseMatchDate(b.date, b.time));
  knockout.sort((a, b) => parseMatchDate(a.date, a.time) - parseMatchDate(b.date, b.time));
  return { finished, upcoming, knockout };
}

function makeStandings(matches) {
  const groups = {};
  matches.forEach((match) => {
    if (!match.group || !Array.isArray(match.score?.ft)) {
      return;
    }
    const team1 = match.team1;
    const team2 = match.team2;
    const [score1, score2] = match.score.ft;
    groups[match.group] ??= {};
    const state = groups[match.group];

    state[team1] ??= { team: team1, pts: 0, gd: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0 };
    state[team2] ??= { team: team2, pts: 0, gd: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0 };

    state[team1].gf += score1;
    state[team1].ga += score2;
    state[team1].gd += score1 - score2;
    state[team2].gf += score2;
    state[team2].ga += score1;
    state[team2].gd += score2 - score1;

    if (score1 > score2) {
      state[team1].w += 1;
      state[team2].l += 1;
      state[team1].pts += 3;
    } else if (score1 < score2) {
      state[team2].w += 1;
      state[team1].l += 1;
      state[team2].pts += 3;
    } else {
      state[team1].d += 1;
      state[team2].d += 1;
      state[team1].pts += 1;
      state[team2].pts += 1;
    }
  });

  return Object.entries(groups)
    .map(([group, teamState]) => {
      const items = Object.values(teamState);
      items.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
      return { group, teams: items };
    })
    .sort((a, b) => a.group.localeCompare(b.group, undefined, { numeric: true }));
}

function renderStandings(standings) {
  if (standings.length === 0) {
    $standingsSection.innerHTML = '<p class="match-map">No completed group matches yet. Standings appear as group results are entered.</p>';
    return;
  }
  $standingsSection.innerHTML = standings
    .map((groupRow) => {
      const rows = groupRow.teams
        .map((team, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${team.team}</td>
            <td>${team.pts}</td>
            <td>${team.gd}</td>
            <td>${team.gf}</td>
            <td>${team.ga}</td>
          </tr>
        `)
        .join('');
      return `
        <div>
          <p class="table-title">${groupRow.group}</p>
          <table class="standings-table">
            <thead>
              <tr><th>#</th><th>Team</th><th>Pts</th><th>GD</th><th>GF</th><th>GA</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    })
    .join('');
}

function renderMatchSection(container, matches, label, emptyMessage) {
  if (matches.length === 0) {
    container.innerHTML = `<p class="match-map">${emptyMessage}</p>`;
    return;
  }
  container.innerHTML = matches.map((match, idx) => buildMatchCard(match, label(idx))).join('');
}

function formatLiveLabel(index) {
  return index === 0 ? 'Next on the pitch' : 'Recent result';
}

function formatUpcomingLabel(index) {
  return index === 0 ? 'Up next' : 'Coming soon';
}

function formatKnockoutLabel(index) {
  return index === 0 ? 'Knockout preview' : 'Knockout fixture';
}

function setUpdateTime() {
  $lastUpdated.textContent = new Date().toLocaleString();
}

async function fetchMatches(force = false) {
  try {
    $liveSection.innerHTML = '<p class="match-map">Loading match data…</p>';
    $upcomingSection.innerHTML = '<p class="match-map">Loading match data…</p>';
    $knockoutSection.innerHTML = '<p class="match-map">Loading match data…</p>';

    const response = await fetch(DATA_URL, { cache: 'no-store' });
    const json = await response.json();
    const matches = json.matches || [];
    const { finished, upcoming, knockout } = groupMatches(matches);
    const standings = makeStandings(matches);

    renderMatchSection($liveSection, finished.slice(0, 4), formatLiveLabel, 'No finished or live matches available yet.');
    renderMatchSection($upcomingSection, upcoming.slice(0, 8), formatUpcomingLabel, 'No upcoming matches found in the dataset.');
    renderMatchSection($knockoutSection, knockout.slice(0, 6), formatKnockoutLabel, 'No knockout matches are available yet.');
    renderStandings(standings);
    setUpdateTime();
  } catch (error) {
    $liveSection.innerHTML = '<p class="match-map">Unable to load data. Please try again later.</p>';
    $upcomingSection.innerHTML = '<p class="match-map">Unable to load data. Please try again later.</p>';
    $knockoutSection.innerHTML = '<p class="match-map">Unable to load data. Please try again later.</p>';
    console.error('World Cup data fetch failed:', error);
  }
}

fetchMatches();
setInterval(fetchMatches, REFRESH_INTERVAL);
