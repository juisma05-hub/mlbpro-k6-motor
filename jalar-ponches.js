// jalar-ponches.js
// Actualiza K en vivo cada 30 segundos durante juegos Live
// Muestra: K actuales + K proyectados + IP lanzadas + Pitches lanzados

var ventanaEnVivo = {};

function ipRealDesdeBeisbol(ipString) {
  if (ipString === null || ipString === undefined || ipString === "") return null;
  var partes = String(ipString).split(".");
  var enteros = parseInt(partes[0], 10);
  var outs = partes[1] ? parseInt(partes[1], 10) : 0;
  if (isNaN(enteros)) return null;
  if (outs !== 0 && outs !== 1 && outs !== 2) return null;
  return enteros + (outs / 3);
}

function redondearParaMostrar(numero, decimales) {
  if (numero === null || numero === undefined || isNaN(numero)) return null;
  var factor = Math.pow(10, decimales);
  return Math.round(numero * factor) / factor;
}

async function jalarEnVivoActualizadoPitcher(gamePk, pitcherId) {
  try {
    var url = "https://statsapi.mlb.com/api/v1/game/" + gamePk + "/boxscore";
    var resp = await fetch(MLB_ROUTES.WORKER_BASE + encodeURIComponent(url));
    if (!resp.ok) return null;
    var data = await resp.json();
    var teams = ["away", "home"];
    
    for (var t = 0; t < teams.length; t++) {
      var players = data.teams && data.teams[teams[t]] ? data.teams[teams[t]].players : null;
      if (!players) continue;
      var key = "ID" + pitcherId;
      if (players[key] && players[key].stats && players[key].stats.pitching) {
        var st = players[key].stats.pitching;
        var ipReal = ipRealDesdeBeisbol(st.inningsPitched);
        var kActuales = st.strikeOuts !== undefined ? Number(st.strikeOuts) : null;
        var pitchesLanzados = st.pitches !== undefined ? Number(st.pitches) : null;
        
        if (ipReal === null || kActuales === null) return null;
        
        return {
          en_juego: true,
          ip_actual: ipReal,
          ip_actual_texto: st.inningsPitched,
          k_actual: kActuales,
          pitches_lanzados: pitchesLanzados,
          sigue_en_juego: !players[key].stats.pitching.hasOwnProperty("gameFinished") || true
        };
      }
    }
    return null;
  } catch(e) { return null; }
}

function proyeccionEnVivoActualizado(k6Preciso, enVivo) {
  if (!enVivo || !enVivo.en_juego || k6Preciso === null) return null;
  
  var ritmoK6 = k6Preciso;
  var ritmoPorIP = ritmoK6 / 6;
  var ipRestantes = Math.max(0, 6 - enVivo.ip_actual);
  var kProyRestante = ritmoPorIP * ipRestantes;
  var totalPreciso = enVivo.k_actual + kProyRestante;
  
  return {
    k_actual: enVivo.k_actual,
    ip_actual_texto: enVivo.ip_actual_texto,
    ip_actual: enVivo.ip_actual,
    k_proy_restante: redondearParaMostrar(kProyRestante, 1),
    ip_restantes: redondearParaMostrar(ipRestantes, 1),
    total_en_vivo: redondearParaMostrar(totalPreciso, 1),
    pitches_lanzados: enVivo.pitches_lanzados
  };
}

function actualizarEnVivoPitcher(pitcherId, gamePk, k6Preciso) {
  var elementoEnVivo = document.getElementById("envivo-" + pitcherId);
  if (!elementoEnVivo) return;
  
  ventanaEnVivo[pitcherId] = ventanaEnVivo[pitcherId] || { refetch: 0 };
  ventanaEnVivo[pitcherId].refetch++;
  
  if (ventanaEnVivo[pitcherId].refetch > 20) {
    return; // Limita a 20 actualizaciones por pitcher (10 minutos a 30 seg)
  }
  
  jalarEnVivoActualizadoPitcher(gamePk, pitcherId).then(function(enVivo) {
    if (!enVivo) {
      elementoEnVivo.innerHTML = '<div style="font-size:10px; color:#8b949e; text-align:center; padding:8px;">Juego finalizado o sin datos en vivo</div>';
      return;
    }
    
    var proyVivo = proyeccionEnVivoActualizado(k6Preciso, enVivo);
    if (!proyVivo) {
      elementoEnVivo.innerHTML = '<div style="font-size:10px; color:#8b949e; text-align:center; padding:8px;">Sin datos de proyección</div>';
      return;
    }
    
    var porcentajeLlenado = Math.min(100, (proyVivo.total_en_vivo / 6) * 100);
    var barraColor = proyVivo.total_en_vivo >= 5.5 ? "#0d8a6e" : 
                     proyVivo.total_en_vivo >= 4.5 ? "#79c0ff" : "#6e7681";
    
    var html = '<div class="envivo-box">' +
      '<div class="envivo-titulo">🔴 PROYECCIÓN EN VIVO</div>' +
      '<div class="envivo-total">' + proyVivo.total_en_vivo + '</div>' +
      '<div class="envivo-barra" style="background:#21262d; height:8px; border-radius:4px; margin:10px 0; overflow:hidden;">' +
        '<div style="background:' + barraColor + '; height:100%; width:' + porcentajeLlenado + '%; transition:width 0.3s ease;"></div>' +
      '</div>' +
      '<div class="envivo-detalle" style="font-size:10px; color:#c9d1d9; margin:8px 0 0;">' +
        '<span style="font-weight:700;">' + proyVivo.k_actual + ' K</span> actuales + ' +
        '<span style="font-weight:700;">' + proyVivo.k_proy_restante + ' K</span> proy · ' +
        '<span style="font-weight:700;">' + proyVivo.ip_restantes + '</span> IP restantes' +
      '</div>' +
      '<div class="envivo-detalle" style="font-size:9px; color:#8b949e; margin:6px 0 0;">' +
        '(' + proyVivo.ip_actual_texto + ' IP lanzadas' + 
        (proyVivo.pitches_lanzados !== null ? ' · ' + proyVivo.pitches_lanzados + ' pitches' : '') + ')' +
      '</div>' +
    '</div>';
    
    elementoEnVivo.innerHTML = html;
  }).catch(function(e) {
    console.warn("Error actualizando EN VIVO para pitcher " + pitcherId + ": " + e);
  });
}

function iniciarActualizacionEnVivo(pitcherId, gamePk, k6Preciso) {
  // Primera actualización inmediata
  actualizarEnVivoPitcher(pitcherId, gamePk, k6Preciso);
  
  // Luego cada 30 segundos
  if (!ventanaEnVivo[pitcherId]) {
    ventanaEnVivo[pitcherId] = {};
  }
  
  ventanaEnVivo[pitcherId].intervalo = setInterval(function() {
    actualizarEnVivoPitcher(pitcherId, gamePk, k6Preciso);
  }, 30000); // 30 segundos
}

// Limpiar intervalos cuando cambie de página
window.addEventListener("beforeunload", function() {
  Object.keys(ventanaEnVivo).forEach(function(pitcherId) {
    if (ventanaEnVivo[pitcherId].intervalo) {
      clearInterval(ventanaEnVivo[pitcherId].intervalo);
    }
  });
});
