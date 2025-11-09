export default {
  display_name: "Crown Tower",
  cost: 9,
  color: "#AA9799",
  size: 35,
  type: "building",
  maxhp: 4000,
  sightrange: 60,
  attackrange: 60,
  damage: 100,
  hitspeed: 1,
  hidden: true,
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