// historial-viento.js
// Muestra el historial de un pitcher (fecha, rival, IP, K, BB, ER, pitcheos, viento)
// usando los datos que ya trajo motor-k6-nuevo.html (window.historialPitchers)
// y el cache de jalar-clima.js (climaLeerCache) para cruzar el viento por fecha+equipo.

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
    var fecha = s.date || s.fecha || (s.gameDate ? s.gameDate.slice(0, 10) : "NO_CONFIRMADO");

    var clima = cacheClima.find(function (c) {
      return c.date === fecha && (c.home_team === equipoPitcher || c.away_team === equipoPitcher);
    });

    var rival = clima
      ? (clima.home_team === equipoPitcher ? clima.away_team : clima.home_team)
      : (s.rival || s.opponent || "NO_CONFIRMADO");

    var venue = clima ? clima.venue : (s.venue || "NO_CONFIRMADO");
    var viento = clima ? (clima.windspeed_mph + " mph " + clima.wind_dir) : "NO_CONFIRMADO";

    var ip = s.ip ?? s.inningsPitched ?? "";
    var k = s.k ?? s.strikeOuts ?? "";
    var bb = s.bb ?? s.baseOnBalls ?? "";
    var er = s.er ?? s.earnedRuns ?? "";
    var pitcheos = s.pitcheos ?? s.numberOfPitches ?? "";

    return "<tr>" +
      "<td>" + fecha + "</td>" +
      "<td>vs " + rival + "</td>" +
      "<td>" + venue + "</td>" +
      "<td>" + ip + "</td>" +
      "<td>" + k + "</td>" +
      "<td>" + bb + "</td>" +
      "<td>" + er + "</td>" +
      "<td>" + pitcheos + "</td>" +
      "<td>" + viento + "</td>" +
      "</tr>";
  }).join("");

  contenedor.innerHTML =
    "<table class='tabla-historial' style='width:100%;font-size:11px;border-collapse:collapse;margin-top:6px;'>" +
    "<thead><tr style='color:#8b949e;'><th>Fecha</th><th>Rival</th><th>Parque</th><th>IP</th><th>K</th><th>BB</th><th>ER</th><th>Pitcheos</th><th>Viento</th></tr></thead>" +
    "<tbody>" + filas + "</tbody></table>";
  contenedor.style.display = "block";
}
