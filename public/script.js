import p5 from "https://esm.sh/p5@1.11.9";
import { gameloop } from "../shared/gameloop.js";
import cardsData from "../shared/cardsData.js";
import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js"
const socket = io();

let loaded = false;
let user = {};
const UIdiv = document.getElementById("ui");
let match = {};
let displaySize = 0;
let isPlaying = false;
let selected = 0;
let draw = true;
let side = 0; // side 0 is upper side, side 1 is lower side

const randomFacts = [
  `Nerf miner`,
  `"I'll only make Clash Royale at home when pigs fly" i was so dumb`,
  `Fish in a box, fish in a box. flop flop.`,
  `THIS. IS. WHY. WE. CLAAAAAAAAAAAASH.`,
  `Tryna strike a cord and its probably a MINER!`,
  `I'll only believe on the fan lore of Mega knight, shit is so peak`,
  `Microtransactions when?`,
  `Evos when?`,
  `Don't worry guys, Boss Bandit will never be added.<br>I'll add an even more broken champion instead.`,
  `I have a personal vendatta against firecracker and you should too`,
];

// the UI im talking about is in the bottom left side of the screen
const UImode = {
  custom: `<p>@1@</p>
    <button id="back">Understood</button>`, // use custom for short texts with no special buttons
  mainmenu: `<p class="fat">Main Menu</p>
    <button id="matchmake">Play</button>
    <button id="patchnotes">Patch notes</button>
    <button id="credits">Credits</button>

    <br><br>
    <p>@1@</p>`,
  patchnotes: `<p class="fat">Patch notes</p>
    <p class="small">unnumbered beta version</p>
    <div class="deep restrain">
    <p>-Base release. Basic gameloop only.</p>
    </div>`,
  credits: `<p class="fat">Credits</p>
    <p>Clash Royale At Home</p>
    <p class="small">Not affiliated with any company, especially not Supercell</p>
    <div class="deep">
    <p>Developer: Fish in a box</p>
    </div>`,
  gamestate: `<p class="fat">Match against @1@</p>
    <p>Elixir: @2@ Selected: @3@</p>
    <button id="card1">@4@</button>
    <button id="card2">@5@</button>
    <button id="card3">@6@</button>
    <button id="card4">@7@</button>
    <p>Next: @8@</p>`,
  matchmaking: `<p>Finding match...</p>
    <br/>
    <p>Click on an empty space to leave this screen,</p>
    <p>You will still be in queue.</p>
    <button id="cancelMatchmake">Cancel Matchmaking</button>`,
  wait: `<p>wait for a moment</p>
    <br/>
    <p>or you can click to cancel</p>`,
};
UIdiv.addEventListener("click", (event) => {
  const isButton = event.target.nodeName === "BUTTON";
  if (!isButton) {
    if (isPlaying) {
      showGamestate();
      return;
    }
    UIset("mainmenu");
    return;
  }

  // button interections, event.target.id is the id of the button clicked
  switch (event.target.id) {
    case "back":
      UIset("mainmenu");
      break;
    case "patchnotes":
      UIset("patchnotes");
      break;
    case "credits":
      UIset("credits");
      break;
    case "matchmake":
      UIset("wait");
      socket.emit("matchmake");
      break;
    case "cancelMatchmake":
      UIset("mainmenu");
      socket.emit("leaveMatch");
      break;
    case "card1":
      selected = 0;
      showGamestate();
      break;
    case "card2":
      selected = 1;
      showGamestate();
      break;
    case "card3":
      selected = 2;
      showGamestate();
      break;
    case "card4":
      selected = 3;
      showGamestate();
      break;
    default:
      console.log("Try changing the id in the switch statement too smh");
      break;
  }
});

socket.on("connect", () => {
  socket.emit("requestUserData");
  console.log("Connected!");
});

socket.on("loginAgain", () => {
  window.location.replace("/");
  window.location.reload();
});

socket.on("userData", (syncData) => {
  console.log(syncData);
  user = syncData.user;
  match = syncData.match;

  document.getElementById("avatar").src = user.avatarUrl;
  document.getElementById(
    "greeting"
  ).innerText = `Greetings, ${user.username}!`;
  document.getElementById("account-age").innerHTML = `Year 0 of playing!`;
  document.getElementById(
    "total-playtime"
  ).innerHTML = `Total playtime: 0 hours`;

  if (match.players.includes(user.id)) {
    isPlaying = true;
    side = match.players.indexOf(user.id)
  }

  if (!loaded) UIset("mainmenu");
  loaded = true;
  draw = true;
});

socket.on("message", (wordsOfWisdom) => {
  console.log(wordsOfWisdom);
  UIset("custom", [wordsOfWisdom]);
});

socket.on("inMatchmaking", () => {
  UIset("matchmaking");
});

let gameInterval = 0;
socket.on("matchStarted", (m) => {
  match = m;
  if (match.players.includes(user.id)) {
    socket.emit("gamestate");
    isPlaying = true;
    side = match.players.indexOf(user.id)
  }
  if (gameInterval == 0) gameInterval = setInterval(() => {
    match = gameloop(match, cardsData);
    draw = true;
  }, 1000 / match.tickRate);
});

socket.on("matchEnded", (m) => {
  UIset("mainmenu");
  clearInterval(interval);
  clearInterval(gameInterval);
  isPlaying = false;
  match = m;
  interval = 0;
  gameInterval = 0;
  draw = true;
})

socket.on("ping", () => {
  socket.emit("gamestate");
});

socket.on("gamestate", (m, personal) => {
  match = m;
  user.game = personal;
  if (isPlaying) showGamestate();
});

let interval = 0; // nothing yet
function showGamestate() {
  let elixir = Math.min(Math.floor((Date.now() - match.timeStarted) / 1800) - user.game.elixirUsed, 10);
  const opponent = match.players[0] == user.id ? 1 : 0;
  const a = (id) => {
    return `${cardsData[id].display_name} (${cardsData[id].cost})`;
  }

  UIset("gamestate", [match.usernames[opponent], elixir, a(user.game.cards[selected]), a(user.game.cards[0]), a(user.game.cards[1]), a(user.game.cards[2]), a(user.game.cards[3]), a(user.game.inCycle[0])]);

  if (interval == 0) interval = setInterval(() => {
    showGamestate()
    //console.log(match);
  }, 900);
}

const sketch = (p) => {
  p.setup = () => {
    let canvas = p.createCanvas(p.windowHeight, p.windowHeight);
    canvas.parent("canvas");
    console.log("Created Canvas");
    displaySize =
      p.windowHeight > p.windowWidth * 0.45 ? p.windowWidth * 0.45 : p.windowHeight;
  }
  p.windowResized = () => {
    displaySize =
      p.windowHeight > p.windowWidth * 0.45 ? p.windowWidth * 0.45 : p.windowHeight;
    p.resizeCanvas(displaySize, displaySize);
    draw = true;
    return;
  }
  p.draw = () => {
    if (draw) {
      draw = false;
    } else {
      return;
    }
    p.background("#666666");
    p.fill(255);
    p.text("This is made for PC,", p.windowWidth / 2, p.windowHeight / 2 - 30);
    p.text(
      "unfortunately I ain't gonna add mobile support.",
      p.windowWidth / 2,
      p.windowHeight / 2
    );

    if (p.windowWidth < p.windowHeight) return;
    if (!loaded) return;
    let s = displaySize / match.gridSize; // standard size
    p.stroke("rgba(0, 0, 0, 0.05)");
    for (let x = 0; x < match.gridSize; x++) {
      for (let y = 0; y < match.gridSize; y++) {
        let c = p.color(130, 130, 130);
        const percentX = x / match.gridSize;
        const percentY = y / match.gridSize;
        const isRiver = percentY >= 0.45 && percentY <= 0.55
        // assume the grid is 100% width, 10% to 30% should be bridge, 70% to 90% should be bridge. the rest should be false
        const isBridge = (percentX >= 0.15 && percentX <= 0.3) || (percentX >= 0.65 && percentX <= 0.8)

        if (x == 0 || y == 0 || x == match.gridSize - 1 || y == match.gridSize - 1) {
          c = p.color(110, 110, 100);
        } else if (isRiver && isBridge) {
          c = p.color(127, 101, 61);
        } else if (isRiver) {
          c = p.color(100, 100, 200);
        } else if ((x + y) % 2) {
          c = p.color(135, 135, 135);
        }
        p.fill(c);
        p.square(x * s, y * s, s);
      }
    }
    let sa = 1 * displaySize / match.gridSize / 10; // stardard adjusted size. game coord to absolute coord

    //console.log(match)
    for (let i = 0; i < match.objects.length; i++) {
      const object = match.objects[i];
      if (object.dead) continue;
      
      const card = cardsData[object.cardId];
      const offset = card.size / 2
      p.fill(card.color);
      p.square((object.x - offset) * sa, (object.y - offset)*sa, s * card.size/10);
      // dot at center
      p.fill(255, 255, 255);
      p.circle(object.x * sa, object.y * sa, 3);

      // health bar
      if (!("hp" in object)) continue;
      p.fill(55, 55, 55);
      p.rect((object.x - offset) * sa, (object.y - offset) * sa - card.size/2-6, sa * card.size, 3);
      if (object.owner != side) {
        p.fill(255, 55, 55);
      } else {
        p.fill(55, 55, 255);
      }
      p.rect((object.x - offset) * sa, (object.y - offset) * sa - card.size/2-6, sa * card.size * (object.hp / card.maxhp), 3);
    }
  }

  p.mouseClicked = () => {
    if (p.mouseX < 0) return;
    const clickedX = Math.floor((p.mouseX / displaySize) * match.gridSize) * 10;
    const clickedY = Math.floor((p.mouseY / displaySize) * match.gridSize) * 10;

    console.log(`Clicked at (${clickedX}, ${clickedY})`);
    socket.emit("useElixir", user.game.cards[selected], clickedX, clickedY);
  }
};
const P5 = new p5(sketch);

function UIset(mode, fillIn = []) {
  let base = UImode[mode].split("@");
  if (mode == "mainmenu")
    fillIn = [randomFacts[Math.floor(Math.random() * randomFacts.length)]];

  if (base.length == 1) {
    UIdiv.innerHTML = UImode[mode];
  }

  for (let i = 0; i < fillIn.length; i++) {
    base[1 + i * 2] = fillIn[i];
  }

  UIdiv.innerHTML = base.join("");
}