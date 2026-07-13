// motor-k6-nuevo.js
// MOTOR K6 — proyección de ponches del abridor, escalado a 6.0 IP.
//
// REGLA DE REDONDEO (confirmada 3 jul 2026, CRÍTICA):
//   NO se redondea en ningún paso intermedio del cálculo. Todos los
//   factores y la base se mantienen en precisión completa (float) y se
//   multiplican sin redondear. El redondeo SOLO pasa al final, para
//   MOSTRAR el número (a 1 decimal) — nunca para calcular con él.
//   Ejemplo: K6 real = 6.42 → se muestra "6.4", pero para comparar
//   contra la línea de mercado se usa 6.42, no 6.4 ni 6.0.
//
// REGLA DE ORO DEL MOTOR (confirmada antes):
//   - K6 = (Ponches del start × 6) / IP real del start. Se calcula POR CADA start
//     reciente y luego se promedian los resultados ya escalados.
//   - NO se filtra por un mínimo de IP.
//   - NO se redondea inningsPitched. .1 = 1/3 (0.333...), .2 = 2/3 (0.666...).
//   - Si un pitcher no tiene NINGÚN start con datos válidos, el resultado es NO_CONFIRMADO.
//
// FORMULA:
//   K6 = BASE_K_SKILL × EXPECTED_VOLUME_IMPLICITO × ARSENAL × LINEUP × UMPIRE × CATCHER × PARK × CLIMA
//   (expected_volume no es un factor multiplicativo aparte — ya está implicito
//   en que base_k_skill se calcula por start real, con su IP real de cada start)

// ============================================================
// CONSTANTES DE REFERENCIA
// ============================================================
const LEAGUE_AVG_PITCHES_PER_K = 372172 / 21175; // = 17.58, sin redondear

const LINEUP_PITCHES_PER_K_2026 = {
  "Tampa Bay Rays":      { pitches: 11726, so: 580, pitches_per_k: 11726/580 },
  "Colorado Rockies":    { pitches: 12142, so: 750, pitches_per_k: 12142/750 },
  "Cincinnati Reds":     { pitches: 12378, so: 783, pitches_per_k: 12378/783 }
  // ... resto de los 30 equipos: NO_CONFIRMADO hasta transcribir tabla completa
};

// ============================================================
// UTILIDAD: convertir innings "de béisbol" (4.2) a número real (4.667)
// ============================================================
function ipRealDesdeBeisbol(ipString) {
  if (ipString === null || ipString === undefined || ipString === "NO_CONFIRMADO") return null;
  const partes = String(ipString).split(".");
  const enteros = parseInt(partes[0], 10);
  const outs = partes[1] ? parseInt(partes[1], 10) : 0;
  if (isNaN(enteros)) return null;
  if (outs !== 0 && outs !== 1 && outs !== 2) return null;
  return enteros + (outs / 3);
}

// Valida que `v` sea un número real usable: rechaza null, undefined,
// "", NaN, Infinity, -Infinity y booleanos. Number(null)===0,
// Number("")===0 y Number(true)===1, así que no basta con
// Number.isFinite(Number(v)) a secas — hay que descartar esos casos
// ANTES de convertir. CRITERIO ÚNICO en todo el motor: siempre se llama
// esNumeroReal(valor_crudo) primero, y Number(valor_crudo) recién
// después de que la validación pasó — nunca al revés. Convertir antes
// de validar anula la protección: Number(true)===1 y esNumeroReal(1)
// ya no puede saber que el original era un booleano.
// Se usa en redondearParaMostrar(), compararConLinea(), en las
// conversiones de K/IP/pitcheos, y en los factores externos
// (zone_factor, so_factor, usage, whiff, temperatura, viento).
function esNumeroReal(v) {
  if (v === null || v === undefined || v === "") return false;
  if (typeof v === "boolean") return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return Number.isFinite(Number(v));
}

// Redondeo SOLO para mostrar — nunca se usa el resultado de esta funcion
// para seguir calculando con el, solo para pintar en pantalla.
function redondearParaMostrar(numero, decimales) {
  if (!esNumeroReal(numero)) return null;
  const factor = Math.pow(10, decimales);
  return Math.round(numero * factor) / factor;
}

// ============================================================
// CAPA 1 + 2: BASE_K_SKILL + EXPECTED_VOLUME (precision completa, sin redondear)
// ============================================================
function calcularBaseYVolumen(juegos) {
  const valuos = juegos.filter(function(j) {
    const ipReal = ipRealDesdeBeisbol(j.innings_pitched);
    if (!esNumeroReal(j.strikeouts)) return false;
    return ipReal !== null && ipReal > 0;
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
    const k6Start = (k * 6) / ipReal; // SIN redondear aqui
    sumaK6Escalado += k6Start;
    sumaIP += ipReal;
    sumaKreal += k;
    if (esNumeroReal(j.pitches)) {
      sumaPitches += Number(j.pitches);
      nPitches++;
    }
  });

  // NADA de Math.round() aqui abajo — precision completa hasta el final.
  const k6Promedio = sumaK6Escalado / valuos.length;
  const ipPromedio = sumaIP / valuos.length;
  const pitchesPromedio = nPitches > 0 ? sumaPitches / nPitches : null;
  const pitchesPorK = (pitchesPromedio !== null && sumaKreal > 0)
    ? sumaPitches / sumaKreal
    : null;

  return {
    base_k_skill: k6Promedio,                   // precision completa
    base_k_skill_display: redondearParaMostrar(k6Promedio, 2), // solo para leer, no para calcular
    expected_volume_ip: ipPromedio,
    expected_volume_ip_display: redondearParaMostrar(ipPromedio, 2),
    pitches_promedio: pitchesPromedio,
    pitches_promedio_display: pitchesPromedio !== null ? redondearParaMostrar(pitchesPromedio, 1) : null,
    pitches_por_k: pitchesPorK,
    pitches_por_k_display: pitchesPorK !== null ? redondearParaMostrar(pitchesPorK, 2) : null,
    n_starts_usados: valuos.length,
    status: valuos.length < 3 ? "MUESTRA_PEQUENA" : "OK",
    motivo: valuos.length < 3 ? "MENOS_DE_3_STARTS_CON_DATOS_LEER_CON_CAUTELA" : null
  };
}

// ============================================================
// CAPA 3: ARSENAL_K_POWER
// Referencia de whiff de liga (25%) todavía NO está validada con datos
// reales — mientras tanto esta capa es SOLO INFORMATIVA: se calcula y
// se expone whiff_ponderado para lectura humana, pero el factor que
// entra en la fórmula del K6 se fuerza a 1.0 (neutro) y la capa queda
// NO_CONFIRMADO (entra en capas_sin_confirmar sin tocar esa lógica en
// calcularK6, que ya trata cualquier status distinto de "OK" /
// "OK_CON_REFERENCIA_APROXIMADA" como no confirmado).
// ============================================================
function calcularArsenalFactor(playerId, arsenalMaster) {
  const datos = arsenalMaster[String(playerId)];
  if (!datos || !Array.isArray(datos.arsenal) || datos.arsenal.length === 0) {
    return { factor: 1.0, factor_display: 1.0, whiff_ponderado: null, status: "NO_CONFIRMADO", motivo: "PITCHER_NO_EN_ARSENAL_MASTER" };
  }

  let sumaUsage = 0, sumaWhiffPonderado = 0;
  datos.arsenal.forEach(function(p) {
    if (!esNumeroReal(p.whiff) || !esNumeroReal(p.usage)) return;
    const usage = Number(p.usage);
    const whiff = Number(p.whiff);
    sumaUsage += usage;
    sumaWhiffPonderado += usage * whiff;
  });

  if (sumaUsage === 0) {
    return { factor: 1.0, factor_display: 1.0, whiff_ponderado: null, status: "NO_CONFIRMADO", motivo: "SIN_WHIFF_VALIDO_EN_ARSENAL" };
  }

  const whiffPonderado = sumaWhiffPonderado / sumaUsage;

  return {
    factor: 1.0,
    factor_display: 1.0,
    whiff_ponderado: whiffPonderado,
    whiff_ponderado_display: redondearParaMostrar(whiffPonderado, 2),
    status: "NO_CONFIRMADO",
    motivo: "Referencia de liga (25%) no validada con datos reales todavia — factor neutro (1.0) hasta confirmar; whiff_ponderado queda solo como informacion"
  };
}

// ============================================================
// CAPA 4: LINEUP_K_MATCHUP (precision completa)
// ============================================================
function calcularLineupFactor(pitchesPorKPitcher, nombreEquipoRival) {
  const datosEquipo = LINEUP_PITCHES_PER_K_2026[nombreEquipoRival];

  if (!datosEquipo) {
    return { factor: 1.0, factor_display: 1.0, status: "NO_CONFIRMADO", motivo: "EQUIPO_RIVAL_NO_VERIFICADO_AUN_FALTAN_27_EQUIPOS" };
  }
  if (!esNumeroReal(pitchesPorKPitcher)) {
    return { factor: 1.0, factor_display: 1.0, status: "NO_CONFIRMADO", motivo: "PITCHER_SIN_PITCHES_POR_K_CALCULADO" };
  }
  const pitchesPorKPitcherNum = Number(pitchesPorKPitcher);

  const factorEquipo = LEAGUE_AVG_PITCHES_PER_K / datosEquipo.pitches_per_k;
  const factorPitcher = LEAGUE_AVG_PITCHES_PER_K / pitchesPorKPitcherNum;
  const factor = Math.sqrt(factorEquipo * factorPitcher); // sin redondear

  return {
    factor: factor,
    factor_display: redondearParaMostrar(factor, 3),
    pitches_por_k_equipo: datosEquipo.pitches_per_k,
    pitches_por_k_pitcher: pitchesPorKPitcherNum,
    liga_referencia: LEAGUE_AVG_PITCHES_PER_K,
    status: "OK",
    motivo: null
  };
}

// ============================================================
// CAPA 5: UMPIRE_FACTOR (ya viene sin redondear del CSV, se usa tal cual)
// ============================================================
function calcularUmpireFactor(nombreUmpireNormalizado, umpiresMaster) {
  const datos = umpiresMaster[nombreUmpireNormalizado];
  if (!datos) {
    return { factor: 1.0, factor_display: 1.0, status: "NO_CONFIRMADO", motivo: "UMPIRE_NO_ENCONTRADO_EN_TABLA_77" };
  }
  if (!esNumeroReal(datos.zone_factor)) {
    return { factor: 1.0, factor_display: 1.0, status: "NO_CONFIRMADO", motivo: "UMPIRE_ZONE_FACTOR_INVALIDO" };
  }
  const zoneFactor = Number(datos.zone_factor);
  return {
    factor: zoneFactor,
    factor_display: redondearParaMostrar(zoneFactor, 3),
    k_tier: datos.k_tier,
    k_per_game: datos.k_per_game,
    status: "OK",
    motivo: null
  };
}

// ============================================================
// CAPA 6: CATCHER_FACTOR (desactivada, pendiente confirmar campos)
// ============================================================
function calcularCatcherFactor(nombreCatcher, catcherData) {
  return {
    factor: 1.0,
    factor_display: 1.0,
    status: "NO_CONFIRMADO",
    motivo: "PENDIENTE: confirmar si rv_11..rv_19 son zonas Statcast antes de usar este dato."
  };
}

// ============================================================
// CAPA 7: PARK_FACTOR (precision completa)
// ============================================================
function calcularParkFactor(nombreVenue, parkFactors) {
  const datos = parkFactors[nombreVenue];
  if (!datos) {
    return { factor: 1.0, factor_display: 1.0, status: "NO_CONFIRMADO", motivo: "PARQUE_NO_ENCONTRADO_EN_TABLA_29" };
  }
  if (!esNumeroReal(datos.so_factor)) {
    return { factor: 1.0, factor_display: 1.0, status: "NO_CONFIRMADO", motivo: "PARK_SO_FACTOR_INVALIDO" };
  }
  const soFactor = Number(datos.so_factor);
  const factor = soFactor / 100; // sin redondear
  return {
    factor: factor,
    factor_display: redondearParaMostrar(factor, 3),
    so_factor_raw: soFactor,
    category: datos.category,
    status: "OK",
    motivo: null
  };
}

// ============================================================
// CAPA 8: CLIMATE_FACTOR
// Heuristica SIN backtest aprobado todavia — esta capa es SOLO
// INFORMATIVA: se calculan las notas de que hubiera sugerido la
// heuristica (frio/calor/viento), pero el factor que entra en la
// formula del K6 se fuerza a 1.0 (neutro) y la capa queda NO_CONFIRMADO
// (misma logica de exclusion que ya usa calcularK6 para ARSENAL).
// ============================================================
function calcularClimaFactor(climaData) {
  if (!climaData || !esNumeroReal(climaData.temperature_f)) {
    return { factor: 1.0, factor_display: 1.0, status: "NO_CONFIRMADO", motivo: "SIN_DATO_CLIMA_VALIDO" };
  }

  if (climaData.roof && /closed|dome|retractable.*closed/i.test(climaData.roof)) {
    return { factor: 1.0, factor_display: 1.0, status: "ROOF_CERRADO_NEUTRO", motivo: null };
  }

  const notas = [];

  const temp = Number(climaData.temperature_f);
  const windDir = (climaData.wind_dir || "").toUpperCase();
  const windSpeed = esNumeroReal(climaData.windspeed_mph) ? Number(climaData.windspeed_mph) : 0;

  // Solo se registran las notas de lo que la heuristica hubiera hecho —
  // NO se suma/resta nada al factor real (se fuerza a 1.0 abajo).
  if (temp < 60) notas.push("frio<60F: heuristica sugeriria +0.03 (no aplicado, sin backtest)");
  if (temp > 85) notas.push("calor>85F: heuristica sugeriria -0.03 (no aplicado, sin backtest)");
  if (windDir.includes("IN") && windSpeed >= 8) notas.push("vientoIN>=8mph: heuristica sugeriria +0.03 (no aplicado, sin backtest)");
  if (windDir.includes("OUT") && windSpeed >= 8) notas.push("vientoOUT>=8mph: heuristica sugeriria -0.03 (no aplicado, sin backtest)");

  return {
    factor: 1.0,
    factor_display: 1.0,
    notas: notas,
    status: "NO_CONFIRMADO",
    motivo: "HEURISTICA_SIN_BACKTEST — factor neutro (1.0) hasta que exista backtest aprobado; notas quedan solo como informacion"
  };
}

// ============================================================
// MOTOR PRINCIPAL — junta las 8 capas, TODO en precision completa
// ============================================================
function calcularK6(input) {
  const baseVolumen = calcularBaseYVolumen(input.juegosRecientes || []);

  if (baseVolumen.status === "NO_CONFIRMADO") {
    return {
      k6_proyectado: null,
      k6_proyectado_preciso: null,
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

  // MULTIPLICACION CON PRECISION COMPLETA — ningun factor fue redondeado
  // antes de esta linea. Este es el numero real, sin perdida.
  const k6Preciso = baseVolumen.base_k_skill
    * arsenal.factor
    * lineup.factor
    * umpire.factor
    * catcher.factor
    * park.factor
    * clima.factor;

  const capasSinConfirmar = [];
  if (arsenal.status !== "OK" && arsenal.status !== "OK_CON_REFERENCIA_APROXIMADA") capasSinConfirmar.push("ARSENAL");
  if (lineup.status !== "OK") capasSinConfirmar.push("LINEUP");
  if (umpire.status !== "OK") capasSinConfirmar.push("UMPIRE");
  if (catcher.status !== "OK") capasSinConfirmar.push("CATCHER");
  if (park.status !== "OK") capasSinConfirmar.push("PARK");
  if (clima.status === "NO_CONFIRMADO") capasSinConfirmar.push("CLIMA");

  return {
    // k6_proyectado = SOLO para mostrar en pantalla (1 decimal). NUNCA
    // usar este campo para comparar contra la linea o para otro calculo.
    k6_proyectado: redondearParaMostrar(k6Preciso, 1),
    // k6_proyectado_preciso = el numero real, sin redondear. USAR ESTE
    // para cualquier comparacion (linea de mercado, umbral, etc).
    k6_proyectado_preciso: k6Preciso,
    base_k_real: baseVolumen.base_k_skill_display,
    n_starts_usados: baseVolumen.n_starts_usados,
    muestra_status: baseVolumen.status,
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
// Usa SIEMPRE el valor preciso (sin redondear) para la resta, y clasifica
// segun que tan lejos esta de la linea — no es solo "arriba/abajo".
//
// Ejemplos confirmados por el usuario:
//   K6=6.42, línea 5.5 → diferencia +0.92 → OVER con margen (claro)
//   K6=6.42, línea 6.5 → diferencia -0.08 → pegado, no es limpio
//   K6=6.42, línea 7.5 → diferencia -1.08 → UNDER claro (lejos)
// ============================================================
function compararConLinea(k6Preciso, lineaBanca) {
  if (!esNumeroReal(k6Preciso) || !esNumeroReal(lineaBanca)) {
    return { lectura: "NO_CONFIRMADO", diferencia: null, diferencia_display: null, texto: "Sin línea de mercado o sin K6 para comparar." };
  }

  const k6 = Number(k6Preciso);
  const linea = Number(lineaBanca);
  const diferencia = k6 - linea; // SIN redondear, se usa completa para clasificar

  let lectura, texto;
  if (diferencia >= 0.75) {
    lectura = "OVER_CON_MARGEN";
    texto = "Over con margen claro";
  } else if (diferencia >= 0.25) {
    lectura = "LEAN_OVER";
    texto = "Inclinado a Over, sin ser aplastante";
  } else if (diferencia > -0.25) {
    lectura = "PEGADO";
    texto = "Pegado a la línea — no es una lectura limpia";
  } else if (diferencia > -0.75) {
    lectura = "LEAN_UNDER";
    texto = "Inclinado a Under, sin ser aplastante";
  } else {
    lectura = "UNDER_CLARO";
    texto = "Under claro — está lejos de la línea";
  }

  return {
    lectura: lectura,
    diferencia: diferencia,
    diferencia_display: redondearParaMostrar(diferencia, 2),
    texto: texto
  };
}

// ============================================================
// EXPORTS
// ============================================================
if (typeof window !== "undefined") {
  window.calcularK6 = calcularK6;
  window.compararConLinea = compararConLinea;
  window.ipRealDesdeBeisbol = ipRealDesdeBeisbol;
  window.redondearParaMostrar = redondearParaMostrar;
  window.LEAGUE_AVG_PITCHES_PER_K = LEAGUE_AVG_PITCHES_PER_K;
  window.LINEUP_PITCHES_PER_K_2026 = LINEUP_PITCHES_PER_K_2026;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calcularK6: calcularK6,
    compararConLinea: compararConLinea,
    ipRealDesdeBeisbol: ipRealDesdeBeisbol,
    redondearParaMostrar: redondearParaMostrar,
    LEAGUE_AVG_PITCHES_PER_K: LEAGUE_AVG_PITCHES_PER_K,
    LINEUP_PITCHES_PER_K_2026: LINEUP_PITCHES_PER_K_2026
  };
}
