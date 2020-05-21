/**
 * @description User Module
 * @author Fahid Mohammad, Harikrishna
 */
// load dependencies
const twilio = require('../../libs/twilio')
    , common = require('../../libs/utils/common')
    , randomKey = require('random-key')
    , auth = require('../../libs/auth')
    , helpAdaptor = require('../../libs/helper')
    , bcrypt = require('bcrypt')
    , mailer = require('../../libs/mailer')

// Create New User (sign up)
const CreateUser = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in creaticallbackng user',
        response: null
    }
    if (!(args && args.code && args.email && args.number)) {
        responseObj.message = "Please provide all required fields"
        return callback(responseObj);
    }

    let conditionCheck = true
    let checkUser = (lCallback) => {
        _mongoose.models['Users'].findOne({ $or: [{ email: args.email }, { $and: [{ code: args.code }, { number: args.number }] }] }, (e, d) => {
            //if (d && d.verified) {
            if (d) {
                let errMsg = "user already exists";
                if (_.isEqual(d.number, args.number)) {
                    errMsg = "user already exists with the " + args.number;
                } else if (_.isEqual(d.email, args.email)) {
                    errMsg = "user already exists with the " + args.email;
                }
                conditionCheck = false
                responseObj.message = errMsg;
                return callback(responseObj);
            } else {
                return lCallback()
            }
        })
    }
    let saveUser = (lCallback) => {
        if (!conditionCheck) return lCallback();
        args.idProofAuth = "pending";
        args.uid = randomKey.generateDigits(8)
        new _mongoose.models['Users'](args).save((e, s) => {
            if (e || !s) {
                conditionCheck = false
            }
            return lCallback()
        })
    }
    let sendOTP = (lCallback) => {
        //if (!conditionCheck) return lCallback()
        twilio.sendOTP(args, (response) => {
            if (response && response.status === _status.SUCCESS) {
                responseObj.status = _status.SUCCESS
                responseObj.message = "otp sent successfully to +" + args.code + " " + args.number
                responseObj.response = {
                    number: args.number,
                    code: args.code
                }
                console.log('otp sent successfully')
            } else {
                responseObj.message = response.message
                //responseObj.message = "Error in sending OTP"
                conditionCheck = false
            }
            return lCallback()
        })
    }
    _async.series([
        checkUser.bind(),
        //saveUser.bind(),
        sendOTP.bind()
    ], () => {
        return callback(responseObj)
    })
}

// Authenticate User
const VerifyUser = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: "Error in verifying user",
        response: null
    }
    let conditionCheck = true
    let userInfo = null
    let oldPassword = ''
    if (!(args && args.code && args.number && args.otp)) {
        responseObj.message = "Please enter required fields";
        return callback(responseObj);
    }
    let verifyOTP = (lCallback) => {
        twilio.verifyOTP(args, (response) => {
            if (response && response.status === _status.SUCCESS) {
                console.log('verified otp successfully')
            } else {
                responseObj.message = response.message;
                responseObj.status = response.status;
                conditionCheck = false
            }
            return lCallback()
        })
    }

    let hashPassword = (cb) => {
        oldPassword = args.password
        bcrypt.hash(args.password, 10, function (err, hash) {
            if (err) {
                responseObj.message = "Error in encrypt the password."
                return callback(responseObj);
            }
            args.password = hash;
            return cb();
        });
    }

    let saveUser = (lCallback) => {
        if (!conditionCheck) return callback(responseObj);
        if (!(args && args.code && args.number && args.email && args.password)) {
            responseObj.message = "Please provide all required fields"
            return callback(responseObj);
        }

        if (args.password.length < 8) {
            responseObj.message = "Password length should be max of 8 charaters"
            return callback(responseObj);
        }
        args.uid = randomKey.generateDigits(8);
        let { fname, lname, number, code, email, uid, pic } = args;
        userInfo = {
            fname: fname,
            lname: lname,
            number: number,
            code: code,
            email: email,
            uid: uid,
            pic: pic || null
        }
        args.idProofAuth = "pending";
        args.verified = true
        delete args.otp;
        _mongoose.models['Users'](args).save((e, s) => {
            if (e || !s) {
                conditionCheck = false
            }
            return lCallback()
        })
    }

    let updateUser = (lCallback) => {
        if (!conditionCheck) return lCallback()
        _mongoose.models['Users'].findOne({ number: args.number }, (e, s) => {
            if (e) return lCallback()
            let { fname, lname, number, code, email, uid, pic } = s
            userInfo = {
                fname: fname,
                lname: lname,
                number: number,
                code: code,
                email: email,
                uid: uid,
                pic: pic || null
            }
            s.verified = true
            s.save((err) => {
                if (!err) return lCallback()
                conditionCheck = false
                return lCallback()
            })
        })
    }

    // generate accessToken
    let generateJWT = (lCallback) => {
        if (!conditionCheck) return callback(responseObj)
        responseObj.status = _status.SUCCESS
        responseObj.message = "verified user successfully"
        responseObj.response = {
            accesstoken: auth.generateJWT(userInfo),
            userInfo: userInfo
        }
        return lCallback()
    }

    let sendMail = (lCallback) => {


    //     let data = {
    //         body: {
    //             template: "register",
    //             //toemail: args.email,
    //             //subject: "New User",
    //             userId: userInfo.uid
    //         }
    //     }

    //     let emailInfo = {
    //         emailType: 'register',
    //         isSend: false,
    //         data: data
    //     }
    //     mailer.sendMail({
    //         template: "register",
    //         userId: userInfo.uid
    //     }, function (res) {
    //         if (res && res.status == 1000) {
    //             emailInfo.isSend = true
    //         } else {
    //             emailInfo.isSend = false
    //         }
    //         _mongoose.models['Emails'].create(emailInfo, (err, data) => {
    //             return lCallback();
    //         })
    //     })
    }
    let seriesArr = [verifyOTP.bind()];
    if (args.hasOwnProperty("forgot") && _.isEqual(args.forgot, true)) {
        seriesArr.push(updateUser.bind());
    } else {
        seriesArr.push(hashPassword.bind())
        seriesArr.push(saveUser.bind())
        // seriesArr.push(sendMail.bind())

    }
    seriesArr.push(generateJWT.bind())
    //TODO: Your Logic
    _async.series(seriesArr, () => {
        mailer.sendMail({
            template: "register",
            userId: userInfo.uid,
            lang: 'en'
        }, () => {

        })
        return callback(responseObj)
    })
}

// login user
const Login = (args, callback) => {
    let conditionCheck = true
    let userInfo = null
    let responseObj = {
        status: _status.ERROR,
        message: 'Error during login',
        response: null
    }
    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(args, "userLoginRQ-" + currentTime, "User-Login")
    if (!(args && args.code && args.number && args.password)) {
        responseObj.message = "Please enter required fields";
        return callback(responseObj);
    }

    let checkUser = (lCallback) => {
        _mongoose.models['Users'].findOne({ number: args.number, code: args.code }, (e, d) => {
            if (e) {
                conditionCheck = false
                return lCallback()
            } else {
                if (!d || _.isEmpty(d)) {
                    conditionCheck = false;
                    responseObj.message = "Your given number ( +" + args.code + " " + args.number + " ) is not registerd, please signup and try";
                    return lCallback()
                } else {
                    let logStatus = (cb) => {
                        bcrypt.compare(args.password, d.password, function (err, res) {
                            if (err || !res) {
                                conditionCheck = false;
                                responseObj.message = "Incorrect password.";
                                return callback(responseObj)
                            }
                            return cb()
                        });
                    }
                    let userData = (cb) => {
                        if (d.verified) {
                            let { fname, lname, number, code, email, uid, pic } = d
                            userInfo = {
                                fname: fname,
                                lname: lname,
                                number: number,
                                code: code,
                                email: email,
                                uid: uid,
                                pic: pic || null
                            }
                        } else {
                            responseObj.message = "+" + args.code + "" + args.number + " number registered but not verified, please try forgot password";
                            conditionCheck = false;
                        }
                        return cb();
                    }
                    _async.series([
                        logStatus.bind(),
                        userData.bind()
                    ], () => {
                        return lCallback()
                    })
                }
            }
        })
    }

    let generateJWT = (lCallback) => {
        if (!conditionCheck) return callback(responseObj)
        responseObj.status = _status.SUCCESS
        responseObj.message = "user logged in successfully"
        responseObj.response = {
            accesstoken: auth.generateJWT(userInfo),
            userInfo: userInfo
        }
        return lCallback()
    }
    _async.series([
        checkUser.bind(),
        generateJWT.bind()
    ], () => {
        helpAdaptor.logWriter(responseObj, "userLoginRS-" + currentTime, "User-Login")
        return callback(responseObj)
    })
}

// Get all the customers B2E
const GetUsers = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error in fetching customers',
        response: null,
        total: 0
    }
    let body = { verified: true }
    let filter = {}
    if (args.key && args.key != '') {
        //filter["$and"] = []
        let key = args.key.replace(/[&\\\#,+()$~%.'":*?<>{}]/g, '')
        filter["$or"] = [
            { fname: new RegExp(key, 'i') },
            { lname: new RegExp(key, 'i') },
            { fullName: new RegExp(key, 'i') },
            { code: new RegExp(key, 'i') },
            { number: new RegExp(key, 'i') },
            { mobile: new RegExp(key, 'i') }
        ]

        // key = key.split('/')
        // if (key[0]) {
        //     filter["$and"].push(
        //         {'$or' : [
        //             { fname: new RegExp(key[0], 'i') },
        //             { lname: new RegExp(key[0], 'i') },
        //             { fullName: new RegExp(key[0], 'i') }]
        //         })
        // } 
        // if (key[1]) {
        //     filter["$and"].push({number: new RegExp(key[1], 'i') })
        // }

    }

    if (args["isVerified"]) {
        if (_.isEmpty(filter["$and"])) {
            filter["$and"] = [];
        }
        filter["$and"].push(
            {
                "$or": [
                    { "idProofAuth": new RegExp(args["isVerified"], 'i') },
                    { "idProofAuth": { "$exists": false } }
                ]
            })
    }

    let getUserList = (cb) => {
        let agg = _mongoose.models["Users"]["getAllUsers"](body, filter, {})
        //  _mongoose.models["Trip"].aggregate(agg).skip(body.offset).limit(body.limit).exec((err, docs) => {
        _mongoose.models['Users'].aggregate(agg).skip(args.offset).limit(args.limit).exec((e, d) => {
            if (!e && d) {
                _.forEach(d, o => {
                    _.set(o, 'active', true)
                })
                responseObj.status = _status.SUCCESS
                responseObj.message = 'customers fetched successfully'
                responseObj.response = d
            }
            return cb();
        })
    }

    let getUserCount = (cb) => {
        _mongoose.models["Users"].countDocuments(filter, (err, count) => {
            if (!err && count) {
                responseObj.total = count
            }
            return cb();
        })
    }

    _async.parallel([getUserList.bind(), getUserCount.bind()], () => {
        return callback(responseObj)
    })
}
// get single customer details for operations
const getOneUser = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error in fetching customers',
        response: {}
    }
    // let body = {
    //     uid: args.uid
    // }

    // customer basic information
    let userInfo = (cb) => {
        _mongoose.models['Users'].findOne({ uid: args.uid }, (err, doc) => {
            if (!err && doc) {
                responseObj.status = _status.SUCCESS,
                    responseObj.message = 'Customer Information'
                responseObj.response['userInfo'] = doc
            }
            return cb();
        })
    }

    // list of trips added by customer
    let cityIdArr = []
    let tripInfo = (cb) => {
        let filter = {}
        let agg = _mongoose.models["Trip"]["getOneTrip"]({ userId: args.uid }, filter, { lang: "en" })
        _mongoose.models["Trip"].aggregate(agg).exec((err, docs) => {
            if (docs && docs.length) {
                for (let d of docs) {
                    d.depDate = _moment(d.depDate, 'YYYY-MM-DD').format("DD MMM YY")
                    d.arrDate = _moment(d.arrDate, 'YYYY-MM-DD').format("DD MMM YY")
                    if (d.pick && d.pick.fDate && d.pick.tDate) {
                        d.pick.fDate = _moment(d.pick.fDate, 'YYYY-MM-DD').format("DD MMM YY")
                        d.pick.tDate = _moment(d.pick.tDate, 'YYYY-MM-DD').format("DD MMM YY")
                    }
                    if (d.deliver && d.deliver.fDate && d.deliver.tDate) {
                        d.deliver.fDate = _moment(d.deliver.fDate, 'YYYY-MM-DD').format("DD MMM YY")
                        d.deliver.tDate = _moment(d.deliver.tDate, 'YYYY-MM-DD').format("DD MMM YY")
                    }
                    cityIdArr.push(parseInt(d.from))
                    cityIdArr.push(parseInt(d.to))
                    // d.city = common.arrayTomap(d.city, "cityId", true)
                }
                responseObj.response['tripInfo'] = docs
            }
            return cb();
        })
    }

    // list of carry req made by customers
    let carryReq = (cb) => {
        let filter = {}
        let agg = _mongoose.models["CarryRequests"]["getOneRequest"]({ userId: args.uid, status: {"$nin": ['onHold'] }}, filter, { lang: "en" })
        _mongoose.models["CarryRequests"].aggregate(agg).exec((err, docs) => {
            if (docs && docs.length) {
                for (let d of docs) {
                    d.depDate = _moment(d.trip.depDate, 'YYYY-MM-DD').format("DD MMM YY")
                    d.arrDate = _moment(d.trip.arrDate, 'YYYY-MM-DD').format("DD MMM YY")
                    // d.city = common.arrayTomap(d.city, "cityId", true)
                    d.from = d.trip.from
                    d.to = d.trip.to
                    // delete d.city
                    cityIdArr.push(parseInt(d.trip.from))
                    cityIdArr.push(parseInt(d.trip.to))
                    delete d.trip
                }
                responseObj.response['carryReq'] = docs
            }
            return cb();
        })
    }

    // list of wallet transactions
    let walletInfo = (cb) => {
        _mongoose.models['WalletInfo'].find({ userId: args.uid }, (err, docs) => {
            if (!err && docs) {
                let temp = JSON.parse(JSON.stringify(docs))
                for (let d of temp) {
                    d.transactionDate = _moment(d.createdAt).format('DD/MM/YYYY hh:mm A')
                }
                responseObj.status = _status.SUCCESS,
                    responseObj.message = 'Wallet Transactions'
                responseObj.response['walletInfo'] = temp
            }
        })
        return cb();
    }

    // get city map data
    let getCityData = (cb) => {
        let params = {
            lang: "en",
            cityIds: cityIdArr
        }
        let agg = _mongoose.models["CityPredictive"]["cityName"]({}, {}, params)
        _mongoose.models["CityPredictive"].aggregate(agg).exec((err, docs) => {
            if (docs && docs.length) {
                responseObj['cityMap'] = common.arrayTomap(docs, "cityId", true)
            }
            return cb()
        })
    }

    // get bank account details
    let bankDetails = (cb) => {
        _mongoose.models['BankInfo'].findOne({ userId: args.uid }, '-_id -updatedAt').exec((err, data) => {
            if (!err || data) {
                responseObj.response['bankDetails'] = data
            }
            return cb();
        });
    }

    // get carrier transactions
    const getCarrierTxn = (cb) => {
        _mongoose.models['TravellerAccount'].find({ 'carrierUid': args.uid }).exec((err, docs) => {
            if (!err && docs.length) {
                let temp = JSON.parse(JSON.stringify(docs))
                for (let d of temp) {
                    d.createdAt = _moment(d.createdAt).format('DD/MM/YYYY hh:mm A')
                }
                responseObj.response['accountStatement'] = temp
            }
            return cb();
        })
    }

    _async.parallel([
        userInfo.bind(),
        tripInfo.bind(),
        carryReq.bind(),
        bankDetails.bind(),
        getCarrierTxn.bind(),
        walletInfo.bind()
    ], () => {
        _async.parallel([getCityData.bind()], () => {
            return callback(responseObj)
        })
    })

}
// Remove the customer
const RemoveUser = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error in removing customers'
    }
    _mongoose.models['Users'].findOneAndDelete({ number: args.phone }, (e, d) => {
        if (!e && d) {
            responseObj.status = _status.SUCCESS
            responseObj.message = 'customers removed successfully'
        }
        return callback(responseObj)
    })
}

// Forgot password -> check and send the otp
const Fgtpwd = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error while sending sms',
        response: null
    }
    let conditionCheck = true
    let checkUser = (lCallback) => {
        _mongoose.models['Users'].findOne({ number: args.number, code: args.code }, (e, d) => {
            if (e || !d) {
                responseObj.status = _status.DB_ERROR
                responseObj.message = "user doesn't exist. signup to continue"
                conditionCheck = false
            }
            return lCallback()
        })
    }
    let sendOTP = (lCallback) => {
        if (!conditionCheck) return callback(responseObj)
        twilio.sendOTP(args, (response) => {
            if (response && response.status === _status.SUCCESS) {
                responseObj.status = _status.SUCCESS
                responseObj.message = "otp sent successfully to +" + args.code + " " + args.number
                responseObj.response = {
                    number: args.number,
                    code: args.code
                }
                console.log('otp sent successfully')
            } else {
                conditionCheck = false
            }
            return lCallback()
        })
    }
    _async.series([
        checkUser.bind(),
        sendOTP.bind()
    ], () => {
        return callback(responseObj)
    })
}

//set password
const Setpwd = (req, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error while setting password',
        response: null
    }
    if (!(req.body && req.body.password)) {
        responseObj.message = "Please enter required fields."
        return callback(responseObj);
    }
    if (req.body.password.length < 8) {
        responseObj.message = "The length of the password should be 8 characters."
        return callback(responseObj);
    }
    _mongoose.models['Users'].findOne({ uid: req.userInfo.uid }).exec((e, d) => {
        if (!e && d) {
            let encryptPassword = (cb) => {
                bcrypt.hash(req.body.password, 10, function (err, hash) {
                    if (err) {
                        responseObj.message = "Error in encrypt the password."
                        return callback(responseObj);
                    }
                    req.body.password = hash;
                    return cb();
                });
            }
            let savePwd = (cb) => {
                d.password = req.body.password
                d.save(function (err) {
                    if (err) {
                        responseObj.status = _status.DB_ERROR
                        return callback(responseObj)
                    } else {
                        responseObj.status = _status.SUCCESS
                        responseObj.message = "password set successfully"
                        return callback(responseObj)
                    }
                })
            }
            _async.series([
                encryptPassword.bind(),
                savePwd.bind()
            ], () => {
                return callback(responseObj)
            })
        } else {
            responseObj.status = _status.DB_ERROR
            responseObj.message = 'DB Error'
            return callback(responseObj)
        }
    })
}

//change password
const Changepwd = (req, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error while changing password',
        response: null
    }
    if (!(req.body && req.body.oldpw && req.body.newpw)) {
        responseObj.message = "Please enter required fields";
        return callback(responseObj)
    }

    if (_.isEqual(req.body.oldpw, req.body.newpw)) {
        responseObj.message = "Old password and new password are same give different password";
        return callback(responseObj);
    }

    _mongoose.models['Users'].findOne({ uid: req.userInfo.uid }).exec((e, d) => {
        if (!e && d) {
            let checkPwd = (cb) => {
                bcrypt.compare(req.body.oldpw, d.password, function (err, res) {
                    if (err || !res) {
                        conditionCheck = false;
                        responseObj.message = 'You entered old password is incorrect'
                        return callback(responseObj)
                    }
                    return cb()
                });
            }

            let encryptPassword = (cb) => {
                bcrypt.hash(req.body.newpw, 10, function (err, hash) {
                    if (err) {
                        responseObj.message = "Error in encrypt the password."
                        return callback(responseObj);
                    }
                    req.body.newpw = hash;
                    return cb();
                });
            }

            let updatepwd = (cb) => {
                _mongoose.models['Users'].findOneAndUpdate({ 'uid': req.userInfo.uid }, { $set: { password: req.body.newpw } }, (err, res) => {
                    if (err || !res) {
                        responseObj.message = "Error while change the password";
                        responseObj.status = _status.ERROR;
                        return callback(responseObj);
                    } else {
                        responseObj.status = _status.SUCCESS
                        responseObj.message = "password changed successfully"
                        return callback(responseObj)
                    }
                });
            }

            _async.series([
                checkPwd.bind(),
                encryptPassword.bind(),
                updatepwd.bind()
            ], () => {
                return callback(responseObj)
            })

            // if (d.password == req.body.oldpw) {
            //     d.password = req.body.newpw
            //     d.save(function (err) {
            //         if (err) {
            //             responseObj.status = _status.DB_ERROR
            //             return callback(responseObj)
            //         } else {
            //             responseObj.status = _status.SUCCESS
            //             responseObj.message = "password changed successfully"
            //             return callback(responseObj)
            //         }
            //     })
            // } else {
            //     responseObj.message = 'old password you entered is incorrect'
            //     return callback(responseObj)
            // }
        } else {
            responseObj.status = _status.DB_ERROR
            responseObj.message = 'DB Error'
            return callback(responseObj)
        }
    })
}

// edit profile
const EditProfile = (req, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error while editing profile',
        response: null
    }
    _mongoose.models['Users'].findOne({ uid: req.userInfo.uid }).exec((e, d) => {
        if (!e && d) {
            d.fname = req.body.fname
            d.lname = req.body.lname
            d.pic = req.body.pic
            d.save(function (err) {
                if (err) {
                    responseObj.status = _status.DB_ERROR
                    return callback(responseObj)
                } else {
                    responseObj.status = _status.SUCCESS
                    responseObj.message = "profile updated successfully"
                    let userInfo = {
                        fname: d.fname,
                        lname: d.lname,
                        number: d.number,
                        code: d.code,
                        email: d.email,
                        uid: d.uid,
                        pic: d.pic || null
                    }
                    responseObj.response = {
                        accesstoken: auth.generateJWT(userInfo),
                        userInfo: userInfo
                    }
                    return callback(responseObj)
                }
            })
        } else {
            responseObj.status = _status.DB_ERROR
            responseObj.message = 'DB Error'
            return callback(responseObj)
        }
    })
}

// Id proof verification status
const idProofVerification = (req, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error while editing profile',
        response: null
    }
    _mongoose.models['Users'].findOne({ 'uid': req.body.uid }, (err, res) => {
        if (!err && res) {
            res['idProofAuth'] = req.body.idProofAuth
            res['reason'] = req.body.reason
            res.save(() => {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Success'
                responseObj.response = res
                return callback(responseObj)
            })
        } else {
            return callback(responseObj)
        }
    })
}

const hashing = (req, callback) => {
    _mongoose.models['Users'].find({}, (err, res) => {
        if (!err) {
            for (let d of res) {
                bcrypt.hash(d.password, 10, function (err, hash) {
                    if (!err) {
                        d.password = hash
                    }
                    d.save((err, res) => {

                    })
                });
            }
            return callback({ 'status': 'success' })
        }
    })
}

module.exports = {
    CreateUser,
    VerifyUser,
    Login,
    GetUsers,
    RemoveUser,
    getOneUser,
    Fgtpwd,
    Setpwd,
    EditProfile,
    Changepwd,
    idProofVerification,
    hashing
};
