/**
 *@author 
 *@description Dummy Schema
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
	UID: { type: String, required: true, unique: true },
	VALUE: { type: String, required: true },
	insertedDate: { type: Date, default: Date.now }
}, {
	autoIndex: false,
	versionKey: false
});
module.exports = mongoose.model("DummySchema", schema, 'DummySchema');
