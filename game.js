'use strict';
/* =========================================================================
   SHOTGUN KING v2 — pixel chess roguelike
   - Continuous mouse aiming: pellets are randomized inside a cone angle
   - 5 switchable weapons + sniper mode weapon
   - Tower modes: classic / musou (infinite ammo) / obstacle / sniper
   - Crisp bitmap pixel font (no blurry canvas text)
   ========================================================================= */

/* ------------------------------------------------------------------ utils */
const W = 480, H = 270;
const CELL = 27;
const BX = 10, BY = 28;            // board top-left (internal pixels)
const PANEL_X = 236;
const TAU = Math.PI * 2;

const DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

function inB(x, y) { return x >= 0 && x < 8 && y >= 0 && y < 8; }
function cheb(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function wait(g, ms) { return sleep(g && g.turbo ? 0 : ms); }
function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function normDeg(a) { a = ((a + 180) % 360 + 360) % 360 - 180; return a; }
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------ bitmap font */
const FONT = {
  '0':['111','101','101','101','111'], '1':['010','110','010','010','111'],
  '2':['111','001','111','100','111'], '3':['111','001','111','001','111'],
  '4':['101','101','111','001','001'], '5':['111','100','111','001','111'],
  '6':['111','100','111','101','111'], '7':['111','001','001','010','010'],
  '8':['111','101','111','101','111'], '9':['111','101','111','001','111'],
  'A':['111','101','111','101','101'], 'B':['110','101','110','101','110'],
  'C':['111','100','100','100','111'], 'D':['110','101','101','101','110'],
  'E':['111','100','110','100','111'], 'F':['111','100','110','100','100'],
  'G':['111','100','101','101','111'], 'H':['101','101','111','101','101'],
  'I':['111','010','010','010','111'], 'J':['001','001','001','101','111'],
  'K':['101','101','110','101','101'], 'L':['100','100','100','100','111'],
  'M':['101','111','111','101','101'], 'N':['111','101','101','101','101'],
  'O':['111','101','101','101','111'], 'P':['111','101','111','100','100'],
  'Q':['111','101','101','111','001'], 'R':['110','101','110','101','101'],
  'S':['111','100','111','001','111'], 'T':['111','010','010','010','010'],
  'U':['101','101','101','101','111'], 'V':['101','101','101','101','010'],
  'W':['101','101','111','111','101'], 'X':['101','101','010','101','101'],
  'Y':['101','101','010','010','010'], 'Z':['111','001','010','100','111'],
  ' ':[ '000','000','000','000','000'], '.':['000','000','000','000','010'],
  ',':['000','000','000','010','100'], ':':['000','010','000','010','000'],
  '!':['010','010','010','000','010'], '+':['000','010','111','010','000'],
  '-':['000','000','111','000','000'], '/':['001','001','010','100','100'],
  "'":['010','010','000','000','000'], '(':['001','010','010','010','001'],
  ')':['100','010','010','010','100'], '?':['111','001','011','000','010'],
  '#':['010','111','010','111','010'], '*':['000','101','010','101','000']
};
const SPACE_GLYPH = FONT[' '];

function drawText(c, text, x, y, color, scale) {
  scale = scale || 1;
  text = String(text).toUpperCase();
  c.fillStyle = color;
  let cx = Math.round(x);
  for (let i = 0; i < text.length; i++) {
    const g = FONT[text[i]] || SPACE_GLYPH;
    for (let r = 0; r < 5; r++) {
      const row = g[r];
      for (let col = 0; col < 3; col++) {
        if (row[col] === '1') c.fillRect(cx + col * scale, Math.round(y) + r * scale, scale, scale);
      }
    }
    cx += 4 * scale;
  }
  return cx - x;
}

function drawLine(c, x0, y0, x1, y1, color) {
  c.fillStyle = color;
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 0; i <= steps; i++) {
    c.fillRect(Math.round(x0 + dx * i / steps), Math.round(y0 + dy * i / steps), 1, 1);
  }
}

/* ------------------------------------------------------------- upgrade cards */
const CARDS = [
  { id:'bandolier',  rarity:'common', en:'Bandolier',     zh:'弹药带',
    enDesc:'+2 max ammo for every weapon, +2 shells now.', zhDesc:'所有武器最大弹药 +2，并立即获得 2 发。' },
  { id:'heavyshot',  rarity:'common', en:'Heavy Shot',    zh:'重型弹丸',
    enDesc:'All weapons deal +1 damage.', zhDesc:'所有武器伤害 +1。' },
  { id:'longbarrel', rarity:'common', en:'Long Barrel',   zh:'加长枪管',
    enDesc:'All weapons gain +1 range.', zhDesc:'所有武器射程 +1。' },
  { id:'buckshot',   rarity:'common', en:'Buckshot',      zh:'鹿弹',
    enDesc:'+1 pellet (cone weapons); other weapons +1 damage.', zhDesc:'扇形武器弹丸 +1；其余武器改为伤害 +1。' },
  { id:'royalblood', rarity:'common', en:'Royal Blood',   zh:'王室血脉',
    enDesc:'+1 max crown, heal 1.', zhDesc:'王冠上限 +1，并恢复 1 点。' },
  { id:'ironcrown',  rarity:'common', en:'Iron Crown',    zh:'铁王冠',
    enDesc:'+2 max crowns.', zhDesc:'王冠上限 +2。' },
  { id:'bounty',     rarity:'common', en:'War Bounty',    zh:'战利品',
    enDesc:'40% chance to heal 1 on kill.', zhDesc:'击杀时 40% 概率恢复 1 点生命。' },
  { id:'scavenger',  rarity:'common', en:'Scavenger',     zh:'拾荒者',
    enDesc:'30% chance for +1 shell on kill.', zhDesc:'击杀时 30% 概率为当前武器补 1 发弹药。' },
  { id:'padding',    rarity:'common', en:'Padding',       zh:'加厚护甲',
    enDesc:'Enemy hits deal -1 damage (min 1).', zhDesc:'受到敌方的伤害 -1（最低 1）。' },
  { id:'slug',       rarity:'rare', en:'Slug Round',      zh:'独头弹',
    enDesc:'Cone weapons fire ONE slug: cone 5 deg, +2 dmg, +1 range. Other weapons +2 dmg.', zhDesc:'扇形武器改为单发独头弹（5°锥角、+2伤、+1射程）；其余武器伤害 +2。' },
  { id:'pierce',     rarity:'rare', en:'Piercing Shot',   zh:'穿透弹',
    enDesc:'Ray weapons pierce +1 more piece.', zhDesc:'弹道类武器穿透力 +1（弓箭本身无限穿透）。' },
  { id:'explosive',  rarity:'rare', en:'Explosive Shot',  zh:'爆裂弹',
    enDesc:'Hits explode in 3x3 for 1 damage; AoE weapons +1 damage.', zhDesc:'命中附带 3×3 溅射；范围武器伤害 +1。' },
  { id:'dragonfire', rarity:'rare', en:'Dragon Breath',   zh:'龙息弹',
    enDesc:'Hits burn for 1 damage next turn.', zhDesc:'被命中的棋子下回合灼烧 1 点。' },
  { id:'vampiric',   rarity:'rare', en:'Vampiric Shells', zh:'吸血弹',
    enDesc:'Heal 1 crown per kill.', zhDesc:'每次击杀恢复 1 点生命。' },
  { id:'thorns',     rarity:'rare', en:'Thorn Crown',     zh:'荆棘王冠',
    enDesc:'Attackers take 1 damage.', zhDesc:'攻击你的棋子受到 1 点反伤。' },
  { id:'scope',      rarity:'rare', en:'Scope',           zh:'瞄准镜',
    enDesc:'Center pellet +2 damage; AoE weapons +1 damage.', zhDesc:'中央弹丸伤害 +2；范围武器伤害 +1。' },
  { id:'quickloader',rarity:'rare', en:'Quick Loader',    zh:'快速装填',
    enDesc:'Reloading is a FREE action.', zhDesc:'装弹变为免费行动，不推进敌方回合。' },
  { id:'opening',    rarity:'rare', en:'First Strike',    zh:'先手',
    enDesc:'Your first move each floor is FREE.', zhDesc:'每层楼的第一次移动免费。' },
  { id:'sawedoff',   rarity:'rare', en:'Sawed-Off',       zh:'锯管霰弹',
    enDesc:'+1 damage, -1 range (min 2).', zhDesc:'所有武器伤害 +1、射程 -1（最低 2）。' },
  { id:'insurance',  rarity:'rare', en:'Royal Insurance', zh:'王冠保险',
    enDesc:'Once per floor, survive lethal at 1 crown.', zhDesc:'每层一次：受到致命伤时以 1 点生命存活。' },
  { id:'doubletap',  rarity:'rare', en:'Double Tap',      zh:'双连发',
    enDesc:'Fire two attacks when you have 2+ ammo.', zhDesc:'弹药 ≥2 时，一次开火连续攻击两次。' },
  { id:'headshot',   rarity:'rare', en:'Headshot',        zh:'爆头',
    enDesc:'20% per hit to deal double damage.', zhDesc:'每次命中 20% 概率造成双倍伤害。' },
  { id:'blackpowder',rarity:'legendary', en:'Black Powder', zh:'黑火药',
    enDesc:'+2 pellets, +1 damage, -1 max ammo on all weapons.', zhDesc:'扇形武器弹丸 +2、伤害 +1，但所有武器最大弹药 -1。' },
  { id:'shield',     rarity:'legendary', en:'Crown Shield', zh:'王冠护盾',
    enDesc:'+1 shield at each floor start (absorbs one hit).', zhDesc:'每层开始获得 1 层护盾，完全抵挡一次攻击。' },
  { id:'aura',       rarity:'legendary', en:'Royal Aura',  zh:'君临威压',
    enDesc:'After you move or fire, adjacent enemies take 1 damage.', zhDesc:'移动或开火后，相邻敌人受到 1 点伤害。' },
  { id:'decree',     rarity:'legendary', en:'Royal Decree', zh:'御前王令',
    enDesc:'At each floor start, remove one random non-boss enemy.', zhDesc:'每层开始时，随机消灭一个非首领棋子。' },
  { id:'timestop',   rarity:'legendary', en:'Time Rift',   zh:'时间裂隙',
    enDesc:'Every 5th action is FREE.', zhDesc:'每第 5 次行动免费，不推进敌方回合。' },
];
const RARITY_WEIGHT = { common: 10, rare: 5, legendary: 2 };
function cardById(id) { return CARDS.find(c => c.id === id); }

/* ----------------------------------------------------------------- weapons */
const WEAPON_DEFS = {
  shotgun: { id:'shotgun', name:'SHOTGUN', short:'SGN', type:'spray',  cone:45, pellets:5, range:4, dmg:1, pierce:0,   maxAmmo:4 },
  choke:   { id:'choke',   name:'CHOKE',   short:'CHK', type:'spray',  cone:15, pellets:3, range:6, dmg:1, pierce:0,   maxAmmo:4 },
  warbow:  { id:'warbow',  name:'WARBOW',  short:'BOW', type:'bow',    cone:10, pellets:1, range:8, dmg:2, pierce:999, maxAmmo:1 },
  flamer:  { id:'flamer',  name:'FLAMER',  short:'FLM', type:'flame',  cone:25, pellets:0, range:4, dmg:1, pierce:0,   maxAmmo:6 },
  bomber:  { id:'bomber',  name:'BOMBER',  short:'BMB', type:'bomber', cone:0,  pellets:0, range:3, dmg:2, pierce:0,   maxAmmo:3 },
  sniper:  { id:'sniper',  name:'SNIPER',  short:'SNP', type:'sniper', cone:2,  pellets:1, range:99,dmg:6, pierce:0,   maxAmmo:5 },
};

function makeWeapon(id) {
  const d = WEAPON_DEFS[id];
  return { ...d, ammo: d.maxAmmo };
}
function buildWeapons(modeId) {
  if (modeId === 'sniper') return [makeWeapon('sniper')];
  return ['shotgun', 'choke', 'warbow', 'flamer', 'bomber'].map(makeWeapon);
}

/* ------------------------------------------------------------------ state */
let nextPieceId = 1;

function defaultStats() {
  return {
    dmg: 1, pellets: 3, range: 3,
    pierce: 0, explosive: false, burn: false, slow: false,
    lifesteal: false, thorns: false, focus: false,
    headshot: false, bountyChance: 0, scavengeChance: 0,
    armor: 0, freeReload: false, freeMove: false,
    insurance: false, doubletap: false, shieldPerFloor: false,
    aura: false, decree: false, timeStop: false,
    slug: false
  };
}

function newGame(modeId) {
  modeId = modeId || 'classic';
  const g = {
    modeId,
    musou: modeId === 'musou',
    obstacleMode: modeId === 'obstacle',
    floor: 1,
    turn: 0,
    actionNo: 0,
    kills: 0,
    score: 0,
    phase: 'player',
    over: false,
    won: false,
    endless: false,
    floorCleared: false,
    lastAim: -90,                    // degrees; -90 = up (screen y down)
    shield: 0,
    insuranceUsed: false,
    freeMoveUsed: false,
    player: { x: 4, y: 7, hp: 3, maxHp: 3, moving: null },
    stats: defaultStats(),
    cards: [],
    weapons: buildWeapons(modeId),
    weapon: 0,
    pieces: [],
    obstacles: [],
    particles: [],
    floats: [],
    flashes: [],
    tracers: [],
    bomb: null,
    shake: 0,
    log: [],
    hover: null,
    bombTarget: null,
    turbo: false,
    autoPick: false
  };
  return g;
}
function activeWeapon(g) { return g.weapons[g.weapon]; }

/* -------------------------------------------------------------- board utils */
function pieceAt(g, x, y) {
  for (const p of g.pieces) if (p.x === x && p.y === y) return p;
  return null;
}
function obstacleAt(g, x, y) {
  for (const o of g.obstacles) if (o.x === x && o.y === y) return o;
  return null;
}
function blockedAt(g, x, y) { return pieceAt(g, x, y) || obstacleAt(g, x, y); }
function whiteKing(g) { return g.pieces.find(p => p.type === 'king'); }
function pieceValue(type) {
  return { pawn:1, knight:3, bishop:3, rook:5, queen:9, king:20 }[type] || 1;
}
function baseHp(type) {
  return { pawn:1, knight:2, bishop:2, rook:3, queen:4, king:1 }[type] || 1;
}
function baseDmg(type) {
  return { pawn:1, knight:2, bishop:2, rook:2, queen:3, king:1 }[type] || 1;
}
function hpScale(f) { return 1 + Math.floor((f - 1) / 4); }
function enemyHp(type, f) { return baseHp(type) * hpScale(f); }
function enemyDmg(type, f) { return baseDmg(type) + (f >= 6 ? 1 : 0); }

function msg(g, text) {
  g.log.push({ text, turn: g.turn, t: now() });
  if (g.log.length > 30) g.log.shift();
}

/* ------------------------------------------------------------ floor spawning */
function spawnPiece(g, type, x, y, opts) {
  const o = opts || {};
  const f = g.floor;
  const p = {
    id: nextPieceId++,
    type, x, y,
    hp: o.hp != null ? o.hp : enemyHp(type, f),
    maxHp: o.hp != null ? o.hp : enemyHp(type, f),
    dmg: o.dmg != null ? o.dmg : enemyDmg(type, f),
    boss: !!o.boss,
    burned: false,
    slowed: false,
    moving: null
  };
  g.pieces.push(p);
  return p;
}

function emptyCellsIn(g, rows) {
  const cells = [];
  for (const y of rows) {
    for (let x = 0; x < 8; x++) {
      if (!blockedAt(g, x, y)) cells.push({ x, y });
    }
  }
  return shuffle(cells);
}

function spawnObstacles(g) {
  const f = g.floor;
  const n = Math.min(14, 7 + Math.floor(f / 2));
  let placed = 0, tries = 0;
  while (placed < n && tries < 300) {
    tries++;
    const x = ri(0, 7), y = ri(1, 6);
    if (blockedAt(g, x, y)) continue;
    if (cheb({ x, y }, g.player) <= 1) continue;
    const hp = 2 + (f >= 5 ? 1 : 0);
    g.obstacles.push({ x, y, hp, maxHp: hp });
    placed++;
  }
}

function spawnFloor(g) {
  const f = g.floor;
  g.pieces = [];
  g.obstacles = [];
  g.floorCleared = false;
  g.player.x = 4; g.player.y = 7; g.player.moving = null;
  g.insuranceUsed = false;
  g.freeMoveUsed = false;
  g.flashes = [];
  g.floats = [];
  g.tracers = [];
  g.bomb = null;

  if (g.stats.shieldPerFloor) g.shield = Math.min(2, g.shield + 1);

  const kingHp = f === 10 && !g.endless ? 12 : (f > 10 ? 10 + Math.floor((f - 10) * 1.5) : 2 + Math.floor((f - 1) / 2));
  spawnPiece(g, 'king', ri(0, 7), ri(0, 1), { hp: kingHp, dmg: 1 });

  const pool = ['pawn'];
  if (f >= 2) pool.push('knight');
  if (f >= 3) pool.push('bishop');
  if (f >= 4) pool.push('rook');
  if (f >= 6) pool.push('queen');
  let count = Math.min(9, Math.floor(2 + f * 0.75 + (f >= 4 ? 1 : 0) + (f >= 7 ? 1 : 0)));
  const hasBoss = f >= 5 && f % 5 === 0;
  if (hasBoss) count = Math.max(3, count - 2);
  if (f === 10) count = 6;

  const typeWeight = () => {
    const w = {};
    for (const t of pool) {
      if (t === 'pawn') w[t] = Math.max(1, 6 - f);
      else if (t === 'knight') w[t] = 3;
      else if (t === 'bishop') w[t] = 2;
      else if (t === 'rook') w[t] = f >= 5 ? 2 : 1;
      else if (t === 'queen') w[t] = f >= 8 ? 2 : 1;
    }
    return w;
  };
  const pickType = () => {
    const w = typeWeight();
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const t of pool) { r -= w[t]; if (r <= 0) return t; }
    return 'pawn';
  };

  const rows = f >= 6 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3];
  const cells = emptyCellsIn(g, rows);
  for (let i = 0; i < count && cells.length > 0; i++) {
    const c = cells.pop();
    spawnPiece(g, pickType(), c.x, c.y);
  }

  if (hasBoss) {
    const btype = f === 10 ? 'queen' : (f % 10 === 5 ? 'rook' : 'queen');
    const boss = spawnPiece(g, btype, ri(2, 5), 0, { boss: true, hp: 9 + f, dmg: 3 });
    const conflict = g.pieces.find(p => p !== boss && p.x === boss.x && p.y === boss.y);
    if (conflict) {
      const alt = emptyCellsIn(g, [0, 1, 2, 3])[0];
      if (alt) { conflict.x = alt.x; conflict.y = alt.y; }
    }
  }

  if (g.obstacleMode) spawnObstacles(g);

  if (g.stats.decree) {
    const targets = g.pieces.filter(p => p.type !== 'king' && !p.boss);
    if (targets.length) {
      const t = targets[ri(0, targets.length - 1)];
      killPiece(g, t, 'decree', true);
      msg(g, 'ROYAL DECREE: A WHITE PIECE DESERTED!');
    }
  }

  msg(g, 'FLOOR ' + f + ' - KILL THE WHITE KING');
  g.phase = 'player';
}

/* ------------------------------------------------------------ legality & AI */
function legalPlayerMoves(g) {
  const out = [];
  for (const [dx, dy] of DIRS) {
    const x = g.player.x + dx, y = g.player.y + dy;
    if (!inB(x, y)) continue;
    if (blockedAt(g, x, y)) continue;
    out.push({ x, y });
  }
  return out;
}

function legalEnemyMoves(g, p) {
  const moves = [];
  const P = g.player;
  const push = (x, y) => {
    if (!inB(x, y)) return;
    if (x === P.x && y === P.y) {
      if (p.type !== 'king') moves.push({ x, y, capture: true });
      return;
    }
    if (!blockedAt(g, x, y)) moves.push({ x, y, capture: false });
  };
  const slide = (dirs) => {
    for (const [dx, dy] of dirs) {
      let x = p.x + dx, y = p.y + dy;
      while (inB(x, y)) {
        if (x === P.x && y === P.y) {
          if (p.type !== 'king') moves.push({ x, y, capture: true });
          break;
        }
        if (blockedAt(g, x, y)) break;
        moves.push({ x, y, capture: false });
        x += dx; y += dy;
      }
    }
  };

  switch (p.type) {
    case 'pawn': {
      if (inB(p.x, p.y + 1) && !blockedAt(g, p.x, p.y + 1) && !(P.x === p.x && P.y === p.y + 1)) {
        moves.push({ x: p.x, y: p.y + 1, capture: false });
      }
      if (p.y <= 1 && !blockedAt(g, p.x, p.y + 1) && !(P.x === p.x && P.y === p.y + 1) &&
          !blockedAt(g, p.x, p.y + 2) && !(P.x === p.x && P.y === p.y + 2)) {
        moves.push({ x: p.x, y: p.y + 2, capture: false });
      }
      for (const dx of [-1, 1]) {
        if (inB(p.x + dx, p.y + 1) && P.x === p.x + dx && P.y === p.y + 1) {
          moves.push({ x: P.x, y: P.y, capture: true });
        }
      }
      break;
    }
    case 'knight':
      for (const [dx, dy] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) push(p.x + dx, p.y + dy);
      break;
    case 'bishop': slide([[1,1],[1,-1],[-1,1],[-1,-1]]); break;
    case 'rook':   slide([[1,0],[-1,0],[0,1],[0,-1]]); break;
    case 'queen':  slide([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]); break;
    case 'king': {
      for (const [dx, dy] of DIRS) {
        const x = p.x + dx, y = p.y + dy;
        if (!inB(x, y)) continue;
        if (x === P.x && y === P.y) continue;
        if (!blockedAt(g, x, y)) moves.push({ x, y, capture: false });
      }
      break;
    }
  }
  return moves;
}

function pickEnemyMove(g, p) {
  const moves = legalEnemyMoves(g, p);
  if (!moves.length) return null;
  if (p.type === 'king') {
    // flee the black king, avoid being adjacent, stay out of his longest weapon range
    let bestRange = 0;
    for (const w of g.weapons) bestRange = Math.max(bestRange, effectiveWeapon(g, w).range);
    let best = null, bestScore = -Infinity;
    for (const m of moves) {
      const d = cheb(m, g.player);
      let score = d * 10 - Math.random() * 2;
      if (d <= 1) score -= 8;
      if (d <= bestRange) score -= 2;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    const score = m.capture ? 10000 : -cheb(m, g.player) * 10 + Math.random() * 3;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

function threatMap(g) {
  const map = [];
  for (let y = 0; y < 8; y++) map.push(new Array(8).fill(false));
  for (const p of g.pieces) {
    if (p.type === 'king') continue;
    for (const m of legalEnemyMoves(g, p)) {
      if (!m.capture) map[m.y][m.x] = true;
    }
  }
  return map;
}

/* ------------------------------------------------------------- damage & kill */
function spawnFloat(g, x, y, text, color) {
  g.floats.push({ x, y, text, color, t0: now(), life: 900 });
}
function addShake(g, n) { g.shake = Math.min(6, g.shake + n); }

function killPiece(g, piece, src, silent) {
  const i = g.pieces.indexOf(piece);
  if (i < 0) return;
  g.pieces.splice(i, 1);
  g.kills++;
  g.score += pieceValue(piece.type) * 10;
  spawnFloat(g, piece.x, piece.y, 'KILL', '#ffd75e');
  if (!silent) msg(g, piece.type.toUpperCase() + ' FALLS!');
  if (src !== 'decree') {
    if (g.stats.lifesteal && g.player.hp < g.player.maxHp) {
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + 1);
      spawnFloat(g, g.player.x, g.player.y, '+1 HP', '#62c86a');
    }
    if (g.stats.bountyChance > 0 && Math.random() < g.stats.bountyChance && g.player.hp < g.player.maxHp) {
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + 1);
      spawnFloat(g, g.player.x, g.player.y, 'BOUNTY +1', '#62c86a');
    }
    if (g.stats.scavengeChance > 0 && Math.random() < g.stats.scavengeChance) {
      const w = activeWeapon(g);
      if (!g.musou && w.ammo < w.maxAmmo) {
        w.ammo++;
        spawnFloat(g, piece.x, piece.y, '+1 SHELL', '#ffd75e');
      }
    }
  }
  if (piece.type === 'king') {
    g.floorCleared = true;
    msg(g, 'THE WHITE KING IS DEAD!');
  }
}

function damagePiece(g, piece, dmg, src) {
  piece.hp -= dmg;
  spawnFloat(g, piece.x, piece.y, '-' + dmg, '#ff7a6a');
  addShake(g, src === 'shot' ? 2 : 1);
  if (src === 'shot' && g.stats.explosive) explodeAt(g, piece.x, piece.y, piece);
  if (piece.hp <= 0) { killPiece(g, piece, src); return true; }
  return false;
}

function damageObstacle(g, ob, dmg) {
  ob.hp -= dmg;
  spawnFloat(g, ob.x, ob.y, '-' + dmg, '#c9a36a');
  addShake(g, 1);
  if (ob.hp <= 0) {
    const i = g.obstacles.indexOf(ob);
    if (i >= 0) g.obstacles.splice(i, 1);
    g.score += 5;
    spawnFloat(g, ob.x, ob.y, 'WALL DOWN', '#ffd75e');
    msg(g, 'A WALL CRUMBLES!');
  }
}

function explodeAt(g, x, y, origin) {
  g.flashes.push({ x, y, r: 1, t0: now(), life: 260, color: '#ffb347' });
  for (const p of [...g.pieces]) {
    if (p === origin) continue;
    if (Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1) damagePiece(g, p, 1, 'blast');
  }
  for (const o of [...g.obstacles]) {
    if (Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1) damageObstacle(g, o, 1);
  }
}

function explodeAtCell(g, x, y, dmg) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = x + dx, cy = y + dy;
      if (!inB(cx, cy)) continue;
      g.flashes.push({ x: cx, y: cy, r: 1, t0: now(), life: 300, color: '#ffb347' });
    }
  }
  addShake(g, 4);
  let slowDone = false;
  for (const p of [...g.pieces]) {
    if (Math.abs(p.x - x) > 1 || Math.abs(p.y - y) > 1) continue;
    let d = dmg;
    if (g.stats.headshot && Math.random() < 0.2) { d *= 2; spawnFloat(g, p.x, p.y, 'CRIT!', '#ffd75e'); }
    const killed = damagePiece(g, p, d, 'blast');
    if (!killed) {
      if (g.stats.burn) p.burned = true;
      if (g.stats.slow && !slowDone) { p.slowed = true; slowDone = true; }
    }
  }
  for (const o of [...g.obstacles]) {
    if (Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1) damageObstacle(g, o, dmg);
  }
}

function damagePlayer(g, amount, attacker) {
  const dmg = Math.max(1, amount - g.stats.armor);
  if (g.shield > 0) {
    g.shield--;
    spawnFloat(g, g.player.x, g.player.y, 'SHIELD!', '#7cc0ff');
    addShake(g, 2);
    return 0;
  }
  g.player.hp -= dmg;
  spawnFloat(g, g.player.x, g.player.y, '-' + dmg + ' HP', '#ff5a5a');
  addShake(g, 4);
  if (typeof sfx === 'function') sfx('hurt');
  if (g.player.hp <= 0) {
    if (g.stats.insurance && !g.insuranceUsed) {
      g.insuranceUsed = true;
      g.player.hp = 1;
      spawnFloat(g, g.player.x, g.player.y, 'ROYAL INSURANCE!', '#ffd75e');
      msg(g, 'INSURANCE SAVES THE CROWN!');
      return dmg;
    }
    g.player.hp = 0;
    endGame(g);
  }
  return dmg;
}

function endGame(g) {
  if (g.over) return;
  g.over = true;
  g.phase = 'over';
  msg(g, 'THE BLACK KING HAS FALLEN.');
  if (typeof showEndOverlay === 'function') showEndOverlay(g);
}

/* --------------------------------------------------------- raycast & combat */
function raycast(g, cx, cy, angleDeg, maxDistCells, limit) {
  const rad = angleDeg * Math.PI / 180;
  const dx = Math.cos(rad), dy = Math.sin(rad);
  const deltaX = Math.abs(dx) < 1e-9 ? Infinity : Math.abs(1 / dx);
  const deltaY = Math.abs(dy) < 1e-9 ? Infinity : Math.abs(1 / dy);
  let mapX = Math.floor(cx), mapY = Math.floor(cy);
  let stepX, stepY, sideX, sideY;
  if (dx > 0) { stepX = 1; sideX = (mapX + 1 - cx) * deltaX; }
  else { stepX = -1; sideX = (cx - mapX) * deltaX; }
  if (dy > 0) { stepY = 1; sideY = (mapY + 1 - cy) * deltaY; }
  else { stepY = -1; sideY = (cy - mapY) * deltaY; }

  let t = 0;
  const hits = [];
  for (let i = 0; i < 64; i++) {
    if (sideX < sideY) { t = sideX; sideX += deltaX; mapX += stepX; }
    else { t = sideY; sideY += deltaY; mapY += stepY; }
    if (t > maxDistCells) break;
    if (!inB(mapX, mapY)) break;
    const ob = obstacleAt(g, mapX, mapY);
    if (ob) { hits.push({ kind:'obstacle', x:mapX, y:mapY, ob, dist:t }); break; }
    const pc = pieceAt(g, mapX, mapY);
    if (pc) {
      hits.push({ kind:'piece', x:mapX, y:mapY, pc, dist:t });
      let n = 0;
      for (const h of hits) if (h.kind === 'piece') n++;
      if (n >= limit) break;
    }
  }
  return hits;
}

function effectiveWeapon(g, w) {
  const s = g.stats;
  let dmg = w.dmg + (s.dmg - 1);
  let range;
  if (w.type === 'sniper' || w.type === 'bomber') range = w.range;   // sniper: infinite; bomber: fixed throw distance 3
  else range = Math.min(10, w.range + (s.range - 3));
  let cone = w.cone;
  let pellets = w.pellets;
  let pierce = w.pierce;
  const pelletBonus = Math.max(0, s.pellets - 3);

  if (w.type === 'spray') {
    if (s.slug) { cone = 5; pellets = 1; dmg += 2; range = Math.min(10, range + 1); }
    else pellets = Math.min(12, w.pellets + pelletBonus);
    pierce = (w.pierce >= 900 ? 999 : w.pierce + s.pierce);
  } else if (w.type === 'bow') {
    if (s.slug) { dmg += 2; range = Math.min(10, range + 1); }
    dmg += pelletBonus;
    cone = w.cone;
  } else if (w.type === 'sniper') {
    if (s.slug) dmg += 2;
    dmg += pelletBonus;
    pierce = w.pierce + s.pierce;
  } else { // flame & bomber
    if (s.slug) dmg += 2;
    dmg += pelletBonus;
  }
  if (s.focus && (w.type === 'flame' || w.type === 'bomber')) dmg += 1;
  return { dmg, range, cone, pellets, pierce };
}

function playerPx(g) {
  return { x: BX + g.player.x * CELL + Math.floor(CELL / 2), y: BY + g.player.y * CELL + Math.floor(CELL / 2) };
}

function addTracer(g, angle, len, color, life) {
  const p = playerPx(g);
  g.tracers.push({ x: p.x, y: p.y, ang: angle, len, color, t0: now(), life: life || 170 });
}

function fireRayWeapon(g, w, aimDeg) {
  const eff = effectiveWeapon(g, w);
  const angles = [];
  if (w.type === 'spray') {
    angles.push(aimDeg);                              // deterministic center pellet
    for (let i = 1; i < eff.pellets; i++) {
      angles.push(aimDeg + (Math.random() * 2 - 1) * (eff.cone / 2));
    }
  } else {
    // bow / sniper: single projectile, random inside its tiny cone
    angles.push(aimDeg + (Math.random() * 2 - 1) * (eff.cone / 2));
  }

  const cx = g.player.x + 0.5, cy = g.player.y + 0.5;
  const limit = eff.pierce >= 900 ? 900 : eff.pierce + 1;
  let slowDone = false;

  for (let pi = 0; pi < angles.length; pi++) {
    const ang = angles[pi];
    const hits = raycast(g, cx, cy, ang, eff.range, limit);
    for (const h of hits) {
      addTracer(g, ang, h.dist * CELL, '#ffd75e', 180);
      if (h.kind === 'obstacle') {
        damageObstacle(g, h.ob, Math.max(1, Math.round(eff.dmg)));
        break;
      }
      let dmg = eff.dmg;
      if (pi === 0 && g.stats.focus) dmg += 2;
      if (g.stats.headshot && Math.random() < 0.2) {
        dmg *= 2;
        spawnFloat(g, h.pc.x, h.pc.y, 'CRIT!', '#ffd75e');
      }
      const killed = damagePiece(g, h.pc, dmg, 'shot');
      if (!killed) {
        if (g.stats.burn) h.pc.burned = true;
        if (g.stats.slow && !slowDone) { h.pc.slowed = true; slowDone = true; }
      }
      if (g.floorCleared) return;
    }
    if (g.floorCleared) return;
  }
}

function fireFlame(g, w, aimDeg) {
  const eff = effectiveWeapon(g, w);
  const cx = g.player.x + 0.5, cy = g.player.y + 0.5;
  let slowDone = false;
  for (const p of [...g.pieces]) {
    const dx = (p.x + 0.5) - cx, dy = (p.y + 0.5) - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > eff.range + 0.5) continue;
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    if (Math.abs(normDeg(ang - aimDeg)) > eff.cone / 2 + 1) continue;
    let dmg = eff.dmg;
    if (g.stats.explosive) dmg += 1;
    if (g.stats.headshot && Math.random() < 0.2) { dmg *= 2; spawnFloat(g, p.x, p.y, 'CRIT!', '#ffd75e'); }
    const killed = damagePiece(g, p, dmg, 'flame');
    if (!killed) {
      p.burned = true;
      if (g.stats.slow && !slowDone) { p.slowed = true; slowDone = true; }
    }
    if (g.floorCleared) return;
  }
  // flame cone visuals
  const p = playerPx(g);
  for (let i = 0; i < 14; i++) {
    const ang = aimDeg + (Math.random() * 2 - 1) * (eff.cone / 2);
    const rad = ang * Math.PI / 180;
    const len = (0.5 + Math.random() * 0.5) * eff.range * CELL;
    addTracer(g, ang, len, i % 3 === 0 ? '#ff9a4d' : '#ff6a3a', 240);
  }
}

function bombTargetFromAngle(g, aimDeg) {
  const rad = aimDeg * Math.PI / 180;
  let tx = Math.round(g.player.x + 3 * Math.cos(rad));
  let ty = Math.round(g.player.y + 3 * Math.sin(rad));
  tx = clamp(tx, 0, 7); ty = clamp(ty, 0, 7);
  return { x: tx, y: ty };
}

function bombClampTarget(g, tx, ty) {
  const dx = tx - g.player.x, dy = ty - g.player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 3) {
    tx = Math.round(g.player.x + 3 * dx / dist);
    ty = Math.round(g.player.y + 3 * dy / dist);
  }
  return { x: clamp(tx, 0, 7), y: clamp(ty, 0, 7) };
}

async function fireBomber(g, w, aimDeg) {
  const eff = effectiveWeapon(g, w);
  let target = g.bombTarget;
  if (!target) target = bombTargetFromAngle(g, aimDeg);
  const clamped = bombClampTarget(g, target.x, target.y);
  const tx = clamped.x, ty = clamped.y;
  // one random bounce in any of the 8 directions
  const bd = DIRS[ri(0, 7)];
  let bx = tx + bd[0], by = ty + bd[1];
  if (!inB(bx, by)) { bx = tx; by = ty; }

  g.bomb = { ax: g.player.x, ay: g.player.y, bx: tx, by: ty, cx: bx, cy: by, t0: now(), dur: 380 };
  if (typeof sfx === 'function') sfx('bomb');
  await wait(g, 380);
  g.bomb = null;

  let dmg = eff.dmg;
  if (g.stats.explosive) dmg += 1;
  explodeAtCell(g, bx, by, dmg);
  await wait(g, 150);
}

/* ------------------------------------------------------------------- actions */
async function playerMove(g, x, y) {
  g.player.moving = { fx: g.player.x, fy: g.player.y, tx: x, ty: y, t0: now(), dur: 90 };
  g.player.x = x; g.player.y = y;
  await wait(g, 90);
  g.player.moving = null;
}

async function playerAction(g, kind, arg) {
  if (g.phase !== 'player' || g.over) return false;

  let ok = false;
  let free = false;
  const useFreeMove = kind === 'move' && g.stats.freeMove && !g.freeMoveUsed;

  if (kind === 'move') {
    const legal = legalPlayerMoves(g);
    if (legal.some(m => m.x === arg.x && m.y === arg.y)) {
      await playerMove(g, arg.x, arg.y);
      free = useFreeMove;
      if (free) g.freeMoveUsed = true;
      ok = true;
      if (typeof sfx === 'function') sfx('move');
    }
  } else if (kind === 'fire') {
    const w = activeWeapon(g);
    if (!g.musou && w.ammo <= 0) { msg(g, 'NO AMMO! PRESS R TO RELOAD.'); return false; }
    const aimDeg = normDeg(arg == null ? g.lastAim : arg);
    g.lastAim = aimDeg;
    let shots = 1;
    if (g.stats.doubletap && (g.musou || w.ammo >= 2)) shots = 2;
    if (!g.musou) w.ammo -= shots;

    for (let i = 0; i < shots && !g.floorCleared; i++) {
      if (w.type === 'bomber') await fireBomber(g, w, aimDeg);
      else if (w.type === 'flame') fireFlame(g, w, aimDeg);
      else fireRayWeapon(g, w, aimDeg);
    }
    addShake(g, 3);
    if (typeof sfx === 'function') sfx('shot');
    if (shots === 2) msg(g, 'DOUBLE TAP!');
    await wait(g, 130);
    ok = true;
  } else if (kind === 'reload') {
    const w = activeWeapon(g);
    if (g.musou) { msg(g, 'MUSOU MODE: AMMO IS INFINITE.'); return false; }
    if (w.ammo >= w.maxAmmo) { msg(g, w.name + ' ALREADY LOADED.'); return false; }
    w.ammo = w.maxAmmo;
    msg(g, w.name + ' RELOADED.');
    if (typeof sfx === 'function') sfx('reload');
    free = g.stats.freeReload;
    ok = true;
  }
  if (!ok) return false;

  g.actionNo++;
  if (g.stats.timeStop && g.actionNo % 5 === 0) {
    free = true;
    msg(g, 'TIME RIFT: FREE ACTION!');
  }
  if (free) msg(g, 'FREE ACTION - ENEMIES FROZEN.');

  if (g.stats.aura && kind !== 'reload') {
    for (const p of [...g.pieces]) {
      if (cheb(p, g.player) <= 1) damagePiece(g, p, 1, 'aura');
    }
  }

  if (g.floorCleared) { await endFloor(g); return true; }
  if (free) { g.phase = 'player'; return true; }

  g.phase = 'enemy';
  await enemyPhase(g);
  if (!g.over && g.floorCleared) await endFloor(g);
  return true;
}

/* --------------------------------------------------------------- enemy phase */
function typeOrder(t) { return { pawn:0, knight:1, bishop:2, rook:3, queen:4, king:5 }[t] || 9; }

async function tweenPiece(g, p, fx, fy, tx, ty, dur) {
  p.moving = { fx, fy, tx, ty, t0: now(), dur };
  await wait(g, dur);
}

async function enemyPhase(g) {
  g.phase = 'enemy';
  const order = [...g.pieces].sort((a, b) => typeOrder(a.type) - typeOrder(b.type));

  for (const p of order) {
    if (g.over || g.floorCleared) break;
    if (!g.pieces.includes(p)) continue;

    if (p.slowed) { p.slowed = false; continue; }
    if (p.burned) {
      p.burned = false;
      const killed = damagePiece(g, p, 1, 'burn');
      if (killed || g.floorCleared) continue;
    }

    const mv = pickEnemyMove(g, p);
    if (!mv) continue;

    if (mv.capture) {
      const ox = p.x, oy = p.y;
      await tweenPiece(g, p, p.x, p.y, g.player.x, g.player.y, 75);
      damagePlayer(g, p.dmg, p);
      if (g.over) break;
      if (g.stats.thorns && g.pieces.includes(p)) {
        const killed = damagePiece(g, p, 1, 'thorns');
        if (killed) continue;
      }
      await tweenPiece(g, p, g.player.x, g.player.y, ox, oy, 65);
      p.moving = null;
    } else {
      await tweenPiece(g, p, p.x, p.y, mv.x, mv.y, 80);
      p.x = mv.x; p.y = mv.y; p.moving = null;
    }
    await wait(g, 24);
  }

  if (g.over) return;
  g.turn++;
  g.phase = 'player';
}

/* ---------------------------------------------------------- floors & cards */
function rollCards() {
  const out = [];
  let pool = CARDS.slice();
  while (out.length < 3 && pool.length) {
    const total = pool.reduce((a, c) => a + RARITY_WEIGHT[c.rarity], 0);
    let r = Math.random() * total;
    let pick = pool[pool.length - 1];
    for (const c of pool) { r -= RARITY_WEIGHT[c.rarity]; if (r <= 0) { pick = c; break; } }
    out.push(pick);
    pool = pool.filter(c => c.id !== pick.id);
  }
  return out;
}

function addPellets(g, n) {
  if (g.stats.slug) g.stats.dmg += n;
  else g.stats.pellets = Math.min(7, g.stats.pellets + n);
}

function applyCard(g, card) {
  const s = g.stats;
  switch (card.id) {
    case 'bandolier':
      for (const w of g.weapons) {
        w.maxAmmo = Math.min(12, w.maxAmmo + 2);
        w.ammo = Math.min(w.maxAmmo, w.ammo + 2);
      }
      break;
    case 'heavyshot':   s.dmg += 1; break;
    case 'longbarrel':  s.range = Math.min(8, s.range + 1); break;
    case 'buckshot':    addPellets(g, 1); break;
    case 'royalblood':  g.player.maxHp += 1; g.player.hp = Math.min(g.player.maxHp, g.player.hp + 1); break;
    case 'ironcrown':   g.player.maxHp += 2; break;
    case 'bounty':      s.bountyChance = Math.min(0.8, s.bountyChance + 0.4); break;
    case 'scavenger':   s.scavengeChance = Math.min(0.9, s.scavengeChance + 0.3); break;
    case 'padding':     s.armor += 1; break;
    case 'slug':        if (!s.slug) s.slug = true; else s.dmg += 1; break;
    case 'pierce':      s.pierce += 1; break;
    case 'explosive':   s.explosive = true; break;
    case 'dragonfire':  s.burn = true; break;
    case 'vampiric':    s.lifesteal = true; break;
    case 'thorns':      s.thorns = true; break;
    case 'scope':       s.focus = true; break;
    case 'quickloader': s.freeReload = true; break;
    case 'opening':     s.freeMove = true; break;
    case 'sawedoff':    s.dmg += 1; s.range = Math.max(2, s.range - 1); break;
    case 'insurance':   s.insurance = true; break;
    case 'doubletap':   s.doubletap = true; break;
    case 'headshot':    s.headshot = true; break;
    case 'blackpowder':
      addPellets(g, 2);
      s.dmg += 1;
      for (const w of g.weapons) {
        w.maxAmmo = Math.max(1, w.maxAmmo - 1);
        w.ammo = Math.min(w.ammo, w.maxAmmo);
      }
      break;
    case 'shield':      s.shieldPerFloor = true; g.shield = Math.min(2, g.shield + 1); break;
    case 'aura':        s.aura = true; break;
    case 'decree':      s.decree = true; break;
    case 'timestop':    s.timeStop = true; break;
  }
  g.cards.push(card);
  msg(g, 'UPGRADE: ' + card.en);
  if (typeof sfx === 'function') sfx('pick');
}

function chooseCard(g, id) {
  const card = cardById(id);
  if (!card) return;
  applyCard(g, card);
  g.floor++;
  spawnFloor(g);
  if (typeof hideCardOverlay === 'function') hideCardOverlay();
}

function skipCard(g) {
  if (g.player.hp < g.player.maxHp) g.player.hp++;
  msg(g, 'REST AND RECOVER +1 CROWN.');
  g.floor++;
  spawnFloor(g);
  if (typeof hideCardOverlay === 'function') hideCardOverlay();
}

async function endFloor(g) {
  g.phase = 'floor';
  g.score += g.floor * 100;
  msg(g, 'FLOOR ' + g.floor + ' CLEARED!');

  if (g.floor === 10 && !g.endless && !g.won) {
    g.won = true;
    msg(g, 'THE TOWER IS CONQUERED!');
    if (typeof showEndOverlay === 'function') showEndOverlay(g);
    return;
  }

  if (g.autoPick) {
    const card = rollCards()[0];
    applyCard(g, card);
    g.floor++;
    spawnFloor(g);
    return;
  }

  if (typeof showCardOverlay === 'function') showCardOverlay(g);
}

/* ==================================================================== RENDER */
let ctx = null;
let SCALE = 2;        // backing-store multiplier: canvas pixels = 480*SCALE x 270*SCALE
let UI_BIG = 2;       // big bitmap text scale (small text = UI_BIG - 1)
let UI_SMALL = 1;

function pxRect(c, x, y, w, h, col) {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}
function pxCircle(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r + r * 0.4) c.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1);
    }
  }
}
function pxRing(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const x = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    c.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    c.fillRect(Math.round(cx - x), Math.round(cy + y), 1, 1);
  }
}

const WHITE_COL = { main:'#f0e7d0', shade:'#b9ac8d', dark:'#4a4334', accent:'#9a4b4b', gold:'#e8c34a' };
const BLACK_COL = { main:'#5a5d6e', shade:'#2b2d3a', dark:'#0d0e13', accent:'#e8c34a', gold:'#e8c34a', light:'#d9dce8' };

function pieceShapes(type) {
  const r = (x, y, w, h) => ({ t:'r', x, y, w, h });
  const c = (cx, cy, rad) => ({ t:'c', cx, cy, r: rad });
  switch (type) {
    case 'pawn':   return [c(0,-3,2), r(-1,-1,3,1), r(-2,0,5,2), r(-3,2,7,1), r(-4,4,9,2), r(-2,6,5,2)];
    case 'knight': return [c(-2,-3,3), r(1,-4,2,1), r(-2,0,6,2), r(-3,2,7,1), r(-4,4,9,2), r(-2,6,5,2)];
    case 'bishop': return [c(0,-4,2), r(-1,-2,3,2), r(-2,0,5,2), r(-3,2,7,1), r(-4,4,9,2), r(-2,6,5,2)];
    case 'rook':   return [r(-3,-5,7,2), r(-3,-7,2,2), r(-1,-7,3,2), r(3,-7,2,2), r(-2,-3,5,4), r(-3,1,7,1), r(-4,4,9,2), r(-2,6,5,2)];
    case 'queen':  return [c(0,-3,2), r(-2,-1,5,2), r(-2,1,5,2), r(-3,3,7,1), r(-4,4,9,2), r(-2,6,5,2)];
    case 'king':   return [c(0,-3,2), r(-2,-1,5,2), r(-2,1,5,1), r(-3,3,7,1), r(-4,4,9,2), r(-2,6,5,2)];
  }
  return [];
}

function drawPieceSprite(c, type, white, px, py) {
  const col = white ? WHITE_COL : BLACK_COL;
  const shapes = pieceShapes(type);
  const pass = (color, ox, oy) => {
    for (const s of shapes) {
      if (s.t === 'r') pxRect(c, px + s.x + ox, py + s.y + oy, s.w, s.h, color);
      else pxCircle(c, px + s.cx + ox, py + s.cy + oy, s.r, color);
    }
  };
  pass(col.dark, -1, 0); pass(col.dark, 1, 0); pass(col.dark, 0, -1); pass(col.dark, 0, 1);
  pass(col.main, 0, 0);
  for (const s of shapes) {
    if (s.t === 'r') pxRect(c, px + s.x, py + s.y + s.h - 1, s.w, 1, col.shade);
  }
  if (type === 'bishop') {
    pxRect(c, px - 1, py - 6, 1, 2, col.accent); pxRect(c, px, py - 7, 1, 1, col.accent);
  }
  if (type === 'rook') {
    pxRect(c, px - 1, py - 2, 3, 1, col.accent); pxRect(c, px, py - 1, 1, 1, col.accent);
  }
  if (type === 'queen') {
    pxRect(c, px - 3, py - 6, 7, 2, col.gold);
    pxRect(c, px - 3, py - 8, 1, 2, col.gold); pxRect(c, px, py - 8, 1, 2, col.gold); pxRect(c, px + 3, py - 8, 1, 2, col.gold);
  }
  if (type === 'king') {
    pxRect(c, px - 3, py - 6, 7, 2, col.gold);
    pxRect(c, px - 3, py - 8, 1, 2, col.gold); pxRect(c, px, py - 8, 1, 2, col.gold); pxRect(c, px + 3, py - 8, 1, 2, col.gold);
    pxRect(c, px, py - 10, 1, 3, col.gold); pxRect(c, px - 1, py - 9, 3, 1, col.gold);
  }
  if (type === 'knight') {
    pxRect(c, px - 2, py - 6, 1, 1, col.accent); pxRect(c, px + 2, py - 6, 1, 1, col.accent);
  }
}

function drawPos(o) {
  if (o.moving) {
    const t = Math.min(1, (now() - o.moving.t0) / o.moving.dur);
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    return { x: o.moving.fx + (o.moving.tx - o.moving.fx) * e, y: o.moving.fy + (o.moving.ty - o.moving.fy) * e };
  }
  return { x: o.x, y: o.y };
}

function cellCenter(x, y) {
  return { x: BX + x * CELL + Math.floor(CELL / 2), y: BY + y * CELL + Math.floor(CELL / 2) };
}

function drawMiniCrown(c, x, y, col) {
  pxRect(c, x, y, 5, 1, col);
  pxRect(c, x + 1, y - 1, 3, 1, col);
  pxRect(c, x, y - 2, 1, 1, col); pxRect(c, x + 4, y - 2, 1, 1, col);
  pxRect(c, x + 2, y - 2, 1, 1, col);
}
function drawShell(c, x, y, col) {
  pxRect(c, x, y, 3, 2, col);
  pxRect(c, x + 2, y - 1, 3, 1, col);
  pxRect(c, x + 4, y, 2, 2, '#b58a2e');
}

function aimPreviewTarget(g) {
  if (!g.hover) return null;
  const w = activeWeapon(g);
  const eff = effectiveWeapon(g, w);
  if (w.type === 'bomber' || w.type === 'flame') return null;
  const cx = g.player.x + 0.5, cy = g.player.y + 0.5;
  const limit = eff.pierce >= 900 ? 900 : eff.pierce + 1;
  const hits = raycast(g, cx, cy, g.hover.angle, eff.range, limit);
  return hits.find(h => h.kind === 'piece') || (hits[0] && hits[0].kind === 'obstacle' ? hits[0] : null);
}

function drawAim(g, c) {
  if (g.phase !== 'player' || !g.hover) return;
  const w = activeWeapon(g);
  const eff = effectiveWeapon(g, w);
  const p = playerPx(g);
  const aim = g.hover.angle;

  if (w.type === 'bomber') {
    pxRing(c, p.x, p.y, w.range * CELL, 'rgba(255,215,94,0.25)');
    const t = g.bombTarget || bombTargetFromAngle(g, aim);
    const cc = cellCenter(t.x, t.y);
    pxRect(c, cc.x - 4, cc.y - 4, 3, 3, '#ffd75e');
    pxRect(c, cc.x + 1, cc.y - 4, 3, 3, '#ffd75e');
    pxRect(c, cc.x - 4, cc.y + 1, 3, 3, '#ffd75e');
    pxRect(c, cc.x + 1, cc.y + 1, 3, 3, '#ffd75e');
    drawLine(c, p.x, p.y, cc.x, cc.y, 'rgba(255,215,94,0.35)');
    return;
  }

  const maxLen = eff.range >= 90 ? 12 * CELL : eff.range * CELL;
  if (w.type === 'sniper' || w.type === 'bow') {
    drawLine(c, p.x, p.y, p.x + Math.cos(aim * Math.PI / 180) * maxLen, p.y + Math.sin(aim * Math.PI / 180) * maxLen, 'rgba(255,215,94,0.4)');
    drawLine(c, p.x, p.y, p.x + Math.cos((aim + eff.cone / 2) * Math.PI / 180) * maxLen, p.y + Math.sin((aim + eff.cone / 2) * Math.PI / 180) * maxLen, 'rgba(255,215,94,0.15)');
    drawLine(c, p.x, p.y, p.x + Math.cos((aim - eff.cone / 2) * Math.PI / 180) * maxLen, p.y + Math.sin((aim - eff.cone / 2) * Math.PI / 180) * maxLen, 'rgba(255,215,94,0.15)');
  } else if (w.type === 'spray' || w.type === 'flame') {
    const step = Math.max(2, Math.floor(eff.cone / 10));
    for (let a = aim - eff.cone / 2; a <= aim + eff.cone / 2 + 0.01; a += step) {
      const rad = a * Math.PI / 180;
      const alpha = Math.abs(normDeg(a - aim)) < 0.6 ? 0.5 : 0.16;
      const color = w.type === 'flame' ? 'rgba(255,122,58,' + alpha + ')' : 'rgba(255,215,94,' + alpha + ')';
      drawLine(c, p.x, p.y, p.x + Math.cos(rad) * maxLen, p.y + Math.sin(rad) * maxLen, color);
    }
  }

  const hit = aimPreviewTarget(g);
  if (hit) {
    const cc = cellCenter(hit.x, hit.y);
    const col = hit.kind === 'obstacle' ? '#c9a36a' : '#ff6a5a';
    pxRect(c, cc.x - 5, cc.y - 5, 3, 3, col);
    pxRect(c, cc.x + 2, cc.y - 5, 3, 3, col);
    pxRect(c, cc.x - 5, cc.y + 2, 3, 3, col);
    pxRect(c, cc.x + 2, cc.y + 2, 3, 3, col);
  }
}

function render(g) {
  const c = ctx;
  c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  c.clearRect(0, 0, W, H);
  const sh = g.shake;
  if (sh > 0) {
    c.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    g.shake = Math.max(0, sh - 1.2);
  }

  pxRect(c, 0, 0, W, H, '#10131c');
  pxRect(c, 0, 0, W, 22, '#0a0c12');
  pxRect(c, 0, 22, W, 1, '#2a2f3f');

  const threat = (g.phase === 'player') ? threatMap(g) : null;
  const legal = (g.phase === 'player') ? legalPlayerMoves(g) : null;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const tx = BX + x * CELL, ty = BY + y * CELL;
      const dark = (x + y) % 2 === 1;
      pxRect(c, tx, ty, CELL, CELL, dark ? '#333847' : '#444a5e');
      pxRect(c, tx, ty, CELL, 1, '#252936');
      pxRect(c, tx, ty, 1, CELL, '#252936');
      if (threat && threat[y][x]) {
        pxRect(c, tx, ty, CELL, CELL, 'rgba(216,74,74,0.22)');
        pxRect(c, tx + 2, ty + 2, 3, 3, '#d84a4a');
        pxRect(c, tx + CELL - 5, ty + CELL - 5, 3, 3, '#d84a4a');
      }
      if (legal && legal.some(m => m.x === x && m.y === y)) {
        pxRect(c, tx + 1, ty + 1, CELL - 2, CELL - 2, 'rgba(98,200,106,0.22)');
        pxRect(c, tx + 4, ty + 4, CELL - 8, CELL - 8, 'rgba(98,200,106,0.35)');
      }
      if (g.player.x === x && g.player.y === y) {
        pxRect(c, tx + 1, ty + 1, 3, 3, '#ffd75e');
        pxRect(c, tx + CELL - 4, ty + CELL - 4, 3, 3, '#ffd75e');
        pxRect(c, tx + 1, ty + CELL - 4, 3, 3, '#ffd75e');
        pxRect(c, tx + CELL - 4, ty + 1, 3, 3, '#ffd75e');
      }
    }
  }
  pxRect(c, BX - 2, BY - 2, CELL * 8 + 4, 2, '#0a0c12');
  pxRect(c, BX - 2, BY + CELL * 8, CELL * 8 + 4, 2, '#0a0c12');
  pxRect(c, BX - 2, BY - 2, 2, CELL * 8 + 4, '#0a0c12');
  pxRect(c, BX + CELL * 8, BY - 2, 2, CELL * 8 + 4, '#0a0c12');

  drawAim(g, c);

  // obstacles (destructible brick walls)
  for (const o of g.obstacles) {
    const tx = BX + o.x * CELL, ty = BY + o.y * CELL;
    pxRect(c, tx + 2, ty + 2, CELL - 4, CELL - 4, '#5b422a');
    pxRect(c, tx + 3, ty + 3, CELL - 6, CELL - 6, '#7a5a38');
    pxRect(c, tx + 3, ty + 3, CELL - 6, 1, '#4a3420');
    pxRect(c, tx + 3, ty + 10, CELL - 6, 1, '#4a3420');
    pxRect(c, tx + 3, ty + 17, CELL - 6, 1, '#4a3420');
    pxRect(c, tx + 10, ty + 3, 1, 7, '#4a3420');
    pxRect(c, tx + 17, ty + 10, 1, 7, '#4a3420');
    pxRect(c, tx + 4, ty + 5, 6, 4, '#8a6a42');
    pxRect(c, tx + 13, ty + 12, 6, 4, '#8a6a42');
    if (o.hp < o.maxHp) {
      drawLine(c, tx + 6, ty + 4, tx + 14, ty + 20, '#2b2115');
      drawLine(c, tx + 14, ty + 4, tx + 6, ty + 20, '#2b2115');
    }
  }

  // flashes
  const tNow = now();
  g.flashes = g.flashes.filter(f => tNow - f.t0 < f.life);
  for (const f of g.flashes) {
    if (!inB(f.x, f.y)) continue;
    const k = 1 - (tNow - f.t0) / f.life;
    const tx = BX + f.x * CELL, ty = BY + f.y * CELL;
    pxRect(c, tx, ty, CELL, CELL, 'rgba(255,230,150,' + (0.5 * k).toFixed(2) + ')');
    if (f.r > 0) pxRect(c, tx - 1, ty - 1, CELL + 2, CELL + 2, 'rgba(255,178,71,' + (0.4 * k).toFixed(2) + ')');
  }

  // pieces
  for (const p of g.pieces) {
    const d = drawPos(p);
    const cc = cellCenter(d.x, d.y);
    drawPieceSprite(c, p.type, true, cc.x, cc.y);
    if (p.hp < p.maxHp) {
      const w = Math.max(1, Math.round(10 * p.hp / p.maxHp));
      pxRect(c, cc.x - 5, cc.y - 12, 10, 1, '#14161c');
      pxRect(c, cc.x - 5, cc.y - 12, w, 1, p.boss ? '#ff9a4d' : '#62c86a');
    }
    if (p.boss) { pxRect(c, cc.x - 1, cc.y - 13, 1, 1, '#ff6a5a'); pxRect(c, cc.x, cc.y - 13, 1, 1, '#ff6a5a'); }
    if (p.burned) pxRect(c, cc.x + 4, cc.y - 11, 2, 3, '#ff9a4d');
    if (p.slowed) pxRect(c, cc.x - 6, cc.y - 11, 2, 3, '#7cc0ff');
  }

  // black king + held weapon barrel
  {
    const d = drawPos(g.player);
    const cc = cellCenter(d.x, d.y);
    drawPieceSprite(c, 'king', false, cc.x, cc.y);
    const rad = g.lastAim * Math.PI / 180;
    drawLine(c, cc.x, cc.y - 1, cc.x + Math.cos(rad) * 9, cc.y - 1 + Math.sin(rad) * 9, '#7c8296');
    drawLine(c, cc.x, cc.y, cc.x + Math.cos(rad) * 9, cc.y + Math.sin(rad) * 9, '#4d5262');
    if (g.shield > 0) {
      pxRect(c, cc.x - 8, cc.y - 9, 2, 4, '#7cc0ff');
      pxRect(c, cc.x - 7, cc.y - 9, 1, 4, '#bfe2ff');
    }
  }

  // pellet tracers
  g.tracers = g.tracers.filter(t => tNow - t.t0 < t.life);
  for (const t of g.tracers) {
    const k = 1 - (tNow - t.t0) / t.life;
    const rad = t.ang * Math.PI / 180;
    drawLine(c, t.x, t.y, t.x + Math.cos(rad) * t.len * k, t.y + Math.sin(rad) * t.len * k, t.color);
  }

  // bomb animation
  if (g.bomb) {
    const b = g.bomb;
    const t = clamp((tNow - b.t0) / b.dur, 0, 1);
    const a = cellCenter(b.ax, b.ay);
    const m = cellCenter(b.bx, b.by);
    const e = cellCenter(b.cx, b.cy);
    let x, y;
    if (t < 0.55) { const k = t / 0.55; x = a.x + (m.x - a.x) * k; y = a.y + (m.y - a.y) * k; }
    else { const k = (t - 0.55) / 0.45; x = m.x + (e.x - m.x) * k; y = m.y + (e.y - m.y) * k; }
    pxRect(c, x - 1, y - 1, 3, 3, '#1a1c22');
    pxRect(c, x, y, 1, 1, '#ff6a3a');
    pxRect(c, x - 2, y - 2, 1, 1, '#ffd75e');
  }

  // particles
  g.particles = g.particles.filter(p => tNow - p.t0 < p.life);
  for (const p of g.particles) {
    const px = p.x + p.vx * (tNow - p.t0) / 1000;
    const py = p.y + p.vy * (tNow - p.t0) / 1000;
    pxRect(c, px, py, p.size, p.size, p.color);
  }

  // floating text
  g.floats = g.floats.filter(f => tNow - f.t0 < f.life);
  for (const f of g.floats) {
    const k = 1 - (tNow - f.t0) / f.life;
    const cc = cellCenter(f.x, f.y);
    c.globalAlpha = Math.max(0, Math.min(1, k * 1.6));
    drawText(c, f.text, cc.x - f.text.length * 2 * UI_BIG, cc.y - 14 - (1 - k) * 8, f.color, UI_BIG);
    c.globalAlpha = 1;
  }

  renderPanel(g);
  renderButtons(g);
  renderTopStrip(g);
}

function renderTopStrip(g) {
  const c = ctx;
  let tx = BX;
  const topY = 3;
  tx += drawText(c, 'SHOTGUN KING', tx, topY, '#e8c34a', UI_BIG) + 6;
  const modeName = g.modeId === 'classic' ? 'CLASSIC' : g.modeId.toUpperCase();
  const smallY = topY + (UI_BIG - UI_SMALL) * 5;
  tx += drawText(c, modeName, tx, smallY, '#62c86a', UI_SMALL) + 8;
  const floorTxt = g.endless ? 'ENDLESS ' + g.floor : 'TOWER ' + g.floor + '/10';
  tx += drawText(c, floorTxt, tx, smallY, '#8d93a8', UI_SMALL);
  const w = activeWeapon(g);
  drawText(c, w.short, PANEL_X + 6, smallY, '#ffd75e', UI_SMALL);
}

function renderPanel(g) {
  const c = ctx;
  const x = PANEL_X;
  pxRect(c, x, 0, W - x, H, '#171a24');
  pxRect(c, x, 0, 1, H, '#2a2f3f');

  const compact = UI_BIG >= 3;                       // phone layout
  const SH = UI_SMALL * 5 + 3;                       // small line advance
  const BH = UI_BIG * 5 + 2;                         // big line advance
  let y = 16;

  // crowns
  drawText(c, 'CROWNS', x + 6, y, '#8d93a8', UI_SMALL);
  for (let i = 0; i < Math.min(g.player.maxHp, 10); i++) {
    const filled = i < g.player.hp;
    drawMiniCrown(c, x + 46 + i * 7, y, filled ? '#e8c34a' : '#3a3f50');
  }
  if (g.player.maxHp > 10) drawText(c, '+' + (g.player.maxHp - 10), x + 46 + 70, y, '#8d93a8', UI_SMALL);
  y += Math.max(9, UI_SMALL * 5 + 5);

  // active weapon block
  const w = activeWeapon(g);
  const eff = effectiveWeapon(g, w);
  drawText(c, w.name, x + 6, y, '#ffd75e', UI_BIG);
  y += BH;
  drawText(c, 'DMG ' + eff.dmg + ' CONE ' + eff.cone, x + 6, y, '#aeb4c8', UI_BIG);
  y += BH;
  let line2 = 'RNG ' + (eff.range >= 90 ? 'INF' : eff.range);
  if (w.type === 'spray') line2 += ' PEL ' + eff.pellets;
  if (w.type === 'bow') line2 += ' PIERCE-ALL';
  if (w.type === 'flame') line2 += ' AOE+BURN';
  if (w.type === 'bomber') line2 += ' BOUNCE 3X3';
  drawText(c, line2, x + 6, y, '#aeb4c8', UI_BIG);
  y += BH + 1;

  // ammo
  drawText(c, 'AMMO', x + 6, y, '#8d93a8', UI_SMALL);
  if (g.musou) {
    drawText(c, 'INFINITE', x + 44, y - 2, '#62c86a', UI_BIG);
  } else {
    for (let i = 0; i < Math.min(w.maxAmmo, 12); i++) {
      drawShell(c, x + 44 + i * 7, y + (UI_SMALL - 1) * 2, i < w.ammo ? '#ffd75e' : '#3a3f50');
    }
  }
  y += SH + 3;

  // upgrade extras
  const s = g.stats;
  const extras = [];
  if (s.pierce) extras.push('PIERCE+' + s.pierce);
  if (s.explosive) extras.push('BLAST');
  if (s.burn) extras.push('BURN');
  if (s.lifesteal) extras.push('VAMP');
  if (s.thorns) extras.push('THORN');
  if (s.focus) extras.push('SCOPE');
  if (s.headshot) extras.push('CRIT');
  if (s.freeReload) extras.push('FASTLOAD');
  if (s.freeMove) extras.push('FIRST');
  if (s.doubletap) extras.push('DOUBLE');
  if (s.insurance) extras.push('SAVE');
  if (s.shieldPerFloor) extras.push('SHIELD');
  if (s.aura) extras.push('AURA');
  if (s.decree) extras.push('DECREE');
  if (s.timeStop) extras.push('TIME');
  if (s.armor) extras.push('ARMOR+' + s.armor);
  if (s.slug) extras.push('SLUG');
  const extraLines = Math.max(1, Math.ceil(extras.length / 4));
  const showExtraLines = compact ? Math.min(2, extraLines) : extraLines;
  for (let i = 0; i < showExtraLines; i++) {
    drawText(c, extras.slice(i * 4, i * 4 + 4).join(' '), x + 6, y + i * SH, '#62c86a', UI_SMALL);
  }
  y += showExtraLines * SH + 1;

  // owned cards
  drawText(c, 'CARDS ' + g.cards.length, x + 6, y, '#8d93a8', UI_SMALL);
  y += SH;
  const shown = compact ? g.cards.slice(-1) : g.cards.slice(-3);
  shown.forEach((cd, i) => {
    drawText(c, cd.en.slice(0, 11), x + 6, y + i * SH, '#aeb4c8', UI_SMALL);
  });
  y += shown.length * SH + 1;

  // message log
  pxRect(c, x + 4, y, W - x - 8, 1, '#2a2f3f');
  y += 3;
  const log = g.log.slice(-3);
  log.forEach((m, i) => {
    drawText(c, m.text.slice(0, 30), x + 6, y + i * SH, i === log.length - 1 ? '#e8e2cf' : '#6b7188', UI_SMALL);
  });
  y += log.length * SH;

  // weapon loadout (only when there is room; bottom bar always shows slots)
  if (y + SH * (g.weapons.length + 1) < 244) {
    drawText(c, 'LOADOUT', x + 6, y, '#8d93a8', UI_SMALL);
    g.weapons.forEach((wp, i) => {
      const ammoTxt = g.musou ? 'INF' : wp.ammo + '/' + wp.maxAmmo;
      drawText(c, (i + 1) + ' ' + wp.short + ' ' + ammoTxt, x + 6, y + (i + 1) * SH, i === g.weapon ? '#ffd75e' : '#aeb4c8', UI_SMALL);
    });
  }
}

function renderButtons(g) {
  const c = ctx;
  const y = 246, h = 22;
  const n = g.weapons.length + 1;
  const gap = 4;
  const bw = (W - 4 - (n - 1) * gap) / n;
  const ty = y + Math.max(2, Math.floor((h - UI_BIG * 5) / 2));
  g.weapons.forEach((w, i) => {
    const bx = 2 + i * (bw + gap);
    const active = i === g.weapon;
    pxRect(c, bx, y, Math.floor(bw), h, active ? '#2a2f42' : '#171a24');
    pxRect(c, bx, y, Math.floor(bw), 1, active ? '#e8c34a' : '#3a4052');
    pxRect(c, bx, y + h - 1, Math.floor(bw), 1, active ? '#e8c34a' : '#3a4052');
    pxRect(c, bx, y, 1, h, active ? '#e8c34a' : '#3a4052');
    pxRect(c, bx + Math.floor(bw) - 1, y, 1, h, active ? '#e8c34a' : '#3a4052');
    drawText(c, (i + 1) + ' ' + w.short, bx + 4, ty, active ? '#ffd75e' : '#8d93a8', UI_BIG);
  });
  const bx = 2 + g.weapons.length * (bw + gap);
  const rDisabled = g.musou;
  pxRect(c, bx, y, Math.floor(bw), h, rDisabled ? '#12141c' : '#171a24');
  pxRect(c, bx, y, Math.floor(bw), 1, '#3a4052');
  pxRect(c, bx, y + h - 1, Math.floor(bw), 1, '#3a4052');
  const rLabel = UI_BIG >= 3 ? 'R LOAD' : 'R RELOAD';
  drawText(c, rLabel, bx + 4, ty, rDisabled ? '#3a3f50' : '#8d93a8', UI_BIG);
}

/* ==================================================================== AUDIO */
let AC = null;
function sfx(name) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime;
    const osc = (type, f0, f1, dur, vol) => {
      const o = AC.createOscillator(), gn = AC.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      gn.gain.setValueAtTime(vol, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(AC.destination);
      o.start(t); o.stop(t + dur);
    };
    const noise = (dur, vol, freq) => {
      const len = AC.sampleRate * dur;
      const buf = AC.createBuffer(1, len, AC.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = AC.createBufferSource(); src.buffer = buf;
      const gn = AC.createGain(); gn.gain.value = vol;
      const fl = AC.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = freq;
      src.connect(fl); fl.connect(gn); gn.connect(AC.destination);
      src.start(t);
    };
    if (name === 'shot') {
      noise(0.14, 0.35, 1200);
      osc('square', 120, 40, 0.12, 0.18);
    } else if (name === 'bomb') {
      osc('sine', 160, 40, 0.28, 0.3);
      setTimeout(() => { try { noise(0.2, 0.3, 800); } catch (e) {} }, 320);
    } else if (name === 'reload') {
      osc('square', 320, 220, 0.05, 0.12);
      setTimeout(() => osc('square', 220, 320, 0.05, 0.12), 70);
    } else if (name === 'move') {
      osc('triangle', 180, 150, 0.05, 0.05);
    } else if (name === 'pick') {
      osc('square', 523, 523, 0.07, 0.1);
      setTimeout(() => osc('square', 784, 784, 0.09, 0.1), 80);
    } else if (name === 'hurt') {
      osc('sawtooth', 140, 60, 0.18, 0.16);
    }
  } catch (e) { /* audio unavailable */ }
}

/* ==================================================================== DOM UI */
function showCardOverlay(g) {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('cardOverlay');
  const wrap = document.getElementById('cards');
  const stats = document.getElementById('cardStats');
  wrap.innerHTML = '';
  const w = activeWeapon(g);
  stats.innerHTML =
    '当前状态 — <b>王冠 ' + g.player.hp + '/' + g.player.maxHp + '</b> · ' +
    '当前武器 <b>' + w.name + '</b> 弹药 ' + (g.musou ? '∞' : w.ammo + '/' + w.maxAmmo) + ' · ' +
    '伤害 ' + effectiveWeapon(g, w).dmg;
  const cards = rollCards();
  cards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'card ' + card.rarity;
    div.innerHTML =
      '<div class="rarity">' + card.rarity.toUpperCase() + '</div>' +
      '<div class="ename">' + card.en + '</div>' +
      '<div class="zhdesc"><b>' + card.zh + '</b> — ' + card.zhDesc + '</div>' +
      '<div class="cdesc">' + card.enDesc + '</div>';
    div.onclick = () => chooseCard(g, card.id);
    wrap.appendChild(div);
  });
  overlay.classList.remove('hidden');
}

function hideCardOverlay() {
  if (typeof document === 'undefined') return;
  document.getElementById('cardOverlay').classList.add('hidden');
}

function showEndOverlay(g) {
  if (typeof document === 'undefined') return;
  setTimeout(() => {
    const overlay = document.getElementById('endOverlay');
    const title = document.getElementById('endTitle');
    const stats = document.getElementById('endStats');
    const note = document.getElementById('endNote');
    const endlessBtn = document.getElementById('btnEndless');
    if (g.over) {
      title.textContent = 'THE BLACK KING FALLS';
      title.style.color = '#d84a4a';
      note.textContent = '白色棋子的攻势无穷无尽。换一套 Build 再爬一次吧——走位、弹药与卡牌缺一不可。';
      endlessBtn.classList.add('hidden');
    } else if (g.won) {
      title.textContent = 'TOWER CONQUERED';
      title.style.color = '#e8c34a';
      note.textContent = '黑王与他的军火库征服了十层高塔！真正的统治没有尽头——继续挑战无尽模式。';
      endlessBtn.classList.remove('hidden');
    }
    stats.innerHTML =
      '模式 <b>' + g.modeId.toUpperCase() + '</b> · 层数 <b>' + g.floor + '</b> · 击杀 <b>' + g.kills + '</b> · ' +
      '回合 <b>' + g.turn + '</b> · 卡牌 <b>' + g.cards.length + '</b> · 得分 <b>' + g.score + '</b>';
    overlay.classList.remove('hidden');
  }, g.over ? 500 : 400);
}

function hideEndOverlay() {
  if (typeof document === 'undefined') return;
  document.getElementById('endOverlay').classList.add('hidden');
}

/* ==================================================================== INPUT */
let g = null;
let rafId = 0;
let touchStart = null;
let suppressClickUntil = 0;
let deferredInstallPrompt = null;

function fitCanvas() {
  const cv = document.getElementById('game');
  const vw = Math.max(320, (window.innerWidth || 960) - 16);
  const vh = Math.max(180, (window.innerHeight || 540) - 16);
  const dpr = Math.min(4, Math.max(1, window.devicePixelRatio || 1));
  // CSS size: fit both axes, keep 16:9, integer CSS pixels (avoids blurry resampling)
  const cssW = Math.round(Math.min(vw, vh * 16 / 9, 1920));
  // backing store: nearest integer supersample of the 480x270 logical canvas
  SCALE = clamp(Math.ceil(cssW * dpr / 480), 1, 4);
  cv.width = 480 * SCALE;
  cv.height = 270 * SCALE;
  cv.style.width = cssW + 'px';
  cv.style.height = Math.round(cssW * 270 / 480) + 'px';
  // UI text scale: keeps text a constant physical size across screens
  UI_BIG = clamp(Math.round(2 * 960 / cssW), 2, 3);
  UI_SMALL = UI_BIG - 1;
}

function canvasPoint(e) {
  const cv = document.getElementById('game');
  const r = cv.getBoundingClientRect();
  return {
    sx: (e.clientX - r.left) * (W / r.width),
    sy: (e.clientY - r.top) * (H / r.height)
  };
}

function boardCellFromEvent(e) {
  const { sx, sy } = canvasPoint(e);
  const x = Math.floor((sx - BX) / CELL);
  const y = Math.floor((sy - BY) / CELL);
  if (x < 0 || x > 7 || y < 0 || y > 7) return null;
  return { x, y };
}

function aimAngleAt(sx, sy) {
  const p = playerPx(g);
  return Math.atan2(sy - p.y, sx - p.x) * 180 / Math.PI;
}

function buttonHit(e) {
  const { sx, sy } = canvasPoint(e);
  if (sy < 246 || sy > 268) return null;
  const n = g.weapons.length + 1;
  const gap = 4;
  const bw = (W - 4 - (n - 1) * gap) / n;
  for (let i = 0; i < n; i++) {
    const bx = 2 + i * (bw + gap);
    if (sx >= bx && sx < bx + bw) return i < g.weapons.length ? ('w' + i) : 'reload';
  }
  return null;
}

function overlayOpen() {
  return document.getElementById('cardOverlay').classList.contains('hidden') === false ||
         document.getElementById('endOverlay').classList.contains('hidden') === false ||
         document.getElementById('startOverlay').classList.contains('hidden') === false;
}

function handleCanvasClick(e) {
  if (now() < suppressClickUntil) return;         // tap that ended in a swipe already moved
  if (!g || g.over || g.phase !== 'player' || overlayOpen()) return;
  const btn = buttonHit(e);
  if (btn) {
    if (btn === 'reload') playerAction(g, 'reload', 0);
    else g.weapon = parseInt(btn.slice(1), 10);
    return;
  }
  const { sx, sy } = canvasPoint(e);
  // only fire from clicks inside the board area (panel/top-strip clicks are ignored)
  if (sx < BX - 2 || sx > BX + CELL * 8 + 2 || sy < BY - 2 || sy > BY + CELL * 8 + 2) return;
  const cell = boardCellFromEvent(e);
  if (cell) g.bombTarget = { x: cell.x, y: cell.y };
  const ang = aimAngleAt(sx, sy);
  g.lastAim = ang;
  playerAction(g, 'fire', ang);
}

function handleRightClick(e) {
  e.preventDefault();
  if (!g || g.over || g.phase !== 'player' || overlayOpen()) return;
  const cell = boardCellFromEvent(e);
  if (!cell) return;
  const legal = legalPlayerMoves(g);
  if (legal.some(m => m.x === cell.x && m.y === cell.y)) {
    playerAction(g, 'move', cell);
  }
}

function handleMouseMove(e) {
  if (!g) return;
  const { sx, sy } = canvasPoint(e);
  const cell = boardCellFromEvent(e);
  if (!cell) { g.hover = null; return; }
  const ang = aimAngleAt(sx, sy);
  g.hover = { x: cell.x, y: cell.y, angle: ang, sx, sy };
  g.bombTarget = bombClampTarget(g, cell.x, cell.y);
}

/* ------------------------------------------------------- mobile swipe-move */
function handleTouchStart(e) {
  if (e.touches.length !== 1) { touchStart = null; return; }
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY, t: now() };
}

function handleTouchEnd(e) {
  if (!touchStart || !g) return;
  const t = e.changedTouches[0];
  if (!t) { touchStart = null; return; }
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  const rect = document.getElementById('game').getBoundingClientRect();
  const threshold = Math.max(14, rect.width * 0.025);
  touchStart = null;
  if (Math.hypot(dx, dy) < threshold) return;     // tap -> synthesized click will fire
  if (!g || g.over || g.phase !== 'player' || overlayOpen()) return;

  // snap the swipe vector to one of the 8 king-move directions
  const ang = Math.atan2(dy, dx);
  const dirIdx = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  const [vx, vy] = DIRS[dirIdx];
  const tx = g.player.x + vx, ty = g.player.y + vy;
  if (inB(tx, ty) && !blockedAt(g, tx, ty)) {
    suppressClickUntil = now() + 500;
    playerAction(g, 'move', { x: tx, y: ty });
  }
}

function keyDir(key) {
  const map = { arrowright:0, d:0, arrowdown:2, s:2, arrowleft:4, a:4, arrowup:6, w:6 };
  return map[key];
}

function handleKey(e) {
  if (!g) return;
  const k = e.key.toLowerCase();
  if (k === ' ') {
    e.preventDefault();
    if (g.phase === 'player' && !g.over && !overlayOpen()) {
      g.weapon = (g.weapon + 1) % g.weapons.length;
    }
    return;
  }
  if (k >= '1' && k <= '5') {
    const i = parseInt(k, 10) - 1;
    if (i < g.weapons.length) g.weapon = i;
    return;
  }
  if (k === 'r') { playerAction(g, 'reload', 0); return; }
  const d = keyDir(k);
  if (d == null) return;
  if (g.phase !== 'player' || g.over || overlayOpen()) return;
  e.preventDefault();
  const tx = g.player.x + DIRS[d][0], ty = g.player.y + DIRS[d][1];
  if (inB(tx, ty) && !blockedAt(g, tx, ty)) playerAction(g, 'move', { x: tx, y: ty });
}

function startGame(modeId) {
  g = newGame(modeId);
  spawnFloor(g);
  hideEndOverlay();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('cardOverlay').classList.add('hidden');
  document.getElementById('endOverlay').classList.add('hidden');
  // PWA / mobile: lock to landscape when the platform allows it
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (err) { /* desktop browsers: ignore */ }
}

function endlessContinue() {
  if (!g || !g.won) return;
  g.endless = true;
  g.won = false;
  g.floor++;
  spawnFloor(g);
  hideEndOverlay();
}

/* ==================================================================== BOOT */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const cv = document.getElementById('game');
    ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    fitCanvas();
    window.addEventListener('resize', fitCanvas);
    window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 120));

    cv.addEventListener('mousedown', e => {
      if (e.button === 2) handleRightClick(e);
    });
    cv.addEventListener('click', e => { if (e.button === 0) handleCanvasClick(e); });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('mousemove', handleMouseMove);
    cv.addEventListener('mouseleave', () => { if (g) { g.hover = null; } });
    cv.addEventListener('touchstart', handleTouchStart, { passive: true });
    cv.addEventListener('touchend', handleTouchEnd, { passive: true });
    cv.addEventListener('touchcancel', () => { touchStart = null; });
    window.addEventListener('keydown', handleKey);

    document.querySelectorAll('#modeBtns .modebtn').forEach(btn => {
      btn.addEventListener('click', () => { startGame(btn.dataset.mode); if (typeof sfx === 'function') sfx('pick'); });
    });
    document.getElementById('btnAgain').addEventListener('click', () => { startGame(g ? g.modeId : 'classic'); });
    document.getElementById('btnEndless').addEventListener('click', endlessContinue);
    document.getElementById('btnSkip').addEventListener('click', () => { if (g) skipCard(g); });

    // PWA install prompt
    const installBtn = document.getElementById('btnInstall');
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      installBtn.classList.remove('hidden');
    });
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(() => {});
      deferredInstallPrompt = null;
      installBtn.classList.add('hidden');
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      installBtn.classList.add('hidden');
    });
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      installBtn.classList.add('hidden');
    }

    function loop() {
      if (g) render(g);
      rafId = requestAnimationFrame(loop);
    }
    loop();
  });
}

/* ============================================================== node export */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    newGame, spawnFloor, playerAction, enemyPhase, endFloor,
    legalPlayerMoves, legalEnemyMoves, threatMap, pickEnemyMove,
    pieceAt, obstacleAt, whiteKing, raycast, effectiveWeapon,
    fireRayWeapon, fireFlame, fireBomber, damagePiece, damageObstacle, damagePlayer,
    rollCards, applyCard, chooseCard, skipCard, CARDS, WEAPON_DEFS, DIRS, inB, render,
    showCardOverlay, hideCardOverlay, showEndOverlay, hideEndOverlay
  };
}
