export default {
  display_name: "Arrows",
  cost: 3,
  color: "#99999955",
  size: 60,
  type: "spell",
  onTick: function(g) {
    // just die after 3 seconds
    if (g.match.ticks-g.get("tickPlaced") > 3*g.match.tickRate) g.selfDestruct();
  }
}