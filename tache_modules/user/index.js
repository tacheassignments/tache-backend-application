/**
 * @description User Module
 * @author 
 */
// load dependencies
const common = require('../../libs/utils/common')
    , randomKey = require('random-key')
    , auth = require('../../libs/auth')
    , helpAdaptor = require('../../libs/helper')
    , bcrypt = require('bcrypt')

// Create New User (sign up)
const CreateUser = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in create user',
        response: {}
    }

    let userInfo = {
        name: args.name,
        mobile: args.mobile,
        email: args.email
    }

    // check if user already exists
    let checkUser = (cb) => {
        _mongoose.models['Users'].findOne({ $or: [{ email: args.email }, { mobile: args.mobile }] }, (e, d) => {
            if (d) {
                let errMsg = "user already exists";
                if (d.mobile == args.mobile) {
                    errMsg = "user already exists with the mobile number " + args.mobile;
                } else if (_.isEqual(d.email, args.email)) {
                    errMsg = "user already exists with the email id " + args.email;
                }
                responseObj.message = errMsg;
                return callback(responseObj);
            } else {
                return cb()
            }
        })
    }

    let hashPassword = (cb) => {
        bcrypt.hash(args.password, 6, function (err, hash) {
            if (err) {
                responseObj.message = "Error in encrypt the password."
                return callback(responseObj);
            }
            args.password = hash;
            return cb();
        });
    }

    // save user details
    let saveUser = (cb) => {
        args.uid = randomKey.generateDigits(8)
        userInfo.uid = args.uid;
        new _mongoose.models['Users'](args).save((e, s) => {
            if (!s || e) {
                responseObj.message = e
                return callback(responseObj)
            } else {
                return cb()
            }
        })
    }

    // generate accessToken
    let generateJWT = (lCallback) => {
        responseObj.status = _status.SUCCESS
        responseObj.message = "Success"
        responseObj.response = {
            accesstoken: auth.generateJWT(userInfo),
            userInfo: userInfo
        }
        return lCallback()
    }
    
    _async.series([
        checkUser.bind(),
        hashPassword.bind(),
        saveUser.bind(),
        generateJWT.bind()
    ], () => {
        return callback(responseObj)
    })
}

// login user (sign in)
const Login = (args, callback) => {
    let userInfo = {}
    let responseObj = {
        status: _status.ERROR,
        message: 'Error during login',
        response: {}
    }
    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(args, "userLoginRQ-" + currentTime, "User-Login")

    let checkUser = (cb) => {
        _mongoose.models['Users'].findOne({ email: args.email }, (e, d) => {
            if (e) {
                return callback(responseObj)
            } else {
                if (!d || _.isEmpty(d)) {
                    responseObj.message = "Your given email id ( " + args.email + " ) is not registerd, please signup and try";
                    return callback(responseObj)
                } else {
                    let logStatus = (cb) => {
                        bcrypt.compare(args.password, d.password, function (err, res) {
                            if (err || !res) {
                                responseObj.message = "Invalid user details";
                                return callback(responseObj)
                            }
                            return cb()
                        });
                    }
                    let userData = (cb) => {
                        let { name, mobile, email, uid } = d
                        userInfo = {
                            name: name,
                            mobile:  mobile,
                            email: email,
                            uid: uid,
                        }
                        return cb();
                    }
                    _async.series([
                        logStatus.bind(),
                        userData.bind()
                    ], () => {
                        return cb()
                    })
                }
            }
        })
    }

    let generateJWT = (lCallback) => {
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

const forgot = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in during forgot password',
        response: {}
    }

    _mongoose.models['Users'].findOne({ email: args.email }, (e, d) => {
        if (e) {
            return callback(responseObj)
        } else {
            return callback({
                status: _status.SUCCESS,
                message: "email id exists"
            })
        }
    });
}

const setPassword = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in during forgot password',
        response: {}
    }

    _mongoose.models['Users'].findOne({ email: args.email }, (e, d) => {
        if (e) {
            return callback(responseObj)
        } else {
            let hashPassword = (cb) => {
                bcrypt.hash(args.password, 6, function (err, hash) {
                    if (err) {
                        responseObj.message = "Error in encrypt the password."
                        return callback(responseObj);
                    }
                    d.password = hash;
                    return cb();
                });
            }
            let changePassword = (cb) => {
                new _mongoose.models['Users'](d).save((e, d) => {
                    if (!e && d) {
                        responseObj.status = _status.SUCCESS;
                        responseObj.message = 'successfully set password';
                        //responseObj.data = d;
                        return cb();
                    } else if (e) {
                        responseObj.error = e;
                        return cb();
                    }
                })
            }
            _async.series([
                hashPassword.bind(),
                changePassword.bind()
            ], () => {
                return callback(responseObj)
            })
        }
    });
}

module.exports = {
    CreateUser,
    Login,
    forgot,
    setPassword
};
