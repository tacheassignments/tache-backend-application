'use strict'
/*
** Author: Saif
Description: Encrypt and decrypt jwt token
*/
var crypto = require('crypto')
var alogorithm = 'aes-256-cbc'
exports.encrypt = function(text) {
	var cipher = crypto.createCipher(alogorithm,_config.encryptedKey)
	var encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted = encrypted + cipher.final('base64')
	return encrypted
}

exports.decrypt = function(text) {
	var decipher = crypto.createDecipher(alogorithm,_config.encryptedKey)
	var decrypted = decipher.update(text, 'base64', 'utf8');
    decrypted = decrypted + decipher.final('utf8');
	return decrypted
}