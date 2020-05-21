const _ = require('lodash');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
module.exports = {
    arrayTomap: (objects, key, flag) => {
        let map = {}
        for (let o of objects) {
            if (o[key]) {
                map[o[key]] = o
                if (flag) {
                    delete o[key]
                }
            }
        }
        return map
    },
    //http post request
    httpPost: (args, callback) => {
        let headers = (args.headers) ? args.headers : { "content-type": "application/json" }
        _request({
            url: args.uri,
            headers: headers,
            method: "POST",
            body: JSON.stringify(args.data),
            time: true
        }, (error, response, body) => {
            if (!error && body) {
                //parse body and check for any parse error
                let parsedData = parseData(body);
                if (parsedData)
                    return callback(null, parsedData);
                return callback({ status: "parse Error" }, null);
            }
            return callback(error, null);
        });
    },
    //http get request
    httpGet: (args, callback) => {
        let headers = (args.headers) ? args.headers : { "content-type": "application/json" }
        request({
            url: args.uri,
            headers: headers,
            method: "GET",
            body: JSON.stringify(args.data),
            time: true
        }, (error, response, body) => {
            if (!error && body) {
                //parse body and check for any parse error
                let parsedData = parseData(body);
                if (parsedData)
                    return callback(null, parsedData);
                return callback({ status: "parse Error" }, null);
            }
            return callback(error, null);
        });
    },
    //Parse to JSON using lodash
    _parseJson: function (data) {
        return _.attempt(JSON.parse.bind(null, data));
    },

	/**
	 *@description Write Log Files
	 *@params String
	 *@params Array
	 *@return Boolean
	 *@author Fahid Mohammad
	 *@date 15/12/2015 13:10
	 */
    logWriter: function (data, filename, folderName, append) {
        if (typeof data === 'object') {
            data = JSON.stringify(data);
        }
        logPath = this.createLogFolder(folderName);
        var currentDate = moment().format('DD-MM-YYYY');
        logPath = logPath + filename + '.log';
        if (append) {
            var newData = "\n" + data;
            fs.appendFile(logPath, newData);
        } else {
            fs.writeFileSync(logPath, data);
        }
    },

    createLogFolder: function createLogFolder(folderName) {
        var currentDate = moment().format('DD-MM-YYYY');
        var logPathDir = path.join(__dirname, '../../../CARRY_IT');
        if (!fs.existsSync(logPathDir)) {
            fs.mkdirSync(logPathDir);
        }
        logPathDir = path.join(logPathDir + '/' + currentDate);
        if (!fs.existsSync(logPathDir)) {
            fs.mkdirSync(logPathDir);
        }
        logPathDir = path.join(logPathDir + '/' + folderName);
        if (!fs.existsSync(logPathDir)) {
            fs.mkdirSync(logPathDir);
        }
        return logPathDir + "/";
    }
}

// parse Data
let parseData = (data) => {
    try {
        let parsedData = JSON.parse(data);
        return parsedData;
    } catch (e) {
        return null;
    }


}