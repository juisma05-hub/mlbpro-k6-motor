// motor-k6-nuevo.js
// MOTOR K6 — proyección de ponches del abridor, escalado a 6.0 IP.
//
// REGLA DE ORO DE ESTE MOTOR (corregida y confirmada en conversación):
//   - K6 = (Ponches del start × 6) / IP real del start. Se calcula POR CADA start
//     reciente y luego se promedian los resultados ya escalados.
//   - NO se filtra por un mínimo de IP. Un start de 5.1 IP con 8 K SÍ cuenta,
//     escalado: 8*6/5.333 = 9.0.
//   - NO se redondea inningsPitched. .1 = 1/3 (0.333...), .2 = 2/3 (0.666...).
//   - Si un pitcher no tiene NINGÚN start con datos válidos (IP y K numéricos)
//     en la ventana, el resultado es NO_CONFIRMADO. No se inventa.
//
// FORMULA (definida por el usuario):
//   K6 = BASE_K_SKILL × EXPECTED_VOLUME × ARSENAL × LINEUP × UMPIRE × CATCHER × PARK × CLIMA
//
// Este archivo NO inventa campos. Donde el dato real no existe o no está
// confirmado, el factor queda en 1.0 (neutro) y se marca status:"NO_CONFIRMADO"
// en el desglose, para que TÚ decidas si confías en el número o no.

// ============================================================
// CONSTANTES DE REFERENCIA (ligadas a datos reales ya confirmados)
// ============================================================

// Pitches por K promedio de LIGA, calculado de la tabla Statcast que mandaste
// (372,172 pitches / 21,175 SO, temporada 2026 completa, 30 equipos).
// Fuente: captura baseballsavant.mlb.com/league, confirmada por el usuario.
const LEAGUE_AVG_PITCHES_PER_K = 372172 / 21175; // = 17.58

// Tabla de equipos: pitches por K, SACADA SOLO de las capturas confirmadas.
// NO_CONFIRMADO para cualquier equipo que no haya sido verificado en captura.
// Llenar esta tabla completa (30 equipos) es tarea pendiente — por ahora
// solo los 3 que se verificaron en conversación.
const LINEUP_PITCHES_PER_K_2026 = {
  "Tampa Bay Rays":      { pitches: 11726, so: 580, pitches_per_k: 11726/580 },  // 20.22
  "Colorado Rockies":    { pitches: 12142, so: 750, pitches_per_k: 12142/750 },  // 16.19
  "Cincinnati Reds":     { pitches: 12378, so: 783, pitches_per_k: 12378/783 }   // 15.81
  // ... resto de los 30 equipos: NO_CONFIRMADO hasta transcribir tabla completa
};

// ============================================================
// UTILIDAD: convertir innings "de béisbol" (4.2) a número real (4.667)
// CRÍTICO: nunca usar parseFloat() directo sobre inningsPitched.
// ============================================================
function ipRealDesdeBeisbol(ipString) {
  if (ipString === null || ipString === undefined || ipString === "NO_CONFIRMADO") return null;
  const partes = String(ipString).split(".");
  const enteros = parseInt(partes[0], 10);
  const outs = partes[1] ? parseInt(partes[1], 10) : 0;
  if (isNaN(enteros)) return null;
  // outs solo puede ser 0, 1 o 2 — si viene otra cosa, el dato está corrupto
  if (outs !== 0 && outs !== 1 && outs !== 2) return null;
  return enteros + (outs / 3);
}

// ============================================================
// CAPA 1 + 2: BASE_K_SKILL + EXPECTED_VOLUME
// Fuente: jalar-ultimos5.js (ya existe en el repo).
// FORMULA: por cada start con datos válidos, K6_start = (K del start × 6) / IP_real.
// Se promedian esos K6_start ya escalados. NO se filtra por un piso de IP.
// ============================================================
function calcularBaseYVolumen(juegos) {
  // juegos = array de salidas del pitcher: [{innings_pitched, strikeouts, pitches}, ...]
  // (formato que ya devuelve jalar-ultimos5.js en salida.juegos)

  const valuos = juegos.filter(function(j) {
    const ipReal = ipRealDesdeBeisbol(j.innings_pitched);
    const k = Number(j.strikeouts);
    return ipReal !== null && ipReal > 0 && !isNaN(k);
  });

  if (valuos.length === 0) {
    return {
      base_k_skill: null,
      expected_volume_ip: null,
      pitches_promedio: null,
      pitches_por_k: null,
      n_starts_usados: 0,
      status: "NO_CONFIRMADO",
      motivo: "SIN_STARTS_CON_DATOS_VALIDOS_DE_IP_Y_K"
    };
  }

  let sumaK6Escalado = 0;
  let sumaIP = 0, sumaPitches = 0, nPitches = 0;
  let sumaKreal = 0;

  valuos.forEach(function(j) {
    const ipReal = ipRealDesdeBeisbol(j.innings_pitched);
    const k = Number(j.strikeouts);
    const k6Start = (k * 6) / ipReal; // formula de escala por start
    sumaK6Escalado += k6Start;
    sumaIP += ipReal;
    sumaKreal += k;
    if (j.pitches !== null && j.pitches !== undefined && !isNaN(j.pitches)) {
      sumaPitches += Number(j.pitches);
      nPitches++;
    }
  });

  const k6Promedio = sumaK6Escalado / valuos.length;
  const ipPromedio = sumaIP / valuos.length;
  const pitchesPromedio = nPitches > 0 ? sumaPitches / nPitches : null;
  // pitches por K calculado sobre los totales reales (no escalados), para que sea representativo
  const pitchesPorK = (pitchesPromedio !== null && sumaKreal > 0)
    ? sumaPitches / sumaKreal
    : null;

  return {
    base_k_skill: Math.round(k6Promedio * 100) / 100,        // K6 promedio YA escalado por start
    expected_volume_ip: Math.round(ipPromedio * 100) / 100,   // IP real promedio de los starts usados
    pitches_promedio: pitchesPromedio !== null ? Math.round(pitchesPromedio * 10) / 10 : null,
    pitches_por_k: pitchesPorK !== null ? Math.round(pitchesPorK * 100) / 100 : null,
    n_starts_usados: valuos.length,
    status: valuos.length < 3 ? "MUESTRA_PEQUENA" : "OK",
    motivo: valuos.length < 3 ? "MENOS_DE_3_STARTS_CON_DATOS_LEER_CON_CAUTELA" : null
  };
}

// ============================================================
// CAPA 3: ARSENAL_K_POWER
// Fuente: arsenal-master.js (ARSENAL_MASTER_2026), ya completo en el repo.
// Calcula el whiff% ponderado por uso real del pitcher.
// ============================================================
function calcularArsenalFactor(playerId, arsenalMaster) {
  const datos = arsenalMaster[String(playerId)];
  if (!datos || !Array.isArray(datos.arsenal) || datos.arsenal.length === 0) {
    return { factor: 1.0, whiff_ponderado: null, status: "NO_CONFIRMADO", motivo: "PITCHER_NO_EN_ARSENAL_MASTER" };
  }

  let sumaUsage = 0, sumaWhiffPonderado = 0;
  datos.arsenal.forEach(function(p) {
    if (p.whiff !== null && p.whiff !== undefined && !isNaN(p.whiff) && p.usage) {
      sumaUsage += p.usage;
      sumaWhiffPonderado += p.usage * p.whiff;
    }
  });

  if (sumaUsage === 0) {
    return { factor: 1.0, whiff_ponderado: null, status: "NO_CONFIRMADO", motivo: "SIN_WHIFF_VALIDO_EN_ARSENAL" };
  }

  const whiffPonderado = sumaWhiffPonderado / sumaUsage;

  // Referencia: ~25% es un whiff% promedio razonable de liga para un arsenal mixto.
  // ESTO ES UNA APROXIMACIÓN, no un dato verificado de liga — se deja explícito.
  const REFERENCIA_WHIFF_LIGA_APROX = 25.0;
  const factor = whiffPonderado / REFERENCIA_WHIFF_LIGA_APROX;

  return {
    factor: Math.round(factor * 1000) / 1000,
    whiff_ponderado: Math.round(whiffPonderado * 100) / 100,
    status: "OK_CON_REFERENCIA_APROXIMADA",
    motivo: "Referencia de liga (25%) es aproximacion, no dato verificado — pista para revisar despues"
  };
}

// ============================================================
// CAPA 4: LINEUP_K_MATCHUP
// Cruce real: pitches_por_k del PITCHER vs pitches_por_k del EQUIPO RIVAL,
// ambos contra el promedio de liga. Esto es lo que pediste: el núcleo del match.
// ============================================================
function calcularLineupFactor(pitchesPorKPitcher, nombreEquipoRival) {
  const datosEquipo = LINEUP_PITCHES_PER_K_2026[nombreEquipoRival];

  if (!datosEquipo) {
    return { factor: 1.0, status: "NO_CONFIRMADO", motivo: "EQUIPO_RIVAL_NO_VERIFICADO_AUN_FALTAN_27_EQUIPOS" };
  }
  if (pitchesPorKPitcher === null || pitchesPorKPitcher === undefined) {
    return { factor: 1.0, status: "NO_CONFIRMADO", motivo: "PITCHER_SIN_PITCHES_POR_K_CALCULADO" };
  }

  // Si el equipo rival necesita MENOS pitches por K que la liga, es fácil de ponchar -> sube factor.
  // Si necesita MAS pitches por K que la liga, es duro de ponchar -> baja factor.
  const factorEquipo = LEAGUE_AVG_PITCHES_PER_K / datosEquipo.pitches_per_k;

  // Si el pitcher necesita MENOS pitches por K que la liga (eficiente/elite), sube factor.
  const factorPitcher = LEAGUE_AVG_PITCHES_PER_K / pitchesPorKPitcher;

  // El cruce real: promedio geométrico de ambos efectos (ninguno domina al otro).
  const factor = Math.sqrt(factorEquipo * factorPitcher);

  return {
    factor: Math.round(factor * 1000) / 1000,
    pitches_por_k_equipo: Math.round(datosEquipo.pitches_per_k * 100) / 100,
    pitches_por_k_pitcher: Math.round(pitchesPorKPitcher * 100) / 100,
    liga_referencia: Math.round(LEAGUE_AVG_PITCHES_PER_K * 100) / 100,
    status: "OK",
    motivo: null
  };
}

// ============================================================
// CAPA 5: UMPIRE_FACTOR
// Fuente: umpires-master.js (UMPIRES_MASTER_2026), completo, 77 umpires.
// zone_factor ya viene centrado ~1.0 — se usa directo.
// ============================================================
function calcularUmpireFactor(nombreUmpireNormalizado, umpiresMaster) {
  const datos = umpiresMaster[nombreUmpireNormalizado];
  if (!datos) {
    return { factor: 1.0, status: "NO_CONFIRMADO", motivo: "UMPIRE_NO_ENCONTRADO_EN_TABLA_77" };
  }
  return {
    factor: datos.zone_factor,
    k_tier: datos.k_tier,
    k_per_game: datos.k_per_game,
    status: "OK",
    motivo: null
  };
}

// ============================================================
// CAPA 6: CATCHER_FACTOR
// Fuente: documento sin confirmar (rv_11 a rv_19 por catcher, posibles zonas Statcast).
// PENDIENTE DE CONFIRMACION DEL USUARIO — no se asume el significado de los campos.
// Se deja DESACTIVADA (factor 1.0) hasta confirmar qué son rv_11..rv_19.
// ============================================================
function calcularCatcherFactor(nombreCatcher, catcherData) {
  return {
    factor: 1.0,
    status: "NO_CONFIRMADO",
    motivo: "PENDIENTE: confirmar si rv_11..rv_19 son zonas Statcast antes de usar este dato. " +
            "No se asume el significado de los campos para evitar inventar logica."
  };
}

// ============================================================
// CAPA 7: PARK_FACTOR
// Fuente: park-factors.js (PARK_FACTORS_2026), completo, 29 parques.
// so_factor ya viene centrado ~100 — se usa directo /100.
// ============================================================
function calcularParkFactor(nombreVenue, parkFactors) {
  const datos = parkFactors[nombreVenue];
  if (!datos) {
    return { factor: 1.0, status: "NO_CONFIRMADO", motivo: "PARQUE_NO_ENCONTRADO_EN_TABLA_29" };
  }
  return {
    factor: Math.round((datos.so_factor / 100) * 1000) / 1000,
    so_factor_raw: datos.so_factor,
    category: datos.category,
    status: "OK",
    motivo: null
  };
}

// ============================================================
// CAPA 8: CLIMATE_FACTOR
// Fuente: jalar-clima.js trae los datos crudos. Las REGLAS que siguen son
// heuristicas basadas en lo que dijiste, NO estan respaldadas por backtest
// todavia. Se marcan como tal.
// ============================================================
function calcularClimaFactor(climaData) {
  if (!climaData || climaData.temperature_f === "" || typeof climaData.temperature_f !== "number") {
    return { factor: 1.0, status: "NO_CONFIRMADO", motivo: "SIN_DATO_CLIMA_VALIDO" };
  }

  // Roof cerrado: clima exterior no aplica, neutro.
  if (climaData.roof && /closed|dome|retractable.*closed/i.test(climaData.roof)) {
    return { factor: 1.0, status: "ROOF_CERRADO_NEUTRO", motivo: null };
  }

  let factor = 1.0;
  const notas = [];

  const temp = climaData.temperature_f;
  const windDir = (climaData.wind_dir || "").toUpperCase();
  const windSpeed = typeof climaData.windspeed_mph === "number" ? climaData.windspeed_mph : 0;

  // Frio favorece pitcheo/ponches (bola se comporta distinto, bateadores incomodos)
  if (temp < 60) { factor += 0.03; notas.push("frio<60F:+0.03"); }
  if (temp > 85) { factor -= 0.03; notas.push("calor>85F:-0.03"); }

  // Viento IN (hacia el plato, contra el bateador) ayuda al pitcher
  if (windDir.includes("IN") && windSpeed >= 8) { factor += 0.03; notas.push("vientoIN>=8mph:+0.03"); }
  // Viento OUT (hacia los jardines) favorece ofensiva, baja ponches relativos
  if (windDir.includes("OUT") && windSpeed >= 8) { factor -= 0.03; notas.push("vientoOUT>=8mph:-0.03"); }

  return {
    factor: Math.round(factor * 1000) / 1000,
    notas: notas,
    status: "HEURISTICA_SIN_BACKTEST",
    motivo: "Reglas basadas en logica del usuario, NO validadas con datos historicos todavia"
  };
}

// ============================================================
// MOTOR PRINCIPAL — junta las 8 capas
// ============================================================
function calcularK6(input) {
  // input esperado:
  // {
  //   playerId, juegosRecientes (de jalar-ultimos5), arsenalMaster,
  //   nombreEquipoRival, nombreUmpireNormalizado, umpiresMaster,
  //   nombreCatcher, catcherData, nombreVenue, parkFactors, climaData
  // }

  const baseVolumen = calcularBaseYVolumen(input.juegosRecientes || []);

  // Si no hay base real (sin starts calificados), el motor NO proyecta un numero falso.
  if (baseVolumen.status === "NO_CONFIRMADO") {
    return {
      k6_proyectado: null,
      status: "NO_CONFIRMADO",
      motivo: baseVolumen.motivo,
      capas: { base_volumen: baseVolumen }
    };
  }

  const arsenal = calcularArsenalFactor(input.playerId, input.arsenalMaster || {});
  const lineup = calcularLineupFactor(baseVolumen.pitches_por_k, input.nombreEquipoRival);
  const umpire = calcularUmpireFactor(input.nombreUmpireNormalizado, input.umpiresMaster || {});
  const catcher = calcularCatcherFactor(input.nombreCatcher, input.catcherData);
  const park = calcularParkFactor(input.nombreVenue, input.parkFactors || {});
  const clima = calcularClimaFactor(input.climaData);

  const k6Proyectado = baseVolumen.base_k_skill
    * arsenal.factor
    * lineup.factor
    * umpire.factor
    * catcher.factor
    * park.factor
    * clima.factor;

  // Lista de capas que quedaron NO_CONFIRMADO, para que el reporte sea honesto
  // sobre cuanto del numero final esta respaldado vs cuanto es neutro por defecto.
  const capasSinConfirmar = [];
  if (arsenal.status !== "OK" && arsenal.status !== "OK_CON_REFERENCIA_APROXIMADA") capasSinConfirmar.push("ARSENAL");
  if (lineup.status !== "OK") capasSinConfirmar.push("LINEUP");
  if (umpire.status !== "OK") capasSinConfirmar.push("UMPIRE");
  if (catcher.status !== "OK") capasSinConfirmar.push("CATCHER");
  if (park.status !== "OK") capasSinConfirmar.push("PARK");
  if (clima.status === "NO_CONFIRMADO") capasSinConfirmar.push("CLIMA");

  return {
    k6_proyectado: Math.round(k6Proyectado * 100) / 100,
    base_k_real: baseVolumen.base_k_skill,
    n_starts_usados: baseVolumen.n_starts_usados,
    muestra_status: baseVolumen.status, // "OK" o "MUESTRA_PEQUENA"
    capas_sin_confirmar: capasSinConfirmar,
    capas: {
      base_volumen: baseVolumen,
      arsenal: arsenal,
      lineup: lineup,
      umpire: umpire,
      catcher: catcher,
      park: park,
      clima: clima
    }
  };
}

// ============================================================
// COMPARAR CONTRA LINEA DE CASA DE APUESTAS
// ============================================================
function compararConLinea(k6Proyectado, lineaBanca) {
  if (k6Proyectado === null) return { lectura: "NO_CONFIRMADO", diferencia: null };
  const diferencia = Math.round((k6Proyectado - lineaBanca) * 100) / 100;
  let lectura = "NEUTRO";
  if (diferencia >= 0.5) lectura = "LEAN_OVER";
  if (diferencia <= -0.5) lectura = "LEAN_UNDER";
  return { lectura: lectura, diferencia: diferencia };
}

// ============================================================
// EXPORTS (ajustar segun como cargues modulos en tu repo: window.* o module.exports)
// ============================================================
if (typeof window !== "undefined") {
  window.calcularK6 = calcularK6;
  window.compararConLinea = compararConLinea;
  window.ipRealDesdeBeisbol = ipRealDesdeBeisbol;
  window.LEAGUE_AVG_PITCHES_PER_K = LEAGUE_AVG_PITCHES_PER_K;
  window.LINEUP_PITCHES_PER_K_2026 = LINEUP_PITCHES_PER_K_2026;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calcularK6: calcularK6,
    compararConLinea: compararConLinea,
    ipRealDesdeBeisbol: ipRealDesdeBeisbol,
    LEAGUE_AVG_PITCHES_PER_K: LEAGUE_AVG_PITCHES_PER_K,
    LINEUP_PITCHES_PER_K_2026: LINEUP_PITCHES_PER_K_2026
  };
}
