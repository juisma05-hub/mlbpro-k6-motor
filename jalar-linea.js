// jalar-linea.js
// Jala el over/under (total) de The Odds API para los juegos de MLB de hoy.
// La llave NUNCA sale al cliente — la inyecta el Worker de Cloudflare.

var LINEAS_CACHE_KEY = "lineas_mercado_cache";

// Mapeo: nombre de equipo (como viene de The Odds API) → venue exacto del estadio
var ODDS_TEAM_TO_VENUE = {
  "Baltimore Orioles":       "Oriole Park at Camden Yards",
  "Boston Red Sox":          "Fenway Park",
  "New York Yankees":        "Yankee Stadium",
  "Tampa Bay Rays":          "Tropicana Field",
  "Toronto Blue Jays":       "Rogers Centre",
  "Chicago White Sox":       "Rate Field",
  "Cleveland Guardians":     "Progressive Field",
  "Detroit Tigers":          "Comerica Park",
  "Kansas City Royals":      "Kauffman Stadium",
  "Minnesota Twins":         "Target Field",
  "Houston Astros":          "Daikin Park",
  "Los Angeles Angels":      "Angel Stadium",
  "Oakland Athletics":       "Sutter Health Park",
  "Seattle Mariners":        "T-Mobile Park",
  "Texas Rangers":           "Globe Life Field",
  "Atlanta Braves":          "Truist Park",
  "Miami Marlins":           "loanDepot Park",
  "New York Mets":           "Citi Field",
  "Philadelphia Phillies":   "Citizens Bank Park",
  "Washington Nationals":    "Nationals Park",
  "Chicago Cubs":            "Wrigley Field",
  "Cincinnati Reds":         "Great American Ball Park",
  "Milwaukee Brewers":       "American Family Field",
  "Pittsburgh Pirates":      "PNC Park",
  "St. Louis Cardinals":     "Busch Stadium",
  "Arizona Diamondbacks":    "Chase Field",
  "Colorado Rockies":        "Coors Field",
  "Los Angeles Dodgers":     "Dodger Stadium",
  "San Diego Padres":        "Petco Park",
  "San Francisco Giants":    "Oracle Park"
};

function lineasLeerCache() {
  try {
    var raw = localStorage.getItem(LINEAS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}

function lineasGuardarCache(obj) {
  try {
    localStorage.setItem(LINEAS_CACHE_KEY, JSON.stringify(obj));
  } catch(e) {}
}

// Busca el total por venue del parque local
function lineasBuscarVenue(venue) {
  var cache = lineasLeerCache();
  if (!cache || !cache.juegos) return null;
  var v = (venue || "").trim().toLowerCase();
  for (var i = 0; i < cache.juegos.length; i++) {
    var j = cache.juegos[i];
    if ((j.venue || "").trim().toLowerCase() === v) return j;
  }
  return null;
}

async function jalarLineas(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  var hoy = (function(){
    var d = new Date(Date.now() - 6*60*60*1000);
    return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  })();

  var cache = lineasLeerCache();
  if (cache && cache.fecha === hoy && cache.juegos && cache.juegos.length > 0) {
    log("Líneas de mercado: cache de hoy OK (" + cache.juegos.length + " juegos).");
    return cache;
  }

  log("Jalando líneas de mercado (totals)...");

  var oddsUrl = "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?regions=us&markets=totals&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm";
  var proxyUrl = MLB_ROUTES.WORKER_BASE + encodeURIComponent(oddsUrl);

  var resp = await fetch(proxyUrl);
  if (!resp.ok) throw new Error("Odds API HTTP " + resp.status);
  var data = await resp.json();
  if (!Array.isArray(data)) throw new Error("Odds API: respuesta inesperada");

  log("Juegos recibidos de Odds API: " + data.length);

  var juegos = [];
  for (var i = 0; i < data.length; i++) {
    var g = data[i];
    var home = g.home_team || "";
    var away = g.away_team || "";
    var venue = ODDS_TEAM_TO_VENUE[home] || null;
    var total = null;
    var bookie = null;

    var orden = ["draftkings", "fanduel", "betmgm"];
    for (var bo = 0; bo < orden.length && total === null; bo++) {
      for (var b = 0; b < g.bookmakers.length; b++) {
        if (g.bookmakers[b].key !== orden[bo]) continue;
        var mkts = g.bookmakers[b].markets || [];
        for (var m = 0; m < mkts.length; m++) {
          if (mkts[m].key !== "totals") continue;
          var outs = mkts[m].outcomes || [];
          for (var o = 0; o < outs.length; o++) {
            if (outs[o].name === "Over" && outs[o].point !== undefined) {
              total = outs[o].point;
              bookie = g.bookmakers[b].title;
              break;
            }
          }
          if (total !== null) break;
        }
        if (total !== null) break;
      }
    }

    juegos.push({ home: home, away: away, venue: venue, total: total, bookie: bookie });
    log("  " + away + " @ " + home + " → venue: " + (venue||"N/C") + " · total: " + (total !== null ? total : "N/C"));
  }

  var nuevo = { fecha: hoy, juegos: juegos };
  lineasGuardarCache(nuevo);
  log("Líneas de mercado guardadas en cache.");
  return nuevo;
}
