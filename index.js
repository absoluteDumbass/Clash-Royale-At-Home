import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import passport from 'passport';
import { Strategy } from 'passport-discord';
import session from 'express-session';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import c from 'chalk';
import dotenv from 'dotenv';
dotenv.config();

import cardsData from './physics/index.js';
import { gameloop, game } from './physics/gameloop.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cfg = JSON.parse(fs.readFileSync('./config.json'));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configure Passport
passport.use(
  new Strategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: '/callback',
      scope: ['identify'],
    },
    function(accessToken, refreshToken, profile, done) {
      // In a real application, you might store the profile in a database
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// we make our own session store
const { Store } = session;
class myStore extends Store {
  constructor(path) {
    super();
    this.path = path || './db.json';
  }
  destroy(sid, cb) {
    const data = JSON.parse(fs.readFileSync(this.path));
    try {
      data.sessions = data.sessions.filter((session) => session.sid !== sid);
      fs.writeFileSync(this.path, JSON.stringify(data, null, 2));
      return optionalCb(null, null, cb)
    } catch (err) {
      return optionalCb(err, null, cb)
    }
  }
  get(sid, cb) {
    const data = JSON.parse(fs.readFileSync(this.path));
    try {
      const session = data.sessions.find((session) => session.sid === sid);
      return optionalCb(null, session ? session.session : null, cb)
    } catch (err) {
      return optionalCb(err, null, cb)
    }
  }
  set(sid, session, cb) {
    const data = JSON.parse(fs.readFileSync(this.path));
    try {
      const existingSession = data.sessions.find((session) => session.sid === sid);
      if (existingSession) {
        existingSession.session = session;
      } else {
        data.sessions.push({ sid, session });
      }
      fs.writeFileSync(this.path, JSON.stringify(data, null, 2));
      return optionalCb(null, null, cb);
    } catch (err) {
      return optionalCb(err, null, cb)
    }
  }
}

function optionalCb(err, data, cb) {
  if (cb) return cb(err, data);
  if (err) throw err;
  return data
}

const db = new myStore()

const sessionMiddleware = session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  store: db,
});
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use('/static', express.static(__dirname + '/public'));
app.use('/shared', express.static(__dirname + '/physics'));

// Routes
app.get('/', (req, res) => {
  // Check if this is an actual page visit (e.g., by checking a query parameter, user-agent, etc.)
  const isBot = req.headers['user-agent'].includes('bot'); // Example for bots/crawlers
  const isSharedLink = req.query.shared === 'true'; // Example query parameter for shared links

  if (isBot || isSharedLink) {
    // Serve the root page with custom meta tags
    res.send(`
            <html>
                <head>
                    <title>${cfg.meta.title}</title>
                    <meta name='title' content='${cfg.meta.title}'>
                    <meta name='description' content='${cfg.meta.description}'>
                    <meta name='keywords' content='${cfg.meta.tags}'>
                    <meta name='robots' content='index, follow'>
                    <meta http-equiv='Content-Type' content='text/html; charset=utf-8'>
                    <meta name='language' content='English'>
                </head>
                <body>
                    <h1>go away scrapers!</h1>
                </body>
            </html>
        `);
  } else {
    // Redirect to login for other visits
    res.redirect('/login');
  }
});

app.get('/login', passport.authenticate('discord'));

app.get(
  '/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication
    res.redirect('/profile');
  }
);

app.get('/profile', (req, res) => {
  if (!req.isAuthenticated() || !req.user) {
    res.redirect('/');
    return;
  }

  let user = req.user.id in userList ? userList[req.user.id] : -1

  if (user == -1) user = {
    deck: ['knight', 'crossbow', 'arrows', 'dart', 'golem', 'inferno', 'skarmy', 'wizard'],
    game: {
      cards: [],
      inCycle: [],
      elixirUsed: 0,
    }
  }

  user.id = req.user.id;
  user.username = req.user.global_name;
  user.avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${req.user.avatar}.png`;
  if (user.id == '930064591961079849') user.admin = true; // developer!

  userList[req.user.id] = user;

  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const userList = {
  /*'0': { // fake user for testing
    id: '0',
    username: 'Maru',
    avatarUrl: 'https://cdn.discordapp.com/avatars/930064591961079849/504889585883226112.png',
    deck: ['knight', 'crossbow', 'arrows', 'dart', 'golem', 'inferno', 'skarmy', 'wizard'],
    game: {
      cards: [],
      inCycle: [],
      elixirUsed: 0,
    }
  }*/
};

/* template (not perfect syntax)
userlist = {
    user: {
        id: discord id
        username: discord name
        avatarUrl: discord avatar
        game: {
          match: id for the match, but for now empty
          cards: [playable cards]
          inCycle: [unplayable cards, you need to cycle]
          elixirUsed: total elixir used or leaked
        }
        deck: [all cards in deck]
        admin: is admin or not? 
    }
}
*/
let loop = 0; // nothing lol

let match = {
  players: [],
  usernames: [],
  hasStarted: false,
  timeStarted: 0,
  objects: [],
  events: [],
  ticks: 0,
  tickRate: 10, // ticks per second
  gridSize: 32,
};

const defaultObjects = [{
  cardId: 'crown_castle',
  objectId: 0,
  x: match.gridSize / 2 * 10,
  y: match.gridSize / 8 * 10,
  owner: 0,
  tickPlaced: 0,
  hp: cardsData['crown_castle'].maxhp
}, {
  cardId: 'crown_castle',
  objectId: 1,
  x: match.gridSize / 2 * 10,
  y: (match.gridSize - (match.gridSize / 8)) * 10,
  owner: 1,
  tickPlaced: 0,
  hp: cardsData['crown_castle'].maxhp
}, {
  cardId: 'crown_tower',
  objectId: 2,
  x: match.gridSize / 5 * 10,
  y: match.gridSize / 5 * 10,
  owner: 0,
  tickPlaced: 0,
  hp: cardsData['crown_tower'].maxhp
}, {
  cardId: 'crown_tower',
  objectId: 3,
  x: (match.gridSize - match.gridSize / 5) * 10,
  y: match.gridSize / 5 * 10,
  owner: 0,
  tickPlaced: 0,
  hp: cardsData['crown_tower'].maxhp
}, {
  cardId: 'crown_tower',
  objectId: 2,
  x: match.gridSize / 5 * 10,
  y: (match.gridSize - (match.gridSize / 5)) * 10,
  owner: 1,
  tickPlaced: 0,
  hp: cardsData['crown_tower'].maxhp
}, {
  cardId: 'crown_tower',
  objectId: 3,
  x: (match.gridSize - match.gridSize / 5) * 10,
  y: (match.gridSize - (match.gridSize / 5)) * 10,
  owner: 1,
  tickPlaced: 0,
  hp: cardsData['crown_tower'].maxhp
}];

match.objects = defaultObjects;

function initialise(user) {
  user.game = {
    cards: [],
    inCycle: [],
    elixirUsed: -7,
    side: match.players[0] ? 0 : 1
  };

  let deck = user.deck;
  console.log(deck);
  for (let i = 0; i < 4; i++) {
    user.game.inCycle.push(deck.pop());
  }
  user.game.cards = deck;

  return user;
}

function travel(obj, phID = 0) {
  let res = {}
  let placeholders = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const temp = travel(value, placeholders.length + phID);
        res[key] = temp[0];
        placeholders = placeholders.concat(temp[1]);
      } else if (typeof value == 'function') {
        res[key] = `FN_COMPILER_PLACEHOLDER_${placeholders.length + phID}`;
        placeholders.push(value.toString());
      } else {
        res[key] = value;
      }
    }
  }
  return [res, placeholders]
}
function enabler(obj) {
  const res = travel(obj);
  let data = 'export default ' + JSON.stringify(res[0], null, 2);

  for (let i = 0; i < res[1].length; i++) {
    data = data.replace(`"FN_COMPILER_PLACEHOLDER_${i}"`, res[1][i]);
  }

  if (data.includes('Math.random(')) {
    console.log(`${c.bold.red('[WARNING]')} Please use game.random(min, max, noise) instead of Math.random(). This is to prevent server-client desync.`);
  } else if (data.includes('setInterval(')) {
    throw new Error(`${c.bold.red('[BANNED]')} Do not use setInterval() or any time operations, use ticks to track time instead.`);
  } else if (data.includes('setTimeout(')) {
    throw new Error(`${c.bold.red('[BANNED]')} Do not use setTimeout() or any time operations, use ticks to track time instead.`);
  } else if (data.includes('Date.now(')) {
    throw new Error(`${c.bold.red('[BANNED]')} Do not use Date.now() or any time operations, use ticks to track time instead.`);
  } else if (data.includes('async')) {
    console.log(`${c.bold.red('[WARNING]')} Async functions are not tested and might cause issues.`);
  }

  return data;
}
console.log(`\n==========\n${c.green('Green')} means good.\n${c.blue('Blue')} means info.\n${c.yellow('Yellow')} means bad but handled.\n${c.bold.red('Red')} means high severity integrity risk.\n==========\n`);

const compiled = enabler(cardsData);
fs.writeFileSync('./physics/cardsData.js', compiled);
console.log(`${c.blue('[SUCCESS]')} Compiled cards data at ./physics/cardsData.js`);
//console.log(compiled)

// i have NO idea what this chunk does but its essential
const wrap = (middleware) => (socket, next) =>
  middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));
io.use((socket, next) => {
  if (socket.request.user) {
    next();
  } else {
    next(new Error('unauthorized'));
  }
});

// Error-handling middleware
app.use((err, req, res, next) => {
  if (err.message === 'Unauthorized') {
    // Redirect to login page
    return res.redirect('/login');
  }

  // For other errors, send a generic error response
  res.status(500).json({
    message: err.message || 'Internal Server Error',
  });
});

io.on('connection', (socket) => {
  const user = userList[socket.request.user.id];
  if (!user) {
    console.log(
      `${c.yellow('[RELOG]')} ${socket.request.user.global_name} is forced to re-log`
    );
    socket.emit('loginAgain');
    return;
  }

  socket.on('requestUserData', () => {
    console.log(`${c.green('[JOIN]')} ${user.username} joined the lobby!`);
    socket.emit('userData', { user, match });
    if (match.players.includes(user.id)) socket.emit('gamestate', match, user.game);
  });

  socket.on('cheat1', () => {
    if (!user.admin) return;
    console.log(`${c.bold.red('[CHEAT]')} ${user.username} gains infinite elixir.`);
    user.elixirUsed -= Infinity;
  });

  socket.on('cheat2', () => {
    if (!user.admin) return;
    // this happens so i can edit the code without restarting the server
    // and mess with people
    console.log(`${c.bold.red('[CHEAT]')} ${user.username} forced everyone to re-log.`)
    io.emit('loginAgain');
  });

  socket.on('cheat3', () => {
    if (!user.admin) return;
    console.log(`${c.bold.red('[CHEAT]')} ${user.username} cleared the board.`);
    match.objects = [];
  })

  socket.on('matchmake', () => {
    if (match.players.includes(user.id)) {
      if (match.hasStarted) socket.emit('gamestate', match, user.game);
      if (!match.hasStarted) socket.emit('inMatchmaking');
      return;
    }

    if (match.hasStarted) {
      socket.emit('message', `Match is full, try again later.\n${match.usernames[0]} and ${match.usernames[1]} is playing right now.`);
      return;
    }

    match.players.push(user.id);
    match.usernames.push(user.username);
    console.log(`${c.green('[JOIN]')} ${user.username} is in matchmaking!`);

    if (match.players.length == 2) {
      match.hasStarted = true;
      match.timeStarted = Date.now();

      userList[match.players[0]] = initialise(userList[match.players[0]], match);
      userList[match.players[1]] = initialise(userList[match.players[1]], match);

      io.emit('matchStarted', match);
      loop = setInterval(() => {
        match = gameloop(match, cardsData);
        if (match.end) {
          clearInterval(loop);
          match.hasStarted = false;
          match.players = [];
          match.usernames = [];
          match.objects = defaultObjects;
          match.events = [];
          match.ticks = 0;
          match.timeStarted = 0;
          io.emit('matchEnded');
        }
      }, 1000 / match.tickRate)
      console.log(`${c.green('[START]')} Match started!`);
    } else {
      socket.emit('inMatchmaking');
    }
  });

  socket.on('leaveMatch', () => {
    if (!match.players.includes(user.id)) return;
    match.players = match.players.filter((id) => id !== user.id);
    match.usernames = match.usernames.filter((name) => name !== user.username);
    match.hasStarted = false;
    clearInterval(loop);
    console.log(`${c.green('[LEAVE]')} ${user.username} left the match or matchmaking.`);
  });

  socket.on('gamestate', () => {
    //if (!match.players.includes(user.id)) return;
    socket.emit('gamestate', match, user.game);
  })

  socket.on('useElixir', (id, x, y) => {
    if (!match.players.includes(user.id)) return;
    const isAllowedToPlace = match.players.indexOf(user.id) ? (y > (match.gridSize / 2 * 10)) : (y < (match.gridSize / 2 * 10))
    if (!(cardsData[id].globalPlacement || isAllowedToPlace)) return;
    if (user.game.cards.includes(id)) {
      user.game.cards = user.game.cards.filter((card) => card !== id);
      user.game.inCycle.push(id);
      user.game.cards.push(user.game.inCycle.shift());
    } else {
      return;
    }
    
    let elixir = Math.floor((Date.now() - match.timeStarted) / 1800) - user.game.elixirUsed;
    if (elixir > 10 && user.game.elixirUsed != Infinity) {
      user.game.elixirUsed += elixir - 10;
      elixir = 10;
    }

    if (cardsData[id].cost > elixir) return;
    user.game.elixirUsed += cardsData[id].cost;
    match.objects.push({
      cardId: id,
      objectId: match.objects.length,
      x: x + 5,
      y: y + 5,
      owner: match.players.indexOf(user.id),
      tickPlaced: match.ticks,
      hp: cardsData[id].maxhp
    })

    console.log(`${c.green('[USE]')} ${user.username} used ${cardsData[id].display_name} (${cardsData[id].cost}) at (${x}, ${y})`)

    io.emit('ping');
  })

  socket.on('disconnect', () => {
    console.log(`${c.green('[LEAVE]')} ${socket.request.user.global_name} left the server`);
  });
});

// For non-technical people who don't understand what this is:
// No, this is not an IP logger. I'm trying to know where the server is hosted in.
function serverIP() {
  const interfaces = os.networkInterfaces(); // this only gets the list of IPs from my own OS
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`${c.blue('[SUCCESS]')} Server is running on ${serverIP()}:${PORT}`);
});
