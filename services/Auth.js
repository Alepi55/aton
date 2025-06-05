/*!
    @preserve

 	ATON Authentication middleware

 	@author Bruno Fanini
	VHLab, CNR ISPC

==================================================================================*/

const path = require('path');
const fs = require('fs');
let bodyParser = require('body-parser');

let passport = require('passport');
let Strategy = require('passport-local').Strategy;
const cookieParser = require('cookie-parser');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

let Auth = {};

Core.Auth = Auth;
Core.passport = passport;

Auth.init = (app) => {
    Auth.setupPassport();

    // Percorso assoluto per la cartella sessions
    const sessionsPath = path.join(__dirname, '..', 'sessions');
    if (!fs.existsSync(sessionsPath)) {
        fs.mkdirSync(sessionsPath, { recursive: true });
        console.log("✔️ Cartella 'sessions/' creata automaticamente.");
    }

    let fileStoreOptions = {
        path: sessionsPath,
        fileExtension: ".ses"
    };

    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));
    app.use(cookieParser());
    app.use(
        session({
            secret: 'shu',
            resave: true,
            saveUninitialized: true,
            store: new FileStore(fileStoreOptions)
        })
    );

    app.use(passport.initialize());
    app.use(passport.session());
};

Auth.setupPassport = () => {
    passport.use(new Strategy((username, password, cb) => {
        Auth._findByUsername(username, function (err, user) {
            if (err) return cb(err);
            if (!user) return cb(null, false);
            if (user.password != password) return cb(null, false);

            return cb(null, user);
        });
    }));

    passport.serializeUser((user, cb) => {
        cb(null, Core.users.indexOf(user));
    });

    passport.deserializeUser((id, cb) => {
        Auth._findById(id, (err, user) => {
            if (err) return cb(err);
            cb(null, user);
        });
    });
};

Auth._findByUsername = (username, cb) => {
    process.nextTick(function () {
        Core.users = Core.Maat.getUsers();

        for (let i = 0; i < Core.users.length; i++) {
            let U = Core.users[i];
            if (U.username === username) return cb(null, U);
        }

        return cb(null, null);
    });
};

Auth._findById = (id, cb) => {
    process.nextTick(() => {
        Core.users = Core.Maat.getUsers();

        if (Core.users[id]) cb(null, Core.users[id]);
        else cb(new Error('User ' + id + ' does not exist'));
    });
};

Auth.findUser = (username) => {
    for (let i in Core.users) {
        let U = Core.users[i];
        if (U.username === username) return U;
    }
    return undefined;
};

Auth.getUID = (req) => {
    if (!req.user) return undefined;
    return req.user.username;
};

Auth.isUserAuth = (req, username) => {
    if (!req.user || !req.user.username) return false;
    if (username && req.user.username !== username) return false;
    return true;
};

Auth.isUserAdmin = (req) => {
    if (!Auth.isUserAuth(req)) return false;
    let u = req.user;
    return u.admin === true;
};

Auth.createClientResponse = (req) => {
    if (!Auth.isUserAuth(req)) return false;

    let U = {
        username: req.user.username,
        admin: req.user.admin
    };

    if (Core.config.services.webdav && Core.config.services.webdav.PORT)
        U.webdav = Core.config.services.webdav.PORT;

    return U;
};

module.exports = Auth;
