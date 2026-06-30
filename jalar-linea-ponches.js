// jalar-linea-ponches.js
// Jala la linea de mercado de ponches (pitcher_strikeouts) de The Odds API.
// IMPORTANTE: pitcher_strikeouts es un "additional market" (player prop) — no se puede pedir
// con el endpoint general /odds (como totals). Hay que pedirlo evento por evento via
// /events/{eventId}/odds. Por eso son 2 pasos: 1) events del dia, 2) odds por cada eventId.
// La llave NUNCA sale al cliente, la inyecta el Worker. Cachea en localStorage por dia.

var LINEAS_PONCHES_CACHE_KEY = "lineas_ponches_cache_v1";

function lineasPonchesLeerCache() {
  try {
    var raw = localStorage.getItem(LINEAS_PONCHES_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}

function lineasPonchesGuardarCache(obj) {
  try {
    localStorage.setItem(LINEAS_PONCHES_CACHE_KEY, JSON.stringify(obj));
  } catch(e) {}
}

function lineaPonchesBuscarPitcher(nombreCompleto) {
  var cache = lineasPonchesLeerCache();
  if (!cache || !cache.pitchers || !nombreCompleto) return null;
  var v = nombreCompleto.trim().toLowerCase();
  for (var i = 0; i < cache.pitchers.length; i++) {
    if ((cache.pitchers[i].pitcher || "").trim().toLowerCase() === v) return cache.pitchers[i];
  }
  return null;
}

async function jalarLineasPonches(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  var hoy = (function(){
    var d = new Date(Date.now() - 6*60*60*1000);
    return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  })();

  var cache = lineasPonchesLeerCache();
  if (cache && cache.fecha === hoy && cache.pitchers && cache.pitchers.length > 0) {
    log("Líneas de ponches: cache de hoy OK (" + cache.pitchers.length + " pitchers).");
    return cache;
  }

  // 1. lista de eventos del dia (sin odds, solo IDs)
  log("Jalando eventos MLB del día...");
  var eventsUrl = "https://api.the-odds-api.com/v4/sports/baseball_mlb/events";
  var eventsProxy = MLB_ROUTES.WORKER_BASE + encodeURIComponent(eventsUrl);
  var resEvents = await fetch(eventsProxy);
  if (!resEvents.ok) throw new Error("Odds API events HTTP " + resEvents.status);
  var events = await resEvents.json();
  if (!Array.isArray(events)) throw new Error("Odds API events: respuesta inesperada");
  log("Eventos MLB encontrados: " + events.length);

  var pitchers = [];

  // 2. por cada evento, pedir el market pitcher_strikeouts individualmente
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    try {
      var oddsUrl = "https://api.the-odds-api.com/v4/sports/baseball_mlb/events/" + ev.id +
        "/odds?regions=us&markets=pitcher_strikeouts&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm";
      var oddsProxy = MLB_ROUTES.WORKER_BASE + encodeURIComponent(oddsUrl);
      var resOdds = await fetch(oddsProxy);
      if (!resOdds.ok) { log("  " + ev.away_team + " @ " + ev.home_team + " → sin market K (HTTP " + resOdds.status + ")"); continue; }
      var dataOdds = await resOdds.json();

      var bookmakers = dataOdds.bookmakers || [];
      var encontradoEnEvento = false;
      var orden = ["draftkings", "fanduel", "betmgm"];

      for (var bo = 0; bo < orden.length && !encontradoEnEvento; bo++) {
        var bk = null;
        for (var b = 0; b < bookmakers.length; b++) {
          if (bookmakers[b].key === orden[bo]) { bk = bookmakers[b]; break; }
        }
        if (!bk) continue;

        var mkts = bk.markets || [];
        for (var m = 0; m < mkts.length; m++) {
          if (mkts[m].key !== "pitcher_strikeouts") continue;
          var outs = mkts[m].outcomes || [];
          var porNombre = {};
          outs.forEach(function(o) {
            var nom = o.description || "NO_CONFIRMADO";
            if (!porNombre[nom]) porNombre[nom] = { pitcher: nom, total_k: o.point !== undefined ? o.point : null, over_price: null, under_price: null };
            if (o.name === "Over") porNombre[nom].over_price = o.price;
            if (o.name === "Under") porNombre[nom].under_price = o.price;
          });
          Object.keys(porNombre).forEach(function(nom) {
            pitchers.push({
              pitcher: nom,
              away_team: ev.away_team,
              home_team: ev.home_team,
              total_k: porNombre[nom].total_k,
              over_price: porNombre[nom].over_price,
              under_price: porNombre[nom].under_price,
              bookie: bk.title
            });
          });
          encontradoEnEvento = true;
        }
      }
      log("  " + ev.away_team + " @ " + ev.home_team + " → " + (encontradoEnEvento ? "K OK" : "sin market K disponible"));
    } catch (eEv) {
      log("AVISO evento " + (ev.away_team||"?") + " @ " + (ev.home_team||"?") + ": " + (eEv && eEv.message ? eEv.message : eEv));
    }
  }

  var nuevo = { fecha: hoy, pitchers: pitchers };
  lineasPonchesGuardarCache(nuevo);
  log("Líneas de ponches guardadas: " + pitchers.length + " registros.");
  return nuevo;
}
