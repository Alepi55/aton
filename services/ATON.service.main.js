/*!
    @preserve

 	ATON Main Service (gateway)

 	@author Bruno Fanini
	VHLab, CNR ISPC

==================================================================================*/

const fs          = require('fs');
const express     = require('express');
const http        = require('http');
const https       = require('https');
const url         = require('url');
//const compression = require('compression');
const path        = require('path');
const cors        = require('cors');
const chalk       = require('chalk');

const glob   = require("glob");
const nanoid = require("nanoid");
const { createProxyMiddleware } = require('http-proxy-middleware');

// ✅ CREA la cartella 'sessions' prima di tutto
const sessionsPath = path.join(__dirname, '..', 'sessions');
if (!fs.existsSync(sessionsPath)) {
	fs.mkdirSync(sessionsPath, { recursive: true });
	console.log("✔️ Cartella 'sessions/' creata automaticamente.");
}

// Ora è sicuro importare i moduli che la usano
const Core = require('./Core');
const Auth = require('./Auth');
const Render = require('./Render');
const API  = require("./API/v2"); // v2

// Initialize & load config files
Core.init();

const CONF = Core.config;

// Standard PORTS
let PORT        = 8080;
let PORT_SECURE = 8083;
let VRC_PORT    = 8890;
let VRC_ADDR    = "ws://localhost";
let PORT_WEBDAV = 8081;

if (CONF.services.main.PORT) 
	PORT = CONF.services.main.PORT;

if (process.env.PORT)
	PORT = process.env.PORT;

if (CONF.services.main.PORT_S)
	PORT_SECURE = CONF.services.main.PORT_S;

if (CONF.services.photon){
	if (CONF.services.photon.PORT)    VRC_PORT = CONF.services.photon.PORT;
	if (CONF.services.photon.address) VRC_ADDR = CONF.services.photon.address;
}

// compatibility with previous configs
if (CONF.services.vroadcast){
	if (CONF.services.vroadcast.PORT)    VRC_PORT = CONF.services.vroadcast.PORT;
	if (CONF.services.vroadcast.address) VRC_ADDR = CONF.services.vroadcast.address;
}

if (CONF.services.webdav && CONF.services.webdav.PORT)
	PORT_WEBDAV = CONF.services.webdav.PORT;

const pathCert = Core.getCertPath();
const pathKey  = Core.getKeyPath();

let bExamples = CONF.services.main.examples;
//let bAPIdoc   = CONF.services.main.apidoc;

// Debug on req received (client)
let logger = function(req, res, next){
    console.log('Request from: ' + req.ip + ' For: ' + req.path);
    next();
};

let app = express();
app.use('/admin', express.static(path.join(__dirname, 'admin')));

//app.set('trust proxy', 1); 	// trust first proxy
//app.use(compression());

app.use(cors({
	credentials: true,
	origin: true
}));

app.use(express.json({ limit: '50mb' }));

const CACHING_OPT = {
	maxage: "3h"
};

app.use('/', express.static(Core.DIR_PUBLIC, CACHING_OPT ));
if (fs.existsSync(Core.DIR_CONFIGPUB)) app.use('/common', express.static(Core.DIR_CONFIGPUB));
app.use('/a', express.static(Core.DIR_WAPPS));
app.use('/', express.static(Core.DIR_DATA, CACHING_OPT));

// 🔐 Auth
Auth.init(app);

// REST API
Core.realizeBaseAPI(app);
API.init(app);

// Rendering
Core.Render.setup(app);

// Micro-services proxies
app.use('/vrc', createProxyMiddleware({ 
	target: VRC_ADDR+":"+VRC_PORT, 
	ws: true, 
	pathRewrite: { '^/vrc': ''},
	changeOrigin: true
}));
app.use('/svrc', createProxyMiddleware({ 
	target: VRC_ADDR+":"+VRC_PORT, 
	ws: true, 
	pathRewrite: { '^/svrc': ''},
	secure: true,
	changeOrigin: true 
}));

// Flares
Core.setupFlares(app);
for (let fid in Core.flares){
	app.use('/flares/'+fid, express.static(Core.DIR_FLARES+fid+"/public/"));
}

// START
http.createServer(app).listen(PORT, ()=>{
	Core.logGreen("\nATON up and running!");
	console.log("- OFFLINE: http://localhost:"+PORT);
	for (let n in Core.nets) console.log("- NETWORK ('"+n+"'): http://"+Core.nets[n][0]+":"+PORT);
	console.log("\n");
});

// HTTPS
if (fs.existsSync(pathCert) && fs.existsSync(pathKey)){
	let httpsOptions = {
		key: fs.readFileSync(pathKey, 'utf8'),
		cert: fs.readFileSync(pathCert, 'utf8')
	};

	https.createServer(httpsOptions, app).listen(PORT_SECURE, ()=>{ 
		Core.logGreen("\nHTTPS ATON up and running!");
		console.log("- OFFLINE: https://localhost:"+PORT_SECURE);
		for (let n in Core.nets) console.log("- NETWORK ('"+n+"'): https://"+Core.nets[n][0]+":"+PORT_SECURE);
		console.log("\n");
	});
} else {
	console.log("\nSSL certs not found:\n"+pathKey+"\n"+pathCert+"\n");
}
