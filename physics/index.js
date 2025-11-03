// This is the central hub for handling all physics. 
// Like to export and to ensure compatibility, and contains centrally used code

import { readdirSync } from "fs"
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cards =  readdirSync(path.join(__dirname, "/cards")).filter(file => file.endsWith('.js'));

async function load(a) {
    try {
        const module = await import(`./cards/${a}`);
        return module.default;
    } catch (error) {
        console.error('Error loading module:', error);
      return null
    }
}

let cardsData = {}
for (const card of cards) {
  const cardModule = await load(card);
  if (!cardModule) continue;
  console.log(`Loaded card: ${card}`);
  console.log(cardModule)
  cardModule.id = card.replace('.js', '');
  cardsData[cardModule.id] = cardModule;
}

function gameloop(match, users) {
  const game = {
    objectUsing: 0,
    ...match,
    users,
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
    }
  }
  for (let i = 0; i < match.objects.length; i++) {
    const target = cardsData[match.objects[i].id];
    game.objectUsing = i;
    if ("onTick" in target) target.onTick(game);
  }
}

export {
  cardsData,
  gameloop
};