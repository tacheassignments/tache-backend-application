'use strict'
/**
 * @description user controller
 * @author 
 */

let user = require('../../tache_modules/user')
    , express = require('express')
    , router = express.Router()
    , joi = require('../../libs/joi')

// user sign up service
router.post('/signup', (req, res) => {
    let validation = joi.userCreation(req.body)
    if (validation.error == null) {
        user.CreateUser(req.body, result => {
            res.json(result);
        })
    } else {
        res.send({
            status: 1003,
            message: "Request object format error",
            desc: validation.error.details[0].message || validation.error
        });
    }
})

// login user
router.post('/login', (req, res) => {
    let validation = joi.login(req.body)
    if (validation.error == null) {
        user.Login(req.body, result => {
            res.json(result);
        })
    } else {
        res.send({
            status: 1003,
            message: "Request object format error",
            desc: validation.error.details[0].message || validation.error
        });
    }
})

router.post('/forgot', (req, res) => {
    user.forgot(req.body, result => {
        res.json(result);
    })
})

router.post('/setPassword', (req, res) => {
    user.setPassword(req.body, result => {
        res.json(result);
    })
})

module.exports = router