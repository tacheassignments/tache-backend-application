'use strict'
/**
 *@description Trip Types
 *@author Nahl
 *@since July 28 2019
 */
const mongoose = require('mongoose')
module.exports = {
    add: (body, callback) => {
        new mongoose.models[body.mod](body.obj).save((e, s) => {
            callback(s)
        })
    }
}