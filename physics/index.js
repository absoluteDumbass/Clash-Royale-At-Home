// This is the central hub for handling all physics. 
// Like to export and to ensure compatibility, and contains centrally used code

import { readdirSync } from "fs"
import { fileURLToPath } from 'url';
import path from 'path';
import c from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cards = readdirSync(path.join(__dirname, "/cards")).filter(file => file.endsWith('.js'));

async function load(a) {
    try {
        const module = await import(`./cards/${a}`);
        return module.default;
    } catch (error) {
        console.error(`${c.blue('[LOAD]')} Error loading module:`, error);
        return null
    }
}

let cardsData = {}
for (const card of cards) {
    const cardModule = await load(card);
    if (!cardModule) continue;
    console.log(`${c.blue('[LOAD]')} Loading ${card}`);
    
    cardModule.id = card.replace('.js', '');

    // first we point out all missing properties, then we set them to default values
    // point out missing properties
    if (!cardModule.display_name) console.log(`${c.yellow('[WARNING]')} ${cardModule.id} is missing display_name`);
    if (!cardModule.cost) console.log(`${c.yellow('[WARNING]')} ${cardModule.id} is missing cost`);
    if (!cardModule.color) console.log(`${c.yellow('[WARNING]')} ${cardModule.id} is missing color`);
    if (!cardModule.size) console.log(`${c.yellow('[WARNING]')} ${cardModule.id} is missing size`);
    if (!cardModule.type) console.log(`${c.yellow('[WARNING]')} ${cardModule.id} is missing type`);
    if (cardModule.subscribed) console.log(`${c.yellow('[WARNING]')} ${cardModule.id} is using reserved keyword "subscribed" as property`);
    if (cardModule.type == "troop" && !cardModule.maxhp) console.log(`${c.yellow('[WARNING]')} ${cardModule.id} is missing maxhp`);
    if (cardModule.type == "troop" && !cardModule.speed) console.log(`${c.yellow('[WARNING]')} ${cardModule.id} is missing speed`);
    if (cardModule.type == "troop" && !cardModule.sightrange) console.log(`${c.yellow('[WARNING]')} ${cardModule.id} is missing sightrange`);
    if (cardModule.type == "troop" && !cardModule.attackrange) console.log(`${c.yellow('[WARNING]')} ${cardModule.id} is missing attackrange`);
    if (cardModule.type == "troop" && !cardModule.damage) console.log(`${c.yellow('[WARNING]')} ${cardModule.id} is missing damage`);
    if (cardModule.type == "troop" && !cardModule.hitspeed) console.log(`${c.yellow('[WARNING]')} ${cardModule.id} is missing hitspeed`);

    // set to default values
    cardModule.display_name = cardModule.display_name || "Suspicious"; // suspicious indeed
    cardModule.type = cardModule.type || "troop";
    cardModule.size = cardModule.size || 10;
    cardModule.color = cardModule.color || "#FF0022";
    cardModule.cost = cardModule.cost || 1;
    cardModule.subscribed = []; // reserved keyword, for events
    cardModule.hidden = cardModule.hidden || false; // optional, if true, this card will not be shown in the deck selection

    if (cardModule.type == "troop") {
        cardModule.maxhp = cardModule.maxhp || 500;
        cardModule.speed = cardModule.speed || 1;
        cardModule.sightrange = cardModule.sightrange || 100;
        cardModule.attackrange = cardModule.attackrange || cardModule.size/2+2;
        cardModule.damage = cardModule.damage || 120;
        cardModule.hitspeed = cardModule.hitspeed || 1; // hits per second
        cardModule.globalPlacement = cardModule.globalPlacement || false;
    } else {
        cardModule.globalPlacement = cardModule.globalPlacement || true;
    }
    
    cardsData[cardModule.id] = cardModule;
}

export default cardsData