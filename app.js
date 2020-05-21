// set global variables to use in different files
global._express = require('express')
global._router = _express.Router()
global._async = require('async')
global._config = require('config')
global._status = require('./libs/statusTypes').status
global._statusCodes = require('./libs/statusTypes')
global._mongoose = require('mongoose')
global._moment = require('moment')
global._ = require('lodash')
global._request = require('request')

const compression = require('compression')
	, path = require('path')
	, logger = require('morgan')
	, cookieParser = require('cookie-parser')
	, bodyParser = require('body-parser')
	, cors = require('cors')
	, db = require('./config/db')
	, loadModels = require('./models/loader')
	, app = _express()
	, auth = require('./libs/auth');
app.use(compression())
app.use(cors({ origin: '*' }))

app.use(function (req, res, next) {
	// Website you wish to allow to connect
	res.setHeader('Access-Control-Allow-Origin', '*');

	// Request methods you wish to allow
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

	// Request headers you wish to allow
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, Authorization');

	// Set to true if you need the website to include cookies in the requests sent
	// to the API (e.g. in case you use sessions)
	res.setHeader('Access-Control-Allow-Credentials', true);

	// Pass to next layer of middleware
	next();
});

app.use(logger('dev'));
//request entity too large fix
app.use(bodyParser.json({
	limit: '50mb'
}));
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(customBodyParser);

app.use(cookieParser());

app.use(auth.retrieveJWT)
//Load the route index

const routes = require('./routes/index');

//Initiallize Route
routes.initialize(app);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	let err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(function (err, req, res, next) {
		res.status(err.status || 500);
		res.json({
			message: err.message,
			error: err
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
	res.status(err.status || 500);
	res.json({
		message: err.message,
		error: {}
	});
});


/**
 *@description For parsing XML request
 *@author Fahid Mohammad
 *@date 20-07-2017
 */
function customBodyParser(req, res, next) {
	let contype = req.headers['content-type'];
	req.xmlBody = '';
	if (contype === 'application/xml' || contype === 'text/xml') {
		let data = '';
		req.setEncoding('utf8');
		req.on('data', function (chunk) {
			data += chunk;
		});
		req.on('end', function () {
			req.xmlBody = data;
			next();
		});
	} else {
		next();
	}
}

module.exports = app;