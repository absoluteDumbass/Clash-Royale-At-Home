export default {
  display_name: "Knight",
  maxhp: 1500,
  cost: 3,
  color: "#999999",
  size: 13,
  hitspeed: 1.2,
  onTick: function(g) {
    g.move(g.random(-1, 1), g.random(-1, 1))
  }
}