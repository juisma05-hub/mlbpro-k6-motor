// historial-viento.js
// Cruza jalarUltimos5(pitcherId) con climaLeerCache() por fecha + equipo.
// Pegar este archivo en el repo y llamar toggleHistorialK(pitcherId, equipoPitcher) desde el HTML.

function buscarClimaDelStart(start, equipoPitcher, cacheClima) {
  const fecha = start.fecha || start.date;
  if (!fecha) return null;

  return cacheClima.find(function (c) {
    if (c.date !== fecha) return false;
    return c.home_team === equipoPitcher || c.away_team === equipoPitcher;
  }) || null;
}

function toggleHistorialK(pitcherId, equipoPitcher) {
  const contenedor = document.getElementById("historial-" + pitcherId);
  if (!contenedor) return;

  if (contenedor.style.display !== "none" && contenedor.innerHTML !== "") {
    contenedor.style.display = "none";
    return;
  }

  const starts = jalarUltimos5(pitcherId);
  const cacheClima = climaLeerCache();

  if (!starts || starts.length === 0) {
    contenedor.innerHTML = "<p>NO_CONFIRMADO: sin datos de ultimos starts para " + pitcherId + "</p>";
    contenedor.style.display = "block";
    return;
  }

  const filas = starts.map(function (s) {
    const fecha = s.fecha || s.date || "NO_CONFIRMADO";
    const rival = (equipoPitcher && s.home_team === equipoPitcher) ? s.away_team
                : (equipoPitcher && s.away_team === equipoPitcher) ? s.home_team
                : (s.rival || s.opponent || "NO_CONFIRMADO");

    const clima = buscarClimaDelStart(s, equipoPitcher, cacheClima);
    const viento = clima ? (clima.windspeed_mph + " mph " + clima.wind_dir) : "NO_CONFIRMADO";
    const venue = clima ? clima.venue : "NO_CONFIRMADO";

    return "<tr>" +
      "<td>" + fecha + "</td>" +
      "<td>vs " + rival + "</td>" +
      "<td>" + venue + "</td>" +
      "<td>" + (s.ip ?? "") + "</td>" +
      "<td>" + (s.k ?? "") + "</td>" +
      "<td>" + (s.bb ?? "") + "</td>" +
      "<td>" + (s.er ?? "") + "</td>" +
      "<td>" + (s.pitcheos ?? "") + "</td>" +
      "<td>" + viento + "</td>" +
      "</tr>";
  }).join("");

  contenedor.innerHTML =
    "<table class='tabla-historial'>" +
    "<thead><tr><th>Fecha</th><th>Rival</th><th>Parque</th><th>IP</th><th>K</th><th>BB</th><th>ER</th><th>Pitcheos</th><th>Viento</th></tr></thead>" +
    "<tbody>" + filas + "</tbody></table>";
  contenedor.style.display = "block";
}
