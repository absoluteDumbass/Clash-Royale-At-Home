export default {
  display_name: "Knight",
  cost: 3,
  color: "#999999",
  size: 1.3,
  onTick: function(game) {
    game.set("x", game.get("self", "x") + 1);
  }
}