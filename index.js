const express = require('express');
const os = require('os');
const http = require('http');
const socketIo = require('socket.io');
const passport = require('passport');
const session = require('express-session');
const Strategy = require('passport-discord').Strategy;
const path = require('path');
const sql = require('connect-sqlite3')(session);
const cfg = require("./config.json")
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configure Passport
passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.REDIRECT_URI,
    scope: ['identify']
},
function(accessToken, refreshToken, profile, done) {
    // In a real application, you might store the profile in a database
    return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

const sessionMiddleware = session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    store: new sql()
});
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use("/static", express.static(__dirname + '/public'));

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
                    <title>poo poo</title>
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
        res.redirect('/login');
    }
});

app.get('/login', passport.authenticate('discord'));

app.get('/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        // Successful authentication
        res.redirect('/profile');
    }
);

app.get('/profile', (req, res) => {
    if (!req.isAuthenticated() || !req.user) res.redirect('/');
    console.log(req.user);
    
    let user = {}
    user.id = req.user.id;
    user.username = req.user.username
    user.avatarUrl = req.user.avatarUrl
  
    userList[req.user.id] = user;
  
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
    })
  })
});

const userList = {};

/* template (not perfect syntax)
userlist = {
    user: {
        id: discord id
        username: discord name
        avatarUrl: discord avatar
        game: {
          match: id for the match, but for now its true/false
          cards: [playable cards]
          inCycle: [unplayable cards, you need to cycle]
          elixirUsed: total elixir used
          elixirLeaked: amount of elixir unspent when maxed, therefore leaked
          lastUsedElixir: last time player used elixir (used for elixir calculation)
        }
        deck: [all cards in deck]
    }
}
*/

let match = {
  players: [],
  hasStarted: false,
  timeStarted: 0,
  objects: [],
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
    if (err.message === 'Unauthorized') {
        // Redirect to login page
        return res.redirect('/login');
    }

    // For other errors, send a generic error response
    res.status(500).json({
        message: err.message || 'Internal Server Error'
    });
});

io.on('connection', (socket) => {
    const user = userList[socket.request.user.id];
    socket.on('requestUserData', () => {
        if (!user) {
            console.log("someone was bugged and apparently his id is " + socket.request.user.id)
            socket.emit("loginAgain");
            return;
        }
        console.log(`[JOIN] ${user.username} joined the lobby!`);
        socket.emit('userData', {user});
    });

    socket.on("cards", () => {
        socket.emit("updateCards", user.cards);
    })

    socket.on('disconnect', () => {
        console.log(`[LEAVE] soemone left :(`);
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
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on ${serverIP()}:${PORT}`);
});