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
  cardModule.id = card.replace('.js', '');
  cardsData[cardModule.id] = cardModule;
}

export default cardsData