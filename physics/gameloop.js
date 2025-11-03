export default function gameloop(match, cards) {
  const game = {
    objectUsing: 0,
    match,
    global: {},
    set: function(a, b) {
      // a = property, b = value
      match.objects[this.objectUsing][a] = b;
      return b;
    },
    get: function(a, b) {
      // a = object, b = property
      if (a == "self") a = this.objectUsing;
      return match.objects[a][b];
    },
    setGlobal: function(a, b) {
      this.global[a] = b;
      return b;
    },
    getGlobal: function(a) {
      return this.global[a];
    },
    random: function(min = 0, max = 1, noise = 0) {
      // not truly random, its based on the tick.
      let seed = this.match.ticks + noise * 67 + this.objectUsing * 421; // 67 cuz why not?
      seed |= 0; // Ensure seed is a 32-bit integer
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296; // Normalize to [0, 1)
      
      return min + result * (max - min);
    }
  }
  for (let i = 0; i < match.objects.length; i++) {
    const target = cards[match.objects[i].id];
    game.objectUsing = i;
    if ("onTick" in target) target.onTick(game);
    cards[match.objects[i].id] = target;
  }
  game.match.ticks++;
  return game.match;
}