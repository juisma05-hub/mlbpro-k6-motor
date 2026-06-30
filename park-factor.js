// park-factors.js
// Tabla madre de FACTORES DE PARQUE 2024-2026 (rolling 3 años).
// Fuente: DATAPRO_PARK_FACTORS_ROLLING_3Y_2026.csv (Drive del autor). 29 parques.
// Por parque: runs_factor (clave para CARRERAS: 100=neutro, >100 sube, <100 baja),
//   hr_factor (jonrones), so_factor (ponches), park_factor (general), category.
// Indexado por nombre de venue (igual que en estadios.js / schedule MLB).
// Ej: Coors Field runs 125 (revienta), T-Mobile 85 (mata). NO MODIFICAR A MANO.

var PARK_FACTORS_2026 = {
  "Coors Field": { team:"Rockies", runs_factor:125, hr_factor:106, so_factor:90, park_factor:112, bb_factor:100, category:"HITTER_EXTREME" },
  "Chase Field": { team:"D-backs", runs_factor:106, hr_factor:92, so_factor:90, park_factor:103, bb_factor:98, category:"HITTER_PLUS" },
  "Great American Ball Park": { team:"Reds", runs_factor:106, hr_factor:122, so_factor:103, park_factor:103, bb_factor:107, category:"HITTER_PLUS" },
  "Oriole Park at Camden Yards": { team:"Orioles", runs_factor:106, hr_factor:110, so_factor:98, park_factor:103, bb_factor:94, category:"HITTER_PLUS" },
  "Target Field": { team:"Twins", runs_factor:106, hr_factor:98, so_factor:97, park_factor:103, bb_factor:99, category:"HITTER_PLUS" },
  "Fenway Park": { team:"Red Sox", runs_factor:104, hr_factor:84, so_factor:98, park_factor:102, bb_factor:97, category:"NEUTRAL_PLUS" },
  "Citizens Bank Park": { team:"Phillies", runs_factor:104, hr_factor:113, so_factor:103, park_factor:102, bb_factor:96, category:"NEUTRAL_PLUS" },
  "Angel Stadium": { team:"Angels", runs_factor:102, hr_factor:106, so_factor:105, park_factor:101, bb_factor:100, category:"NEUTRAL_PLUS" },
  "Nationals Park": { team:"Nationals", runs_factor:102, hr_factor:100, so_factor:94, park_factor:101, bb_factor:96, category:"NEUTRAL_PLUS" },
  "Daikin Park": { team:"Astros", runs_factor:102, hr_factor:115, so_factor:106, park_factor:101, bb_factor:102, category:"NEUTRAL_PLUS" },
  "UNIQLO Field at Dodger Stadium": { team:"Dodgers", runs_factor:102, hr_factor:129, so_factor:101, park_factor:101, bb_factor:102, category:"NEUTRAL_PLUS" },
  "Kauffman Stadium": { team:"Royals", runs_factor:102, hr_factor:83, so_factor:90, park_factor:101, bb_factor:100, category:"NEUTRAL_PLUS" },
  "Rogers Centre": { team:"Blue Jays", runs_factor:102, hr_factor:109, so_factor:97, park_factor:101, bb_factor:99, category:"NEUTRAL_PLUS" },
  "PNC Park": { team:"Pirates", runs_factor:102, hr_factor:82, so_factor:98, park_factor:101, bb_factor:99, category:"NEUTRAL_PLUS" },
  "Comerica Park": { team:"Tigers", runs_factor:102, hr_factor:103, so_factor:99, park_factor:101, bb_factor:99, category:"NEUTRAL_PLUS" },
  "Yankee Stadium": { team:"Yankees", runs_factor:102, hr_factor:117, so_factor:102, park_factor:101, bb_factor:117, category:"NEUTRAL_PLUS" },
  "loanDepot park": { team:"Marlins", runs_factor:100, hr_factor:86, so_factor:97, park_factor:100, bb_factor:100, category:"NEUTRAL" },
  "Truist Park": { team:"Braves", runs_factor:98, hr_factor:93, so_factor:104, park_factor:99, bb_factor:99, category:"NEUTRAL" },
  "Citi Field": { team:"Mets", runs_factor:98, hr_factor:103, so_factor:103, park_factor:99, bb_factor:107, category:"NEUTRAL" },
  "Oracle Park": { team:"Giants", runs_factor:96, hr_factor:79, so_factor:97, park_factor:98, bb_factor:93, category:"NEUTRAL" },
  "Rate Field": { team:"White Sox", runs_factor:96, hr_factor:97, so_factor:97, park_factor:98, bb_factor:104, category:"NEUTRAL" },
  "Busch Stadium": { team:"Cardinals", runs_factor:96, hr_factor:80, so_factor:90, park_factor:98, bb_factor:92, category:"NEUTRAL" },
  "Progressive Field": { team:"Guardians", runs_factor:96, hr_factor:93, so_factor:105, park_factor:98, bb_factor:102, category:"NEUTRAL" },
  "American Family Field": { team:"Brewers", runs_factor:94, hr_factor:103, so_factor:110, park_factor:97, bb_factor:105, category:"PITCHER_PLUS" },
  "Petco Park": { team:"Padres", runs_factor:94, hr_factor:107, so_factor:102, park_factor:97, bb_factor:101, category:"PITCHER_PLUS" },
  "Tropicana Field": { team:"Rays", runs_factor:94, hr_factor:101, so_factor:102, park_factor:97, bb_factor:96, category:"PITCHER_PLUS" },
  "Wrigley Field": { team:"Cubs", runs_factor:90, hr_factor:99, so_factor:103, park_factor:95, bb_factor:101, category:"PITCHER_PLUS" },
  "Globe Life Field": { team:"Rangers", runs_factor:85, hr_factor:91, so_factor:102, park_factor:92, bb_factor:95, category:"PITCHER_EXTREME" },
  "T-Mobile Park": { team:"Mariners", runs_factor:85, hr_factor:97, so_factor:118, park_factor:92, bb_factor:95, category:"PITCHER_EXTREME" }
};
