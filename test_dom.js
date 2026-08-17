'use strict';
/* Fake-DOM smoke test: boots game.js as a browser would, renders states and
   opens every overlay to catch runtime ReferenceErrors. */

function makeClassList() {
  const set = new Set();
  return {
    add: (...cs) => cs.forEach(c => set.add(c)),
    remove: (...cs) => cs.forEach(c => set.delete(c)),
    contains: c => set.has(c)
  };
}
function makeEl(id) {
  return {
    id,
    classList: makeClassList(),
    innerHTML: '',
    textContent: '',
    style: {},
    dataset: {},
    onclick: null,
    listeners: {},
    addEventListener(ev, fn) { this.listeners[ev] = fn; },
    appendChild() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; },
    getContext() { return makeCtx(); }
  };
}
function makeCtx() {
  return {
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    fillStyle: '',
    setTransform() {}, clearRect() {}, translate() {},
    fillRect() {}
  };
}
const els = {};
const docListeners = {};
const winListeners = {};
const idList = ['game','cardOverlay','cards','cardStats','endOverlay','endTitle','endStats','endNote','btnEndless','btnStart','btnAgain','btnSkip','startOverlay','btnInstall','itemOverlay','itemCards','itemStats','btnItemSkip','chapterList','btnPlay','modeNote','advPrev','advVal','advNext','advDesc','tutOverlay','btnTutClose'];
for (const id of idList) els[id] = makeEl(id);

global.document = {
  getElementById: id => els[id],
  createElement: () => makeEl('created'),
  querySelectorAll: () => [],
  addEventListener: (ev, fn) => { docListeners[ev] = fn; }
};
global.window = {
  innerWidth: 1200,
  innerHeight: 700,
  devicePixelRatio: 1,
  addEventListener: (ev, fn) => { winListeners[ev] = fn; }
};
global.requestAnimationFrame = () => 1;
global.performance = { now: () => Date.now() };

const G = require('./game.js');
docListeners.DOMContentLoaded();

let g = G.newGame('classic');
G.spawnFloor(g);
G.render(g);

g.hover = { x: 4, y: 3, angle: -90, sx: 121, sy: 109 };
G.render(g);

// every weapon in aim + fire visual state
for (let i = 0; i < g.weapons.length; i++) {
  g.weapon = i;
  G.render(g);
}

// obstacle mode render
const go = G.newGame('obstacle');
G.spawnFloor(go);
G.render(go);

// overlays
G.showCardOverlay(g);
G.chooseCard(g, G.rollCards()[0].id);
if (g.floor !== 2) throw new Error('chooseCard did not advance floor');
G.render(g);

const g2 = G.newGame('sniper');
G.spawnFloor(g2);
g2.over = true; g2.won = false;
G.showEndOverlay(g2);
G.hideEndOverlay();
G.showEndOverlay(Object.assign(g2, { over: false, won: true }));
G.hideEndOverlay();
G.hideCardOverlay();

console.log('fake-DOM render/overlay smoke test OK');
