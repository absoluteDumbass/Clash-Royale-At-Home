export default {
  display_name: "Crown Castle",
  cost: 9,
  color: "#876777",
  size: 45,
  type: "building",
  maxhp: 6000,
  sightrange: 80,
  attackrange: 80,
  damage: 100,
  hitspeed: 1,
  hidden: true,
  onDeath: function(g) {
    g.match.end = true;
  },
  onTick: function(game) {
       if (game.closest[0] == -1) return; 
      const closest = game.closest[0];
      const cards = game.cards;
      const objects = game.match.objects;
      const target = objects[game.objectUsing];

      // move
      const distance = Math.hypot(Math.abs(objects[closest].x - target.x), Math.abs(objects[closest].y - target.y));

      if (!(distance > cards[target.cardId].attackrange)) {
        if ((game.match.ticks % (game.match.tickRate * cards[target.cardId].hitspeed)) == 0) game.dealDamage(closest, cards[target.cardId].damage);
      }
    }
}