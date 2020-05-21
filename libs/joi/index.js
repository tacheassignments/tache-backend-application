'use strict'
/**
 * @description validate the request with the JOI
 */
let Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
module.exports = {

    userCreation: (reqObj) => {
        let schema = {
            name: Joi.string().min(3).required().trim(),
            email: Joi.string().email().required(),
            mobile: Joi.number().required(),
            password: Joi.string().required()
        }
        let validation = Joi.validate(reqObj, schema);
        return validation;
    },

    login: (reqObj) => {
        let schema = {
            email: Joi.string().email().required(),
            password: Joi.string().required()
        }
        let validation = Joi.validate(reqObj, schema);
        return validation;
    },
}