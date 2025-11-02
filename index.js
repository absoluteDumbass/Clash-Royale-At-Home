const express = require("express");
const os = require("os");
const http = require("http");
const socketIo = require("socket.io");
const passport = require("passport");
const session = require("express-session");
const Strategy = require("passport-discord").Strategy;
const path = require("path");
const sql = require("connect-sqlite3")(session);
const cfg = require("./config.json");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configure Passport
passport.use(
  new Strategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "/callback",
      scope: ["identify"],
    },
    function (accessToken, refreshToken, profile, done) {
      // In a real application, you might store the profile in a database
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

const sessionMiddleware = session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  store: new sql(),
});
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use("/static", express.static(__dirname + "/public"));

// Routes
app.get("/", (req, res) => {
  // Check if this is an actual page visit (e.g., by checking a query parameter, user-agent, etc.)
  const isBot = req.headers["user-agent"].includes("bot"); // Example for bots/crawlers
  const isSharedLink = req.query.shared === "true"; // Example query parameter for shared links

  if (isBot || isSharedLink) {
    // Serve the root page with custom meta tags
    res.send(`
            <html>
                <head>
                    <title>${cfg.meta.title}</title>
                    <meta name="title" content="${cfg.meta.title}">
                    <meta name="description" content="${cfg.meta.description}">
                    <meta name="keywords" content="${cfg.meta.tags}">
                    <meta name="robots" content="index, follow">
                    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
                    <meta name="language" content="English">
                </head>
                <body>
                    <h1>go away scrapers!</h1>
                </body>
            </html>
        `);
  } else {
    // Redirect to login for other visits
    res.redirect("/login");
  }
});

app.get("/login", passport.authenticate("discord"));

app.get(
  "/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  (req, res) => {
    // Successful authentication
    res.redirect("/profile");
  }
);

app.get("/profile", (req, res) => {
  if (!req.isAuthenticated() || !req.user) res.redirect("/");

  let user = req.user.id in userList ? userList[req.user.id] : -1
  
  if (user == -1) user = {
    deck: ["knight","crossbow", "arrows", "dart", "golem", "inferno", "skarmy", "wizard"],
    game: {
      cards: [],
      inCycle: [],
      elixirUsed: 0,
    }
  }
  
  user.id = req.user.id;
  user.username = req.user.global_name;
  user.avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${req.user.avatar}.png`;
  if (user.id == "930064591961079849") user.admin = true; // developer!

  userList[req.user.id] = user;

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const userList = {
    "0": { // fake user for testing
        id: "0",
        username: "Maru",
        avatarUrl: "https://cdn.discordapp.com/avatars/930064591961079849/504889585883226112.png",
        deck: ["knight","crossbow", "arrows", "dart", "golem", "inferno", "skarmy", "wizard"],
        game: {
          cards: [],
          inCycle: [],
          elixirUsed: 0,
        }
    }
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

const cardsData = require("./physics/index.js");

let match = {
  players: ["0"],
  usernames: ["Maru"],
  hasStarted: false,
  timeStarted: 0,
  objects: [],
};

function initialise(user, m) {
  user.game = {
    cards: [],
    inCycle: [],
    elixirUsed: 0,
  };

  let deck = user.deck;
  console.log(deck);
  for (let i = 0; i < 4; i++) {
    user.game.inCycle.push(deck.pop());
  }
  user.game.cards = deck;

  return user;
}

// i have NO idea what this chunk does but its essential
const wrap = (middleware) => (socket, next) =>
  middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));
io.use((socket, next) => {
  if (socket.request.user || !userList[socket.request.user.id]) {
    next();
  } else {
    next(new Error("unauthorized"));
  }
});

// Error-handling middleware
app.use((err, req, res, next) => {
  if (err.message === "Unauthorized") {
    // Redirect to login page
    return res.redirect("/login");
  }

  // For other errors, send a generic error response
  res.status(500).json({
    message: err.message || "Internal Server Error",
  });
});

io.on("connection", (socket) => {
  const user = userList[socket.request.user.id];
    if (!user) {
      console.log(
        `[RE-LOGIN] ${socket.request.user.global_name} is forced to re-log`
      );
      socket.emit("loginAgain");
      return;
    }
    
  socket.on("requestUserData", () => {
    console.log(`[LOGIN] ${user.username} joined the lobby!`);
    socket.emit("userData", { user, cardsData, match });
  });

  socket.on("cheat", () => {
    if (!user.admin) return;
    console.log(`[CHEAT] ${user.username} gains infinite elixir.`);
    user.elixirUsed -= Infinity;
  });

  socket.on("cheat2", () => {
    if (!user.admin) return;
    console.log(`[CHEAT] ${user.username} forced everyone to re-log.`)
    io.emit("loginAgain");
  })

  socket.on("matchmake", () => {
    if (match.players.includes(user.id)) {
      if (match.hasStarted) socket.emit("gamestate", match, user.game);
      if (!match.hasStarted) socket.emit("inMatchmaking");
      return;
    }
    
    if (match.hasStarted) {
      socket.emit("message", `Match is full, try again later.\n${match.usernames[0]} and ${match.usernames[1]} is playing right now.`);
      return;
    }
    
    match.players.push(user.id);
    console.log(`[JOIN] ${user.username} is in matchmaking!`);
    
    if (match.players.length == 2) {
      match.hasStarted = true;
      match.timeStarted = Date.now();

      userList[match.players[0]] = initialise(userList[match.players[0]], match);
      userList[match.players[1]] = initialise(userList[match.players[1]], match);
      
      io.emit("matchStarted", match);
      console.log(`[START] Match started!`);
    } else {
      socket.emit("inMatchmaking");
    }
  });

  socket.on("leaveMatch", () => {
    if (!match.players.includes(user.id)) return;
    match.players = match.players.filter((id) => id !== user.id);
    match.usernames = match.usernames.filter((name) => name !== user.username);
    match.hasStarted = false;
    console.log(`[LEAVE] ${user.username} left the match or matchmaking.`);
  });

  socket.on("gamestate", () => {
    if (!match.players.includes(user.id)) return;
    socket.emit("gamestate", match, user.game);
  })

  socket.on("useElixir", (id, x, y) => {
    if (!match.players.includes(user.id)) return;
    let elixir = Math.floor((Date.now() - match.timeStarted) / 1800) - user.game.elixirUsed;
    if (elixir > 10 && user.game.elixirUsed != Infinity) {
      user.game.elixirUsed += elixir-10;
      elixir = 10;
    }
      
    if (cardsData[id].cost > elixir) return;
    if (user.game.cards.includes(id)) {
      user.game.cards = user.game.cards.filter((card) => card !== id);
      user.game.inCycle.push(id);
      user.game.cards.push(user.game.inCycle.shift())
    }
    user.game.elixirUsed += cardsData[id].cost;
    match.objects.push({
      id: id,
      x: x,
      y: y,
      owner: user.id,
    })

    console.log(`[USE] ${user.username} used ${cardsData[id].display_name} (${cardsData[id].cost}) at (${x}, ${y})`)

    socket.emit("gamestate", match, user.game);
  })

  socket.on("disconnect", () => {
    console.log(`[LOGOUT] ${socket.request.user.global_name} left the server`);
  });
});

// For non-technical people who don't understand what this is:
// No, this is not an IP logger. I'm trying to know where the server is hosted in.
function serverIP() {
  const interfaces = os.networkInterfaces(); // this only gets the list of IPs from my own OS
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on ${serverIP()}:${PORT}`);
});
