'use strict'
/**
 * @author 
 * @description authentication module
 */

const JWT = require('jsonwebtoken')
const encryptDecrypt = require('../utils/encrypt-decrypt')

// generate JWT
const generateJWT = (args) => {
    //return JWT.sign(args, "carryit_auth", { expiresIn: 900 * 60 })
    let _token =  JWT.sign(args, _config.jwtSecret)
     return encryptDecrypt.encrypt(_token)
}

const retrieveJWT = (req, res, callback) => {
    req.lang = (req.headers.lang) ? req.headers.lang.substring(0, 2): 'en';
    req.userInfo = null
    if (req.headers && req.headers.accesstoken) {
        let _token = encryptDecrypt.decrypt(req.headers.accesstoken)
        JWT.verify(_token, _config.jwtSecret, (err, res) => {
            if (res) {
                req.userInfo = res
            }
            return callback()
        })
    } else {
        return callback()
    }
}

isAuthenticated:(req) => {
    let responseObj = {
        status: 2000,
        error: "Unauthorised",
        desc: "Invalid token. Please login to make this request."
    }
    return new Promise(function(resolve, reject){
        //TODO: Need to setup proper token security
        //Uncomment below code with security implementation
        /* if (req.headers.authorization) {
            var decryptedToken = encryptAndDecrypt.decrypt(req.headers.authorization)
        } else {
            reject(responseObj)
        }

        jwt_token.verify(decryptedToken, config.get('jwtSecret'), function (err, token) {
            if (err) {
                reject(responseObj)
            } else if (token) {
                resolve(token);
            } else {
                reject(responseObj)
            }
        }); */
        if (req.headers.accesstoken) {
            jwt_token.verify(req.headers.accesstoken, 'carryit_auth', function (err, token) {
                if (err) {
                    reject(responseObj)
                } else if (token) {
                    resolve(token);
                } else {
                    reject(responseObj)
                }
            });
        }else{
            reject(responseObj)
        }
    })
}

module.exports = {
    generateJWT,
    retrieveJWT
}