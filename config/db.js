// Bring Mongoose into the app 
const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
const config = require('config');

/**
 *Set MongoDB URL based on Environment
 */
var DBURI = config.get('mongoDBURL');


// Create the database connection 
mongoose.connect(DBURI, { useNewUrlParser: true, useFindAndModify: false }, function(error) {
	if (error) {
		console.log(error);
	}
});

// CONNECTION EVENTS
// When successfully connected
mongoose.connection.on('connected', function() {
	console.log('Mongoose default connection open to ' + DBURI);
});

// If the connection throws an error
mongoose.connection.on('error', function(err) {
	console.log('Mongoose default connection error: ' + err);
});

// When the connection is disconnected
mongoose.connection.on('disconnected', function() {
	console.log('Mongoose default connection disconnected');
});

// If the Node process ends, close the Mongoose connection 
process.on('SIGINT', function() {
	mongoose.connection.close(function() {
		console.log('Mongoose default connection disconnected through app termination');
		process.exit(0);
	});
});