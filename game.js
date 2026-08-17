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

/* ------------------------------------------------------ bilingual (zh) text */
const CN_NUM = ['零','一','二','三','四','五','六','七','八','九'];
const MODE_ZH = { classic:'经典', musou:'无双', obstacle:'障碍', sniper:'狙击', endless:'无尽', xiangqi:'象棋' };
const WEAPON_ZH = {
  shotgun:'霰弹枪', choke:'集束霰弹', warbow:'弓箭',
  flamer:'火焰喷射器', bomber:'投弹手', sniper:'狙击枪'
};
const WEAPON_ZH_SHORT = {
  shotgun:'霰弹', choke:'集束', warbow:'弓箭',
  flamer:'喷火', bomber:'投弹', sniper:'狙击'
};
const PT_ZH = { pawn:'兵', knight:'马', bishop:'象', rook:'车', queen:'后', king:'王' };
const EXTRAS_ZH = {
  BLAST:'爆裂', BURN:'灼烧', VAMP:'吸血', THORN:'荆棘', SCOPE:'瞄准', CRIT:'暴击',
  FASTLOAD:'速装', FIRST:'先手', DOUBLE:'双发', SAVE:'保命', SHIELD:'护盾',
  AURA:'光环', DECREE:'王令', TIME:'裂隙', SLUG:'独头'
};
function extrasZh(e) {
  if (e.indexOf('PIERCE') === 0) return '穿透';
  if (e.indexOf('ARMOR') === 0) return '护甲';
  return EXTRAS_ZH[e] || '';
}

/* 中国象棋规则（第二章）判定：章节 2 即为象棋，模式（经典/无双/障碍/狙击）
   在两种规则下都可用 */
function isXQ(g) { return g.chapter === 2; }
function isSHOGI(g) { return g.chapter === 3; }

/* ------------------------------------------------------------ shogi (ch.3) */
const SHOGI_CHAR = { king:'王', rook:'飛', bishop:'角', gold:'金', silver:'銀', knight:'桂', lance:'香', pawn:'歩' };
const SHOGI_CHAR_BLACK = { king:'王', rook:'飛', bishop:'角', gold:'金', silver:'銀', knight:'桂', lance:'香', pawn:'歩' };
/* 成金：进入黑方半场（y>=4）后升级 */
const SHOGI_PROMO = { pawn:'gold', lance:'gold', knight:'gold', silver:'gold', bishop:'dragonHorse', rook:'dragonKing' };
const SHOGI_DROP_POOL = ['pawn', 'lance', 'silver', 'gold'];
const HAND_MAX = 3;                        // 我方持驹栏上限

/* ------------------------------------------------------------- endless loop */
/* 循环模式（无尽）：每 10 层为一个循环。
   - 循环 1（1-10 层）正常递增；
   - 循环 2（11-20 层）：11 层按 5 层基础出怪，逐层增强，15 层达到 10 层
     最大出怪并持续到 20 层；
   - 之后每个新循环都从 5 层基础重新开始、同样在循环第 5 层达最大；
   - 每完成一个 10 层循环，所有敌人生命值 +1（cycleBonus）；
   - 我方被动（卡牌）每层照常叠加。 */
function spawnBase(g) {
  if (!g.endless) return g.floor;
  if (g.floor <= 10) return g.floor;
  const pos = ((g.floor - 1) % 10) + 1;              // 循环内位置 1..10
  if (pos === 1) return 5;                            // 新循环从 5 层基础开始
  return Math.min(10, Math.round(5 + (pos - 1) * 1.25)); // 第 5 位（15/25/...）达 10
}
function cycleBonus(g) {
  return g.endless ? Math.floor((g.floor - 1) / 10) : 0;   // 每完成一个 10 层 +1
}

/* 主线章节：爬塔战斗是主线，当前为第一章（经典塔），第二章为中国象棋，
   后续章节锁定 */
const CHAPTERS = [
  { id: 1, en: 'THE BLACK THRONE', zh: '第一章 · 王座之路', sub: '经典塔 · 共 10 层', unlocked: true },
  { id: 2, en: 'ACROSS THE RIVER', zh: '第二章 · 楚河汉界', sub: '中国象棋 · 共 10 层', unlocked: true },
  { id: 3, en: 'HEIAN CAPITAL', zh: '第三章 · 平安京', sub: '将棋 · 共 10 层', unlocked: true },
];

/* ---------------------------------------------------------- xiangqi (ch.2) */
const XQ_CHAR = { king:'帅', advisor:'仕', bishop:'相', knight:'马', rook:'车', cannon:'炮', pawn:'兵' };
const XQ_CHAR_BLACK = { king:'将', advisor:'士', bishop:'象', knight:'马', rook:'車', cannon:'砲', pawn:'卒' };
const ELITE_SUBTYPES = ['rook', 'cannon', 'knight', 'bishop', 'pawn'];

/* 第一章白方棋子辨识度：差异化强调色 + 底座铭牌字母 */
const PIECE_ACCENT = {
  pawn:'#8d93a8', knight:'#7cc0ff', bishop:'#c77cf0',
  rook:'#ff9a4d', queen:'#ffd75e', king:'#d84a4a'
};
const PIECE_LETTER = { pawn:'P', knight:'N', bishop:'B', rook:'R', queen:'Q', king:'K' };

/* 主动道具：以撒式多次复用 + 充能；3/6/9 层结束可选取/替换 */
const ITEMS = [
  { id:'bomb',    en:'BIG BOMB',    zh:'大炸弹',   desc:'以自身为中心 3×3 爆炸，伤害 3', maxCharge:4 },
  { id:'freeze',  en:'FREEZE TIME', zh:'时间冻结', desc:'敌方下一回合无法行动',         maxCharge:3 },
  { id:'barrage', en:'BARRAGE',     zh:'八向齐射', desc:'向 8 个方向各射一发',          maxCharge:4 },
  { id:'heal',    en:'CROWN HEAL',  zh:'王冠治疗', desc:'立即恢复 2 点王冠',            maxCharge:3 },
  { id:'purge',   en:'ROYAL PURGE', zh:'御前肃清', desc:'随机消灭一名非将非精英敌人',   maxCharge:5 },
];
function itemById(id) { return ITEMS.find(i => i.id === id); }

/* ------------------------------------------------------------ ascension */
/* 进阶难度（全局叠加）：选高级囊括所有低级；补偿按等级段解锁：
   等级 ≥3 补偿① 龙行 · ≥6 补偿② 龙胆 · ≥9 补偿③ 龙怒 */
const ADVANCES = [
  { id: 0,  zh: '无',        en: 'NONE',            desc: '默认难度' },
  { id: 1,  zh: 'I 穷兵黩武', en: 'WAR OF EXHAUSTION', desc: '战斗开始时，额外生成一个"兵"单位' },
  { id: 2,  zh: 'II 精兵良将', en: 'ELITE TROOPS',     desc: '战斗开始时，随机 2 个敌人血量 +2（带标记）' },
  { id: 3,  zh: 'III 底火不良', en: 'DAMP POWDER',     desc: '战斗开始时，霰弹枪当前弹药 -1' },
  { id: 4,  zh: 'IV 瞄具锈蚀', en: 'RUSTY SIGHTS',     desc: '所有武器散射角 +20%' },
  { id: 5,  zh: 'V 天塌地陷', en: 'FALLING SKY',       desc: '战斗开始时，随机生成一个不可摧毁的障碍' },
  { id: 6,  zh: 'VI 背水一战', en: 'LAST STAND',       desc: '所有敌人血量 +1' },
  { id: 7,  zh: 'VII 君权谁授', en: 'USURPED THRONE', desc: '王冠上限 -1' },
  { id: 8,  zh: 'VIII 执牛耳者', en: 'IRON GENERAL',   desc: '白王（红帅）血量 +2' },
  { id: 9,  zh: 'IX 一触即发', en: 'HAIR TRIGGER',     desc: '所有武器射程 -1' },
  { id: 10, zh: 'X 逐鹿中原', en: 'TWO KINGS',         desc: '额外增加一个白王，需击杀所有白王' },
];
function advanceBonusText(n) {
  const out = [];
  if (n >= 3) out.push('补偿① 龙行：自身首次移动免费');
  if (n >= 6) out.push('补偿② 龙胆：自身首次击杀后王冠 +1');
  if (n >= 9) out.push('补偿③ 龙怒：每层首次攻击造成伤害 +1');
  return out.join(' ｜ ');
}

/* 中文使用正常系统字体（黑体优先、宋体兜底）直接绘制，清晰可读；
   英文保持像素艺术字体。字号按 scale 缩放（1 = 9px）。离屏 canvas 不可用
   （Node 测试环境）时安全降级为只画英文。 */
const CJK_FONT_PX = 9;
const CJK_FONT_FAMILY = '"Microsoft YaHei","PingFang SC","SimHei","Heiti SC","SimSun","WenQuanYi Micro Hei","Noto Sans CJK SC",sans-serif';

function drawTextCJK(c, text, x, y, color, scale) {
  scale = scale || 1;
  const size = Math.round(CJK_FONT_PX * scale);
  c.fillStyle = color;
  try {
    c.font = size + 'px ' + CJK_FONT_FAMILY;
    c.textBaseline = 'top';
    c.textAlign = 'left';
    c.fillText(String(text), Math.round(x), Math.round(y));
  } catch (e) { /* 测试环境无 fillText：静默降级 */ }
  return String(text).length * size;
}

/* 英文（像素字体）+ 中文（正常字体）同行绘制，底部对齐；返回绘制宽度 */
function drawBilingual(c, en, zh, x, y, enCol, zhCol, enScale, zhScale) {
  enScale = enScale || 1; zhScale = zhScale || 1;
  let cx = x + drawText(c, en, x, y, enCol, enScale);
  if (zh) {
    cx += 4;
    drawTextCJK(c, zh, cx, y + enScale * 5 - CJK_FONT_PX * zhScale, zhCol || '#8d93a8', zhScale);
    cx += zh.length * CJK_FONT_PX * zhScale;
  }
  return cx - x;
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

function newGame(modeId, chapter, advance) {
  modeId = modeId || 'classic';
  if (modeId === 'xiangqi') { modeId = 'classic'; chapter = chapter || 2; }   // 兼容旧调用
  const g = {
    modeId,
    chapter: chapter || 1,           // 主线章节：1 = 国际象棋，2 = 中国象棋
    advance: advance || 0,           // 进阶难度（全局叠加 0-10）
    musou: modeId === 'musou',
    obstacleMode: modeId === 'obstacle',
    remnants: [],                  // 残躯栏（最多 2）：击杀掉落，一次性黑棋行进（第 1/2 章）
    hand: [],                      // 持驹栏（最多 3）：第三章将棋打入（我方）
    enemyHand: 0,                  // 敌方持驹计数（第三章：吃掉我方棋子后打入）
    dropMode: null,                // 打入瞄准模式 { slot }
    slabs: [],                     // 第二章：石板路地块（黑王/红帅移动距离 +1）
    activeItem: null,              // 主动道具 { id, charge }（以撒式充能复用）
    relicMode: null,               // 残躯瞄准模式 { type, slot }
    relicGhost: null,              // 残躯行进幽灵动画
    frozen: false,                 // 时间冻结：敌方跳过一回合
    dragonMoveUsed: false,         // 补偿① 龙行：首次移动免费（全局）
    dragonKillUsed: false,         // 补偿② 龙胆：首次击杀 +1 王冠（全局）
    dragonAtkUsed: false,          // 补偿③ 龙怒：每层首次攻击 +1 伤害
    bonusDmg: 0,                   // 龙怒本层首次攻击的伤害加成
    itemRowY: -1,                  // 面板热区（点击使用道具/残躯）
    relicRowY: -1,
    handRowY: -1,                  // 面板热区（第三章持驹打入）
    floor: 1,
    turn: 0,
    actionNo: 0,
    kills: 0,
    score: 0,
    phase: 'player',
    over: false,
    won: false,
    endless: modeId === 'endless',     // 无尽模式 = 独立模式：从 1 层起按循环规则无限爬
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
    pieces: [],    obstacles: [],
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
  // 进阶 VII 君权谁授：王冠上限 -1
  if (g.advance >= 7) {
    g.player.maxHp = Math.max(1, g.player.maxHp - 1);
    g.player.hp = Math.min(g.player.hp, g.player.maxHp);
  }
  return g;
}
function activeWeapon(g) { return g.weapons[g.weapon]; }

/* -------------------------------------------------------------- board utils */
function pieceAt(g, x, y) {
  for (const p of g.pieces) {
    if (p.x === x && p.y === y) return p;
    // 精英棋子：落点在交叉线（格点），占据以其为中心的 2×2 格子
    if (p.e && x >= p.x - 1 && x <= p.x && y >= p.y - 1 && y <= p.y) return p;
  }
  return null;
}
function obstacleAt(g, x, y) {
  for (const o of g.obstacles) if (o.x === x && o.y === y) return o;
  return null;
}
function blockedAt(g, x, y) { return pieceAt(g, x, y) || obstacleAt(g, x, y); }
function whiteKing(g) { return g.pieces.find(p => p.type === 'king'); }
function pieceValue(type) {
  return { pawn:1, knight:3, bishop:3, rook:5, queen:9, king:20, cannon:4, advisor:2, elite:15,
           lance:2, silver:3, gold:4, dragonHorse:7, dragonKing:8 }[type] || 1;
}
function baseHp(type) {
  return { pawn:1, knight:2, bishop:2, rook:3, queen:4, king:1, cannon:2, advisor:2, elite:4,
           lance:2, silver:2, gold:3, dragonHorse:4, dragonKing:5 }[type] || 1;
}
function baseDmg(type) {
  return { pawn:1, knight:2, bishop:2, rook:2, queen:3, king:1, cannon:2, advisor:1, elite:2,
           lance:1, silver:2, gold:2, dragonHorse:2, dragonKing:2 }[type] || 1;
}
function hpScale(f) { return 1 + Math.floor((f - 1) / 4); }
function enemyHp(type, f) { return baseHp(type) * hpScale(f); }
function enemyDmg(type, f) { return baseDmg(type) + (f >= 6 ? 1 : 0); }

function msg(g, text, zh) {
  g.log.push({ text, zh, turn: g.turn, t: now() });
  if (g.log.length > 30) g.log.shift();
}

/* ------------------------------------------------------------ floor spawning */
function spawnPiece(g, type, x, y, opts) {
  const o = opts || {};
  const f = spawnBase(g);                    // 循环模式下按循环难度基础层出怪
  const cb = cycleBonus(g);                  // 每完成一个 10 层循环敌人 +1 生命
  const p = {
    id: nextPieceId++,
    type, x, y,
    hp: o.hp != null ? o.hp : enemyHp(type, f) + cb,
    maxHp: o.hp != null ? o.hp : enemyHp(type, f) + cb,
    dmg: o.dmg != null ? o.dmg : enemyDmg(type, f),
    boss: !!o.boss,
    e: !!o.e,                      // 精英棋子：占 2×2 格、位于交叉点
    subtype: o.subtype,
    burned: false,
    slowed: false,
    moving: null
  };
  if (g.advance >= 6) { p.hp += 1; p.maxHp += 1; }   // 进阶 VI 背水一战：所有敌人血量 +1
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
  const f = spawnBase(g);                 // 循环模式按难度基础层
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

/* 进阶难度开局效果：I 额外兵 / II 标记 +2 血 / III 霰弹 -1 弹 / V 不可摧毁障碍 */
function applyAdvanceSpawns(g) {
  // I 穷兵黩武：战斗开始时额外生成一个"兵"
  if (g.advance >= 1) {
    const rows = isXQ(g) ? [2, 3] : [0, 1, 2, 3];
    const cells = emptyCellsIn(g, rows);
    if (cells.length) { const c = cells.pop(); spawnPiece(g, 'pawn', c.x, c.y); }
  }
  // II 精兵良将：随机 2 个敌人血量 +2（带红色标记）
  if (g.advance >= 2) {
    const targets = shuffle(g.pieces.filter(p => p.type !== 'king' && !p.e));
    for (let i = 0; i < 2 && i < targets.length; i++) {
      targets[i].hp += 2; targets[i].maxHp += 2; targets[i].marked = true;
    }
  }
  // III 底火不良：霰弹枪当前弹药 -1
  if (g.advance >= 3 && !g.musou) {
    const sg = g.weapons.find(w => w.id === 'shotgun');
    if (sg) sg.ammo = Math.max(0, sg.ammo - 1);
  }
  // V 天塌地陷：随机生成一个不可摧毁的障碍（避开玩家邻格）
  if (g.advance >= 5) {
    const cells = [];
    for (let y = 1; y <= 6; y++) {
      for (let x = 0; x < 8; x++) {
        if (!blockedAt(g, x, y) && cheb({ x, y }, g.player) > 1) cells.push({ x, y });
      }
    }
    shuffle(cells);
    if (cells.length) {
      const c = cells[0];
      g.obstacles.push({ x: c.x, y: c.y, hp: 999, maxHp: 999, unbreakable: true });
    }
  }
}

function spawnFloor(g) {
  const f = g.floor;
  const effF = spawnBase(g);              // 循环模式：按循环内难度基础层出怪
  const cb = cycleBonus(g);
  g.pieces = [];
  g.obstacles = [];
  g.floorCleared = false;
  g.player.x = 4; g.player.y = 7; g.player.moving = null;
  g.insuranceUsed = false;
  g.freeMoveUsed = false;
  g.dragonAtkUsed = false;                // 龙怒：每层首次攻击重置
  g.bonusDmg = 0;
  g.flashes = [];
  g.floats = [];
  g.tracers = [];
  g.bomb = null;

  if (isXQ(g)) { spawnXiangqiFloor(g); return; }
  if (isSHOGI(g)) { spawnShogiFloor(g); return; }

  if (g.stats.shieldPerFloor) g.shield = Math.min(2, g.shield + 1);

  let kingHp = effF === 10 ? 12 : 2 + Math.floor((effF - 1) / 2);
  kingHp += cb;                            // 每完成一个 10 层循环敌人 +1 生命
  kingHp += (g.advance >= 8 ? 2 : 0);      // 进阶 VIII 执牛耳者：白王血量 +2
  // 进阶 X 逐鹿中原：双白王（需击杀所有白王）
  const nKings = g.advance >= 10 ? 2 : 1;
  for (let i = 0; i < nKings; i++) {
    let kx, ky, tries = 0;
    do { kx = ri(0, 7); ky = ri(0, 1); tries++; } while (blockedAt(g, kx, ky) && tries < 40);
    spawnPiece(g, 'king', kx, ky, { hp: kingHp, dmg: 1 });
  }

  const pool = ['pawn'];
  if (effF >= 2) pool.push('knight');
  if (effF >= 3) pool.push('bishop');
  if (effF >= 4) pool.push('rook');
  if (effF >= 6) pool.push('queen');
  let count = Math.min(9, Math.floor(2 + effF * 0.75 + (effF >= 4 ? 1 : 0) + (effF >= 7 ? 1 : 0)));
  const hasBoss = effF >= 5 && effF % 5 === 0;
  if (hasBoss) count = Math.max(3, count - 2);
  if (effF === 10) count = 6;

  const typeWeight = () => {
    const w = {};
    for (const t of pool) {
      if (t === 'pawn') w[t] = Math.max(1, 6 - effF);
      else if (t === 'knight') w[t] = 3;
      else if (t === 'bishop') w[t] = 2;
      else if (t === 'rook') w[t] = effF >= 5 ? 2 : 1;
      else if (t === 'queen') w[t] = effF >= 8 ? 2 : 1;
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

  // 白方棋子只允许在己方半场（y 0-3）开局，绝不越过中场线进入黑方半场
  const rows = [0, 1, 2, 3];
  const cells = emptyCellsIn(g, rows);
  for (let i = 0; i < count && cells.length > 0; i++) {
    const c = cells.pop();
    spawnPiece(g, pickType(), c.x, c.y);
  }

  if (hasBoss) {
    const btype = effF === 10 ? 'queen' : (effF % 10 === 5 ? 'rook' : 'queen');
    const boss = spawnPiece(g, btype, ri(2, 5), 0, { boss: true, hp: 9 + effF + cb, dmg: 3 });
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
      msg(g, 'ROYAL DECREE: A WHITE PIECE DESERTED!', '御前王令：一名白棋叛逃');
    }
  }

  applyAdvanceSpawns(g);

  const kingMsg = g.advance >= 10 ? 'KILL BOTH WHITE KINGS' : 'KILL THE WHITE KING';
  msg(g, 'FLOOR ' + f + ' - ' + kingMsg, '第 ' + f + ' 层 · ' + (g.advance >= 10 ? '击杀双白王' : '击杀白王'));
  g.phase = 'player';
}

/* --------------------------------------------------- xiangqi floor (ch.2) */
/* 与国际象棋同款的随机生成：每层随机数量、类型随楼层解锁加权；
   兵只在兵行线（y 2..3）、仕/帅限九宫、其余在上半场；精英扫描空位，
   保证 2×2 覆盖区不与任何棋子重叠。 */
function spawnXiangqiFloor(g) {
  const f = g.floor;
  const effF = spawnBase(g);              // 循环模式：按循环内难度基础层出怪
  const cb = cycleBonus(g);
  g.pieces = [];
  g.obstacles = [];
  g.floorCleared = false;
  g.player.x = 4; g.player.y = 7; g.player.moving = null;
  g.insuranceUsed = false;
  g.freeMoveUsed = false;
  g.dragonAtkUsed = false;                // 龙怒：每层首次攻击重置
  g.bonusDmg = 0;
  g.flashes = [];
  g.floats = [];
  g.tracers = [];
  g.bomb = null;

  if (g.stats.shieldPerFloor) g.shield = Math.min(2, g.shield + 1);

  let kingHp = effF === 10 ? 12 : 2 + Math.floor((effF - 1) / 2);
  kingHp += cb;                            // 每完成一个 10 层循环敌人 +1 生命
  kingHp += (g.advance >= 8 ? 2 : 0);      // 进阶 VIII 执牛耳者：红帅血量 +2

  const pool = ['pawn', 'advisor', 'bishop', 'knight'];
  if (effF >= 2) pool.push('cannon');
  if (effF >= 3) pool.push('rook');
  let count = Math.min(9, Math.floor(2 + effF * 0.75 + (effF >= 4 ? 1 : 0) + (effF >= 7 ? 1 : 0)));
  const hasBoss = effF >= 5 && effF % 5 === 0;
  if (hasBoss) count = Math.max(3, count - 2);
  if (effF === 10) count = 6;

  const typeWeight = () => {
    const w = {};
    for (const t of pool) {
      if (t === 'pawn') w[t] = Math.max(1, 5 - effF);
      else if (t === 'advisor') w[t] = 2;
      else if (t === 'bishop') w[t] = 2;
      else if (t === 'knight') w[t] = 3;
      else if (t === 'cannon') w[t] = 2;
      else if (t === 'rook') w[t] = effF >= 5 ? 2 : 1;
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
  // 按类型的可用生成格：兵在兵行线；仕在九宫；其余上半场
  const cellsFor = (t) => {
    const cells = [];
    if (t === 'pawn') {
      for (const y of [2, 3]) for (let x = 0; x < 8; x++) if (!blockedAt(g, x, y)) cells.push({ x, y });
    } else if (t === 'advisor' || t === 'king') {
      for (let y = 0; y <= 2; y++) for (let x = 3; x <= 5; x++) if (!blockedAt(g, x, y)) cells.push({ x, y });
    } else {
      for (const y of [0, 1, 2, 3]) for (let x = 0; x < 8; x++) if (!blockedAt(g, x, y)) cells.push({ x, y });
    }
    return shuffle(cells);
  };

  // 进阶 X 逐鹿中原：双帅（九宫内两个不同位置，需击杀所有帅）
  const nKings = g.advance >= 10 ? 2 : 1;
  const palace = shuffle(cellsFor('king'));
  for (let i = 0; i < nKings && palace.length > 0; i++) {
    const c = palace.pop();
    spawnPiece(g, 'king', c.x, c.y, { hp: kingHp, dmg: 1 });
  }

  for (let i = 0; i < count; i++) {
    const t = pickType();
    const cells = cellsFor(t);
    if (!cells.length) continue;
    const c = cells.pop();
    spawnPiece(g, t, c.x, c.y);
  }

  if (hasBoss) {
    // Boss 层：额外一只大将（大车），上半场空位
    const cells = cellsFor('rook');
    if (cells.length) {
      const c = cells.pop();
      spawnPiece(g, 'rook', c.x, c.y, { boss: true, hp: 9 + effF + cb, dmg: 3 });
    }
  }

  // 障碍模式：随机可破坏砖墙（在精英之前生成，精英扫描时自动避让）
  if (g.obstacleMode) spawnObstacles(g);

  // 精英棋子：交叉点（格点）上的 2×2 单位。扫描上半场格点，覆盖区必须
  // 完全为空（不与其他棋子重叠），随机取一个；无解则退而求其次（跨河线），
  // 再不行就不生成（保证永不重叠）。
  const subtype = ELITE_SUBTYPES[ri(0, ELITE_SUBTYPES.length - 1)];
  const ehp = 3 + effF + (effF >= 5 ? 2 : 0) + cb;
  // 精英落点在交叉线（格点），占据以其为中心的 2×2：扫描格点 1..7，
  // 覆盖区（gx-1..gx × gy-1..gy）必须完全为空（不与其他棋子重叠）
  const findEliteSpot = (maxEy) => {
    const cands = [];
    for (let ey = 1; ey <= maxEy; ey++) {
      for (let ex = 1; ex <= 7; ex++) {
        let ok = true;
        for (let dy = 0; dy <= 1 && ok; dy++) {
          for (let dx = 0; dx <= 1; dx++) {
            if (!inB(ex - 1 + dx, ey - 1 + dy) || blockedAt(g, ex - 1 + dx, ey - 1 + dy)) { ok = false; break; }
          }
        }
        if (ok) cands.push({ ex, ey });
      }
    }
    return cands;
  };
  let spots = findEliteSpot(3);                     // 优先纯上半场（覆盖 y 0..3）
  if (!spots.length) spots = findEliteSpot(4);      // 兜底：可跨河线
  if (spots.length) {
    const s = spots[ri(0, spots.length - 1)];
    const e = spawnPiece(g, 'elite', s.ex, s.ey, { hp: ehp, dmg: 2, boss: true });
    e.e = true; e.subtype = subtype;
  }

  if (g.stats.decree) {
    const targets = g.pieces.filter(p => p.type !== 'king' && !p.e);
    if (targets.length) {
      const t = targets[ri(0, targets.length - 1)];
      killPiece(g, t, 'decree', true);
      msg(g, 'ROYAL DECREE: A RED PIECE DESERTED!', '御前王令：一名红棋叛逃');
    }
  }

  applyAdvanceSpawns(g);

  // 石板路（紫禁深宫机制）：黑王与红帅站在石板上时，一次移动距离 +1
  g.slabs = [];
  const slabN = 3 + Math.floor(effF / 3);
  for (let i = 0; i < slabN; i++) {
    const cells = [];
    for (let y = 1; y <= 6; y++) {
      for (let x = 0; x < 8; x++) {
        if (!blockedAt(g, x, y) && cheb({ x, y }, g.player) > 1 && !(x === g.player.x && y === g.player.y)) cells.push({ x, y });
      }
    }
    if (!cells.length) break;
    const c = cells[ri(0, cells.length - 1)];
    g.slabs.push({ x: c.x, y: c.y });
  }

  const kingMsg = g.advance >= 10 ? 'KILL BOTH RED GENERALS' : 'KILL THE RED GENERAL';
  msg(g, 'FLOOR ' + f + ' - ' + kingMsg, '第 ' + f + ' 层 · ' + (g.advance >= 10 ? '击杀双帅' : '击杀红帅'));
  g.phase = 'player';
}

/* ------------------------------------------------------- shogi floor (ch.3) */
/* 将棋（平安京）：红方按将棋规则逼近（歩/香/桂/銀/金/角/飛/王），进入黑方
   半场自动成金；随机樱花树（可摧毁）；击杀王将通关。玩家可打入持驹，红方
   也会打入。 */
function spawnShogiFloor(g) {
  const f = g.floor;
  const effF = spawnBase(g);
  const cb = cycleBonus(g);
  g.pieces = [];
  g.obstacles = [];
  g.slabs = [];
  g.floorCleared = false;
  g.player.x = 4; g.player.y = 7; g.player.moving = null;
  g.insuranceUsed = false;
  g.freeMoveUsed = false;
  g.dragonAtkUsed = false;
  g.bonusDmg = 0;
  g.flashes = [];
  g.floats = [];
  g.tracers = [];
  g.bomb = null;

  if (g.stats.shieldPerFloor) g.shield = Math.min(2, g.shield + 1);

  let kingHp = effF === 10 ? 12 : 2 + Math.floor((effF - 1) / 2);
  kingHp += cb;
  kingHp += (g.advance >= 8 ? 2 : 0);
  const nKings = g.advance >= 10 ? 2 : 1;
  for (let i = 0; i < nKings; i++) {
    let kx, ky, tries = 0;
    do { kx = ri(0, 7); ky = ri(0, 2); tries++; } while (blockedAt(g, kx, ky) && tries < 40);
    spawnPiece(g, 'king', kx, ky, { hp: kingHp, dmg: 1 });
  }

  const pool = ['pawn', 'lance', 'knight', 'silver', 'gold'];
  if (effF >= 2) pool.push('bishop');
  if (effF >= 3) pool.push('rook');
  let count = Math.min(9, Math.floor(2 + effF * 0.75 + (effF >= 4 ? 1 : 0) + (effF >= 7 ? 1 : 0)));
  const hasBoss = effF >= 5 && effF % 5 === 0;
  if (hasBoss) count = Math.max(3, count - 2);
  if (effF === 10) count = 6;

  const typeWeight = () => {
    const w = {};
    for (const t of pool) {
      if (t === 'pawn') w[t] = Math.max(1, 5 - effF);
      else if (t === 'lance') w[t] = 2;
      else if (t === 'knight') w[t] = 2;
      else if (t === 'silver') w[t] = 3;
      else if (t === 'gold') w[t] = 3;
      else if (t === 'bishop') w[t] = 2;
      else if (t === 'rook') w[t] = effF >= 5 ? 2 : 1;
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
  const cellsFor = (t) => {
    const cells = [];
    if (t === 'pawn') {   // 步兵初始在第三段（兵行线）
      for (const y of [2, 3]) for (let x = 0; x < 8; x++) if (!blockedAt(g, x, y)) cells.push({ x, y });
    } else {
      for (const y of [0, 1, 2, 3]) for (let x = 0; x < 8; x++) if (!blockedAt(g, x, y)) cells.push({ x, y });
    }
    return shuffle(cells);
  };

  for (let i = 0; i < count; i++) {
    const t = pickType();
    const cells = cellsFor(t);
    if (!cells.length) continue;
    const c = cells.pop();
    spawnPiece(g, t, c.x, c.y);
  }

  if (hasBoss) {
    const cells = cellsFor('gold');
    if (cells.length) {
      const c = cells.pop();
      spawnPiece(g, 'gold', c.x, c.y, { boss: true, hp: 9 + effF + cb, dmg: 3 });
    }
  }

  if (g.obstacleMode) spawnObstacles(g);

  // 樱花树：随机 3~6 棵（可摧毁，贴图与箱子不同）
  const sakuraN = Math.min(6, 3 + Math.floor(effF / 2));
  for (let i = 0; i < sakuraN; i++) {
    const cells = [];
    for (let y = 1; y <= 6; y++) {
      for (let x = 0; x < 8; x++) {
        if (!blockedAt(g, x, y) && cheb({ x, y }, g.player) > 1) cells.push({ x, y });
      }
    }
    if (!cells.length) break;
    const c = cells[ri(0, cells.length - 1)];
    const hp = 2;
    g.obstacles.push({ x: c.x, y: c.y, hp, maxHp: hp, sakura: true });
  }

  if (g.stats.decree) {
    const targets = g.pieces.filter(p => p.type !== 'king' && !p.boss);
    if (targets.length) {
      const t = targets[ri(0, targets.length - 1)];
      killPiece(g, t, 'decree', true);
      msg(g, 'ROYAL DECREE: A PIECE DESERTED!', '御前王令：一名棋子叛逃');
    }
  }

  applyAdvanceSpawns(g);

  const kingMsg = g.advance >= 10 ? 'KILL BOTH SHOGI KINGS' : 'KILL THE SHOGI KING';
  msg(g, 'FLOOR ' + f + ' - ' + kingMsg, '第 ' + f + ' 层 · ' + (g.advance >= 10 ? '击杀双王将' : '击杀王将'));
  g.phase = 'player';
}

/* 我方棋子（第三章打入的持驹）：静态防御单位，阻挡敌方并会被敌方吃掉 */
function spawnAlly(g, type, x, y) {
  const p = {
    id: nextPieceId++,
    type, x, y,
    hp: 1, maxHp: 1, dmg: 0,
    boss: false, e: false, subtype: null,
    friendly: true, promoted: false,
    protected: true,               // 吸引回合保护期：不会被敌人吃掉
    burned: false, slowed: false, moving: null
  };
  g.pieces.push(p);
  return p;
}

/* ------------------------------------------------------------ legality & AI */
function onSlab(g, x, y) {
  if (!g.slabs) return false;
  return g.slabs.some(s => s.x === x && s.y === y);
}

function legalPlayerMoves(g) {
  const out = [];
  for (const [dx, dy] of DIRS) {
    const x = g.player.x + dx, y = g.player.y + dy;
    if (!inB(x, y)) continue;
    if (blockedAt(g, x, y)) continue;
    out.push({ x, y });
  }
  // 第二章石板路：黑王站在石板上时一次可走 2 格（直线，中间必须为空）
  if (isXQ(g) && onSlab(g, g.player.x, g.player.y)) {
    for (const [dx, dy] of DIRS) {
      const mx = g.player.x + dx, my = g.player.y + dy;
      const x2 = g.player.x + dx * 2, y2 = g.player.y + dy * 2;
      if (!inB(x2, y2)) continue;
      if (blockedAt(g, mx, my)) continue;
      if (blockedAt(g, x2, y2)) continue;
      out.push({ x: x2, y: y2 });
    }
  }
  return out;
}

/* 敌方合法走法核心：vacating = 本回合要离开的棋子格（可被其他白棋进入），
   decided = 已定下落的棋子格（对其他白棋封闭）。公开版 legalEnemyMoves 即
   空集合版本，语义与原实现完全一致。 */
function legalEnemyMovesCore(g, p, vacating, decided) {
  const moves = [];
  const P = g.player;
  const key = (x, y) => x + ',' + y;
  const blocked = (x, y) => {
    const k = key(x, y);
    if (decided.has(k)) return true;
    if (vacating.has(k)) return false;
    return blockedAt(g, x, y);
  };
  const push = (x, y) => {
    if (!inB(x, y)) return;
    if (x === P.x && y === P.y) {
      if (p.type !== 'king') moves.push({ x, y, capture: true });
      return;
    }
    const pc = pieceAt(g, x, y);
    if (pc && pc.friendly && !pc.protected) { moves.push({ x, y, capture: true, ally: pc }); return; }   // 第三章：吃我方棋子
    if (!blocked(x, y)) moves.push({ x, y, capture: false });
  };
  const slide = (dirs) => {
    for (const [dx, dy] of dirs) {
      let x = p.x + dx, y = p.y + dy;
      while (inB(x, y)) {
        if (x === P.x && y === P.y) {
          if (p.type !== 'king') moves.push({ x, y, capture: true });
          break;
        }
        const pc = pieceAt(g, x, y);
        if (pc && pc.friendly && !pc.protected) { moves.push({ x, y, capture: true, ally: pc }); break; }
        if (blocked(x, y)) break;
        moves.push({ x, y, capture: false });
        x += dx; y += dy;
      }
    }
  };
  // 第三章将棋：成金后按升级类型行动
  const effType = (isSHOGI(g) && p.promoted) ? (SHOGI_PROMO[p.type] || p.type) : p.type;
  // 歩/香/桂/銀 成金 → 金将走法（提前统一处理）
  if (isSHOGI(g) && p.promoted && effType === 'gold') {
    for (const [dx, dy] of [[0,1],[1,1],[-1,1],[1,0],[-1,0],[0,-1]]) push(p.x + dx, p.y + dy);
    return moves;
  }

  switch (p.type) {
    case 'pawn': {
      if (isSHOGI(g)) {
        // 歩：向前一格（可吃玩家/我方棋子）
        const y1 = p.y + 1;
        if (inB(p.x, y1)) {
          if (P.x === p.x && P.y === y1) { moves.push({ x: p.x, y: y1, capture: true }); break; }
          const pc = pieceAt(g, p.x, y1);
          if (pc && pc.friendly && !pc.protected) { moves.push({ x: p.x, y: y1, capture: true, ally: pc }); break; }
          if (!blocked(p.x, y1)) moves.push({ x: p.x, y: y1, capture: false });
        }
        break;
      }
      if (isXQ(g)) {
        // 兵：向前一步；过河（y>=4）后可横走；不能后退
        const y1 = p.y + 1;
        const fwdBlocked = (inB(p.x, y1) && blocked(p.x, y1)) || (P.x === p.x && P.y === y1);
        if (inB(p.x, y1) && !fwdBlocked) moves.push({ x: p.x, y: y1, capture: false });
        if (p.y >= 4) {
          for (const dx of [-1, 1]) {
            const lx = p.x + dx;
            if (!inB(lx, p.y)) continue;
            if (lx === P.x && p.y === P.y) { moves.push({ x: lx, y: p.y, capture: true }); continue; }
            if (!blocked(lx, p.y)) moves.push({ x: lx, y: p.y, capture: false });
          }
        }
        break;
      }
      const y1 = p.y + 1;
      const fwdBlocked = (inB(p.x, y1) && blocked(p.x, y1)) || (P.x === p.x && P.y === y1);
      if (inB(p.x, y1) && !fwdBlocked) moves.push({ x: p.x, y: y1, capture: false });
      if (p.y <= 1 && !fwdBlocked && !(blocked(p.x, p.y + 2) || (P.x === p.x && P.y === p.y + 2))) {
        moves.push({ x: p.x, y: p.y + 2, capture: false });
      }
      for (const dx of [-1, 1]) {
        if (inB(p.x + dx, p.y + 1) && P.x === p.x + dx && P.y === p.y + 1) {
          moves.push({ x: P.x, y: P.y, capture: true });
        }
      }
      break;
    }
    case 'lance': {
      // 香车：向前直线任意（可吃玩家/我方棋子）
      for (let y = p.y + 1; y < 8; y++) {
        if (P.x === p.x && P.y === y) { moves.push({ x: p.x, y, capture: true }); break; }
        const pc = pieceAt(g, p.x, y);
        if (pc && pc.friendly && !pc.protected) { moves.push({ x: p.x, y, capture: true, ally: pc }); break; }
        if (blocked(p.x, y)) break;
        moves.push({ x: p.x, y, capture: false });
      }
      break;
    }
    case 'knight': {
      if (isSHOGI(g)) {
        // 桂马：向前跳（x±1, y+2），可越子
        for (const dx of [-1, 1]) push(p.x + dx, p.y + 2);
        break;
      }
      if (isXQ(g)) {
        // 马：日字走，蹩马腿
        for (const [dx, dy] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) {
          const lx = p.x + dx, ly = p.y + dy;
          if (!inB(lx, ly)) continue;
          const legX = Math.abs(dx) === 2 ? p.x + dx / 2 : p.x;
          const legY = Math.abs(dy) === 2 ? p.y + dy / 2 : p.y;
          if (blocked(legX, legY) || (legX === P.x && legY === P.y)) continue;
          push(lx, ly);
        }
        break;
      }
      for (const [dx, dy] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) push(p.x + dx, p.y + dy);
      break;
    }
    case 'silver': {
      // 银将：前/前斜/后斜
      for (const [dx, dy] of [[0,1],[1,1],[-1,1],[1,-1],[-1,-1]]) push(p.x + dx, p.y + dy);
      break;
    }
    case 'gold': {
      // 金将：前/前斜×2/横×2/后（不能斜后）
      for (const [dx, dy] of [[0,1],[1,1],[-1,1],[1,0],[-1,0],[0,-1]]) push(p.x + dx, p.y + dy);
      break;
    }
    case 'bishop': {
      if (isSHOGI(g)) {
        slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
        if (effType === 'dragonHorse') {
          // 龙马：角行 + 王步
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) push(p.x + dx, p.y + dy);
        }
        break;
      }
      if (isXQ(g)) {
        // 相：田字走，塞象眼，不过河（红方上半场 y<=3）
        for (const [dx, dy] of [[2,2],[2,-2],[-2,2],[-2,-2]]) {
          const lx = p.x + dx, ly = p.y + dy;
          if (!inB(lx, ly) || ly > 3) continue;
          const ex = p.x + dx / 2, ey = p.y + dy / 2;
          if (blocked(ex, ey) || (ex === P.x && ey === P.y)) continue;
          push(lx, ly);
        }
        break;
      }
      slide([[1,1],[1,-1],[-1,1],[-1,-1]]); break;
    }
    case 'cannon': {
      // 炮：直线移动（路径全空）；吃子须隔一个炮架
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        let x = p.x + dx, y = p.y + dy, seen = false;
        while (inB(x, y)) {
          const t = blocked(x, y);
          if (!seen) {
            if (x === P.x && y === P.y) break;          // 不能停在玩家格
            if (t) seen = true;
            else moves.push({ x, y, capture: false });
          } else {
            if (x === P.x && y === P.y) { moves.push({ x, y, capture: true, remote: true }); break; }
            break;                                       // 第二子（红棋）不可吃
          }
          x += dx; y += dy;
        }
      }
      break;
    }
    case 'advisor': {
      // 仕：九宫内斜走一格（红方九宫 x 3..5, y 0..2）
      for (const [dx, dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const lx = p.x + dx, ly = p.y + dy;
        if (lx < 3 || lx > 5 || ly < 0 || ly > 2) continue;
        push(lx, ly);
      }
      break;
    }
    case 'rook': {
      if (isSHOGI(g)) {
        slide([[1,0],[-1,0],[0,1],[0,-1]]);
        if (effType === 'dragonKing') {
          // 龙王：飞车 + 王步
          for (const [dx, dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]) push(p.x + dx, p.y + dy);
        }
        break;
      }
      slide([[1,0],[-1,0],[0,1],[0,-1]]); break;
    }
    case 'queen':  slide([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]); break;
    case 'king': {
      if (isSHOGI(g)) {
        // 王将：8 方向 1 格（不攻击玩家，可吃我方棋子）
        for (const [dx, dy] of DIRS) {
          const x = p.x + dx, y = p.y + dy;
          if (!inB(x, y)) continue;
          if (x === P.x && y === P.y) continue;
          const pc = pieceAt(g, x, y);
          if (pc && pc.friendly && !pc.protected) { moves.push({ x, y, capture: true, ally: pc }); continue; }
          if (!blocked(x, y)) moves.push({ x, y, capture: false });
        }
        break;
      }
      if (isXQ(g)) {
        // 将：九宫内直走一格（红方九宫 x 3..5, y 0..2）
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const x = p.x + dx, y = p.y + dy;
          if (x < 3 || x > 5 || y < 0 || y > 2) continue;
          if (x === P.x && y === P.y) continue;
          if (!blocked(x, y)) moves.push({ x, y, capture: false });
        }
        // 石板路：红帅站在石板上一次可走 2 格（九宫内直线，中间必须为空）
        if (onSlab(g, p.x, p.y)) {
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const mx = p.x + dx, my = p.y + dy;
            const x2 = p.x + dx * 2, y2 = p.y + dy * 2;
            if (x2 < 3 || x2 > 5 || y2 < 0 || y2 > 2) continue;
            if (blocked(mx, my)) continue;
            if (blocked(x2, y2)) continue;
            moves.push({ x: x2, y: y2, capture: false });
          }
        }
        break;
      }
      for (const [dx, dy] of DIRS) {
        const x = p.x + dx, y = p.y + dy;
        if (!inB(x, y)) continue;
        if (x === P.x && y === P.y) continue;
        if (!blocked(x, y)) moves.push({ x, y, capture: false });
      }
      break;
    }
  }
  return moves;
}

function legalEnemyMoves(g, p) {
  return legalEnemyMovesCore(g, p, new Set(), new Set());
}

function pickEnemyMoveFrom(g, p, moves) {
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
  // 第三章打入棋是诱饵：离打入棋比离玩家更近的敌人，尽量靠近打入棋
  let target = g.player;
  if (isSHOGI(g)) {
    let bestAlly = null, bestD = Infinity;
    for (const a of g.pieces) {
      if (!a.friendly) continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < bestD) { bestD = d; bestAlly = a; }
    }
    if (bestAlly && cheb(bestAlly, p) < cheb(g.player, p)) target = bestAlly;
  }
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    const score = m.capture ? 10000 : -cheb(m, target) * 10 + Math.random() * 3;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

function pickEnemyMove(g, p) {
  return pickEnemyMoveFrom(g, p, legalEnemyMoves(g, p));
}

/* --------------------------------------------------------- elite piece */
/* 精英棋子位于交叉线（格点）上，占据 2×2 格子，按中国象棋规则在点线上
   移动；攻击范围扩大：覆盖 4 格，覆盖到玩家即造成伤害，精英炮可隔山远程
   攻击玩家。 */
function playerInElite(g, e) {
  // 精英占据以格点为中心的 2×2：玩家在其落点一圈格子内即被攻击
  return g.player.x >= e.x - 1 && g.player.x <= e.x && g.player.y >= e.y - 1 && g.player.y <= e.y;
}
function eliteAreaHas(g, e, gx, gy, includePlayer) {
  // 格点 (gx,gy) 的 2×2 覆盖区（gx-1..gx × gy-1..gy）是否含阻挡，自身重叠除外
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = 0; dx <= 1; dx++) {
      const cx = gx - 1 + dx, cy = gy - 1 + dy;
      if (!inB(cx, cy)) return true;
      if (cx >= e.x - 1 && cx <= e.x && cy >= e.y - 1 && cy <= e.y) continue;
      if (pieceAt(g, cx, cy)) return true;
      if (obstacleAt(g, cx, cy)) return true;
      if (includePlayer && g.player.x === cx && g.player.y === cy) return true;
    }
  }
  return false;
}
function eliteCoverClear(g, e, gx, gy) {
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = 0; dx <= 1; dx++) {
      const cx = gx - 1 + dx, cy = gy - 1 + dy;
      if (!inB(cx, cy)) return false;
      if (cx >= e.x - 1 && cx <= e.x && cy >= e.y - 1 && cy <= e.y) continue;
      if (pieceAt(g, cx, cy)) return false;
      if (obstacleAt(g, cx, cy)) return false;
    }
  }
  return true;
}
function eliteMoves(g, e) {
  const out = [];
  const add = (gx, gy) => {
    if (gx < 1 || gx > 7 || gy < 1 || gy > 7) return;   // 2×2 必须完整在棋盘内
    if (!eliteCoverClear(g, e, gx, gy)) return;
    out.push({ ex: gx, ey: gy, capture: playerInElite(g, { x: gx, y: gy }), remote: false });
  };
  const s = e.subtype;
  if (s === 'rook' || s === 'cannon') {
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      let gx = e.x + dx, gy = e.y + dy, seen = false;
      while (gx >= 1 && gx <= 7 && gy >= 1 && gy <= 7) {
        const capPlayer = playerInElite(g, { x: gx, y: gy });
        if (s === 'rook') {
          if (capPlayer) { out.push({ ex: gx, ey: gy, capture: true, remote: false }); break; }
          if (eliteAreaHas(g, e, gx, gy, false)) break;      // 车遇阻停
          if (eliteCoverClear(g, e, gx, gy)) out.push({ ex: gx, ey: gy, capture: false, remote: false });
        } else {
          if (!seen) {
            if (capPlayer) { out.push({ ex: gx, ey: gy, capture: true, remote: false }); break; }  // 直接覆盖玩家
            if (eliteAreaHas(g, e, gx, gy, false)) { seen = true; gx += dx; gy += dy; continue; }   // 炮架
            if (eliteCoverClear(g, e, gx, gy)) out.push({ ex: gx, ey: gy, capture: false, remote: false });
          } else {
            if (capPlayer) { out.push({ ex: gx, ey: gy, capture: true, remote: true }); }           // 隔山打
            break;
          }
        }
        gx += dx; gy += dy;
      }
    }
  } else if (s === 'knight') {
    for (const [dx, dy] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) {
      const gx = e.x + dx, gy = e.y + dy;
      if (gx < 1 || gx > 7 || gy < 1 || gy > 7) continue;
      const legX = Math.abs(dx) === 2 ? e.x + dx / 2 : e.x;
      const legY = Math.abs(dy) === 2 ? e.y + dy / 2 : e.y;
      if (eliteAreaHas(g, e, legX, legY, false)) continue;   // 蹩马腿
      add(gx, gy);
    }
  } else if (s === 'bishop') {
    for (const [dx, dy] of [[2,2],[2,-2],[-2,2],[-2,-2]]) {
      const gx = e.x + dx, gy = e.y + dy;
      if (gx < 1 || gx > 7 || gy < 1 || gy > 7 || gy > 3) continue;  // 相不过河（覆盖 y<=3）
      const ex = e.x + dx / 2, ey = e.y + dy / 2;
      if (eliteAreaHas(g, e, ex, ey, false)) continue;              // 塞象眼
      add(gx, gy);
    }
  } else if (s === 'pawn') {
    add(e.x, e.y + 1);                            // 前进
    if (e.y >= 4) { for (const dx of [-1, 1]) add(e.x + dx, e.y); } // 过河（覆盖跨河界）后横走
  }
  return out;
}
function elitePickMove(g, e) {
  const moves = eliteMoves(g, e);
  if (!moves.length) return null;
  let best = null, bestScore = -Infinity;
  const P = g.player;
  for (const m of moves) {
    const score = m.capture ? 10000 + Math.random() * 2
      : -Math.hypot(m.ex - (P.x + 0.5), m.ey - (P.y + 0.5)) * 10 + Math.random() * 3;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

function threatMap(g) {
  const map = [];
  for (let y = 0; y < 8; y++) map.push(new Array(8).fill(false));
  for (const p of g.pieces) {
    if (p.e) {
      // 精英：落点一圈格子（2×2）都是威胁
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const cx = p.x - 1 + dx, cy = p.y - 1 + dy;
          if (inB(cx, cy)) map[cy][cx] = true;
        }
      }
      continue;
    }
    if (p.type === 'king') continue;
    for (const m of legalEnemyMoves(g, p)) {
      if (!m.capture) map[m.y][m.x] = true;
    }
  }
  return map;
}

/* ------------------------------------------------------------- damage & kill */
function spawnFloat(g, x, y, text, color, zh) {
  g.floats.push({ x, y, text, zh, color, t0: now(), life: 900 });
}
function addShake(g, n) { g.shake = Math.min(6, g.shake + n); }

/* 打入棋走法射程（引爆范围 = 射程 ×2） */
const SHOGI_RANGE = { pawn:1, lance:7, knight:2, silver:1, gold:1, bishop:7, rook:7, king:1 };

/* 引爆打入棋：范围伤害 = 该棋子走法射程 ×2（切比雪夫方形，截断到棋盘） */
function allyBoom(g, piece) {
  const r = Math.min(7, (SHOGI_RANGE[piece.type] || 1) * 2);
  addShake(g, 5);
  g.flashes.push({ x: piece.x, y: piece.y, r: 1, t0: now(), life: 320, color: '#7cc0ff' });
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = piece.x + dx, y = piece.y + dy;
      if (!inB(x, y)) continue;
      g.flashes.push({ x, y, r: 1, t0: now(), life: 280, color: 'rgba(124,192,255,0.5)' });
      const pc = pieceAt(g, x, y);
      if (pc && !pc.friendly) damagePiece(g, pc, 2, 'blast');
      const ob = obstacleAt(g, x, y);
      if (ob) damageObstacle(g, ob, 2);
    }
  }
  spawnFloat(g, piece.x, piece.y, 'DETONATE!', '#7cc0ff', '引爆！');
  msg(g, 'YOU DETONATE YOUR PIECE!', '你引爆了打入棋！');
  if (typeof sfx === 'function') sfx('bomb');
}

function killPiece(g, piece, src, silent) {
  const i = g.pieces.indexOf(piece);
  if (i < 0) return;
  if (piece.friendly) {
    // 击杀（射击）己方打入棋 = 引爆：范围伤害，不计击杀收益
    g.pieces.splice(i, 1);
    allyBoom(g, piece);
    return;
  }
  g.pieces.splice(i, 1);
  g.kills++;
  g.score += pieceValue(piece.type) * 10;
  spawnFloat(g, piece.x, piece.y, 'KILL', '#ffd75e', '击杀');
  if (!silent) msg(g, piece.type.toUpperCase() + ' FALLS!', (PT_ZH[piece.type] || '') + ' 阵亡');
  // 补偿② 龙胆：首次击杀后王冠 +1
  if (g.advance >= 6 && !g.dragonKillUsed) {
    g.dragonKillUsed = true;
    if (g.player.hp < g.player.maxHp) {
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + 1);
      spawnFloat(g, g.player.x, g.player.y, 'DRAGON +1', '#ffd75e', '龙胆 +1');
    }
  }
  if (src !== 'decree' && src !== 'remnant') {
    if (isSHOGI(g)) {
      // 第三章：击杀获得持驹（打入用），代替残躯
      if (!piece.friendly && g.hand.length < HAND_MAX) {
        g.hand.push({ type: piece.type });
        spawnFloat(g, g.player.x, g.player.y, '+HAND', '#7cc0ff', '持驹 +1');
      }
    } else {
      // 残躯掉落：对应棋子类型（精英掉落其子类型），栏位最多 2
      const rt = piece.e ? piece.subtype : piece.type;
      if (g.remnants.length < 2) {
        g.remnants.push({ type: rt });
        spawnFloat(g, g.player.x, g.player.y, '+RELIC', '#7cc0ff', '残躯 +1');
      }
    }
    // 主动道具充能：击杀 +1，精英 +2
    if (g.activeItem) {
      g.activeItem.charge = Math.min(itemById(g.activeItem.id).maxCharge, g.activeItem.charge + (piece.e ? 2 : 1));
    }
    if (g.stats.lifesteal && g.player.hp < g.player.maxHp) {
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + 1);
      spawnFloat(g, g.player.x, g.player.y, '+1 HP', '#62c86a', '+1 生命');
    }
    if (g.stats.bountyChance > 0 && Math.random() < g.stats.bountyChance && g.player.hp < g.player.maxHp) {
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + 1);
      spawnFloat(g, g.player.x, g.player.y, 'BOUNTY +1', '#62c86a', '悬赏 +1');
    }
    if (g.stats.scavengeChance > 0 && Math.random() < g.stats.scavengeChance) {
      const w = activeWeapon(g);
      if (!g.musou && w.ammo < w.maxAmmo) {
        w.ammo++;
        spawnFloat(g, piece.x, piece.y, '+1 SHELL', '#ffd75e', '+1 弹药');
      }
    }
  }
  if (piece.type === 'king') {
    // 进阶 X 逐鹿中原：双王需全部击杀才通关
    if (!g.pieces.some(p => p.type === 'king')) {
      g.floorCleared = true;
      msg(g, 'THE WHITE KING IS DEAD!', '白王已死！');
    } else {
      msg(g, 'A WHITE KING FALLS - ONE REMAINS!', '一名白王阵亡——还剩一名！');
    }
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
  if (ob.unbreakable) {
    // 进阶 V 天塌地陷：不可摧毁的障碍
    spawnFloat(g, ob.x, ob.y, 'IMMUNE', '#8d93a8', '坚不可摧');
    return;
  }
  ob.hp -= dmg;
  spawnFloat(g, ob.x, ob.y, '-' + dmg, '#c9a36a');
  addShake(g, 1);
  if (ob.hp <= 0) {
    const i = g.obstacles.indexOf(ob);
    if (i >= 0) g.obstacles.splice(i, 1);
    g.score += 5;
    spawnFloat(g, ob.x, ob.y, 'WALL DOWN', '#ffd75e', '墙体崩塌');
    msg(g, 'A WALL CRUMBLES!', '墙体崩塌！');
  }
}

function explodeAt(g, x, y, origin) {
  g.flashes.push({ x, y, r: 1, t0: now(), life: 260, color: '#ffb347' });
  for (const p of [...g.pieces]) {
    if (p === origin || p.friendly) continue;   // 不误伤己方棋子
    if (p.e) {
      // 精英：爆炸 3×3 与其落点一圈（2×2 覆盖）相交即命中
      if (p.x - 1 <= x + 1 && p.x >= x - 1 && p.y - 1 <= y + 1 && p.y >= y - 1) damagePiece(g, p, 1, 'blast');
      continue;
    }
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
    if (p.friendly) continue;   // 不误伤己方棋子
    if (p.e) {
      if (p.x - 1 <= x + 1 && p.x >= x - 1 && p.y - 1 <= y + 1 && p.y >= y - 1) {
        const killed = damagePiece(g, p, dmg, 'blast');
        if (!killed && g.stats.burn) p.burned = true;
      }
      continue;
    }
    if (Math.abs(p.x - x) > 1 || Math.abs(p.y - y) > 1) continue;
    let d = dmg;
    if (g.stats.headshot && Math.random() < 0.2) { d *= 2; spawnFloat(g, p.x, p.y, 'CRIT!', '#ffd75e', '暴击！'); }
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
    spawnFloat(g, g.player.x, g.player.y, 'SHIELD!', '#7cc0ff', '护盾！');
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
      spawnFloat(g, g.player.x, g.player.y, 'ROYAL INSURANCE!', '#ffd75e', '皇家保险！');
      msg(g, 'INSURANCE SAVES THE CROWN!', '皇家保险保住了王冠！');
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
  msg(g, 'THE BLACK KING HAS FALLEN.', '黑王陨落');
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
      if (pc.e) break;                       // 精英是 2×2 大目标，挡住射线
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
  if (w.type === 'sniper') range = w.range;                                     // sniper: infinite
  else if (w.type === 'bomber') range = Math.max(1, w.range - (g.advance >= 9 ? 1 : 0));   // 进阶 IX 射程 -1
  else {
    range = Math.min(10, w.range + (s.range - 3));
    if (g.advance >= 9) range = Math.max(1, range - 1);                         // 进阶 IX 一触即发
  }
  let cone = w.cone;
  if (g.advance >= 4 && cone > 0) cone = Math.round(cone * 1.2);                // 进阶 IV 瞄具锈蚀 +20%
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
    if (g.advance >= 4) cone = Math.round(cone * 1.2);
  } else if (w.type === 'sniper') {
    if (s.slug) dmg += 2;
    dmg += pelletBonus;
    pierce = w.pierce + s.pierce;
  } else { // flame & bomber
    if (s.slug) dmg += 2;
    dmg += pelletBonus;
  }
  if (s.focus && (w.type === 'flame' || w.type === 'bomber')) dmg += 1;
  dmg += (g.bonusDmg || 0);                                                      // 补偿③ 龙怒：每层首次攻击 +1
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
        spawnFloat(g, h.pc.x, h.pc.y, 'CRIT!', '#ffd75e', '暴击！');
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
    // 精英中心在交叉点（格点），普通棋子中心在格心
    const px = p.e ? p.x : p.x + 0.5;
    const py = p.e ? p.y : p.y + 0.5;
    const dx = px - cx, dy = py - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > eff.range + 0.5) continue;
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    if (Math.abs(normDeg(ang - aimDeg)) > eff.cone / 2 + 1) continue;
    let dmg = eff.dmg;
    if (g.stats.explosive) dmg += 1;
    if (g.stats.headshot && Math.random() < 0.2) { dmg *= 2; spawnFloat(g, p.x, p.y, 'CRIT!', '#ffd75e', '暴击！'); }
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
  // 补偿① 龙行：自身首次移动免费（全局一次）
  const dragonMove = kind === 'move' && g.advance >= 3 && !g.dragonMoveUsed;

  if (kind === 'move') {
    const legal = legalPlayerMoves(g);
    if (legal.some(m => m.x === arg.x && m.y === arg.y)) {
      await playerMove(g, arg.x, arg.y);
      free = useFreeMove || dragonMove;
      if (useFreeMove) g.freeMoveUsed = true;
      if (dragonMove) g.dragonMoveUsed = true;
      ok = true;
      if (typeof sfx === 'function') sfx('move');
    }
  } else if (kind === 'fire') {
    const w = activeWeapon(g);
    if (!g.musou && w.ammo <= 0) { msg(g, 'NO AMMO! PRESS R TO RELOAD.', '没有弹药！按 R 装弹'); return false; }
    // 补偿③ 龙怒：每层首次攻击造成伤害 +1
    if (g.advance >= 9 && !g.dragonAtkUsed) { g.dragonAtkUsed = true; g.bonusDmg = 1; }
    else g.bonusDmg = 0;
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
    if (shots === 2) msg(g, 'DOUBLE TAP!', '双连发！');
    await wait(g, 130);
    ok = true;
  } else if (kind === 'reload') {
    const w = activeWeapon(g);
    if (g.musou) { msg(g, 'MUSOU MODE: AMMO IS INFINITE.', '无双模式：弹药无限'); return false; }
    if (w.ammo >= w.maxAmmo) { msg(g, w.name + ' ALREADY LOADED.', w.name + ' 已满载'); return false; }
    w.ammo = w.maxAmmo;
    msg(g, w.name + ' RELOADED.', w.name + ' 已装弹');
    if (typeof sfx === 'function') sfx('reload');
    free = g.stats.freeReload;
    ok = true;
  }
  if (!ok) return false;

  g.actionNo++;
  if (g.stats.timeStop && g.actionNo % 5 === 0) {
    free = true;
    msg(g, 'TIME RIFT: FREE ACTION!', '时间裂隙：免费行动！');
  }
  if (free) msg(g, 'FREE ACTION - ENEMIES FROZEN.', '免费行动——敌方冻结');

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

async function executeEnemyMove(g, p, mv) {
  if (mv.capture && mv.remote) {
    // 炮：隔山远程攻击玩家，不位移
    damagePlayer(g, p.dmg, p);
    if (typeof sfx === 'function') sfx('hurt');
    return;
  }
  if (mv.capture && mv.ally) {
    // 第三章将棋：吃掉我方打入的棋子（移入目标格），敌方获得持驹
    const ai = g.pieces.indexOf(mv.ally);
    if (ai >= 0) {
      g.pieces.splice(ai, 1);
      g.enemyHand = Math.min(4, g.enemyHand + 1);
      spawnFloat(g, mv.ally.x, mv.ally.y, 'TAKEN!', '#d84a4a', '被吃！');
      msg(g, 'RED CAPTURES YOUR PIECE!', '红方吃掉你的棋子！');
    }
    await tweenPiece(g, p, p.x, p.y, mv.x, mv.y, 80);
    p.x = mv.x; p.y = mv.y; p.moving = null;
    if (isSHOGI(g) && !p.promoted && mv.y >= 4) {
      p.promoted = true;
      spawnFloat(g, p.x, p.y, 'PROMOTE!', '#ffd75e', '成金！');
    }
    return;
  }
  if (mv.capture) {
    const ox = p.x, oy = p.y;
    await tweenPiece(g, p, p.x, p.y, g.player.x, g.player.y, 75);
    damagePlayer(g, p.dmg, p);
    if (g.over) return;
    if (g.stats.thorns && g.pieces.includes(p)) {
      const killed = damagePiece(g, p, 1, 'thorns');
      if (killed) return;
    }
    await tweenPiece(g, p, g.player.x, g.player.y, ox, oy, 65);
    p.moving = null;
  } else {
    await tweenPiece(g, p, p.x, p.y, mv.x, mv.y, 80);
    p.x = mv.x; p.y = mv.y; p.moving = null;
    if (isSHOGI(g) && !p.promoted && mv.y >= 4) {
      p.promoted = true;
      spawnFloat(g, p.x, p.y, 'PROMOTE!', '#ffd75e', '成金！');
    }
  }
}

async function enemyPhase(g) {
  g.phase = 'enemy';

  // 时间冻结：敌方整回合跳过
  if (g.frozen) {
    g.frozen = false;
    msg(g, 'TIME FROZEN - ENEMIES SKIP THEIR TURN.', '时间冻结——敌方跳过回合');
    g.turn++;
    g.phase = 'player';
    return;
  }

  // 第三章将棋：敌方打入——吃掉我方棋子后获得持驹，可放回棋盘
  if (isSHOGI(g) && g.enemyHand > 0 && Math.random() < 0.5) {
    const cells = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (!blockedAt(g, x, y) && cheb({ x, y }, g.player) > 1) cells.push({ x, y });
      }
    }
    if (cells.length) {
      const c = cells[ri(0, cells.length - 1)];
      const t = SHOGI_DROP_POOL[ri(0, SHOGI_DROP_POOL.length - 1)];
      spawnPiece(g, t, c.x, c.y);
      g.enemyHand--;
      spawnFloat(g, c.x, c.y, 'DROP!', '#ff9a4d', '打入！');
      msg(g, 'RED DROPS A PIECE!', '红方打入一枚棋子！');
    }
  }

  // 灼烧等状态结算对所有普通棋子生效（精英免疫状态）
  for (const p of [...g.pieces]) {
    if (g.over) break;
    if (!p.e && !p.friendly && p.burned) {
      p.burned = false;
      damagePiece(g, p, 1, 'burn');
    }
  }
  if (g.over) return;
  if (g.floorCleared) { g.turn++; g.phase = 'player'; return; }

  /* 普通棋子分批行动：每次从可行动棋子中随机挑选一组，组内同时移动。
     - 最多 60% 的棋子一起移动（floor(0.6n)）
     - 至少 2 个棋子一起移动（场上只剩 1 个可行动时除外）
     - 其余棋子本回合按兵不动 */
  const n = g.pieces.length;
  const eligible = g.pieces.filter(p => !p.e && !p.friendly && !p.slowed && legalEnemyMoves(g, p).length > 0);
  const maxMovers = Math.max(2, Math.floor(n * 0.6));
  let count = Math.min(maxMovers, eligible.length);
  if (count < 2) count = Math.min(2, eligible.length);
  const movers = shuffle(eligible).slice(0, count);
  for (const p of g.pieces) if (!movers.includes(p) && !p.e && !p.friendly) p.slowed = false;

  // 组内决策：按棋子类型顺序依次定案，保持与逐子行动一致的棋面语义。
  // vacated = 已定案要离开的格子（对其他棋子开放）；taken = 已定案落子的
  // 格子（对其他棋子封闭）。未定案/抓人往返的棋子原地不动，格子始终封闭。
  const vacated = new Set();
  const taken = new Set();
  const plans = [];
  const order = [...movers].sort((a, b) => typeOrder(a.type) - typeOrder(b.type));
  for (const p of order) {
    const moves = legalEnemyMovesCore(g, p, vacated, taken);
    const mv = pickEnemyMoveFrom(g, p, moves);
    if (!mv) continue;
    plans.push({ p, mv });
    if (!mv.capture) { vacated.add(p.x + ',' + p.y); taken.add(mv.x + ',' + mv.y); }
  }
  if (plans.length > 0) msg(g, plans.length + ' PIECES ADVANCE.', plans.length + ' 枚棋子推进');

  await Promise.all(plans.map(({ p, mv }) => executeEnemyMove(g, p, mv)));
  if (g.over) return;
  if (g.floorCleared) { g.turn++; g.phase = 'player'; return; }

  // 精英棋子：每回合必动（不走分批），覆盖玩家即攻击；精英炮可隔山远程
  for (const e of [...g.pieces]) {
    if (g.over || g.floorCleared) break;
    if (!e.e) continue;
    const mv = elitePickMove(g, e);
    if (!mv) continue;
    if (mv.remote) {
      damagePlayer(g, e.dmg, e);
      spawnFloat(g, e.x, e.y, 'CANON!', '#ff9a4d', '隔山炮！');
      if (g.over) break;
      continue;
    }
    await tweenPiece(g, e, e.x, e.y, mv.ex, mv.ey, 90);
    e.x = mv.ex; e.y = mv.ey; e.moving = null;
    if (playerInElite(g, e)) {
      damagePlayer(g, e.dmg, e);
      if (g.over) break;
    }
    await wait(g, 20);
  }

  if (g.over) return;
  g.turn++;
  g.phase = 'player';
  // 吸引回合结束：打入棋保护期解除（未被引爆则之后会被敌人吃掉）
  for (const p of g.pieces) if (p.friendly) p.protected = false;
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
  msg(g, 'UPGRADE: ' + card.en, '升级：' + card.zh);
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
  msg(g, 'REST AND RECOVER +1 CROWN.', '休整恢复 +1 王冠');
  g.floor++;
  spawnFloor(g);
  if (typeof hideCardOverlay === 'function') hideCardOverlay();
}

/* ------------------------------------------------------------- remnants */
/* 击杀敌人获得对应残躯（栏位 2）：一次性召唤黑色对应棋子，按对应走法行进
   一次——可吃掉路径终点上的敌人。 */
function relicMoves(g) {
  if (!g.relicMode) return [];
  const t = g.relicMode.type;
  const P = g.player;
  const out = [];
  const add = (x, y) => {
    if (!inB(x, y) || (x === P.x && y === P.y)) return;
    if (obstacleAt(g, x, y)) return;          // 障碍不可落
    out.push({ x, y });
  };
  const slideAdd = (dx, dy) => {
    let x = P.x + dx, y = P.y + dy;
    while (inB(x, y)) {
      const pc = pieceAt(g, x, y);
      if (pc) { add(x, y); break; }           // 吃子
      if (obstacleAt(g, x, y)) break;
      add(x, y);
      x += dx; y += dy;
    }
  };
  if (isXQ(g)) {
    switch (t) {
      case 'pawn': {                            // 黑卒：向前（上）；过河后可横走
        add(P.x, P.y - 1);
        if (P.y <= 3) { for (const dx of [-1, 1]) add(P.x + dx, P.y); }
        break;
      }
      case 'knight':                            // 黑马：日字 + 蹩马腿
        for (const [dx, dy] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) {
          const lx = P.x + dx, ly = P.y + dy;
          if (!inB(lx, ly)) continue;
          const legX = Math.abs(dx) === 2 ? P.x + dx / 2 : P.x;
          const legY = Math.abs(dy) === 2 ? P.y + dy / 2 : P.y;
          if (blockedAt(g, legX, legY)) continue;
          add(lx, ly);
        }
        break;
      case 'bishop':                            // 黑象：田字 + 塞象眼 + 不过河
        for (const [dx, dy] of [[2,2],[2,-2],[-2,2],[-2,-2]]) {
          const lx = P.x + dx, ly = P.y + dy;
          if (!inB(lx, ly) || ly < 4) continue;
          if (blockedAt(g, P.x + dx / 2, P.y + dy / 2)) continue;
          add(lx, ly);
        }
        break;
      case 'rook': for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) slideAdd(dx, dy); break;
      case 'cannon': {                          // 黑砲：直线移动或隔一子吃
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          let x = P.x + dx, y = P.y + dy, seen = false;
          while (inB(x, y)) {
            const b = blockedAt(g, x, y);
            if (!seen) {
              if (b) seen = true;
              else add(x, y);
            } else {
              if (pieceAt(g, x, y)) add(x, y);  // 隔子吃
              break;
            }
            x += dx; y += dy;
          }
        }
        break;
      }
      case 'advisor':                           // 黑士：九宫（x3..5, y6..8）斜走
        for (const [dx, dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
          const lx = P.x + dx, ly = P.y + dy;
          if (lx >= 3 && lx <= 5 && ly >= 6 && ly <= 8) add(lx, ly);
        }
        break;
      case 'king':                              // 黑将：九宫直走
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const lx = P.x + dx, ly = P.y + dy;
          if (lx >= 3 && lx <= 5 && ly >= 6 && ly <= 8) add(lx, ly);
        }
        break;
    }
  } else {
    switch (t) {
      case 'pawn': add(P.x, P.y - 1); break;
      case 'knight':
        for (const [dx, dy] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) add(P.x + dx, P.y + dy);
        break;
      case 'bishop': for (const [dx, dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]) slideAdd(dx, dy); break;
      case 'rook': for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) slideAdd(dx, dy); break;
      case 'queen': for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) slideAdd(dx, dy); break;
      case 'king': for (const [dx, dy] of DIRS) add(P.x + dx, P.y + dy); break;
    }
  }
  return out;
}

function useRemnantSlot(g, slot) {
  if (g.phase !== 'player' || g.over || overlayOpen()) return;
  if (g.relicMode) { g.relicMode = null; return; }   // 再次点击取消瞄准
  const r = g.remnants[slot];
  if (!r) return;
  g.relicMode = { type: r.type, slot };
  if (typeof sfx === 'function') sfx('move');
}

async function chooseRemnant(g, x, y) {
  if (!g.relicMode || g.phase !== 'player' || g.over) return;
  const moves = relicMoves(g);
  if (!moves.some(m => m.x === x && m.y === y)) { g.relicMode = null; return; }  // 非法格 = 取消
  const type = g.relicMode.type, slot = g.relicMode.slot;
  const target = pieceAt(g, x, y);
  g.relicGhost = { fx: g.player.x, fy: g.player.y, tx: x, ty: y, type, t0: now(), dur: 140 };
  await wait(g, 140);
  g.relicGhost = null;
  if (target) {
    const tname = target.e ? (XQ_CHAR[target.subtype] || '精') : (target.type === 'king' ? (isXQ(g) ? '帅' : '王') : (PT_ZH[target.type] || target.type));
    killPiece(g, target, 'remnant');
    spawnFloat(g, x, y, 'DEVOUR!', '#7cc0ff', '吞噬！');
    msg(g, 'REMNANT DEVOURS ' + target.type.toUpperCase() + '!', '残躯吞噬' + tname + '！');
    if (typeof sfx === 'function') sfx('bomb');
  }
  g.remnants.splice(slot, 1);
  g.relicMode = null;
  // 残躯行进算一次行动：推进敌方回合
  g.actionNo++;
  if (g.stats.timeStop && g.actionNo % 5 === 0) { msg(g, 'TIME RIFT: FREE ACTION!', '时间裂隙：免费行动！'); return; }
  if (g.stats.aura) {
    for (const p of [...g.pieces]) {
      if (!p.e && cheb(p, g.player) <= 1) damagePiece(g, p, 1, 'aura');
    }
  }
  if (g.floorCleared) { await endFloor(g); return; }
  g.phase = 'enemy';
  await enemyPhase(g);
  if (!g.over && g.floorCleared) await endFloor(g);
}

/* ---------------------------------------------------- shogi drop (ch.3) */
/* 我方打入：击杀将棋敌人获得持驹（栏位 3），K 键/点击面板进入放置模式，
   选空格放入己方棋子（静态防御单位，会被敌方吃掉并触发敌方打入）。 */
function useDrop(g, slot) {
  if (g.phase !== 'player' || g.over || overlayOpen()) return;
  if (g.dropMode) { g.dropMode = null; return; }      // 再次触发取消
  const h = g.hand[slot];
  if (!h) return;
  g.dropMode = { slot };
  if (typeof sfx === 'function') sfx('move');
}

async function chooseDrop(g, x, y) {
  if (!g.dropMode || g.phase !== 'player' || g.over) return;
  if (blockedAt(g, x, y)) { g.dropMode = null; return; }   // 非法格 = 取消
  const slot = g.dropMode.slot;
  const h = g.hand[slot];
  if (!h) { g.dropMode = null; return; }
  spawnAlly(g, h.type, x, y);
  spawnFloat(g, x, y, 'DROP!', '#7cc0ff', '打入！');
  msg(g, 'YOU DROP A PIECE!', '你打入一枚棋子！');
  g.hand.splice(slot, 1);
  g.dropMode = null;
  if (typeof sfx === 'function') sfx('pick');
  // 打入算一次行动：推进敌方回合
  g.actionNo++;
  if (g.stats.timeStop && g.actionNo % 5 === 0) { msg(g, 'TIME RIFT: FREE ACTION!', '时间裂隙：免费行动！'); return; }
  g.phase = 'enemy';
  await enemyPhase(g);
  if (!g.over && g.floorCleared) await endFloor(g);
}

/* ----------------------------------------------------------- active item */
function useItem(g) {
  if (!g.activeItem) {
    msg(g, 'NO ACTIVE ITEM! GET ONE AT FLOOR 3/6/9.', '还没有主动道具！3/6/9 层结束可选。');
    return;
  }
  if (g.phase !== 'player' || g.over || overlayOpen()) return;
  const it = itemById(g.activeItem.id);
  if (g.activeItem.charge < it.maxCharge) {
    msg(g, 'ITEM NOT CHARGED! (' + g.activeItem.charge + '/' + it.maxCharge + ')', '道具充能不足！');
    return;
  }
  g.activeItem.charge = 0;
  switch (it.id) {
    case 'bomb':
      explodeAtCell(g, g.player.x, g.player.y, 3);
      msg(g, 'BIG BOMB DETONATED!', '大炸弹引爆！');
      break;
    case 'freeze':
      g.frozen = true;
      msg(g, 'TIME FROZEN!', '时间冻结！');
      break;
    case 'barrage': {
      const w = activeWeapon(g);
      for (let i = 0; i < 8; i++) {
        fireRayWeapon(g, w, i * 45 - 180 + 22.5);
        if (g.floorCleared) break;
      }
      msg(g, 'BARRAGE!', '八向齐射！');
      break;
    }
    case 'heal':
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + 2);
      spawnFloat(g, g.player.x, g.player.y, '+2 HP', '#62c86a', '+2 生命');
      msg(g, 'CROWN HEALED!', '王冠恢复！');
      break;
    case 'purge': {
      const targets = g.pieces.filter(p => p.type !== 'king' && !p.e);
      if (targets.length) {
        const t = targets[ri(0, targets.length - 1)];
        killPiece(g, t, 'purge');
        msg(g, 'ROYAL PURGE STRIKES!', '御前肃清！');
      }
      break;
    }
  }
  if (typeof sfx === 'function') sfx('pick');
  if (g.floorCleared) { endFloor(g); }
}

function showItemOverlay(g) {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('itemOverlay');
  const wrap = document.getElementById('itemCards');
  const stats = document.getElementById('itemStats');
  if (!overlay || !wrap || !stats) return;
  wrap.innerHTML = '';
  stats.innerHTML = g.activeItem
    ? '当前道具 <b>' + itemById(g.activeItem.id).zh + '</b> —— 选择一张替换，或点击「保留」（战斗中按 <b>Q</b> 或点底部 <b>ITEM</b> 按钮释放）'
    : '每 3 层（3/6/9）可选取一件<b>主动道具</b>：击杀敌人充能，充满后按 <b>Q</b> 或点底部 <b>ITEM</b> 按钮释放';
  const pool = shuffle(ITEMS.slice());
  pool.slice(0, 3).forEach(it => {
    const div = document.createElement('div');
    div.className = 'card rare';
    div.innerHTML =
      '<div class="rarity">ACTIVE ITEM · 主动道具</div>' +
      '<div class="ename">' + it.en + '</div>' +
      '<div class="zhdesc"><b>' + it.zh + '</b> — ' + it.desc + '</div>' +
      '<div class="cdesc">CHARGE ' + it.maxCharge + ' · 充能 ' + it.maxCharge + '</div>';
    div.onclick = () => chooseItem(g, it.id);
    wrap.appendChild(div);
  });
  overlay.classList.remove('hidden');
}

function hideItemOverlay() {
  if (typeof document === 'undefined') return;
  const o = document.getElementById('itemOverlay');
  if (o) o.classList.add('hidden');
}

function chooseItem(g, id) {
  g.activeItem = { id, charge: 0 };
  msg(g, 'ACTIVE ITEM: ' + itemById(id).en, '主动道具：' + itemById(id).zh);
  if (typeof sfx === 'function') sfx('pick');
  hideItemOverlay();
  if (typeof showCardOverlay === 'function') showCardOverlay(g);
}

function skipItem(g) {
  hideItemOverlay();
  if (typeof showCardOverlay === 'function') showCardOverlay(g);
}

/* ------------------------------------------------------ shogi tutorial */
function showTutOverlay() {
  if (typeof document === 'undefined') return;
  const o = document.getElementById('tutOverlay');
  if (o) o.classList.remove('hidden');
}

function hideTutOverlay() {
  if (typeof document === 'undefined') return;
  const o = document.getElementById('tutOverlay');
  if (o) o.classList.add('hidden');
}

async function endFloor(g) {
  g.phase = 'floor';
  g.score += g.floor * 100;
  msg(g, 'FLOOR ' + g.floor + ' CLEARED!', '第 ' + g.floor + ' 层通关！');

  if (g.floor === 10 && !g.endless && !g.won) {
    g.won = true;
    msg(g, 'THE TOWER IS CONQUERED!', '高塔已被征服！');
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

  // 3/6/9 层结束：先选/替换主动道具，再选强化卡
  if (g.floor % 3 === 0 && typeof showItemOverlay === 'function') {
    showItemOverlay(g);
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
  const accent = white ? (PIECE_ACCENT[type] || col.accent) : col.accent;
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
    pxRect(c, px - 1, py - 6, 1, 2, accent); pxRect(c, px, py - 7, 1, 1, accent);
  }
  if (type === 'rook') {
    pxRect(c, px - 1, py - 2, 3, 1, accent); pxRect(c, px, py - 1, 1, 1, accent);
  }
  if (type === 'queen') {
    pxRect(c, px - 3, py - 6, 7, 2, col.gold);
    pxRect(c, px - 3, py - 8, 1, 2, col.gold); pxRect(c, px, py - 8, 1, 2, col.gold); pxRect(c, px + 3, py - 8, 1, 2, col.gold);
  }
  if (type === 'king') {
    pxRect(c, px - 3, py - 6, 7, 2, accent);
    pxRect(c, px - 3, py - 8, 1, 2, accent); pxRect(c, px, py - 8, 1, 2, accent); pxRect(c, px + 3, py - 8, 1, 2, accent);
    pxRect(c, px, py - 10, 1, 3, accent); pxRect(c, px - 1, py - 9, 3, 1, accent);
  }
  if (type === 'knight') {
    pxRect(c, px - 2, py - 6, 1, 1, accent); pxRect(c, px + 2, py - 6, 1, 1, accent);
  }
  // 底座铭牌：字母（P/N/B/R/Q/K）——一眼认出棋子种类
  if (white && PIECE_LETTER[type]) {
    pxRect(c, px - 4, py + 8, 9, 5, col.dark);
    pxRect(c, px - 4, py + 8, 9, 1, col.shade);
    drawText(c, PIECE_LETTER[type], px - 1, py + 8, col.main, 1);
  }
}

/* 中国象棋棋子：圆形 + 汉字（红方） */
function drawXiangqiPiece(c, type, px, py) {
  const ch = XQ_CHAR[type] || '兵';
  if (type === 'king') pxRing(c, px, py, 11, '#e8c34a');
  pxRing(c, px, py, 10, '#7a2626');
  pxCircle(c, px, py, 9, '#c94f4f');
  pxCircle(c, px, py, 7, '#b23d3d');
  drawTextCJK(c, ch, px - 4, py - 4, '#f5e9d0', 1);
}
/* 黑色（我方）中国象棋棋子：残躯幽灵用 */
function drawXiangqiPieceBlack(c, type, px, py) {
  pxRing(c, px, py, 10, '#0d0e13');
  pxCircle(c, px, py, 9, '#3a3f50');
  pxCircle(c, px, py, 7, '#2b2d3a');
  drawTextCJK(c, XQ_CHAR_BLACK[type] || '卒', px - 4, py - 4, '#e8e2cf', 1);
}
/* 精英棋子：位于交叉点（格点），占据 2×2，金色大环 + 汉字 */
/* 将棋棋子：伪梯形駒形（上宽下窄的五边形，尖端指向进攻方向）+ 汉字，
   一眼即知是将棋。红方（敌方）进攻向下 → 宽端朝上、尖端朝下；
   我方持驹为黑方（进攻向上）→ 宽端朝下、尖端朝上。整体对齐格子中心。 */
function drawKoma(c, px, py, h, wTop, wBot, col) {
  for (let r = 0; r < h; r++) {
    const t = r / (h - 1);
    let half = (wTop + (wBot - wTop) * t) / 2;
    if (r === 0 || r === h - 1) half = Math.max(1, half - 1);   // 首尾收圆角
    pxRect(c, Math.round(px - half), py + r, Math.max(1, Math.round(half * 2)), 1, col);
  }
}
function drawShogiPiece(c, type, px, py, friendly, promoted) {
  const ch = SHOGI_CHAR[type] || '歩';
  const h = 15;
  const wideTop = !friendly;                       // 红方宽端朝上；我方宽端朝下
  const wTop = wideTop ? 17 : 8;
  const wBot = wideTop ? 8 : 17;
  const dark = friendly ? '#0d0e13' : '#7a2626';
  const main = friendly ? '#3a3f50' : '#c94f4f';
  const ink = friendly ? '#e8e2cf' : '#f5e9d0';
  drawKoma(c, px, py - 8, h + 2, wTop + 2, wBot + 2, dark);     // 描边（总高 17，中心对齐）
  drawKoma(c, px, py - 7, h, wTop, wBot, main);                  // 主体（总高 15，中心对齐）
  if (type === 'king') {                                          // 王将金边
    drawKoma(c, px, py - 8, h + 2, wTop + 2, wBot + 2, '#b58a2e');
    drawKoma(c, px, py - 7, h, wTop, wBot, '#c94f4f');
  }
  drawTextCJK(c, ch, px - 4, py - 4, ink, 1);                    // 中央汉字（居中于格子中心）
  if (promoted) {                                                 // 成金金冠（宽端上方）
    pxRect(c, px - 3, py - 12, 7, 2, '#ffd75e');
    pxRect(c, px - 1, py - 13, 3, 1, '#ffd75e');
  }
}

function drawElitePiece(c, p, gx, gy) {
  pxRing(c, gx, gy, 13, '#e8c34a');
  pxRing(c, gx, gy, 11, '#8e2f2f');
  pxCircle(c, gx, gy, 10, '#c94f4f');
  pxCircle(c, gx, gy, 8, '#b23d3d');
  drawTextCJK(c, XQ_CHAR[p.subtype] || '兵', gx - 4, gy - 4, '#ffe9a8', 1);
  pxRect(c, gx + 5, gy - 14, 3, 3, '#ffd75e');   // 星标
  pxRect(c, gx + 6, gy - 15, 1, 5, '#ffd75e');
  pxRect(c, gx + 4, gy - 14, 5, 1, '#ffd75e');
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

/* 主动道具 7×7 像素图标 */
function drawItemIcon(c, id, x, y) {
  if (id === 'bomb') {
    pxCircle(c, x + 3, y + 4, 3, '#c94f4f');
    pxRect(c, x + 2, y + 1, 1, 2, '#ffd75e');
    pxRect(c, x + 3, y, 1, 1, '#ffd75e');
    pxRect(c, x + 3, y + 3, 1, 1, '#ff9a4d');
  } else if (id === 'freeze') {
    pxRect(c, x + 3, y, 1, 3, '#7cc0ff');
    pxRect(c, x + 3, y + 4, 1, 3, '#7cc0ff');
    pxRect(c, x, y + 3, 3, 1, '#7cc0ff');
    pxRect(c, x + 4, y + 3, 3, 1, '#7cc0ff');
    pxRect(c, x + 2, y + 2, 3, 3, '#bfe2ff');
  } else if (id === 'barrage') {
    pxRect(c, x + 3, y, 1, 3, '#ffd75e');
    pxRect(c, x + 2, y + 3, 3, 1, '#ffd75e');
    pxRect(c, x, y + 4, 1, 2, '#ffd75e');
    pxRect(c, x + 6, y + 4, 1, 2, '#ffd75e');
    pxRect(c, x + 3, y + 5, 1, 2, '#ffd75e');
  } else if (id === 'heal') {
    pxRect(c, x + 3, y, 1, 7, '#62c86a');
    pxRect(c, x, y + 3, 7, 1, '#62c86a');
    pxRect(c, x + 3, y + 3, 1, 1, '#8fe898');
  } else if (id === 'purge') {
    pxRect(c, x + 2, y, 3, 3, '#d8dce8');
    pxRect(c, x + 3, y + 2, 1, 2, '#d8dce8');
    pxRect(c, x + 3, y + 4, 1, 2, '#8d93a8');
    pxRect(c, x + 1, y + 6, 5, 1, '#8d93a8');
    pxRect(c, x + 4, y + 4, 1, 2, '#d84a4a');
  } else {
    pxRect(c, x, y, 7, 7, '#3a3f50');
  }
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
  const xq = isXQ(g);
  const shogi = isSHOGI(g);

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const tx = BX + x * CELL, ty = BY + y * CELL;
      const dark = (x + y) % 2 === 1;
      if (xq) {
        // 紫禁深宫：宫墙红 + 金线
        pxRect(c, tx, ty, CELL, CELL, dark ? '#7a2626' : '#8e2f2f');
        pxRect(c, tx, ty, CELL, 1, '#b58a2e');
        pxRect(c, tx, ty, 1, CELL, '#5b1f1f');
      } else if (shogi) {
        // 平安京：浅木地板
        pxRect(c, tx, ty, CELL, CELL, dark ? '#dccfa8' : '#e8dcc0');
        pxRect(c, tx, ty, CELL, 1, '#c4b48a');
        pxRect(c, tx, ty, 1, CELL, '#c4b48a');
      } else {
        pxRect(c, tx, ty, CELL, CELL, dark ? '#333847' : '#444a5e');
        pxRect(c, tx, ty, CELL, 1, '#252936');
        pxRect(c, tx, ty, 1, CELL, '#252936');
      }
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
  // 中国象棋：楚河汉界
  if (xq) {
    pxRect(c, BX, BY + 3 * CELL, CELL * 8, CELL, '#241a0e');
    pxRect(c, BX, BY + 3 * CELL, CELL * 8, 1, '#0d0a05');
    pxRect(c, BX, BY + 4 * CELL - 1, CELL * 8, 1, '#0d0a05');
    drawTextCJK(c, '楚河', BX + 10, BY + 3 * CELL + 8, 'rgba(232,195,74,0.65)', 1);
    drawTextCJK(c, '汉界', BX + CELL * 8 - 30, BY + 3 * CELL + 8, 'rgba(232,195,74,0.65)', 1);
    // 紫禁深宫：石板路（黑王/红帅在其上移动 +1）——与棋盘同色调的红砖石板
    for (const s of g.slabs || []) {
      const tx = BX + s.x * CELL, ty = BY + s.y * CELL;
      pxRect(c, tx + 2, ty + 2, CELL - 4, CELL - 4, '#9a3838');
      pxRect(c, tx + 4, ty + 4, CELL - 8, CELL - 8, '#a84040');
      pxRect(c, tx + 4, ty + 4, CELL - 8, 1, '#7a2626');
      pxRect(c, tx + 4, ty + 17, CELL - 8, 1, '#7a2626');
      pxRect(c, tx + 4, ty + 10, CELL - 8, 1, '#7a2626');
      pxRect(c, tx + 9, ty + 4, 1, 6, '#7a2626');
      pxRect(c, tx + 18, ty + 11, 1, 6, '#7a2626');
      pxRect(c, tx + 4, ty + 4, 1, 1, '#e8c34a');   // 四角金钉
      pxRect(c, tx + 22, ty + 4, 1, 1, '#e8c34a');
      pxRect(c, tx + 4, ty + 22, 1, 1, '#e8c34a');
      pxRect(c, tx + 22, ty + 22, 1, 1, '#e8c34a');
    }
    // 宫墙金线装饰
    pxRect(c, BX, BY - 4, CELL * 8, 2, '#b58a2e');
  }
  // 平安京：飘落的樱花花瓣（确定性位置）
  if (shogi) {
    const petals = [[3,1],[8,4],[14,2],[19,6],[6,5],[23,3],[12,7],[17,1],[2,6],[21,4],[9,3],[16,5]];
    for (const [px, py] of petals) {
      pxRect(c, BX + px, BY + py, 2, 1, '#f7b6c4');
      pxRect(c, BX + px + 1, BY + py + 1, 1, 1, '#e88aa0');
    }
  }
  pxRect(c, BX - 2, BY - 2, CELL * 8 + 4, 2, '#0a0c12');
  pxRect(c, BX - 2, BY + CELL * 8, CELL * 8 + 4, 2, '#0a0c12');
  pxRect(c, BX - 2, BY - 2, 2, CELL * 8 + 4, '#0a0c12');
  pxRect(c, BX + CELL * 8, BY - 2, 2, CELL * 8 + 4, '#0a0c12');

  // 精英 2×2 覆盖区高亮（金色底纹，落点一圈格子）
  if (xq) {
    for (const p of g.pieces) {
      if (!p.e) continue;
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const tx = BX + (p.x - 1 + dx) * CELL, ty = BY + (p.y - 1 + dy) * CELL;
          pxRect(c, tx, ty, CELL, CELL, 'rgba(232,195,74,0.16)');
          pxRect(c, tx + 1, ty + 1, 2, 2, 'rgba(232,195,74,0.5)');
          pxRect(c, tx + CELL - 3, ty + CELL - 3, 2, 2, 'rgba(232,195,74,0.5)');
        }
      }
    }
  }

  drawAim(g, c);

  // obstacles (destructible brick walls / indestructible steel / sakura trees)
  for (const o of g.obstacles) {
    const tx = BX + o.x * CELL, ty = BY + o.y * CELL;
    if (o.sakura) {
      // 樱花树：可摧毁（约等于贴图不同的箱子）
      pxRect(c, tx + 4, ty + 12, 4, 10, '#7a5a38');
      pxRect(c, tx + 13, ty + 14, 4, 8, '#7a5a38');
      pxRect(c, tx + 2, ty + 8, 9, 7, '#e88aa0');
      pxRect(c, tx + 10, ty + 4, 10, 8, '#f7a8b8');
      pxRect(c, tx + 4, ty + 2, 8, 6, '#f7b6c4');
      pxRect(c, tx + 16, ty + 10, 6, 6, '#e88aa0');
      pxRect(c, tx + 6, ty + 4, 2, 2, '#d86a88');
      pxRect(c, tx + 14, ty + 8, 2, 2, '#d86a88');
      pxRect(c, tx + 20, ty + 13, 2, 2, '#d86a88');
      if (o.hp < o.maxHp) {
        pxRect(c, tx + 5, ty + 8, 14, 1, '#c05878');
        pxRect(c, tx + 9, ty + 12, 8, 1, '#c05878');
      }
      continue;
    }
    if (o.unbreakable) {
      pxRect(c, tx + 2, ty + 2, CELL - 4, CELL - 4, '#2a2f3f');
      pxRect(c, tx + 3, ty + 3, CELL - 6, CELL - 6, '#4a5066');
      pxRect(c, tx + 3, ty + 3, CELL - 6, 1, '#5f6577');
      pxRect(c, tx + 3, ty + 17, CELL - 6, 1, '#5f6577');
      pxRect(c, tx + 3, ty + 8, CELL - 6, 1, '#343a4a');
      pxRect(c, tx + 8, ty + 3, 1, 6, '#5f6577');
      pxRect(c, tx + 17, ty + 10, 1, 6, '#343a4a');
      pxRect(c, tx + 10, ty + 14, 1, 6, '#343a4a');
      pxRect(c, tx + 13, ty + 3, 1, 6, '#343a4a');
      pxRect(c, tx + 5, ty + 11, 1, 6, '#343a4a');
      continue;
    }
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
    if (p.e) {
      // 精英画在交叉点（格点）上
      const gx = BX + d.x * CELL, gy = BY + d.y * CELL;
      drawElitePiece(c, p, gx, gy);
      if (p.hp < p.maxHp) {
        const w = Math.max(1, Math.round(12 * p.hp / p.maxHp));
        pxRect(c, gx - 6, gy - 19, 12, 1, '#14161c');
        pxRect(c, gx - 6, gy - 19, w, 1, '#ff9a4d');
      }
      continue;
    }
    const cc = cellCenter(d.x, d.y);
    if (shogi) drawShogiPiece(c, p.type, cc.x, cc.y, !!p.friendly, !!p.promoted);
    else if (xq) drawXiangqiPiece(c, p.type, cc.x, cc.y);
    else drawPieceSprite(c, p.type, true, cc.x, cc.y);
    if (p.friendly && p.protected) {   // 打入棋保护期（吸引回合）：蓝色光环
      pxRing(c, cc.x, cc.y, 12, 'rgba(124,192,255,0.9)');
    }
    if (p.hp < p.maxHp) {
      const w = Math.max(1, Math.round(10 * p.hp / p.maxHp));
      pxRect(c, cc.x - 5, cc.y - 12, 10, 1, '#14161c');
      pxRect(c, cc.x - 5, cc.y - 12, w, 1, p.boss ? '#ff9a4d' : '#62c86a');
    }
    if (p.boss) { pxRect(c, cc.x - 1, cc.y - 13, 1, 1, '#ff6a5a'); pxRect(c, cc.x, cc.y - 13, 1, 1, '#ff6a5a'); }
    if (p.marked) {   // 进阶 II 精兵良将：血量 +2 标记
      pxRect(c, cc.x - 3, cc.y - 15, 7, 2, '#d84a4a');
      pxRect(c, cc.x - 1, cc.y - 16, 3, 1, '#d84a4a');
    }
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

  // 残躯瞄准：高亮可达格（蓝=移动，红=吃子）
  if (g.relicMode && g.phase === 'player') {
    const moves = relicMoves(g);
    for (const m of moves) {
      const tx = BX + m.x * CELL, ty = BY + m.y * CELL;
      const target = pieceAt(g, m.x, m.y);
      if (target) {
        pxRect(c, tx, ty, CELL, CELL, 'rgba(216,74,74,0.3)');
        pxRect(c, tx + 1, ty + 1, CELL - 2, CELL - 2, 'rgba(216,74,74,0.4)');
      } else {
        pxRect(c, tx + 1, ty + 1, CELL - 2, CELL - 2, 'rgba(124,192,255,0.35)');
      }
    }
    drawText(c, 'PICK A SQUARE', BX, BY + CELL * 8 + 6, '#7cc0ff', UI_SMALL);
  }

  // 打入瞄准（第三章）：高亮所有空格
  if (g.dropMode && g.phase === 'player') {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (blockedAt(g, x, y)) continue;
        const tx = BX + x * CELL, ty = BY + y * CELL;
        pxRect(c, tx + 1, ty + 1, CELL - 2, CELL - 2, 'rgba(124,192,255,0.3)');
        pxRect(c, tx + 4, ty + 4, CELL - 8, CELL - 8, 'rgba(124,192,255,0.4)');
      }
    }
    drawText(c, 'DROP HERE (K)', BX, BY + CELL * 8 + 6, '#7cc0ff', UI_SMALL);
  }

  // 残躯幽灵：黑色对应棋子行进动画
  if (g.relicGhost) {
    const t = clamp((tNow - g.relicGhost.t0) / g.relicGhost.dur, 0, 1);
    const gx = g.relicGhost.fx + (g.relicGhost.tx - g.relicGhost.fx) * t;
    const gy = g.relicGhost.fy + (g.relicGhost.ty - g.relicGhost.fy) * t;
    const cc = cellCenter(gx, gy);
    if (isXQ(g)) drawXiangqiPieceBlack(c, g.relicGhost.type, cc.x, cc.y);
    else drawPieceSprite(c, g.relicGhost.type, false, cc.x, cc.y);
  }

  // floating text
  g.floats = g.floats.filter(f => tNow - f.t0 < f.life);
  for (const f of g.floats) {
    const k = 1 - (tNow - f.t0) / f.life;
    const cc = cellCenter(f.x, f.y);
    const enW = f.text.length * 4 * UI_BIG;
    const zhW = f.zh ? 4 + f.zh.length * CJK_FONT_PX : 0;
    const totalW = enW + zhW;
    const fy = cc.y - 14 - (1 - k) * 8;
    c.globalAlpha = Math.max(0, Math.min(1, k * 1.6));
    drawText(c, f.text, cc.x - totalW / 2, fy, f.color, UI_BIG);
    if (f.zh) drawTextCJK(c, f.zh, cc.x - totalW / 2 + enW + 4, fy + UI_BIG * 5 - CJK_FONT_PX, '#e8e2cf', 1);
    c.globalAlpha = 1;
  }

  renderPanel(g);
  renderButtons(g);
  renderTopStrip(g);
}

function renderTopStrip(g) {
  const c = ctx;
  const topY = 3;
  drawText(c, 'SHOTGUN KING', BX, topY, '#e8c34a', UI_BIG);
  const smallY = topY + (UI_BIG - UI_SMALL) * 5;
  let tx = BX;
  tx += drawBilingual(c, g.modeId === 'classic' ? 'CLASSIC' : g.modeId.toUpperCase(), MODE_ZH[g.modeId] || '', tx, smallY, '#62c86a', '#4d8f52', UI_SMALL, 1) + 6;
  const floorTxt = g.endless ? 'ENDLESS ' + g.floor : g.floor + '/10';
  tx += drawBilingual(c, floorTxt, '第' + CN_NUM[g.chapter] + '章', tx, smallY, '#8d93a8', '#6b7188', UI_SMALL, 1) + 6;
  const w = activeWeapon(g);
  const zhShort = UI_SMALL === 1 ? (WEAPON_ZH_SHORT[w.id] || '') : '';
  drawBilingual(c, w.short, zhShort, tx, smallY, '#ffd75e', '#b58a2e', UI_SMALL, 1);
  // 局内返回主菜单按钮（顶栏右侧热区）
  pxRect(c, W - 44, 3, 38, 15, '#171a24');
  pxRect(c, W - 44, 3, 38, 1, '#3a4052');
  pxRect(c, W - 44, 17, 38, 1, '#3a4052');
  pxRect(c, W - 44, 3, 1, 15, '#3a4052');
  pxRect(c, W - 7, 3, 1, 15, '#3a4052');
  drawText(c, 'MENU', W - 38, 6, '#e8c34a', UI_SMALL);
  drawTextCJK(c, '菜单', W - 38 + 4 * 4 + 4, 6 + UI_SMALL * 5 - CJK_FONT_PX, '#b58a2e', 1);
  // 第三章：将棋规则教程按钮（MENU 左侧）
  if (isSHOGI(g)) {
    pxRect(c, W - 92, 3, 44, 15, '#171a24');
    pxRect(c, W - 92, 3, 44, 1, '#3a4052');
    pxRect(c, W - 92, 17, 44, 1, '#3a4052');
    pxRect(c, W - 92, 3, 1, 15, '#3a4052');
    pxRect(c, W - 49, 3, 1, 15, '#3a4052');
    drawText(c, 'TUTOR', W - 86, 6, '#7cc0ff', UI_SMALL);
    drawTextCJK(c, '教程', W - 86 + 5 * 4 + 4, 6 + UI_SMALL * 5 - CJK_FONT_PX, '#4d8f52', 1);
  }
}

function renderPanel(g) {
  const c = ctx;
  const x = PANEL_X;
  const shogi = isSHOGI(g);
  pxRect(c, x, 0, W - x, H, '#171a24');
  pxRect(c, x, 0, 1, H, '#2a2f3f');

  const compact = UI_BIG >= 3;                       // phone layout
  const SH = UI_SMALL * 5 + (compact ? 3 : 4);       // small line advance（桌面 +1 容纳 9px 中文）
  const BH = UI_BIG * 5 + 2;                         // big line advance
  let y = 16;

  // crowns
  drawBilingual(c, 'CROWNS', '王冠', x + 6, y, '#8d93a8', '#5f6577', UI_SMALL, 1);
  for (let i = 0; i < Math.min(g.player.maxHp, 10); i++) {
    const filled = i < g.player.hp;
    drawMiniCrown(c, x + 46 + i * 7, y, filled ? '#e8c34a' : '#3a3f50');
  }
  if (g.player.maxHp > 10) drawText(c, '+' + (g.player.maxHp - 10), x + 46 + 70, y, '#8d93a8', UI_SMALL);
  y += Math.max(9, UI_SMALL * 5 + 5);

  // active weapon block
  const w = activeWeapon(g);
  const eff = effectiveWeapon(g, w);
  drawBilingual(c, w.name, WEAPON_ZH[w.id] || '', x + 6, y, '#ffd75e', '#b58a2e', UI_BIG, 1);
  y += BH;
  drawBilingual(c, 'DMG ' + eff.dmg + ' CONE ' + eff.cone, '伤害·锥角', x + 6, y, '#aeb4c8', '#8d93a8', UI_BIG, 1);
  y += BH;
  let line2 = 'RNG ' + (eff.range >= 90 ? 'INF' : eff.range);
  let zh2 = '射程·';
  if (w.type === 'spray') { line2 += ' PEL ' + eff.pellets; zh2 += '弹丸'; }
  if (w.type === 'bow') { line2 += ' PIERCE-ALL'; zh2 += '全穿透'; }
  if (w.type === 'flame') { line2 += ' AOE+BURN'; zh2 += '范围灼烧'; }
  if (w.type === 'bomber') { line2 += ' BOUNCE 3X3'; zh2 += '弹跳3×3'; }
  if (w.type === 'sniper') zh2 += '无限';
  drawBilingual(c, line2, zh2, x + 6, y, '#aeb4c8', '#8d93a8', UI_BIG, 1);
  y += BH + 1;

  // ammo
  drawBilingual(c, 'AMMO', '弹药', x + 6, y, '#8d93a8', '#5f6577', UI_SMALL, 1);
  if (g.musou) {
    drawBilingual(c, 'INFINITE', '无限', x + 44, y - 2, '#62c86a', '#4d8f52', UI_BIG, 1);
  } else {
    for (let i = 0; i < Math.min(w.maxAmmo, 12); i++) {
      drawShell(c, x + 44 + i * 7, y + (UI_SMALL - 1) * 2, i < w.ammo ? '#ffd75e' : '#3a3f50');
    }
  }
  y += SH + 3;

  // active item（主动道具：以撒式充能复用，Q 键或点击使用）
  g.itemRowY = -1;
  {
    g.itemRowY = y;
    const has = !!g.activeItem;
    const it = has ? itemById(g.activeItem.id) : null;
    const full = has && g.activeItem.charge >= it.maxCharge;
    if (has) {
      if (full) pxRect(c, x + 4, y - 1, W - x - 8, SH + 2, 'rgba(232,195,74,0.14)');
      drawItemIcon(c, it.id, x + 8, y + 1);
      let ix = x + 20;
      ix += drawBilingual(c, 'ITEM ' + it.en, it.zh, ix, y, full ? '#ffd75e' : '#8d93a8', full ? '#e8c34a' : '#5f6577', UI_SMALL, 1);
      for (let i = 0; i < it.maxCharge; i++) {
        pxRect(c, ix + 4 + i * 6, y + 2, 4, 4, i < g.activeItem.charge ? (full ? '#ffd75e' : '#b58a2e') : '#3a3f50');
      }
      drawText(c, UI_SMALL === 1 ? 'Q' : 'TAP', x + W - x - 26, y + 1, full ? '#ffd75e' : '#3a3f50', UI_SMALL);
    } else {
      drawText(c, 'ITEM', x + 6, y, '#3a3f50', UI_SMALL);
      drawTextCJK(c, '道具', x + 6 + 4 * 4 + 4, y + UI_SMALL * 5 - CJK_FONT_PX, '#2a2f3f', 1);
      drawText(c, '3/6/9F PICK', x + 6 + 60, y, '#2a2f3f', UI_SMALL);
    }
    y += SH;
  }

  // remnant bar（残躯栏：击杀掉落，T/Y 或点击使用）——常驻显示
  // 第三章为持驹栏（HAND：K 键或点击打入）
  g.relicRowY = -1;
  g.handRowY = -1;
  {
    if (shogi) {
      g.handRowY = y;
      let ix = x + 6;
      ix += drawText(c, 'HAND', ix, y, '#8d93a8', UI_SMALL);
      ix += drawTextCJK(c, '持驹', ix + 4, y + UI_SMALL * 5 - CJK_FONT_PX, '#5f6577', 1);
      ix += 4;
      for (let i = 0; i < HAND_MAX; i++) {
        const h = g.hand[i];
        pxRect(c, ix, y + 1, 11, 8, h ? '#243048' : '#14161c');
        pxRect(c, ix, y + 1, 11, 1, h ? '#7cc0ff' : '#2a2f3f');
        if (h) drawTextCJK(c, SHOGI_CHAR_BLACK[h.type] || '歩', ix + 1, y + 1, '#7cc0ff', 1);
        ix += 16;
      }
      drawText(c, UI_SMALL === 1 ? 'K' : 'TAP', x + W - x - 26, y + 1, g.hand.length ? '#7cc0ff' : '#3a3f50', UI_SMALL);
      y += SH;
    } else {
      g.relicRowY = y;
      let ix = x + 6;
      ix += drawText(c, 'RELIC', ix, y, '#8d93a8', UI_SMALL);
      ix += drawTextCJK(c, '残躯', ix + 4, y + UI_SMALL * 5 - CJK_FONT_PX, '#5f6577', 1);
      ix += 4;
      for (let i = 0; i < 2; i++) {
        const r = g.remnants[i];
        pxRect(c, ix, y + 1, 11, 8, r ? '#243048' : '#14161c');
        pxRect(c, ix, y + 1, 11, 1, r ? '#7cc0ff' : '#2a2f3f');
        if (r) {
          const ch = isXQ(g) ? (XQ_CHAR_BLACK[r.type] || '卒') : (PIECE_LETTER[r.type] || '?');
          if (isXQ(g)) drawTextCJK(c, ch, ix + 1, y + 1, '#7cc0ff', 1);
          else drawText(c, ch, ix + 2, y + 2, '#7cc0ff', UI_SMALL);
        }
        ix += 16;
      }
      drawText(c, UI_SMALL === 1 ? 'T/Y' : 'TAP', x + W - x - 26, y + 1, g.remnants.length ? '#7cc0ff' : '#3a3f50', UI_SMALL);
      y += SH;
    }
  }

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
    const seg = extras.slice(i * 4, i * 4 + 4);
    const zhExtras = UI_SMALL === 1 ? seg.map(extrasZh).filter(Boolean).join(' ') : '';
    drawBilingual(c, seg.join(' '), zhExtras, x + 6, y + i * SH, '#62c86a', '#4d8f52', UI_SMALL, 1);
  }
  y += showExtraLines * SH + 1;

  // owned cards
  drawBilingual(c, 'CARDS ' + g.cards.length, '卡牌', x + 6, y, '#8d93a8', '#5f6577', UI_SMALL, 1);
  y += SH;
  const shown = compact ? g.cards.slice(-1) : g.cards.slice(-3);
  shown.forEach((cd, i) => {
    drawBilingual(c, cd.en.slice(0, 11), cd.zh, x + 6, y + i * SH, '#aeb4c8', '#6b7188', UI_SMALL, 1);
  });
  y += shown.length * SH + 1;

  // message log
  pxRect(c, x + 4, y, W - x - 8, 1, '#2a2f3f');
  y += 3;
  const log = g.log.slice(-3);
  log.forEach((m, i) => {
    const col = i === log.length - 1 ? '#e8e2cf' : '#6b7188';
    let cx = x + 6;
    cx += drawText(c, m.text.slice(0, 16), cx, y + i * SH, col, UI_SMALL);
    if (m.zh) drawTextCJK(c, m.zh.slice(0, 12), cx + 4, y + i * SH + UI_SMALL * 5 - CJK_FONT_PX, '#5f6577', 1);
  });
  y += log.length * SH;

  // weapon loadout (only when there is room; bottom bar always shows slots)
  if (y + SH * (g.weapons.length + 1) < 244) {
    drawBilingual(c, 'LOADOUT', '武器', x + 6, y, '#8d93a8', '#5f6577', UI_SMALL, 1);
    g.weapons.forEach((wp, i) => {
      const ammoTxt = g.musou ? 'INF' : wp.ammo + '/' + wp.maxAmmo;
      drawBilingual(c, (i + 1) + ' ' + wp.short + ' ' + ammoTxt, WEAPON_ZH_SHORT[wp.id] || '', x + 6, y + (i + 1) * SH, i === g.weapon ? '#ffd75e' : '#aeb4c8', i === g.weapon ? '#b58a2e' : '#6b7188', UI_SMALL, 1);
    });
  }
}

function renderButtons(g) {
  const c = ctx;
  const y = 246, h = 22;
  const n = g.weapons.length + 2;          // 武器 + 装弹 + 主动道具（显眼入口）
  const gap = 4;
  const bw = (W - 4 - (n - 1) * gap) / n;
  // 桌面端按钮两行：英文在上、中文在下；手机端单行英文
  const ty = UI_BIG >= 3 ? y + Math.max(2, Math.floor((h - UI_BIG * 5) / 2)) : y + 2;
  g.weapons.forEach((w, i) => {
    const bx = 2 + i * (bw + gap);
    const active = i === g.weapon;
    pxRect(c, bx, y, Math.floor(bw), h, active ? '#2a2f42' : '#171a24');
    pxRect(c, bx, y, Math.floor(bw), 1, active ? '#e8c34a' : '#3a4052');
    pxRect(c, bx, y + h - 1, Math.floor(bw), 1, active ? '#e8c34a' : '#3a4052');
    pxRect(c, bx, y, 1, h, active ? '#e8c34a' : '#3a4052');
    pxRect(c, bx + Math.floor(bw) - 1, y, 1, h, active ? '#e8c34a' : '#3a4052');
    drawText(c, (i + 1) + ' ' + w.short, bx + 4, ty, active ? '#ffd75e' : '#8d93a8', UI_BIG);
    if (UI_BIG === 2) drawTextCJK(c, WEAPON_ZH_SHORT[w.id] || '', bx + 4, ty + UI_BIG * 5 + 1, active ? '#b58a2e' : '#5f6577', 1);
  });
  // reload
  const bxR = 2 + g.weapons.length * (bw + gap);
  const rDisabled = g.musou;
  pxRect(c, bxR, y, Math.floor(bw), h, rDisabled ? '#12141c' : '#171a24');
  pxRect(c, bxR, y, Math.floor(bw), 1, '#3a4052');
  pxRect(c, bxR, y + h - 1, Math.floor(bw), 1, '#3a4052');
  drawText(c, UI_BIG >= 3 ? 'LOAD' : 'R LOAD', bxR + 4, ty, rDisabled ? '#3a3f50' : '#8d93a8', UI_BIG);
  if (UI_BIG === 2) drawTextCJK(c, '装弹', bxR + 4, ty + UI_BIG * 5 + 1, rDisabled ? '#3a3f50' : '#5f6577', 1);
  // active item（主动道具按钮：充能满金色高亮，点击释放）
  const bxI = 2 + (g.weapons.length + 1) * (bw + gap);
  const it = g.activeItem ? itemById(g.activeItem.id) : null;
  const itFull = it && g.activeItem.charge >= it.maxCharge;
  pxRect(c, bxI, y, Math.floor(bw), h, it ? (itFull ? '#2a2f42' : '#171a24') : '#12141c');
  pxRect(c, bxI, y, Math.floor(bw), 1, itFull ? '#e8c34a' : '#3a4052');
  pxRect(c, bxI, y + h - 1, Math.floor(bw), 1, itFull ? '#e8c34a' : '#3a4052');
  pxRect(c, bxI, y, 1, h, itFull ? '#e8c34a' : '#3a4052');
  pxRect(c, bxI + Math.floor(bw) - 1, y, 1, h, itFull ? '#e8c34a' : '#3a4052');
  drawText(c, 'ITEM', bxI + 4, ty, itFull ? '#ffd75e' : (it ? '#8d93a8' : '#3a3f50'), UI_BIG);
  if (UI_BIG === 2) {
    if (it) {
      for (let i = 0; i < it.maxCharge; i++) {
        pxRect(c, bxI + 4 + i * 6, ty + UI_BIG * 5 + 1, 4, 4, i < g.activeItem.charge ? (itFull ? '#ffd75e' : '#b58a2e') : '#3a3f50');
      }
    } else {
      drawText(c, '3/6/9', bxI + 4, ty + UI_BIG * 5 + 1, '#3a3f50', UI_SMALL);
      drawTextCJK(c, '层', bxI + 4 + 5 * 4 + 2, ty + UI_BIG * 5 + 1 + UI_SMALL * 5 - CJK_FONT_PX, '#2a2f3f', 1);
    }
  }
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
    if (g.over) {
      title.textContent = 'THE BLACK KING FALLS · 黑王陨落';
      title.style.color = '#d84a4a';
      note.textContent = '白色棋子的攻势无穷无尽。即将返回主界面——换一套 Build 再爬一次吧！';
    } else if (g.won) {
      title.textContent = g.chapter === 2 ? 'CHAPTER 2 CLEARED · 第二章通关' : 'CHAPTER 1 CLEARED · 第一章通关';
      title.style.color = '#e8c34a';
      note.textContent = g.chapter === 2
        ? '黑王横扫楚河汉界，红帅俯首！即将返回主界面；想无限挑战？选择「无尽模式」再战！'
        : '黑王征服了第一章！即将返回主界面；想无限挑战？选择「无尽模式」再战！';
    }
    stats.innerHTML =
      '模式 <b>' + g.modeId.toUpperCase() + '</b> · 层数 <b>' + g.floor + '</b> · 击杀 <b>' + g.kills + '</b> · ' +
      '回合 <b>' + g.turn + '</b> · 卡牌 <b>' + g.cards.length + '</b> · 得分 <b>' + g.score + '</b>';
    overlay.classList.remove('hidden');
    // 输/赢都默认自动返回主界面
    clearTimeout(g.menuTimer);
    g.menuTimer = setTimeout(returnToMenu, g.over ? 3200 : 3800);
  }, g.over ? 500 : 400);
}

function hideEndOverlay() {
  if (typeof document === 'undefined') return;
  document.getElementById('endOverlay').classList.add('hidden');
}

/* 返回主界面：输/赢后默认回到章节+模式选择 */
function returnToMenu() {
  if (typeof document === 'undefined') return;
  clearTimeout(g && g.menuTimer);
  hideEndOverlay();
  if (typeof hideCardOverlay === 'function') hideCardOverlay();
  if (typeof hideItemOverlay === 'function') hideItemOverlay();
  if (typeof hideTutOverlay === 'function') hideTutOverlay();
  const start = document.getElementById('startOverlay');
  if (start) start.classList.remove('hidden');
  selChapter = null;
  selMode = null;
  selAdvance = 0;
  refreshStartState();
  if (typeof updateAdvUI === 'function') updateAdvUI();
  if (typeof sfx === 'function') sfx('move');
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
  const n = g.weapons.length + 2;
  const gap = 4;
  const bw = (W - 4 - (n - 1) * gap) / n;
  for (let i = 0; i < n; i++) {
    const bx = 2 + i * (bw + gap);
    if (sx >= bx && sx < bx + bw) {
      if (i < g.weapons.length) return 'w' + i;
      if (i === g.weapons.length) return 'reload';
      return 'item';
    }
  }
  return null;
}

function overlayOpen() {
  return document.getElementById('cardOverlay').classList.contains('hidden') === false ||
         document.getElementById('endOverlay').classList.contains('hidden') === false ||
         document.getElementById('startOverlay').classList.contains('hidden') === false ||
         (document.getElementById('itemOverlay') && document.getElementById('itemOverlay').classList.contains('hidden') === false) ||
         (document.getElementById('tutOverlay') && document.getElementById('tutOverlay').classList.contains('hidden') === false);
}

function handleCanvasClick(e) {
  if (now() < suppressClickUntil) return;         // tap that ended in a swipe already moved
  if (!g || overlayOpen()) return;
  const { sx, sy } = canvasPoint(e);
  // 顶栏 MENU：任意时刻返回主界面
  if (sx >= W - 46 && sy < 20) {
    if (typeof sfx === 'function') sfx('move');
    returnToMenu();
    return;
  }
  // 顶栏 TUTOR（第三章）：打开将棋规则教程
  if (isSHOGI(g) && sx >= W - 92 && sx < W - 48 && sy < 20) {
    showTutOverlay();
    return;
  }
  if (g.over || g.phase !== 'player') return;
  // 打入瞄准模式：点击空格放置，点击非法格取消
  if (g.dropMode) {
    const cell = boardCellFromEvent(e);
    if (cell) chooseDrop(g, cell.x, cell.y);
    else g.dropMode = null;
    return;
  }
  // 残躯瞄准模式：点击可达格执行，点击非法格取消
  if (g.relicMode) {
    const cell = boardCellFromEvent(e);
    if (cell) chooseRemnant(g, cell.x, cell.y);
    else g.relicMode = null;
    return;
  }
  // 面板热区：主动道具 / 残躯槽 / 持驹槽
  if (sx >= PANEL_X) {
    if (g.itemRowY >= 0 && sy >= g.itemRowY && sy < g.itemRowY + 8) { useItem(g); return; }
    if (g.handRowY >= 0 && sy >= g.handRowY && sy < g.handRowY + 8) { useDrop(g, sx < PANEL_X + 100 ? 0 : 1); return; }
    if (g.relicRowY >= 0 && sy >= g.relicRowY && sy < g.relicRowY + 8) {
      useRemnantSlot(g, sx < PANEL_X + 100 ? 0 : 1);
      return;
    }
    return;
  }
  const btn = buttonHit(e);
  if (btn) {
    if (btn === 'reload') playerAction(g, 'reload', 0);
    else if (btn === 'item') useItem(g);
    else g.weapon = parseInt(btn.slice(1), 10);
    return;
  }
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
  if (k === 'q') { useItem(g); return; }
  if (k === 't') { useRemnantSlot(g, 0); return; }
  if (k === 'k') { useDrop(g, 0); return; }
  if (k === 'y') { useRemnantSlot(g, 1); return; }
  const d = keyDir(k);
  if (d == null) return;
  if (g.phase !== 'player' || g.over || overlayOpen()) return;
  e.preventDefault();
  const tx = g.player.x + DIRS[d][0], ty = g.player.y + DIRS[d][1];
  if (inB(tx, ty) && !blockedAt(g, tx, ty)) playerAction(g, 'move', { x: tx, y: ty });
}

function startGame(modeId, chapter, advance) {
  g = newGame(modeId, chapter, advance);
  spawnFloor(g);
  hideEndOverlay();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('cardOverlay').classList.add('hidden');
  document.getElementById('endOverlay').classList.add('hidden');
  if (typeof hideItemOverlay === 'function') hideItemOverlay();
  // PWA / mobile: lock to landscape when the platform allows it
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (err) { /* desktop browsers: ignore */ }
}

/* ------------------------------------------------------- chapter selection */
/* 章节 + 模式 双选后才可开始：单独点章节或模式不会开局 */
let selChapter = null;
let selMode = null;
let selAdvance = 0;                    // 进阶难度（全局叠加 0-10）

function advanceDescText(n) {
  if (n <= 0) return '未开启进阶难度';
  const bonus = advanceBonusText(n);
  const parts = [];
  for (let i = 1; i <= n; i++) parts.push(ADVANCES[i].zh + '：' + ADVANCES[i].desc);
  let txt = '叠加包含 1~' + n + ' 级全部效果：' + parts.join('；') + '。';
  if (bonus) txt += '｜' + bonus + '。';
  return txt;
}

const ADV_NUM = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

function selectAdvance(n) {
  selAdvance = clamp(n, 0, 10);
  updateAdvUI();
  if (typeof sfx === 'function') sfx('pick');
}

function updateAdvUI() {
  if (typeof document === 'undefined') return;
  const val = document.getElementById('advVal');
  const desc = document.getElementById('advDesc');
  if (val) {
    val.textContent = selAdvance === 0 ? '无' : ADV_NUM[selAdvance - 1];
    val.title = ADVANCES[selAdvance].zh + '：' + ADVANCES[selAdvance].desc;
  }
  if (desc) desc.textContent = advanceDescText(selAdvance);
}

function buildAdvButtons() {
  if (typeof document === 'undefined') return;
  const prev = document.getElementById('advPrev');
  const next = document.getElementById('advNext');
  const val = document.getElementById('advVal');
  if (!prev || !next || !val) return;
  prev.addEventListener('click', () => selectAdvance(selAdvance - 1));
  next.addEventListener('click', () => selectAdvance(selAdvance + 1));
  val.addEventListener('click', () => selectAdvance(selAdvance === 0 ? 10 : 0));  // 点击数字在 无/最高 间切换
  updateAdvUI();
}

function refreshStartState() {
  if (typeof document === 'undefined') return;
  const play = document.getElementById('btnPlay');
  const modeNote = document.getElementById('modeNote');
  if (!play) return;
  const ch = selChapter != null ? CHAPTERS.find(c => c.id === selChapter) : null;
  // 规则提示：第一章国际象棋 / 第二章中国象棋 / 第三章将棋
  if (modeNote) {
    modeNote.textContent = ch
      ? (ch.id === 2 ? '第二章 · 中国象棋规则（兵/马/相/仕/车/炮/帅 + 精英）'
         : ch.id === 3 ? '第三章 · 将棋规则（歩/香/桂/銀/金/角/飛/王 + 成金/打入）'
         : '第一章 · 国际象棋规则（兵/马/象/车/后/王 + 铭牌标识）')
      : '请先选择章节';
  }
  const ready = ch && selMode != null;
  if (ready) {
    play.classList.remove('hidden');
    play.textContent = '开始：' + ch.zh + ' · ' + (MODE_ZH[selMode] || selMode) + ' ▶';
  } else {
    play.classList.add('hidden');
  }
  // 章节/模式按钮高亮
  document.querySelectorAll('#chapterList .chapter').forEach(b => {
    const id = parseInt(b.dataset.ch, 10);
    b.classList.toggle('selected', id === selChapter);
  });
  document.querySelectorAll('#modeBtns .modebtn').forEach(b => {
    b.classList.toggle('selected', b.dataset.mode === selMode);
  });
}

function selectChapter(id) {
  const ch = CHAPTERS.find(c => c.id === id);
  if (!ch) return;
  if (!ch.unlocked) {
    if (typeof document !== 'undefined') {
      const b = document.querySelector('#chapterList .chapter[data-ch="' + id + '"]');
      if (b) {
        b.classList.add('shaken');
        setTimeout(() => b.classList.remove('shaken'), 320);
      }
    }
    return;
  }
  selChapter = id;
  refreshStartState();
}

function selectMode(mode) {
  selMode = mode;
  refreshStartState();
}

function startSelected() {
  if (selChapter == null || selMode == null) return;
  startGame(selMode, selChapter, selAdvance);
}

function buildChapterList() {
  if (typeof document === 'undefined') return;
  const wrap = document.getElementById('chapterList');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const ch of CHAPTERS) {
    const b = document.createElement('button');
    b.className = 'chapter ' + (ch.unlocked ? 'open' : 'locked');
    b.dataset.ch = String(ch.id);
    b.innerHTML = '<b>' + (ch.unlocked ? '' : '🔒 ') + ch.zh + '</b><span>' + ch.en + ' · ' + ch.sub + '</span>';
    b.addEventListener('click', () => selectChapter(ch.id));
    wrap.appendChild(b);
  }
  refreshStartState();
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
      btn.addEventListener('click', () => { selectMode(btn.dataset.mode); if (typeof sfx === 'function') sfx('pick'); });
    });
    document.getElementById('btnPlay').addEventListener('click', () => { startSelected(); if (typeof sfx === 'function') sfx('pick'); });
    document.getElementById('btnAgain').addEventListener('click', returnToMenu);
    document.getElementById('btnSkip').addEventListener('click', () => { if (g) skipCard(g); });
    document.getElementById('btnItemSkip').addEventListener('click', () => { if (g) skipItem(g); });
    document.getElementById('btnTutClose').addEventListener('click', hideTutOverlay);
    buildChapterList();
    buildAdvButtons();

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
    spawnPiece, killPiece, damageObstacle,
    fireRayWeapon, fireFlame, fireBomber, damagePiece, damageObstacle, damagePlayer,
    rollCards, applyCard, chooseCard, skipCard, CARDS, WEAPON_DEFS, DIRS, inB, render,
    showCardOverlay, hideCardOverlay, showEndOverlay, hideEndOverlay, CHAPTERS, ITEMS,
    useRemnantSlot, chooseRemnant, relicMoves, useItem,
    showItemOverlay, hideItemOverlay, chooseItem, skipItem,
    spawnXiangqiFloor, eliteMoves, elitePickMove, playerInElite,
    selectChapter, selectMode, startSelected, returnToMenu, spawnBase, cycleBonus,
    selectAdvance, useDrop, chooseDrop, showTutOverlay, hideTutOverlay, spawnAlly
  };
}
