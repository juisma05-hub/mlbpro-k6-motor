// jalar-ultimos5.js
// PIEZA - trae los ULTIMOS 5 juegos como ABRIDOR de un pitcher (pitches, IP, K, fecha).
// Fuente: MLB Stats API /people/{id}/stats?stats=gameLog&group=pitching&season={year}
// Filtra solo juegos donde fue abridor (gamesStarted=1 en el split, o isStartingPitcher si viene).
// NO inventa: si no hay 5 juegos disponibles, devuelve los que haya y marca el total real.

async function jalarUltimos5(playerId, season) {
  const salida = {
    player_id: playerId,
    season: season,
    juegos: [], // [{date, pitches, innings_pitched, strikeouts, runs_allowed, opponent}]
    pitches_promedio: null,
    ip_promedio: null,
    k_promedio: null,
    n_juegos: 0,
    error: null
  };

  if (!playerId) { salida.error = "ERR:SIN_PLAYER_ID"; return salida; }

  try {
    const mlbUrl = "https://statsapi.mlb.com/api/v1/people/" + playerId +
      "/stats?stats=gameLog&group=pitching&season=" + season;
    const url = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);
    const res = await fetch(url);
    if (!res.ok) { salida.error = "ERR:GAMELOG_HTTP_" + res.status; return salida; }
    const data = await res.json();

    const stats = data && data.stats && data.stats[0] ? data.stats[0] : null;
    const splits = stats && stats.splits ? stats.splits : [];
    if (!splits.length) { salida.error = "SIN_GAMELOG_DISPONIBLE"; return salida; }

    // Solo juegos donde fue ABRIDOR: gamesStarted === 1 en ese split puntual
    const comoAbridor = splits.filter(function(s) {
      return s.stat && Number(s.stat.gamesStarted) === 1;
    });

    if (!comoAbridor.length) { salida.error = "SIN_SALIDAS_COMO_ABRIDOR"; return salida; }

    // ordenar por fecha descendente (mas reciente primero) y tomar 5
    comoAbridor.sort(function(a, b) {
      return (b.date || "") < (a.date || "") ? -1 : 1;
    });
    const ultimos5 = comoAbridor.slice(0, 5);

    let sumaPitches = 0, nPitches = 0;
    let sumaIP = 0, nIP = 0;
    let sumaK = 0, nK = 0;

    ultimos5.forEach(function(s) {
      const st = s.stat || {};
      const pitches = st.numberOfPitches !== undefined ? Number(st.numberOfPitches) : null;
      const ip = st.inningsPitched !== undefined ? parseFloat(st.inningsPitched) : null;
      const k = st.strikeOuts !== undefined ? Number(st.strikeOuts) : null;
      const runs = st.runs !== undefined ? Number(st.runs) : null;
      const opp = s.opponent && s.opponent.name ? s.opponent.name : "NO_CONFIRMADO";

      salida.juegos.push({
        date: s.date || "NO_CONFIRMADO",
        pitches: pitches,
        innings_pitched: st.inningsPitched !== undefined ? st.inningsPitched : "NO_CONFIRMADO",
        strikeouts: k,
        runs_allowed: runs,
        opponent: opp
      });

      if (pitches !== null && !isNaN(pitches)) { sumaPitches += pitches; nPitches++; }
      if (ip !== null && !isNaN(ip)) { sumaIP += ip; nIP++; }
      if (k !== null && !isNaN(k)) { sumaK += k; nK++; }
    });

    salida.n_juegos = ultimos5.length;
    salida.pitches_promedio = nPitches > 0 ? Math.round((sumaPitches / nPitches) * 10) / 10 : null;
    salida.ip_promedio = nIP > 0 ? Math.round((sumaIP / nIP) * 100) / 100 : null;
    salida.k_promedio = nK > 0 ? Math.round((sumaK / nK) * 10) / 10 : null;

    return salida;
  } catch (err) {
    salida.error = "ERR:" + err.message;
    return salida;
  }
}
