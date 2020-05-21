'use strict'
/**
 * @description Scheduler service
 * @author Saif
 */

let requestModule = require('../carry/index.js')

module.exports = {
    releaseOnHoldBookings: (req, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'search error',
            response: null
        }
        let d = new Date();
        d.setMinutes(d.getMinutes() - 15);
        _mongoose.models['BookingInfo'].updateMany({updatedAt: {"$lte": d}, bookingStatus: '101'}, { $set: { transactionStatus: "202" } }, (err, res) => {
            if (!err && res) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Success',
                responseObj.response = res
            }
            return callback(responseObj)
        })
    },
    changeTripStatus: (req, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'search error',
            response: null
        }
        let today = _moment().format()
        let tripIdArr = []
        let getTripIds = (cb) => {
            _mongoose.models['Trip'].find({status: {'$in': ['active', 'inActive', 'filled']}, depDate: {'$lte': _moment(today).format('YYYYMMDD')}, depTime: {'$lt': _moment(today).format('HH:mm') }}, 'tripId').exec((err, docs) => {
                if(!err && docs) {
                    for(let d of docs) {
                        tripIdArr.push(d.tripId)
                    }
                }
                return cb()
            })
        }

        let tripIdWithReq = []
        let checkForRequests = (cb) => {
            _mongoose.models['CarryRequests'].find({tripId: {'$in': tripIdArr}, status: {'$in': ['confirmed', 'picked']} }).exec((err, docs) => {
                if(!err && docs) {
                    for(let d of docs) {
                        tripIdWithReq.push(d.tripId)
                    }
                }return cb()
            })
        }
        
        _async.series([getTripIds.bind(),checkForRequests.bind()],() => {
            let changeTripStatusToOnGoing = (cb) => {
                _mongoose.models['Trip'].updateMany({ tripId: {"$in": tripIdWithReq}}, { $set: { status: "onGoing" } }, (err, docs) => {
                    if (!err && docs) {
                        responseObj.status = _status.SUCCESS
                        responseObj.message = 'Success',
                        responseObj.response = {}
                    }
                    return cb()
                })
            }
            
            let changeTripStatusToExpired = (cb) => {
                let tripIdWithoutReq = _.difference(tripIdArr, tripIdWithReq);
                _mongoose.models['Trip'].updateMany({ tripId: {"$in": tripIdWithoutReq}}, { $set: { status: "expired" } }, (err, docs) => {
                    if (!err && docs) {
                        responseObj.status = _status.SUCCESS
                        responseObj.message = 'Success',
                        responseObj.response = {}
                    }
                    return cb();
                })
            }

            _async.parallel([
                changeTripStatusToOnGoing.bind(),
                changeTripStatusToExpired.bind()

            ]), () => {
                return callback(responseObj)    
            }
            return callback(responseObj)
        })
    },
    autoDecline: (req, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'search error',
            response: null
        }
        let awaitingReq = [];
        let tripIds = [];
        let getAwaitingReq = (cb) => {
            let d = new Date();
            d.setMinutes(d.getMinutes() - 30);
            _mongoose.models['CarryRequests'].find({updatedAt: {"$lte": d}, status: {'$in': ['awaiting', 'captureFailed']}}, 'status carryId tripId', (err, res) => {
                if (!err && res) {
                    for (let s of res) {
                        awaitingReq.push(s.carryId);
                        if (tripIds.indexOf(s.tripId) === -1) {
                            tripIds.push(s.tripId)
                        }
                    }
                    responseObj.status = _status.SUCCESS
                    responseObj.message = 'Success',
                    responseObj.response = res
                }
                return cb()
            })
        }

        //check any accepted and picked and deliverd req
        let checkAcceptedReq = (cb) => {
            _mongoose.models['CarryRequests'].find({tripId: {'$in': tripIds}, status: {'$in': ['confirmed', 'picked', 'delivered']}}, 'status carryId tripId', (err, res) => {
                if (!err && res) {
                    for (let i = 0; i < res.length; i++) {
                        if (tripIds.indexOf(res[i].tripId) !== -1) {
                            tripIds.splice(i, 1);
                        }
                    }
                    responseObj.status = _status.SUCCESS
                    responseObj.message = 'Success'
                    //responseObj.response = res
                }
                return cb()
            })
        }

        // void payment if awaiting
        let voidPayment = (cb) => {
            if (awaitingReq.length) {
                let funcArr = []
                for (let c of awaitingReq) {
                    funcArr.push(function(lcb) {
                        requestModule.decline({carryId: c}, (e, d) => {
                            return lcb()
                        })
                    })
                }

            _async.parallel(funcArr, ()=> {
                return cb()
            })
            } else {
                return cb()
            }
        }

        let updateTripStatus = (cb) => {
            _mongoose.models['Trip'].updateMany({ tripId: {"$in": tripIds}}, { $set: { status: "inActive" } }, (err, docs) => {
                if (!err && docs) {
                    responseObj.status = _status.SUCCESS
                    responseObj.message = 'Success',
                    responseObj.response = {}
                }
                return cb()
            })
        }

        _async.series([
            getAwaitingReq.bind(),
            checkAcceptedReq.bind(),
            voidPayment.bind(),
            updateTripStatus.bind()
        ], () => {

        })
    }
}