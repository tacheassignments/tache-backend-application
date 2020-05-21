/**
 *@author 
 *@description Carryit user schema
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    uid: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true},
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date }
}, {

	autoIndex: false,
    versionKey: false,
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

schema.statics = {
    getAllUsers: function(f, o, p) {
        let pipe = [{
            "$match": f
        },
        {
            "$project": {
                "_id": 0.0,
                "fname": 1.0,
                "lname": 1.0,
                "uid": 1.0,
                "code": 1.0, 
                "number": 1.0,
                "fullName": {"$concat": ["$fname"," ","$lname"]},
                "mobile": {"$concat": ["$code","$number"]},
                "idProofAuth": 1
            }
        },
        {
            "$match": o
        }]
        return pipe
    }
}
module.exports = mongoose.model("Users", schema, 'Users');
