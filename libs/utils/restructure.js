const _ = require('lodash')
    , moment = require('moment')
    , keymapper = require('./key-mapping.js');

module.exports = {
    //mapping object received from server for client use
    mapServerToClient: ms2c,
    //mapping object received from client for server use
    mapClientToServer: mc2s
}

function mc2s(obj) {
    return _.transform(obj, function (result, value, key) {
        // if the key is in keysMap use the replacement, if not use the original key
        var currentKey = keymapper.c2s[key] || key;
        // if the key is an object run it through the inner function - replaceKeys
        result[currentKey] = _.isObject(value) ? mc2s(value) : value;
    });
}

function ms2c(obj) {
    return _.transform(obj, function (result, value, key) {
        // if the key is in keysMap use the replacement, if not use the original key
        var currentKey = keymapper.s2c[key] || key;
        // if the key is an object run it through the inner function - replaceKeys
        if (_.isDate(value)) {
            result[currentKey] = moment(value).format("YYYY-MM_DD");
        }else{
            result[currentKey] = _.isObject(value) ? ms2c(value) : value;
        }
        

    });
}
