'use strict';
/**
 * @description service for token
 * @author Fahid Mohammad
 * @date 20-12-2018
 */
let jwt_token = require('jsonwebtoken');
let config = require('config');
let encryptAndDecrypt = require("./encrypt-decrypt");

module.exports = {
    /**
     * @description Authenticate JWT Token over request header
     */
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
}
