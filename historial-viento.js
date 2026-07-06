// historial-viento.js
// Muestra el historial de un pitcher (fecha, rival, IP, K, carreras, pitcheos, viento)
// usando el objeto real que devuelve jalarUltimos5() y el cache de jalar-clima.js
// (climaLeerCache) para cruzar el viento por fecha+equipo.
//
// Campos reales de jalarUltimos5().juegos[i] (confirmados en el archivo fuente):
//   date, pitches, innings_pitched (string MLB ej "3.1"), innings_pitched_real (decimal),
//   strikeouts, runs_allowed (carreras totales, NO especificamente limpias), opponent
// NO trae BB (bases por bolas) — se muestra NO_CONFIRMADO en vez de inventarlo.

function venueCanonHV(v) {
  return (typeof STADIUM_ALIAS_2026 !== "undefined" && STADIUM_ALIAS_2026[v]) ? STADIUM_ALIAS_2026[v] : v;
}

function buscarClimaDelStart(fecha, equipoPitcher, cacheClima) {
  if (!fecha || !equipoPitcher) return null;
  return cacheClima.find(function (c) {
    if (c.date !== fecha) return false;
    var home = venueCanonHV(c.home_team), away = venueCanonHV(c.away_team);
    return c.home_team === equipoPitcher || c.away_team === equipoPitcher;
  }) || null;
}

function toggleHistorialK(pitcherId) {
  var contenedor = document.getElementById("historial-" + pitcherId);
  if (!contenedor) return;

  if (contenedor.style.display === "block") {
    contenedor.style.display = "none";
    return;
  }

  var datos = window.historialPitchers && window.historialPitchers[pitcherId];
  if (!datos || !datos.juegos || datos.juegos.length === 0) {
    contenedor.innerHTML = "<p style='color:#8b949e;font-size:12px;'>NO_CONFIRMADO: sin datos de starts para este pitcher</p>";
    contenedor.style.display = "block";
    return;
  }

  var cacheClima = [];
  try { cacheClima = (typeof climaLeerCache === "function") ? climaLeerCache() : []; }
  catch (e) { cacheClima = []; }

  var equipoPitcher = datos.equipo;

  var filas = datos.juegos.map(function (s) {
    var fecha = s.date || "NO_CONFIRMADO";
    var rival = s.opponent || "NO_CONFIRMADO";

    var clima = buscarClimaDelStart(fecha, equipoPitcher, cacheClima);
    var venue = clima ? clima.venue : "NO_CONFIRMADO";
    var viento = (clima && clima.windspeed_mph !== undefined && clima.wind_dir !== undefined && clima.wind_dir !== "")
      ? (clima.windspeed_mph + " mph " + clima.wind_dir + "°")
      : "NO_CONFIRMADO";

    var ip = (s.innings_pitched !== undefined && s.innings_pitched !== null) ? s.innings_pitched : "NO_CONFIRMADO";
    var k = (s.strikeouts !== undefined && s.strikeouts !== null) ? s.strikeouts : "NO_CONFIRMADO";
    var bb = "NO_CONFIRMADO"; // este dato no existe en jalarUltimos5()
    var carreras = (s.runs_allowed !== undefined && s.runs_allowed !== null) ? s.runs_allowed : "NO_CONFIRMADO";
    var pitcheos = (s.pitches !== undefined && s.pitches !== null) ? s.pitches : "NO_CONFIRMADO";

    return "<tr>" +
      "<td>" + fecha + "</td>" +
      "<td>vs " + rival + "</td>" +
      "<td>" + venue + "</td>" +
      "<td>" + ip + "</td>" +
      "<td>" + k + "</td>" +
      "<td>" + bb + "</td>" +
      "<td>" + carreras + "</td>" +
      "<td>" + pitcheos + "</td>" +
      "<td>" + viento + "</td>" +
      "</tr>";
  }).join("");

  contenedor.innerHTML =
    "<table class='tabla-historial' style='width:100%;font-size:11px;border-collapse:collapse;margin-top:6px;'>" +
    "<thead><tr style='color:#8b949e;'><th>Fecha</th><th>Rival</th><th>Parque</th><th>IP</th><th>K</th><th>BB</th><th>Carreras</th><th>Pitcheos</th><th>Viento</th></tr></thead>" +
    "<tbody>" + filas + "</tbody></table>" +
    "<div style='font-size:9px;color:#6e7681;margin-top:4px;'>BB no disponible en la fuente de datos actual. Carreras = totales permitidas, no necesariamente limpias (ER).</div>";
  contenedor.style.display = "block";
}
