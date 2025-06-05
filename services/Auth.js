/*!
    @preserve

 	ATON Authentication middleware

 	@author Bruno Fanini
	VHLab, CNR ISPC

==================================================================================*/

const path = require('path');
const bodyParser = require('body-parser');
const passport = require('passport');
const Strategy = require('passport-local').Strategy;
const cookieParser = require('cookie-parser');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

let Auth = {};

Core.Auth = Auth;
Core.passport = passport;

Auth.init = (app) => {
    Auth.setupPassport();

    let fileStoreOptions = {
        path: path.join(__dirname, '..', 'sessions'),
        fileExtension: '.ses'
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
            if (!user || user.password !== password) return cb(null, false);
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
    process.nextTick(() => {
        Core.users = Core.Maat.getUsers();

        for (let user of Core.users) {
            if (user.username === username) return cb(null, user);
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
    return Core.users.find(u => u.username === username);
};

Auth.getUID = (req) => {
    return req.user?.username;
};

Auth.isUserAuth = (req, username) => {
    if (!req.user?.username) return false;
    if (username && req.user.username !== username) return false;
    return true;
};

Auth.isUserAdmin = (req) => {
    return Auth.isUserAuth(req) && req.user.admin === true;
};

Auth.createClientResponse = (req) => {
    if (!Auth.isUserAuth(req)) return false;

    let U = {
        username: req.user.username,
        admin: req.user.admin
    };

    if (Core.config.services.webdav?.PORT) {
        U.webdav = Core.config.services.webdav.PORT;
    }

    return U;
};

module.exports = Auth;
