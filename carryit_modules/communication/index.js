'use strict'
/**
 * @description Communicatio Module
 * @author Fahid Mohammad
 * @date 22-09-2019
 */
const randomstring = require("randomstring")
    , common = require('../../libs/utils/common')
    , restructure = require('../../libs/utils/restructure')
    , helper = require('./helper')
    , axios = require('axios')
    , encryptDecrypt = require('../../libs/utils/encrypt-decrypt')

/**
 * @description Chat Utility
 * @author Fahid Mohammad
 * @date 22-09-2019
 */
/**
  * @description Add if the device id exist or update
  * @param {args} Object 
  * @param {cb} function
  */
exports.getRequestInfo = (args, callback) => {
    //Default response object
    let responseObj = {
        status: 1001,
        message: 'error initiating chat request',
    },
    requestInfoObj = null;

    // Get request info from beakend api
    const getRequestInfo = (cb) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'room create error',
        }
        if(!args.reqId) { return callback(responseObj)}
        let agg = _mongoose.models['CarryRequests']["getRequestInfo"](args.reqId, {}, {});
        _mongoose.models['CarryRequests'].aggregate(agg).exec((e, d) => {
            if (e) {
                responseObj.message = 'Error in getting request info'
                responseObj.status = _status.ERROR;
                return cb();
            } else {
                if (d && d[0] && d[0].reqid) {
                    console.log("d[0]",d[0])
                    responseObj.status = _status.SUCCESS;
                    responseObj.data = d[0];
                    responseObj.message = 'success';
                    requestInfoObj = d[0]
                    return cb();
                } else {
                    responseObj.message = 'Invalid or inactive request id'
                    return callback(responseObj);
                }

            }
        });
    }

    // Create Room if not exist
    const getOrCreateRoom = (cb) => {
        _mongoose.models['ChatRoomSchema'].findOne({ roomId: requestInfoObj.reqid }, (err, data) => {
            if (!err) {
                let d = {
                    roomId: requestInfoObj.reqid,
                    uid: args.uid,
                    requesterId: requestInfoObj.reqUid,
                    carrierId: requestInfoObj.caryUid,
                    requesterEncId: encryptDecrypt.encrypt(requestInfoObj.reqUid),
                    carrierEncId: encryptDecrypt.encrypt(requestInfoObj.caryUid)
                }
                if (!data) {
                    let newRoom = new _mongoose.models['ChatRoomSchema'](d)
                    newRoom.save(function (err) {
                        responseObj.status = 1000;
                        responseObj.message = 'success';
                        responseObj.data = d;
                        return cb()
                    })
                } else {
                    responseObj.status = 1000;
                    responseObj.message = 'success';
                    responseObj.data = d;
                    return cb()
                }
            } else {
                return cb()
            }
        })
    }

    _async.series([
        getRequestInfo.bind(),
        getOrCreateRoom.bind(),
    ], () => {
        return callback(responseObj)
    });
}

/**
  * @description Add if the device id exist or update
  * @param {args} Object 
  * @param {cb} function
  */
exports.saveFCM = (args, cb) => {
    //  Constants
    let responseObj = { status: 1001, message: "Something went wrong!" };
    //  Basic validation
    if (args.device_type && args.did && args.uid && args.fcmt) {
        let _updateOrCreate = (ncallback) => {
            let query = {
                did: args.did,
                device_type: args.device_type
            },
                options = {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                };
            _mongoose.models['FCMSchema'].findOneAndUpdate(query, args, options, function (err) {
                responseObj.status = 1000
                responseObj.message = "Device ID Stored Successfully"
                return ncallback(responseObj)
            });
        }
        //  Final async call
        _async.series([
            _updateOrCreate.bind(),
        ], function () {
            return cb(responseObj)
        })
    } else {
        return cb(responseObj)
    }
}

/**
  * @description Send FCM Notification
  * @param {args} Object 
  * @param {cb} function
  */
exports.sendNotification = (args, cb) => {
    let responseObj = { status: 1001, message: 'error sending notification' },
        status = false,
        receivedId = null,
        fcmTokenArr = [];
    if(!args.roomId) { return cb(responseObj);}

    // Get sender data with userid
    let getUserInformation = (callback) => {
        _mongoose.models['Users'].findOne({ uid: args.sender }, (err, data) => {
            if (err || !data) return callback();
            args.senderName = data.fname + ' ' + data.lname
            return callback()
        })
    } 
    // Get UserId for the FCM user from ChatRoomSchema
    let getUserIdFromRoom = (callback) => {
        _mongoose.models['ChatRoomSchema'].findOne({ roomId: args.roomId }, (err, data) => {
            if (err || !data) return callback();
            status = true
            receivedId = checkReceiver(args.sender, data)
            return callback()
        })
    }

    // Get FCM Token from FCMSchema
    let getFCMToken = (callback) => {
        if (!status) return cb(responseObj);
        _mongoose.models['FCMSchema'].find({ uid: receivedId }, (err, fcmData) => {
            if (!err && fcmData.length) {
                fcmTokenArr = fcmData;
            }
            return callback()
        })
    }

    // Send Notification
    let sendNotificaton = (callback) => {
        if (!status && !fcmTokenArr.length > 0) return cb(responseObj);
        const baseURL = "https://fcm.googleapis.com/fcm/send"
        _.map(fcmTokenArr, function (v) {
            // Notification Payload
            const data = {
                "priority": "high",
                "to": v.fcmt,
                "notification": {
                    title: 'You have a new message from ' + args.senderName,
                    body: args.body
                },
                "data": {
                    roomId: args.roomId
                }
            }
            // Axios Payload Option
            const options = {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'Authorization': "key=" + _config.FCMServerKey
                },
                data: data,
                baseURL,
            }
            axios(options)
                .then(function (response) {
                    console.log("response.status", response.status)
                    console.log("response.data", response.data)
                })
                .catch(function (error) {
                    console.log("error", error)
                })
        })
        responseObj.status = 1000
        responseObj.message = 'success'
        return callback()
    }

    _async.series([
        getUserInformation.bind(),
        getUserIdFromRoom.bind(),
        getFCMToken.bind(),
        sendNotificaton.bind(),
    ], function () {
        return cb(responseObj)
    })
}


/**
 * @description Get Request info to initiate a chat session
 * @author Fahid Mohammad
 * @date 22-09-2019
 * @TODO: Need to handle proper validation
 * @TODO: Need to optimize the payload with proper restructuring 
 */
exports.getRequestData = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'room create error',
    }
    const getRequestInfo = (cb) => {
        let agg = _mongoose.models['CarryRequests']["getRequestInfo"](body.reqId, {}, {});
        _mongoose.models['CarryRequests'].aggregate(agg).exec((e, d) => {
            if (e) {
                responseObj.message = 'Error in getting request info'
                responseObj.status = _status.ERROR;
                return cb();
            } else {
                if (d && d[0] && d[0].reqid) {
                    responseObj.status = _status.SUCCESS;
                    responseObj.data = d[0];
                    responseObj.message = 'success';
                    return cb();
                } else {
                    responseObj.message = 'Invalid or inactive request id'
                    return cb();
                }

            }
        });
    }
    _async.series([
        getRequestInfo.bind(),
    ], () => {
        return callback(responseObj)
    });
}

// Check if the notification reciever is Carrier or Requester
const checkReceiver = (id, args) => {
    let receivedId = null;
    if (args.requesterId == id) {
        receivedId = args.carrierId
    } else {
        receivedId = args.requesterId
    }
    return receivedId;
}



