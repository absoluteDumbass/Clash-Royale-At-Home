// This is the central hub for handling all physics. 
// Like to export and to ensure compatibility, and contains centrally used code

const fs = require("fs");
const cards =  fs.readdirSync(__dirname + "/cards").filter(file => file.endsWith('.js'));

let cardList = {}
for (const card of cards) {
  const cardModule = require(`./cards/${card}`); // file name includes .js
  console.log(`Loaded card: ${cardModule.display_name}`);
  cardModule.id = card.replace('.js', '');
  cardList[cardModule.id] = cardModule;
}

module.exports = cardList;