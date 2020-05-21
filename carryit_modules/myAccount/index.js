'use strict'
/**
 * @description my account controller
 * @author
 * @since August 28 2019
 */
const moment = require("moment")
    , restructure = require('../../libs/utils/restructure')
    , common = require('../../libs/utils/common')
    , randomstring = require("randomstring")
    , helper = require('../carry/helper')
    , tripIndex = require('../trip/index')
    , keymapper = require('../../libs/utils/key-mapping')
    , payment = require('../../carryit_modules/payment')
    , checkout_config = _config.checkout
    , requestModule = require('../carry/index.js')
    , notifications = require('../notifications')
    , helpAdaptor = require('../../libs/helper')
    , mailer = require('../../libs/mailer');

const profile = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        //message: 'Error in getting profile information',
        message: keymapper["s2c"]["errorInProfile"][args.lang],
        response: null
    }
    let currentTime = new Date().getTime()
    const profileInfo = (cb) => {
        let body = { verified: true, uid: args.uid }
        helpAdaptor.logWriter(body, "user_info_RQ" + currentTime, "MyAccount")
        _mongoose.models['Users'].findOne(body).exec((e, d) => {
            if (e) {
                helpAdaptor.logWriter(responseObj, "user_info_ERR" + currentTime, "MyAccount")
                return callback(responseObj);
            }
            responseObj.status = _status.SUCCESS
            responseObj.message = "Success"
            responseObj.response = {
                fname: (d.fname) ? d.fname : "",
                lname: (d.lname) ? d.lname : "",
                number: (d.number) ? d.number : "",
                email: (d.email) ? d.email : "",
                code: (d.code) ? d.code : "",
                uid: (d.uid) ? d.uid : "",
                pic: (d.pic) ? d.pic : "",
                walletBalance: (d.walletBalance) ? parseFloat(d.walletBalance).toFixed(2) : 0
            }
            helpAdaptor.logWriter(responseObj, "user_info_RS" + currentTime, "MyAccount")
            return cb();
        });
    }

    const tripsCount = (cb) => {
        let body = { status: { "$in": ["active", "onGoing", "filled", "inActive"] }, userId: args.uid }
        helpAdaptor.logWriter(body, "user_tripsCount_RQ" + currentTime, "MyAccount")
        _mongoose.models['Trip'].find(body).count().exec((e, d) => {
            if (e) {
                //responseObj.message = 'Error in getting active trips count'
                responseObj.message = keymapper["s2c"]["errorInTripCount"][args.lang];
                responseObj.status = _status.ERROR;
                helpAdaptor.logWriter(responseObj, "user_tripsCount_ERR" + currentTime, "MyAccount")
                return callback(responseObj)
            }
            responseObj.response.trips = d;
            //responseObj.response.balance = "SAR 0";
            helpAdaptor.logWriter(responseObj, "user_tripsCount_RS" + currentTime, "MyAccount")
            return cb();
        });
    }

    const shipmentsCount = (cb) => {
        let body = { status: { "$in": ["picked", "confirmed", "awaiting"] }, userId: args.uid }
        helpAdaptor.logWriter(body, "user_tripsCount_RQ" + currentTime, "MyAccount")
        _mongoose.models['CarryRequests'].find(body).count().exec((e, d) => {
            if (e) {
                //responseObj.message = 'Error in getting active shipments count'
                responseObj.message = keymapper["s2c"]["errorInShipmentsCount"][args.lang];
                responseObj.status = _status.ERROR;
                return callback(responseObj);
            }
            responseObj.response.shipments = d;
            return cb();
        });
    }

    const invoicesCount = (cb) => {
        _mongoose.models['Invoice'].find({ carryUserId: args.uid, status: 'unpaid' }).count().exec((e, d) => {
            if (e) {
                //responseObj.message = 'Error getting in active invoices count'
                responseObj.message = keymapper["s2c"]["errorInInvoiceCount"][args.lang];
                responseObj.status = _status.ERROR;
                return callback(responseObj)
            }
            responseObj.response.invoice = d;
            responseObj.message = 'success'
            responseObj.status = _status.SUCCESS;
            return cb();
        });
    }

    _async.series([
        profileInfo.bind(),
        tripsCount.bind(),
        shipmentsCount.bind(),
        invoicesCount.bind(),
    ], () => {
        return callback(responseObj)
    });
}

const userTrips = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in getting active trips',
        response: null
    }
    args['offset'] = (args.offset) ? parseInt(args.offset) : 0
    args['limit'] = (args.limit) ? parseInt(args.limit) : 10
    let currentDate = Number(_moment().format("YYYYMMDD"));
    let activeFilter = {
        "userId": args.uid,
        "status": { "$in": ["active", "onGoing", "filled", "inActive"] }
    }
    let activeAgg = _mongoose.models["Trip"]["userTrips"](activeFilter, {}, {});

    const activeTripsCount = (cb) => {
        _mongoose.models['Trip'].aggregate(activeAgg).exec((err, data) => {
            if (err && !data) {
                responseObj.status = _status.ERROR;
                responseObj.error = "Error in getting active trips count";
                return callback(responseObj);
            }
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.response.activeTripsCount = data.length;
            return cb();
        });
    }

    const activeTrips = (cb) => {
        _mongoose.models['Trip'].aggregate(activeAgg).skip(args.offset).limit(args.limit).exec((err, data) => {
            if (err && !data) {
                responseObj.status = _status.ERROR;
                responseObj.error = "Error in getting active trips";
                //responseObj.message = keymapper["s2c"]["errorInActiveTrips"][args.lang];
                return callback(responseObj);
            }
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.response.activeTrips = getTripArr(args, data);
            return cb();
        });
    };

    let completedFilter = {
        "userId": args.uid,
        "status": { "$in": ["completed", "paid", "expired"] }
    };
    let completedAgg = _mongoose.models["Trip"]["userTrips"](completedFilter, {}, { complete: true });

    const completedTripsCount = (cb) => {
        _mongoose.models['Trip'].aggregate(completedAgg).exec((err, data) => {
            if (err && !data) {
                responseObj.status = _status.ERROR;
                responseObj.error = "Error in getting completed trips count";
                //responseObj.message = keymapper["s2c"]["errorInCompletedTripsCount"][args.lang];
                return callback(responseObj);
            }
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.response.completedTripsCount = data.length;
            return cb();
        });
    }

    const completedTrips = (cb) => {
        _mongoose.models['Trip'].aggregate(completedAgg).skip(args.offset).limit(args.limit).exec((err, data) => {
            if (err && !data) {
                responseObj.status = _status.ERROR;
                responseObj.error = "Error in getting completed trips";
                //responseObj.message = keymapper["s2c"]["errorInCompletedTrips"][args.lang];
                return callback(responseObj);
            }
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.response.completedTrips = getTripArr(args, data);
            return cb()
        });
    };

    let cancelledFilter = {
        "userId": args.uid,
        "status": { "$in": ["cancelled"] }
    };
    let cancelledAgg = _mongoose.models["Trip"]["userTrips"](cancelledFilter, {}, {});

    const cancelledTripsCount = (cb) => {
        _mongoose.models['Trip'].aggregate(cancelledAgg).exec((err, data) => {
            if (err && !data) {
                responseObj.status = _status.ERROR;
                responseObj.error = "Error in getting cancelled trips count";
                return callback(responseObj);
            }
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.response.cancelledTripsCount = data.length;
            return cb();
        });
    }

    const cancelledTrips = (cb) => {
        _mongoose.models['Trip'].aggregate(cancelledAgg).skip(args.offset).limit(args.limit).exec((err, data) => {
            if (err && !data) {
                responseObj.status = _status.ERROR;
                responseObj.error = "Error in getting cancelled trips count";
                return callback(responseObj);
            }
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.response.cancelledTrips = getTripArr(args, data);
            return cb()
        });
    };

    const cityNames = (cb) => {
        getCityObject(function (cityMap) {
            if (!cityMap) {
                responseObj.status = _status.ERROR;
                responseObj.message = 'Error in getting city names in trips';
                //responseObj.message = keymapper["s2c"]["errorInTripCityNames"][args.lang];
                responseObj.response = null;
                return callback(responseObj);
            }
            responseObj.status = _status.SUCCESS;
            responseObj.message = 'Success';
            if (responseObj.response.activeTrips) {
                responseObj.response.activeTrips = setCityName(cityMap, responseObj.response.activeTrips, args)
            }
            if (responseObj.response.completedTrips) {
                responseObj.response.completedTrips = setCityName(cityMap, responseObj.response.completedTrips, args)
            }
            if (responseObj.response.cancelledTrips) {
                responseObj.response.cancelledTrips = setCityName(cityMap, responseObj.response.cancelledTrips, args)
            }
            return cb();
        });
    }

    const setCityName = (cityMap, arr, args) => {
        let tripObj = [];
        arr.forEach(trip => {
            if (trip && trip.from && cityMap[trip.from]) {
                trip.from = getCityName(cityMap[trip.from], args);
            }
            if (trip && trip.to && cityMap[trip.to]) {
                trip.to = getCityName(cityMap[trip.to], args);
            }
            tripObj.push(trip);
        });
        return tripObj;
    }


    let seriesArr = [];
    if (_.isEqual(args.status, "active")) {
        seriesArr.push(activeTripsCount.bind(), activeTrips.bind());
    } else if (_.isEqual(args.status, "completed")) {
        seriesArr.push(completedTripsCount.bind(), completedTrips.bind());
    } else if (_.isEqual(args.status, "cancelled")) {
        seriesArr.push(cancelledTripsCount.bind(), cancelledTrips.bind());
    } else {
        seriesArr.push(activeTripsCount.bind(), activeTrips.bind()
            , completedTripsCount.bind(), completedTrips.bind()
            , cancelledTripsCount.bind(), cancelledTrips.bind());
    }

    seriesArr.push(cityNames.bind());
    _async.series(seriesArr, () => {
        return callback(responseObj)
    });
};

const getCityObject = (callback) => {
    _mongoose.models['CityPredictive'].find({ cityId: { $in: cityIdsArr } }).exec((err, cityData) => {
        return (err && !cityData && cityData.length) ? callback(null) : callback(common.arrayTomap(cityData, "cityId", true));
    });
};

const cityIdsFun = (from, to) => {
    if (cityIdsArr.indexOf(from) === -1) {
        cityIdsArr.push(from);
    }
    if (cityIdsArr.indexOf(to) === -1) {
        cityIdsArr.push(to);
    }
};

let cityIdsArr = [];
const getTripArr = (args, tripsArrObj) => {
    let tripsArr = [];
    tripsArrObj.forEach(tripInfo => {
        if (tripInfo) {
            tripInfo.cancel = true;
            cityIdsFun(tripInfo.from, tripInfo.to);
            let documentCount = 0, packageCount = 0;
            if (tripInfo.status === "onGoing") {
                tripInfo.cancel = false;
            }
            if (tripInfo.carryRequests) {
                tripInfo.carryRequests.forEach(cReq => {
                    if (cReq && cReq.status && (_.isEqual(cReq.status, "picked") || _.isEqual(cReq.status, "delivered"))) {
                        tripInfo.cancel = false;
                    }
                    if (cReq && cReq.type) {
                        if (cReq.type.toLowerCase() === "document") {
                            documentCount++;
                        }
                        if (cReq.type.toLowerCase() === "package") {
                            packageCount++;
                        }
                    }
                });
                delete tripInfo.carryRequests;
            }
            tripInfo.responce = {
                "document": documentCount,
                "package": packageCount
            }
            tripInfo.depDate = (tripInfo.depDate) ? moment(tripInfo.depDate, 'YYYY/MM/DD').format("DD-MM-YYYY") : "";
            tripInfo.arrDate = (tripInfo.arrDate) ? moment(tripInfo.arrDate, 'YYYY/MM/DD').format("DD-MM-YYYY") : "";
            tripInfo.depTime = (tripInfo.depTime) ? moment(tripInfo.depTime, 'hh:mm').format("LT") : "";
            tripInfo.arrTime = (tripInfo.arrTime) ? moment(tripInfo.arrTime, 'hh:mm').format("LT") : "";
            if (tripInfo.tripType && tripInfo[tripInfo.tripType]) {
                if (tripInfo[tripInfo.tripType].depTerminal) {
                    tripInfo.depTerminal = tripInfo[tripInfo.tripType].depTerminal;
                }
                if (tripInfo[tripInfo.tripType].arrTerminal) {
                    tripInfo.arrTerminal = tripInfo[tripInfo.tripType].arrTerminal;
                }
            }

            tripInfo.totalEarnings = (tripInfo.totalEarnings && tripInfo.totalEarnings.earnAmount) ? tripInfo.totalEarnings.earnAmount : 0;
            tripInfo.currency = "SAR"
            tripsArr.push(tripInfo)
        }
    });
    return tripsArr;
};

const trip = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        //message: 'Error in getting trip information',
        message: keymapper["s2c"]["errorInTripInfo"][args.lang],
        response: null
    }
    let userIdsArr = [];
    const tripInformation = (cb) => {
        _mongoose.models['Trip'].find({ "tripId": args.tripId }, { createdAt: 0, updatedAt: 0, searchKey: 0 }).exec((err, tripData) => {
            if (err && !tripData) {
                return callback(responseObj);
            }
            responseObj.status = _status.SUCCESS;
            responseObj.message = 'Success';
            let tripInfo = [];
            let tripObj = JSON.parse(JSON.stringify(tripData))
            tripObj.forEach(eachtrip => {
                if (eachtrip) {
                    eachtrip.depDate = {
                        "day": (eachtrip.depDate) ? moment(eachtrip.depDate, 'YYYY/MM/DD').format('DD') : "",
                        "monthAndDay": (eachtrip.depDate) ? moment(eachtrip.depDate, 'YYYY/MM/DD').format("MMM - ddd") : "",
                        "year": (eachtrip.depDate) ? moment(eachtrip.depDate, 'YYYY/MM/DD').format('YYYY') : ""
                    }
                    eachtrip.arrDate = {
                        "day": (eachtrip.arrDate) ? moment(eachtrip.arrDate, 'YYYY/MM/DD').format('DD') : "",
                        "monthAndDay": (eachtrip.arrDate) ? moment(eachtrip.arrDate, 'YYYY/MM/DD').format("MMM - ddd") : "",
                        "year": (eachtrip.arrDate) ? moment(eachtrip.arrDate, 'YYYY/MM/DD').format('YYYY') : ""
                    }
                    cityIdsFun(eachtrip.from, eachtrip.to);
                    let totalItemsCarryCount = 0;
                    if (eachtrip.document && eachtrip.document.qnty) {
                        totalItemsCarryCount += eachtrip.document.qnty;
                    }
                    if (eachtrip.package && eachtrip.package.qnty) {
                        totalItemsCarryCount += eachtrip.package.qnty;
                    }
                    if (!responseObj.response) {
                        responseObj.response = {};
                    }
                    responseObj.response.totalCount = totalItemsCarryCount;
                    responseObj.response["currency"] = "SAR";
                    responseObj.response["totalEarnings"] = 0
                }
                tripInfo.push(eachtrip);
            });
            if (!responseObj.response) {
                responseObj.response = {};
            }
            //responseObj.response.trip = tripInfo;
            responseObj.response.trip = tripData;
            return cb();
        });
    };

    const totalReceivedItems = (cb) => {
        _mongoose.models['CarryRequests'].find({ tripId: args.tripId, "status": { $in: ["awaiting", "confirmed", "captureFailed", "declined", "picked", "delivered", "cancelled"] } }).count().exec((e, receivedItems) => {
            if (e) {
                //responseObj.message = 'error in getting received items count'
                responseObj.message = keymapper["s2c"]["errorInReceivedItemsCount"][args.lang],
                    responseObj.status = _status.ERROR;
                return callback(responseObj);
            }
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.response["receivedItems"] = receivedItems;
            responseObj.response["totalEarnings"] = 0;
            responseObj.response["currency"] = "SAR"
            return cb();
        });
    };

    let getTotalEarnings = (cb) => {
        _mongoose.models["TravellerAccount"].aggregate([{ $match: { "tripId": { "$in": [args.tripId] } } }, {
            $group: { _id: "$tripId", totalAmount: { $sum: "$amount" } }
        }], (e, doc) => {
            if (!e && doc && doc.length) {
                responseObj.response["totalEarnings"] = doc[0]['totalAmount']
            }
            return cb();
        });
    }

    let carryRequestsArr = [];
    const carryReqFun = (cb) => {
        let filter = { tripId: args.tripId, "status": { $in: ["awaiting", "confirmed", "captureFailed", "declined", "picked", "delivered", "cancelled"] } };
        _mongoose.models['CarryRequests'].find(filter).exec((e, carrryItems) => {
            if (e && !carrryItems) {
                responseObj.message = 'error in getting carry items'
                responseObj.status = _status.ERROR;
                return callback(responseObj);
            }
            if (carrryItems && !_.isEmpty(carrryItems)) {
                carryRequestsArr = carrryItems;
                carrryItems.forEach(crItem => {
                    if (crItem && crItem.userId) {
                        if (userIdsArr.indexOf(crItem.userId) === -1) {
                            userIdsArr.push(crItem.userId);
                        }
                    }
                });
            }
            return cb();
        });
    };

    const carryReqUserNamesFun = (cb) => {
        _mongoose.models['Users'].find({ uid: { $in: userIdsArr } }).exec((e, user) => {
            if (e && !user) {
                //responseObj.message = 'Error in getting carry user name.'
                responseObj.message = keymapper["s2c"]["errorInCarryUserName"][args.lang],
                    responseObj.status = _status.ERROR;
                return callback(responseObj);
            }
            let userNamesObj = {};
            user.forEach(eachUser => {
                if (eachUser && eachUser.uid) {
                    userNamesObj[eachUser.uid] = {
                        "fname": (eachUser.fname) ? eachUser.fname : "",
                        "lname": (eachUser.lname) ? eachUser.lname : ""
                    };
                }
            });
            let ctArr = [];
            carryRequestsArr.forEach(crItem => {
                if (crItem && crItem.userId && userNamesObj[crItem.userId]) {
                    let obj = JSON.parse(JSON.stringify(crItem));
                    obj.userInfo = userNamesObj[crItem.userId];
                    ctArr.push(obj);
                }
            });
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.response.carryRequests = ctArr;
            return cb();
        });
    };

    const cityNames = (callback) => {
        getCityObject(function (cityMap) {
            if (cityMap) {
                responseObj.status = _status.SUCCESS;
            } else {
                responseObj.status = _status.ERROR;
                //responseObj.message = 'Error in getting city names in trips';
                responseObj.message = keymapper["s2c"]["errorInCityName"][args.lang]
            }
            let tripsArr = [];
            responseObj.response.trip.forEach(trip => {
                if (trip) {
                    if (trip.from && cityMap[trip.from]) {
                        trip.from = getCityName(cityMap[trip.from], args);
                    }
                    if (trip.to && cityMap[trip.to]) {
                        trip.to = getCityName(cityMap[trip.to], args);
                    }
                }
                tripsArr.push(trip);
            });
            responseObj.response.trip = tripsArr;
            return callback();
        });
    }

    let seriesArr = [];
    if (args.hasOwnProperty("requests")) {
        if (args.requests) {
            seriesArr.push(
                carryReqFun.bind(),
                carryReqUserNamesFun.bind(),
            );
        } else {
            seriesArr.push(
                tripInformation.bind(),
                cityNames.bind()
            );
        }
    } else {
        seriesArr.push(
            totalReceivedItems.bind(),
            tripInformation.bind(),
            getTotalEarnings.bind(),
            cityNames.bind(),
            carryReqFun.bind(),
            carryReqUserNamesFun.bind()
        );
    }
    _async.series(seriesArr, () => {
        return callback(responseObj)
    });
}

const getCityName = (cityObj, args) => {
    let con = (cityObj && cityObj.cityName && cityObj.countryName && cityObj.countryName[args.lang]);
    return (con) ? cityObj.cityName[args.lang] + ", " + cityObj.countryName[args.lang] : "";
};

const shipmentsArr = (args, carryDataObj, isTracking) => {
    let activeShipments = [];
    carryDataObj.forEach(carry => {
        if (carry) {
            if (carry.type) {
                carry.type = carry.type.charAt(0).toUpperCase() + "" + carry.type.substring(1);
            }
            if (carry.pickedDate) {
                let pickedDate = {
                    date: moment(carry.pickedDate, 'DD/MM/YYYY').format("DD-MM-YYYY"),
                    time: moment(carry.pickedDate, 'hh:mm').format("LT")
                };
                carry.pickedDate = pickedDate;
            }
            if (carry.droppedDate) {
                let droppedDate = {
                    date: moment(carry.droppedDate, 'DD/MM/YYYY').format("DD-MM-YYYY"),
                    time: moment(carry.droppedDate, 'hh:mm').format("LT")
                };
                carry.droppedDate = droppedDate;
            }
            if (carry.paymentDate) {
                let paymentDate = {
                    date: moment(carry.paymentDate, 'DD/MM/YYYY').format("DD-MM-YYYY"),
                    time: moment(carry.paymentDate, 'hh:mm').format("LT")
                };
                carry.paymentDate = paymentDate;
            }
            if (carry.smc && carry.smc.date) {
                carry.smc.date = moment(carry.smc.date, 'DD/MM/YYYY').format("DD-MM-YYYY")
            }
            if (carry.rmc && carry.rmc.date) {
                carry.rmc.date = moment(carry.rmc.date, 'DD/MM/YYYY').format("DD-MM-YYYY");
            }
            if (args.completed) {
                let cancelledDate = {
                    date: moment(carry.updatedAt).format("DD-MM-YYYY"),
                    time: moment(carry.updatedAt).format("LT")
                };
                carry.cancelledDate = cancelledDate;
            }

            //if (isTracking) {
            let userInfoObj = common.arrayTomap(carry.userInfo, "uid", true);
            carry.requesterDetails = userInfoObj[carry.userId];
            carry.userInfo = userInfoObj[carry.trip.userId]
            //}
            if (!carry.otherReceiver && carry.userInfo) {
                let fname = (carry.requesterDetails.fname) ? carry.requesterDetails.fname : "";
                let lname = (carry.requesterDetails.lname) ? carry.requesterDetails.lname : "";
                carry.receiver = {
                    name: fname + " " + lname,
                    number: (carry.requesterDetails.number) ? carry.requesterDetails.number : "",
                    code: (carry.requesterDetails.code) ? carry.requesterDetails.code : "",
                    email: (carry.requesterDetails.email) ? carry.requesterDetails.email : "",
                    pic: (carry.requesterDetails.pic) ? carry.requesterDetails.pic : ""
                }
                carry.requesterDetails.pic = (carry.requesterDetails.pic) ? carry.requesterDetails.pic : ""
                //delete carry.userInfo;
            }
            if (carry.trip) {
                if (carry.trip.tripType) {
                    carry.tripType = carry.trip.tripType;
                }
                cityIdsFun(carry.trip.from, carry.trip.to);
            }
            if (carry.price) {
                carry.price.forEach(item => {
                    if (item) {
                        carry.price = {
                            "payFare": (item.payFare) ? item.payFare : 0,
                            "currency": (item._id) ? item._id : "SAR"
                        }
                    }
                });
            }
            //setting qrcode
            carry.QRCode = (carry.isPickedUp) ? carry.dropoffId : carry.pickupId;
            delete carry.dropoffId
            delete carry.pickupId
            activeShipments.push(carry);
        }
    });
    return activeShipments;
}

const shipments = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        //message: 'Error in getting shipments information',
        message: keymapper["s2c"]["errorInShipmentInformation"][args.lang],
        response: null
    }
    args.offset = (args.offset) ? args.offset : 0;
    args.limit = (args.limit) ? args.limit : 10;
    let activeShipmentFilter = {
        "status": { "$in": ["awaiting", "confirmed", "picked"] },
        "userId": args.uid
    }
    let tripSFilter = ["active", "onGoing", "filled", "inActive"];
    let countOfActiveShipments = (cb) => {
        let agg = _mongoose.models["CarryRequests"]["userShipmentsList"](activeShipmentFilter, tripSFilter, {});
        _mongoose.models['CarryRequests'].aggregate(agg).exec((e, d) => {
            if (e) {
                responseObj.message = keymapper["s2c"]["errorInShipmentsCount"][args.lang],
                    //responseObj.message = 'Error in getting active shipments count'
                    responseObj.status = _status.ERROR;
                return callback(responseObj);
            } else {
                if (!responseObj.response) {
                    responseObj.response = {};
                }
                responseObj.response.activeShipmentCount = (d && !_.isEmpty(d)) ? d.length : 0;
                responseObj.message = "Success";
                responseObj.status = _status.SUCCESS
                return cb();
            }
        });
    }

    let activeShipments = (cb) => {
        let agg = _mongoose.models["CarryRequests"]["userShipmentsList"](activeShipmentFilter, tripSFilter, {});
        _mongoose.models['CarryRequests'].aggregate(agg).skip(args.offset).limit(args.limit).exec((e, d) => {
            if (e && !d) {
                //responseObj.message = 'Error in getting active shipments'
                responseObj.message = keymapper["s2c"]["errorInActiveShipments"][args.lang]
                responseObj.status = _status.ERROR;
                return callback(responseObj);
            }
            if (d) {
                if (!responseObj.response) {
                    responseObj.response = {};
                }
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Success'
                responseObj.response.activeShipments = shipmentsArr(args, d, false);
                return cb();
            }
        });
    }

    let completedShipmentFilter = {
        "status": { "$in": ["delivered"] },
        "userId": args.uid
    };
    let countOfCompletedShipments = (cb) => {
        _mongoose.models['CarryRequests'].countDocuments(completedShipmentFilter).exec((e, d) => {
            if (e) {
                //responseObj.message = 'Error in getting completed shipments count'
                responseObj.message = keymapper["s2c"]["errorInCompletedShipmentsCount"][args.lang]
                responseObj.status = _status.ERROR;
                return callback(responseObj);
            } else {
                if (!responseObj.response) {
                    responseObj.response = {};
                }
                responseObj.response.completedShipmentCount = d;
                responseObj.message = "Success";
                responseObj.status = _status.SUCCESS
                return cb();
            }
        });
    }

    let completedTripSFilter = ["active", "onGoing", "filled", "completed", "paid", "inActive"];
    let completedShipments = (cb) => {
        let agg = _mongoose.models["CarryRequests"]["userShipmentsList"](completedShipmentFilter, completedTripSFilter, {});
        _mongoose.models['CarryRequests'].aggregate(agg).skip(args.offset).limit(args.limit).exec((e, d) => {
            if (e && !d) {
                //responseObj.message = 'Error in getting active shipments'
                responseObj.message = keymapper["s2c"]["errorInCompletedShipments"][args.lang]
                responseObj.status = _status.ERROR;
                return callback(responseObj);
            }
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Success'
            responseObj.response.completedShipments = shipmentsArr(args, d, false);
            return cb();
        });
    }

    let cancelledShipmentFilter = {
        "status": { "$in": ["cancelled", "captureFailed", "declined"] },
        "userId": args.uid
    };
    let cancelledTripSFilter = ["active", "onGoing", "filled", "completed", "cancelled", "inActive", "paid"];
    let countOfCancelledShipments = (cb) => {
        _mongoose.models['CarryRequests'].countDocuments(cancelledShipmentFilter).exec((e, d) => {
            if (e) {
                responseObj.message = 'Error in getting cancelled shipments count'
                responseObj.status = _status.ERROR;
                return callback(responseObj);
            } else {
                if (!responseObj.response) {
                    responseObj.response = {};
                }
                responseObj.response.cancelledShipmentCount = d;
                responseObj.message = "Success";
                responseObj.status = _status.SUCCESS
                return cb();
            }
        });
    }

    let cancelledShipments = (cb) => {
        let agg = _mongoose.models["CarryRequests"]["userShipmentsList"](cancelledShipmentFilter, cancelledTripSFilter, {});
        _mongoose.models['CarryRequests'].aggregate(agg).skip(args.offset).limit(args.limit).exec((e, d) => {
            if (e && !d) {
                responseObj.message = 'Error in getting cancelled shipments'
                responseObj.status = _status.ERROR;
                return callback(responseObj);
            }
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Success'
            //responseObj.response.cancelledShipments = d;
            args.completed = true
            responseObj.response.cancelledShipments = shipmentsArr(args, d, false);
            return cb();
        });
    }

    const cityNames = (cb) => {
        getCityObject(function (cityMap) {
            if (cityMap) {
                responseObj.status = _status.SUCCESS;
            } else {
                responseObj.status = _status.ERROR;
                //responseObj.message = 'Error in getting city names in trips';
                responseObj.message = keymapper["s2c"]["errorInCityName"][args.lang]
            }
            if (!responseObj.response) {
                responseObj.response = {};
            }
            if (responseObj.response.activeShipments) {
                responseObj.response.activeShipments = shipmenetCityName(cityMap, responseObj.response.activeShipments, args)
            }
            if (responseObj.response.completedShipments) {
                responseObj.response.completedShipments = shipmenetCityName(cityMap, responseObj.response.completedShipments, args)
            }
            return cb();
        });
    }

    const shipmenetCityName = (cityMap, activeShipments, args) => {
        let shipmenets = [];
        activeShipments.forEach(shipment => {
            if (shipment && shipment.trip) {
                let trip = shipment.trip;
                if (trip.from && cityMap[trip.from]) {
                    shipment.from = getCityName(cityMap[trip.from], args);
                }
                if (trip.to && cityMap[trip.to]) {
                    shipment.to = getCityName(cityMap[trip.to], args);
                }
            }
            delete shipment.trip;
            shipmenets.push(shipment);
        });
        return shipmenets;
    }

    let seriesArr = [];
    if (_.isEqual(args.status, "active")) {
        responseObj.message = 'success'
        responseObj.status = _status.SUCCESS
        seriesArr.push(countOfActiveShipments.bind(), activeShipments.bind());
    } else if (_.isEqual(args.status, "completed")) {
        responseObj.message = 'success'
        responseObj.status = _status.SUCCESS
        seriesArr.push(countOfCompletedShipments.bind(), completedShipments.bind());
    } else if (_.isEqual(args.status, "cancelled")) {
        seriesArr.push(countOfCancelledShipments.bind(), cancelledShipments.bind());
    } else {
        seriesArr.push(countOfActiveShipments.bind()
            , activeShipments.bind()
            , countOfCompletedShipments.bind()
            , completedShipments.bind()
            , countOfCancelledShipments.bind()
            , cancelledShipments.bind());
    }

    seriesArr.push(cityNames.bind());
    _async.series(seriesArr, () => {
        return callback(responseObj)
    });
}

const trackingInfo = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        //message: 'Error in getting tracking information',
        message: keymapper["s2c"]["errorInTrackingInfo"][args.lang],
        response: null
    }
    if (!args.carryId) {
        //responseObj.message = 'Error in getting carryId.'
        responseObj.message = keymapper["s2c"]["errorInGettingCarryId"][args.lang];
        responseObj.status = _status.ERROR;
        return callback(responseObj);
    }
    const carryReq = (cb) => {
        let agg = _mongoose.models["CarryRequests"]["shipmentDetails"]({ carryId: args.carryId }, {}, {});
        _mongoose.models['CarryRequests'].aggregate(agg).exec((e, d) => {
            if (e && !d) {
                return callback(responseObj);
            }
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Success';
            cityIdsArr = [];
            responseObj.response = shipmentsArr(args, d, true);
            return cb();
        });
    }

    const carrierCityName = (cb) => {
        getCityObject(function (cityMap) {
            if (cityMap) {
                responseObj.status = _status.SUCCESS;
            } else {
                responseObj.status = _status.ERROR;
                //responseObj.message = 'Error in getting city names';
                responseObj.message = keymapper["s2c"]["errorInCityName"][args.lang];
            }
            if (!responseObj.response) {
                responseObj.response = {};
            }
            let response = responseObj.response[0];
            if (response && response.trip) {
                let tripInfo = response.trip;
                response.tripType = (tripInfo.tripType) ? tripInfo.tripType : "";
                response.from = (tripInfo.from) ? getCityName(cityMap[tripInfo.from], args) : "";
                response.to = (tripInfo.to) ? getCityName(cityMap[tripInfo.to], args) : "";
                delete response.trip;
            }
            responseObj.response = {};
            if (!_.isEmpty(response)) {
                responseObj.response = response;
            }
            return cb();
        });
    }
    _async.series([
        carryReq.bind(),
        carrierCityName.bind()
    ], () => {
        return callback(responseObj)
    });
}
const productDetails = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        //message: 'Error in getting Product Details',
        message: keymapper["s2c"]["errorInProductDetails"][args.lang],
        response: null
    }
    if (!(args && args.carryId)) {
        //responseObj.message = 'Error in getting carryId';
        responseObj.message = keymapper["s2c"]["errorInGettingCarryId"][args.lang];
        return callback(responseObj);
    }

    const carryRequest = (cb) => {
        let agg = _mongoose.models["CarryRequests"]["productDetails"]({ "carryId": args.carryId }, {}, {});
        _mongoose.models['CarryRequests'].aggregate(agg).exec((e, data) => {
            if (data && !e) {
                responseObj.message = 'success'
                responseObj.status = _status.SUCCESS;
                cityIdsArr = [];
                data.forEach(eachItem => {
                    if (eachItem) {
                        //setting qrcode
                        eachItem.QRCode = (eachItem.isPickedUp) ? eachItem.dropoffId : eachItem.pickupId
                        delete eachItem.dropoffId
                        delete eachItem.pickupId
                        let userInfoObj = common.arrayTomap(eachItem.userInfo, "uid", true);
                        eachItem.travellerDetails = userInfoObj[eachItem.shipmentDetails.userId];
                        eachItem.userInfo = userInfoObj[eachItem.userId]
                        if (!eachItem.otherReceiver && eachItem.userId && eachItem.userInfo && eachItem.userInfo.uid && _.isEqual(eachItem.userId, eachItem.userInfo.uid)) {
                            let userObj = eachItem.travellerDetails;
                            let fName = (userObj.fname) ? userObj.fname : "";
                            let lName = (userObj.lname) ? userObj.lname : "";
                            eachItem.receiver = {
                                "name": fName + " " + lName,
                                "email": (userObj.email) ? userObj.email : "",
                                "code": (userObj.code) ? userObj.code : "",
                                "number": (userObj.number) ? userObj.number : "",
                                "pic": (userObj.pic) ? userObj.pic : ""
                            }
                            // delete eachItem.userInfo;
                        }
                        if (eachItem.pickedDate) {
                            eachItem.pickedDate = {
                                date: moment(eachItem.pickedDate, 'YYYY/MM/DD').format("DD-MM-YYYY"),
                                time: moment(eachItem.pickedDate, 'hh:mm').format("LT")
                            };
                        }
                        if (eachItem.droppedDate) {
                            eachItem.droppedDate = {
                                date: moment(eachItem.droppedDate, 'YYYY/MM/DD').format("DD-MM-YYYY"),
                                time: moment(eachItem.droppedDate, 'hh:mm').format("LT")
                            };
                        }
                        if (eachItem.paymentDate) {
                            eachItem.paymentDate = {
                                date: moment(eachItem.paymentDate, 'YYYY/MM/DD').format("DD-MM-YYYY"),
                                time: moment(eachItem.paymentDate, 'hh:mm').format("LT")
                            };
                        }
                        if (eachItem.smc && eachItem.smc.date) {
                            eachItem.smc.date = moment(eachItem.smc.date, 'DD-MM-YYYY').format("DD-MM-YYYY");
                        }
                        if (eachItem.rmc && eachItem.rmc.date) {
                            eachItem.rmc.date = moment(eachItem.rmc.date, 'DD-MM-YYYY').format("DD-MM-YYYY");
                        }
                        if (eachItem.shipmentDetails) {
                            cityIdsFun(eachItem.shipmentDetails.from, eachItem.shipmentDetails.to);
                            if (eachItem.shipmentDetails[eachItem.type]) {
                                eachItem[eachItem.type] = eachItem.shipmentDetails[eachItem.type];
                            }
                            if (eachItem.shipmentDetails.depDate) {
                                eachItem.depDate = moment(eachItem.shipmentDetails.depDate, 'YYYY/MM/DD').format("DD-MM-YYYY");
                            }
                            if (eachItem.shipmentDetails.arrDate) {
                                eachItem.arrDate = moment(eachItem.shipmentDetails.arrDate, 'YYYY/MM/DD').format("DD-MM-YYYY");
                            }
                            if (eachItem.shipmentDetails.depTime) {
                                eachItem.depTime = moment(eachItem.shipmentDetails.depTime, 'hh:mm').format("LT");
                            }
                            if (eachItem.shipmentDetails.arrTime) {
                                eachItem.arrTime = moment(eachItem.shipmentDetails.arrTime, 'hh:mm').format("LT");
                            }
                        }
                        if (eachItem.price) {
                            eachItem.price['totalFareWithCommissionFee'] = parseFloat(eachItem.price['totalFare'] + eachItem.price['commissionFee']).toFixed(2)
                        }
                    }
                });
                responseObj.response = data;
            }
            return cb();
        });
    }
    const cityNames = (callback) => {
        getCityObject(function (cityMap) {
            if (cityMap) {
                responseObj.status = _status.SUCCESS;
            } else {
                responseObj.status = _status.ERROR;
                //responseObj.message = 'Error in getting city names in trips';
                responseObj.message = keymapper["s2c"]["errorInCityName"][args.lang];
            }
            let productsArr = [];
            responseObj.response.forEach(product => {
                if (product && product.shipmentDetails) {
                    let shipmenet = product.shipmentDetails;
                    if (shipmenet.from && cityMap[shipmenet.from]) {
                        product.from = getCityName(cityMap[shipmenet.from], args);
                    }
                    if (shipmenet.to && cityMap[shipmenet.to]) {
                        product.to = getCityName(cityMap[shipmenet.to], args);
                    }
                    delete product.shipmentDetails;
                }
                productsArr.push(product);
            });
            responseObj.response = productsArr;
            return callback();
        });
    }
    _async.series([
        carryRequest.bind(),
        cityNames.bind()
    ], () => {
        return callback(responseObj)
    });
}

const cancelTrip = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        //message: 'Error in canceling the trip.',
        message: keymapper["s2c"]["errorInCancelingTrip"][args.lang],
        response: null
    }

    const checkPickedShipments = (cb) => {
        _mongoose.models['CarryRequests'].find({ tripId: args.tripId, status: { "$in": ["picked", "delivered"] } }, (cerr, res) => {
            if (cerr && !res) {
                responseObj.status = _status.ERROR,
                    responseObj.message = 'Error in getting the carry item';
                return callback(responseObj);
            } else {
                if (res && res.length) {
                    //responseObj.message = 'Cannot cancel the trip once shipment has been picked up';
                    responseObj.message = keymapper["s2c"]["cntCancelTripShipmntPicked"][args.lang]
                    return callback(responseObj);
                } else {
                    return cb();
                }
            }
        });
    }

    let awaitingReq = []
    let confirmedReq = []
    let getCarryIds = (cb) => {
        _mongoose.models['CarryRequests'].find({ tripId: args.tripId, status: { "$in": ['awaiting', 'confirmed', 'captureFailed'] } }, 'status carryId', (err, docs) => {
            if (!err && docs.length) {
                for (let d of docs) {
                    if (d.status == 'awaiting' || d.status == 'captureFailed') {
                        awaitingReq.push(d.carryId)
                    }
                    if (d.status == 'confirmed') {
                        confirmedReq.push(d.carryId)
                    }
                }
            }
            return cb()
        })
    }

    // void payment if awaiting
    let voidPayment = (cb) => {
        if (awaitingReq.length) {
            //let requestModule = require('../carry/index')
            /*  let funcArr = []
             for (let c of awaitingReq) {
                 funcArr.push(function(lcb) {
                     requestModule.decline({carryId: c, lang: args.lang}, (e, d) => {
                         return lcb()
                     })
                 })
             }
 
         _async.parallel(funcArr, ()=> {
             return cb()
         }) */

            _async.each(awaitingReq, (carryId, next) => {
                requestModule.decline({ carryId: carryId, lang: args.lang }, (e, d) => {
                    next()
                })
            }, (e) => {
                return cb()
            })

        } else {
            return cb()
        }
    }
    // refund payment if confirmed
    let refundPayment = (cb) => {
        if (confirmedReq.length) {
            /*  let funcArr = []
             for (let c of confirmedReq) {
                 funcArr.push(function(lcb) {
                     requestModule.cancel({carryId: c, reason: args.reason, lang: args.lang, userInfo: args.userInfo}, (e, d) => {
                         return lcb()
                     })
                 })
             }
 
         _async.parallel(funcArr, ()=> {
             return cb()
         }) */

            _async.each(confirmedReq, (carryId, next) => {
                requestModule.cancel({ carryId: carryId, userInfo: args.userInfo, lang: args.lang }, (e, d) => {
                    next()
                })
            }, (e) => {
                return cb()
            })

        } else {
            return cb()
        }
    }

    let updateTrip = (cb) => {
        _mongoose.models['Trip'].findOneAndUpdate({ tripId: args.tripId, userId: args.userInfo.uid, status: { "$in": ["active", "inActive", "filled"] } }, { $set: { status: "cancelled", "reason": args.reason } }, (err, res) => {
            if (err && !res) {
                responseObj.status = _status.ERROR,
                    responseObj['error'] = err;
                return callback(responseObj);
            } else if (_.isEmpty(res)) {
                responseObj.message = keymapper["s2c"]["tripNotAvailableToCancel"][args.lang]
                return callback(responseObj);
            } else {
                responseObj.status = _status.SUCCESS;
                responseObj.message = "success";
                return cb();
            }
        });
    }
    _async.series([
        checkPickedShipments.bind(),
        getCarryIds.bind(),
        voidPayment.bind(),
        refundPayment.bind(),
        updateTrip.bind()
    ], () => {
        return callback(responseObj)
    })
};

const cancelShipment = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: keymapper["s2c"]["errInCancellingShipment"][args.lang],
        response: null
    }
    if (!args) {
        responseObj.message = keymapper["s2c"]["errIngettingCarryIdNdReason"][args.lang]
        return callback(responseObj);
    }
    if (!args.carryId) {
        //responseObj.message = "Error in getting carry id";
        responseObj.message = keymapper["s2c"]["errIngettingCarryId"][args.lang]
        return callback(responseObj);
    }
    if (!args.reason && !(args.hasOwnProperty('manualRefund') && args["manualRefund"])) {
        //responseObj.message = "Error in getting reason";
        responseObj.message = keymapper["s2c"]["errIngettingReason"][args.lang]
        return callback(responseObj);
    }

    const checkShipment = (cb) => {
        let statusArr = ["confirmed"];
        if (args.hasOwnProperty('manualRefund') && args['manualRefund']) {
            statusArr = ["picked"]
        }
        _mongoose.models['CarryRequests'].findOne({ carryId: args.carryId, status: { "$in": statusArr } }, (err, doc) => {
            if ((err && !doc) || (doc && doc.length)) {
                responseObj.message = 'Error in cancelling the shipment'
                return callback(responseObj)
            } else {
                return cb();
            }
        });
    }

    let refundRes = {}
    let refundStatus = false
    const refundMoney = (cb) => {
        payment.Refund(args, (d) => {
            if (d.response) {
                refundRes = d.response
                refundStatus = true
                responseObj.status = _status.SUCCESS,
                    responseObj.message = 'success';
                return cb();
            } else {
                responseObj.message = 'RefundMoneyFail:Error in Refund money'
                return callback(responseObj)
            }
        });
    }

    let refundResObj = {}
    const verifyRefund = (cb) => {
        if (!refundStatus) {
            return cb()
        }
        let headers = {
            Authorization: checkout_config.secretKey,
            'content-Type': 'application/json;charset=UTF-8'
        }
        _request({
            url: refundRes._links.payment.href,
            headers: headers,
            method: "GET",
            body: {},
            time: true,
            json: true
        }, (error, body, response) => {
            if (!error && response) {
                refundResObj = response
            }
            return cb()
        })
    }

    const updateShipmentStatus = (cb) => {
        let setData = {
            "status": "cancelled"
        }
        if (args.reason) {
            setData.reason = args.reason;
        }
        _mongoose.models['CarryRequests'].updateMany({ carryId: args.carryId }, { $set: setData }, (err, res) => {
            if (err && !res) {
                responseObj['error'] = err;
                return callback(responseObj)
            } else if (_.isEmpty(res)) {
                //responseObj.message = 'There is no shipment to cancel.';
                responseObj.message = keymapper["s2c"]["noShipmentToCancel"][args.lang];
                return callback(responseObj)
            } else {
                return cb();
            }
        });
    }

    const updateBookingInfo = (cb) => {
        _mongoose.models['BookingInfo'].updateMany({ carryId: args.carryId }, { $set: { shippingStatus: "cancelled", bookingStatus: "107" } }, (berr, res) => {
            if (berr) {
                responseObj.status = _status.ERROR,
                    responseObj.message = 'error in updating the status in booking info';
                return callback(responseObj);
            } else {
                return cb();
            }
        });
    }

    const updatePaymentInfo = (cb) => {
        let s = refundResObj.status
        if (!refundStatus) {
            s = 'Capture Failed'
        }
        _mongoose.models['PaymentInfo'].updateMany({ requestId: args.carryId }, { $set: { status: refundResObj.status } }, (berr, res) => {
            if (berr) {
                responseObj.status = _status.ERROR,
                    responseObj.message = 'error in updating the status in payment info ';
                return callback(responseObj);
            } else {
                responseObj.status = _status.SUCCESS;
                responseObj.message = 'success';
                return cb();
            }
        });
    }

    _async.series([
        checkShipment.bind(),
        refundMoney.bind(),
        verifyRefund.bind(),
        updateShipmentStatus.bind(),
        updateBookingInfo.bind(),
        updatePaymentInfo.bind()
    ], () => {
        return callback(responseObj)
    })
};

const ShipmentStatus = (req, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in updating shipment status',
        //message: keymapper["s2c"]["errInUpdatingShipmentStatus"][req.lang],
        response: null
    }
    let obj = null
    let pickedUp = false
    let dropOff = false
    let QRCode = req.body.QRCode
    let notifyType = ''

    if (QRCode.charAt(0) == 'P') {
        // pickedUp = true
        notifyType = 'pickup'
        obj = {
            bookingStatus: '104',
            pickupId: QRCode
        }
    }
    if (QRCode.charAt(0) == 'D') {
        // dropOff = true
        notifyType = 'delivered'
        obj = {
            dropoffId: QRCode
        }
    }
    let verifyQRCode = (cb) => {
        if (!obj) {
            //responseObj.message = 'Invalid QR Code'
            responseObj.message = keymapper["s2c"]["invalidQRCode"][req.lang]
            return callback(responseObj)
        }
        _mongoose.models['BookingInfo'].findOne(obj, (err, doc) => {
            if (!err && doc) {
                if (QRCode.charAt(0) == 'P') {
                    switch (doc.shippingStatus) {
                        case "pending":
                            pickedUp = true
                            break;
                        case "picked":
                        case "delivered":
                            //responseObj.message = 'Pickup has already been completed'
                            responseObj.message = keymapper["s2c"]["pickupCompleted"][req.lang]
                            return callback(responseObj)
                        default:
                            responseObj.message = 'Error in updating pickup status'
                            //responseObj.message = keymapper["s2c"]["errInUpdatingPickUpStatus"][req.lang]
                            return callback(responseObj)
                    }
                } else if (QRCode.charAt(0) == 'D') {
                    switch (doc.shippingStatus) {
                        case "picked":
                            dropOff = true
                            break;
                        case "pending":
                            //responseObj.message = 'Drop cannot be before pickup'
                            responseObj.message = keymapper["s2c"]["dropCannotBeforePickup"][req.lang]
                            return callback(responseObj)
                        case "delivered":
                            //responseObj.message = 'Drop has already been completed'
                            responseObj.message = keymapper["s2c"]["dropCompleted"][req.lang]
                            return callback(responseObj)
                        default:
                            responseObj.message = 'Error in updating drofOff status'
                            //responseObj.message = keymapper["s2c"]["errInUpdatingDropOffStatus"][req.lang]
                            return callback(responseObj)
                    }
                } else {
                    responseObj.message = 'Error in QR Code Verification'
                    //responseObj.message = keymapper["s2c"]["errInQRCode"][req.lang]
                    return callback(responseObj)
                }
                return cb()
            } else {
                //responseObj.message = 'Invalid QR Code'
                responseObj.message = keymapper["s2c"]["invalidQRCode"][req.lang]
                return callback(responseObj)
            }
        })
    }

    // update booking info
    let tripId = ''
    let carryId = ''
    let updateBookingInfo_ = (cb) => {
        _mongoose.models["BookingInfo"].findOne(obj, (e, d) => {
            if (!e && d) {
                tripId = d.tripId
                carryId = d.carryId
                if (pickedUp) {
                    d.shippingStatus = 'picked'
                } if (dropOff) {
                    d.shippingStatus = 'delivered'
                }
                d.save((err, doc) => {
                    responseObj.status = _status.SUCCESS
                    responseObj.message = 'success'
                    return cb()
                })
            } else {
                responseObj.message = 'ShipmentStatus:Error in getting Booking Details'
                return callback(responseObj)
            }
        })
    }

    // update carry request
    let requesterUid = ''
    let requestType = ''
    let updateCarryRequest_ = (cb) => {
        //_mongoose.models['CarryRequests'].findOne(obj, (e, d) => {
        delete obj.bookingStatus;
        _mongoose.models['CarryRequests'].findOne(obj, (e, d) => {
            if (!e && d) {
                requesterUid = d.userId
                requestType = d.type
                if (pickedUp) {
                    d.isPickedUp = true;
                    d.pickedDate = new Date()
                    d.status = "picked";
                }
                if (dropOff) {
                    d.isDroppedOff = true
                    d.droppedDate = new Date()
                    d.status = "delivered"
                }
                d.save((err, doc) => {
                    return cb()
                })
            } else {
                responseObj.message = 'ShipmentStatus:Error in getting Request Details'
                return callback(responseObj)
            }
        })
    }

    // only if it is drop, check if all requests are delievered and update trip status
    let carrierUid = ''
    let tripType = ''
    let tripComp = false
    let updateTripInfo_ = (cb) => {
        if (!dropOff) {
            return cb()
        } else {
            let findBy = {
                tripId: tripId,
                //bookingStatus: {'$in': ['105', '106']}, 
                bookingStatus: { '$in': ['104', '103'] },
                shippingStatus: { '$in': ['pending', 'picked'] }
            }
            _mongoose.models['Trip'].findOne({ tripId: tripId }, (e, d) => {
                if (!e && d) {
                    carrierUid = d.userId
                    tripType = d.tripType
                    _mongoose.models['BookingInfo'].find(findBy, (er, dc) => {
                        if (!er && dc.length == 0) {
                            tripComp = true
                            d.status = 'completed'
                            d.save((err, docs) => {
                                return cb()
                            })
                        } else {
                            return cb()
                        }
                    })
                } else {
                    responseObj.message = 'ShipmentStatus:Error in getting Trip Details'
                    return callback(responseObj)
                }
            })

        }
    }

    // calculate traveller earning for the request
    let requestEarnings = 0
    let calculateTrvlEarnings_ = (cb) => {
        if (!dropOff) {
            return cb()
        } else {
            _mongoose.models['BookingPriceInfo'].find({ carryId: carryId }, (e, d) => {
                if (d && d.length) {
                    for (let p of d) {
                        //requestEarnings = requestEarnings + (p.totalFare - p.commissionFee)
                        requestEarnings = requestEarnings + p.totalFare;
                    }
                }
                return cb()
            })
        }
    }

    // only if it is drop
    let updateTravellerAcc_ = (cb) => {
        if (!dropOff) {
            return cb()
        } else {
            let txnObj = {
                status: 'unprocessed',
                tripId: tripId,
                requestId: carryId,
                cur: 'SAR',
                amount: requestEarnings,
                date: _moment().format(),
                carrierUid: carrierUid,
                requesterUid: requesterUid,
                transactionId: carryId,
                transactionType: 'credit',
                tripType: tripType,
                requestType: requestType
            }
            new _mongoose.models["TravellerAccount"](txnObj).save((e, s) => {
                return cb()
            })
        }
    }

    _async.series([
        verifyQRCode.bind(),
        function (lcb) {
            _async.parallel([
                updateBookingInfo_.bind(),
                updateCarryRequest_.bind()], () => {
                    return lcb()
                })
        },
        function (lcb) {
            _async.parallel([
                updateTripInfo_.bind(),
                calculateTrvlEarnings_.bind()], () => {
                    return lcb()
                })
        },
        updateTravellerAcc_.bind()], () => {
            // norify sender
            notifications.notify({ type: notifyType, carryId: carryId, tripId: tripId }, () => {
                // console.log('notify')
            })
            // notify traveller
            if (tripComp) {
                notifications.notify({ type: 'tripCompleted', carryId: carryId, tripId: tripId }, () => {
                    // console.log('notify')
                })
            }
            // send email to traveller
            mailer.sendMail({
                // emailType: 'new_trip',
                template: 'shipment-delivered',
                // subject: "New trip",
                userId: carrierUid,
                tripId: tripId,
                carryId: carryId,
                lang: req.lang
            }, () => {

            })
            responseObj.status = _status.SUCCESS
            responseObj.message = 'shipment status updated successfully'
            //responseObj.message = keymapper["s2c"]["shipmentStatusUpdated"][req.lang]
            return callback(responseObj)
        })

    /* _async.series([verifyQRCode.bind()], () => {
        _async.parallel([updateCarryRequest.bind(), updateBookingInfo.bind()], () => {
            if (carryRequest && dropOff) {
                _async.parallel([getTripInfo.bind(), getPriceInfo.bind()], () => {
                    // update traveller account 
                    let txnObj = {
                        tripId: carryRequest.tripId,
                        requestId: carryRequest.carryId,
                        cur: 'SAR',
                        amount: carrierAmount,
                        date: _moment.format(),
                        carrierUid: carrierId,
                        requesterUid: carryRequest.userId,
                        transactionId: carryRequest.carryId,
                        transactionType: 'credit',
                        tripType: '',
                        requestType: ''
                    }
                    /* let txnObj = {
                        carrierId: carrierId,
                        requesterId: carryRequest.userId,
                        carryId: carryRequest.carryId,
                        amount: carrierAmount,
                        transactionId: 'pending',
                        transactionStatus: 'pending',                        
                        transactionType: "Cr",
                        paymentType: "carrier earnings",
                        cur: 'SAR',
                        payMode: 'bank',
                        recipient: 'bank',
                        date: _moment().format('DD-MMM-YYYY')
                    } 
                    new _mongoose.models["TravellerAccount"](txnObj).save((e, s) => {
                        return callback(responseObj)
                    })

                })
            } else {
                return callback(responseObj)
            }

        })
    }) */

}

const priceQuote = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in generating price Quote',
        //message: keymapper["s2c"]["errInPriceQuote"][body.lang],
        response: null
    }

    if (!(body && body.carryId && body.tripId && body.type && body.tripType)) {
        responseObj.message = "error in getting required fileds";
        //responseObj.message = keymapper["s2c"]["errInRequiredFields"][body.lang]
        return callback(responseObj)
    }

    const checkIfUnpaiedInvoice = (cb) => {
        let filter = { carryId: body.carryId, tripId: body.tripId, bookingStatus: '108' };
        _mongoose.models["BookingInfo"].find(filter, (e, s) => {
            if (e) {
                responseObj.message = "Error while checking unpaid invoice";
                //responseObj.message = keymapper["s2c"]["errCheckingUnpaidInvoice"][body.lang]
                return callback(responseObj)
            } else if (!_.isEmpty(s)) {
                //responseObj.message = "Unpaid invoice exists.";
                responseObj.message = keymapper["s2c"]["existsUnpaidInvoice"][body.lang]
                return callback(responseObj)
            } else {
                return cb();
            }
        });
    };

    let tripObj = null;
    let getTripDetails = (n) => {
        let filter = { tripId: body.tripId, status: { "$in": ["active"] } };
        _mongoose.models['Trip'].findOne(filter, (e, s) => {
            if (s) {
                tripObj = s
                return n()
            } else {
                //responseObj.message = "Trip is not available"
                responseObj.message = keymapper["s2c"]["tripNotAvailable"][body.lang]
                return callback(responseObj)
            }
        })
    }

    const checkAvailability = (cb) => {
        tripIndex.checkTripAvailability(tripObj, body, (availability) => {
            if (availability) {
                return cb();
            }
            //responseObj.message = 'Weight is exceeding the traveller limit'
            responseObj.message = keymapper["s2c"]["weightExceeding"][body.lang]
            return callback(responseObj)
        });
    }

    const previousCarryWeight = (cb) => {
        let filter = { tripId: body.tripId, carryId: body.carryId };
        _mongoose.models['CarryRequests'].findOne(filter, { _id: 0, weight: 1, userId: 1, sdc: 1, rpc: 1 }, (e, s) => {
            if (e && !s) {
                responseObj.message = 'Error in getting carry weight'
                //responseObj.message = keymapper["s2c"]["errInGettingCarryWeight"][body.lang]
                return callback(responseObj)
            }
            if (s && s.weight) {
                body.weight = s.weight
            }
            if (s && s.userId) {
                body.carryUserId = s.userId;
            }
            if (s) {
                body.sdc = s.sdc
                body.rpc = s.rpc
            }
            return cb();
        });
    }

    const paidPrice = (cb) => {
        let filter = { tripId: body.tripId, carryId: body.carryId };
        _mongoose.models['BookingPriceInfo'].findOne(filter, { _id: 0, payFare: 1, totalFare: 1 }, (e, s) => {
            if (e && !s) {
                responseObj.message = 'Error in getting paid price'
                //responseObj.message = keymapper["s2c"]["errInGettingPaidPrice"][body.lang]
                return callback(responseObj)
            }
            if (s && s.payFare) {
                body.paidFare = s.payFare
                body.totalFare = s.totalFare
            }
            return cb();
        });
    }

    let calculateprice = (n) => {
        let weight = (body.weight) ? parseInt(body.weight) : 0;
        body.weight = body.extraWeight + weight;
        body.invoice = true;
        helper.calculatePrice(body, (invoiceObj) => {
            if (invoiceObj) {
                body.weight = weight;
                let payFare = ((invoiceObj.payFare) ? invoiceObj.payFare : 0);
                let paidFare = ((body.paidFare) ? body.paidFare : 0);
                //body.extraPayFare = paidFare - payFare;
                body.extraPayFare = parseInt(invoiceObj.totalFare) + parseInt(invoiceObj.commissionFee);
                body.totalFare = payFare;
                body.currency = ((invoiceObj.currency) ? invoiceObj.currency : 0);
                body.vat = ((invoiceObj.vat) ? invoiceObj.vat : 0);
                body.vatConfig = ((invoiceObj.vatConfig) ? invoiceObj.vatConfig : 0);
                responseObj.status = _status.SUCCESS
                responseObj.message = "success"
                responseObj.response = body;
            } else {
                responseObj.message = "Error in getting invoice."
                //responseObj.message = keymapper["s2c"]["errInGettingInvoice"][body.lang]
            }
            return n();
        })
    }

    _async.series([
        checkIfUnpaiedInvoice.bind(),
        getTripDetails.bind(),
        previousCarryWeight.bind(),
        paidPrice.bind(),
        checkAvailability.bind(),
        calculateprice.bind()
    ], () => {
        return callback(responseObj);
    });
}

const raiseInvoice = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in generating invoice',
        //message: keymapper["s2c"]["errInGettingInvoice"][body.lang],
        response: null
    }
    if (!(body && body.carryId && body.tripId && body.type && body.tripType)) {
        responseObj.message = "error in getting required fileds";
        //responseObj.message = keymapper["s2c"]["errInRequiredFields"][body.lang];
        return callback(responseObj)
    }
    if (body && body.hasOwnProperty("extraPayFare") && body.extraPayFare <= 0) {
        //responseObj.message = "No extra amount is required to be paid";
        responseObj.message = keymapper["s2c"]["amountIsZero"][body.lang];
        return callback(responseObj);
    }

    const checkIfUnpaiedInvoice = (cb) => {
        let filter = { carryId: body.carryId, tripId: body.tripId, bookingStatus: '108' };
        _mongoose.models["BookingInfo"].find(filter, (e, s) => {
            if (e) {
                //responseObj.message = "Error while checking unpaid invoice";
                responseObj.message = keymapper["s2c"]["errCheckingUnpaidInvoice"][body.lang];
                return callback(responseObj)
            }
            if (!_.isEmpty(s)) {
                //responseObj.message = "Unpaid invoice exists.";
                responseObj.message = keymapper["s2c"]["existsUnpaidInvoice"][body.lang];
                return callback(responseObj)
            }
            return cb();
        });
    };

    let tripObj = null;
    const checkAvailability = (cb) => {
        let getTripDetails = (n) => {
            let filter = { tripId: body.tripId, status: { "$in": ["active"] } };
            _mongoose.models['Trip'].findOne(filter, (e, s) => {
                if (e && !s || _.isEmpty(s)) {
                    //responseObj.message = "Trip is not available"
                    responseObj.message = keymapper["s2c"]["tripNotAvailable"][body.lang];
                    return callback(responseObj)
                } else {
                    tripObj = s;
                    return n();
                }
            })
        }

        let checkWeightAvailability = (n) => {
            tripIndex.checkTripAvailability(tripObj, body, (availability) => {
                if (availability) {
                    return n();
                }
                //responseObj.message = 'Weight is exceeding the Traveller's limit'
                responseObj.message = keymapper["s2c"]["weightExceeding"][body.lang];
                return callback(responseObj)
            });
        }

        _async.series([
            getTripDetails.bind(),
            checkWeightAvailability.bind()
        ], () => {
            return cb();
        });
    }

    let invoiceId = randomstring.generate(5);
    const saveInvoice = (cb) => {
        body.carryMode = (tripObj && tripObj.tripType) ? tripObj.tripType : "";
        body.tripUserId = (tripObj && tripObj.userId) ? tripObj.userId : '';
        body.carryType = body.type;
        body.status = 'unpaid';
        body.invoiceId = invoiceId;
        _mongoose.models["Invoice"](body).save((e, s) => {
            if (e && !s) {
                responseObj.message = "Error in generating invoice";
                //responseObj.message = keymapper["s2c"]["errInGettingInvoice"][body.lang];
                return callback(responseObj);
            }
            _mongoose.models['BookingPriceInfo'].findOneAndUpdate({ 'carryId': body.carryId, 'invoiceId': 'NEG' }, { $set: { "invoiceId": invoiceId } }, (err, res) => {

            })
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.status = _status.SUCCESS
            responseObj.message = 'success'
            responseObj.response.invoiceId = invoiceId;
            return cb();
        })
    };

    const holdInvoiceRequest = (cb) => {
        body.invoice = true;
        body.invoiceId = invoiceId
        tripIndex.holdInvoice(body, (responce) => {
            notifications.notify({ type: 'newInvoice', carryId: body.carryId, tripId: body.tripId, invoiceId: invoiceId }, () => {
                // console.log('notify')
            })
            return callback(responseObj);
        });
    }

    _async.series([
        checkIfUnpaiedInvoice.bind(),
        checkAvailability.bind(),
        saveInvoice.bind(),
        holdInvoiceRequest.bind(),
    ], () => {
        return callback(responseObj);
    });
}

const invoices = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in getting invoices',
        //message: keymapper["s2c"]["errInGettingInvoice"][body.lang],
        response: null
    }

    const activeInvoices = (cb) => {
        let filter = { carryUserId: body.userId, status: 'unpaid' };
        let obj = {
            key: "tripUserId"
        }
        let agg = _mongoose.models["Invoice"]["invoiceList"](filter, obj, {});
        let activeInvoices = [];
        _mongoose.models["Invoice"].aggregate(agg, (e, s) => {
            if (e && !s) {
                return callback(responseObj);
            }
            s.forEach(item => {
                if (item && item.extraPayFare && !_.isEqual(item.extraPayFare, 0) && item.status) {
                    item.paymentUrl = _config.paymentUrl + "?tripId=" + item.tripId + "&carryId=" + item.carryId + "&invoiceId=" + item.invoiceId;
                }
                activeInvoices.push(item);
            });
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.status = _status.SUCCESS
            responseObj.message = 'success'
            responseObj.response.activeInvoices = activeInvoices;
            return cb();
        });
    }

    const raisedInvoices = (cb) => {
        let filter = { tripUserId: body.userId, status: 'unpaid' };
        let obj = {
            key: "carryUserId"
        }
        let agg = _mongoose.models["Invoice"]["invoiceList"](filter, obj, {});
        _mongoose.models['Invoice'].aggregate(agg, (e, s) => {
            if (e && !s) {
                return callback(responseObj);
            }
            s.forEach(eachUser => {
                if (eachUser) {
                    delete eachUser.trip;
                }
            });
            if (!responseObj.response) {
                responseObj.response = {};
            }
            responseObj.status = _status.SUCCESS
            responseObj.message = 'success'
            responseObj.response.raisedInvoices = s;
            return cb();
        })
    }

    _async.series([
        activeInvoices.bind(),
        raisedInvoices.bind()
    ], () => {
        return callback(responseObj);
    });
}

//get list of invoices for operations
const getInvoices = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        //message: 'Error in getting invoices',
        message: keymapper["s2c"]["errInGettingInvoice"][body.lang],
        response: null
    }
    let filter = {}
    if (body.key && body.key != '') {
        //filter["$and"] = []
        let key = body.key.replace(/[&\\\#,+()$~%.'":*?<>{}]/g, '')
        // key = key.split('/')
        // if (key[0]) {
        //     filter["$and"].push({invoiceId: new RegExp(key[0], 'i') })
        // }
        // if (key[1]) {
        //     filter["$and"].push(
        //         {'$or' : [
        //             { "carrier.fname": new RegExp(key[1], 'i') },
        //             { "carrier.lname": new RegExp(key[1], 'i') },
        //             { "carrier.fullName": new RegExp(key[1], 'i') }]
        //         })
        // }
        filter["$or"] = [
            { "carrier.fname": new RegExp(key, 'i') },
            { "carrier.lname": new RegExp(key, 'i') },
            { "carrier.fullName": new RegExp(key, 'i') },
            { "invoiceId": new RegExp(key, 'i') },
            { "tripId": new RegExp(key, 'i') },
            { "carryId": new RegExp(key, 'i') },
            { "requester.fname": new RegExp(key, 'i') },
            { "requester.lname": new RegExp(key, 'i') },
            { "requester.fullName": new RegExp(key, 'i') },
        ]
    }
    let agg = _mongoose.models["Invoice"]["invoiceListOps"]({}, filter, {});
    _mongoose.models["Invoice"].aggregate(agg, (err, docs) => {
        if (!err && docs) {
            for (let d of docs) {
                d.createdAt = _moment(d.createdAt).format('DD-MMM-YYYY hh:mm A')
                d.updated = _moment(d.updated).format('DD-MMM-YYYY hh:mm A')
            }
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Success'
            responseObj.response = docs;
        }
        return callback(responseObj)
    })
}

const getCarrierTxn = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        //message: 'Error in getting carrier transaction',
        message: keymapper["s2c"]["errInGettingCarrierTxn"][body.lang],
        response: null
    }
    _mongoose.models['CarrierTxn'].find({ 'carrierId': body.userInfo.uid }).exec((err, docs) => {
        if (!err && docs) {
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Success'
            // responseObj.response = docs

            // to be removed once integration/changes made in app
            let clone = JSON.parse(JSON.stringify(docs))
            for (let d of clone) {
                d["userId"] = d.carrierId,
                    d["txnType"] = d.transactionType,
                    d["serviceType"] = d.paymentType
            }
            responseObj.response = clone
        }
        return callback(responseObj);
    })
}

const saveIdProofs = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        //message: "Error in save id proofs",
        message: keymapper["s2c"]["errInSaveIdProof"][body.lang],
        response: null
    }
    if (!(body && body.nationality && body.idType && body.attachments && body.attachments.frontImage && body.attachments.backImage)) {
        //responseObj.message = "Error in getting required fields"
        responseObj.message = keymapper["s2c"]["errInRequiredFields"][body.lang];
        return callback(responseObj);
    }
    let idProofObj = {
        nationality: body.nationality,
        idType: body.idType,
        attachments: body.attachments
    }
    let filter = { verified: true, uid: body.uid };
    _mongoose.models['Users'].findOneAndUpdate(filter, { $set: { idProof: idProofObj, idProofAuth: "pending" } }).exec((err, data) => {
        if (!err && data) {
            responseObj.status = _status.SUCCESS;
            responseObj.message = "Success";
        }
        return callback(responseObj);
    });
}

const idProofDetails = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        //message: "Error in getting id proofs",
        message: keymapper["s2c"]["errInGettingIdProof"][body.lang],
        response: null
    }
    let filter = { verified: true, uid: body.uid };
    _mongoose.models['Users'].findOne(filter, { uid: 1, idProof: 1, _id: 0 }).exec((err, data) => {
        if (!err && data) {
            responseObj.status = _status.SUCCESS;
            responseObj.message = "Success";
            responseObj.response = data;
        }
        return callback(responseObj);
    });
}

const onGoingTripsAndShipments = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in getting on goint trips and shipments',
        response: null
    }
    cityIdsArr = [];
    let filter = {
        "userId": body.uid,
        "status": { "$in": ["active", "onGoing", "filled"] }
    }
    let tripsInfo = '';
    let userIdsArr = [];
    let tripsAndShipments = (cb) => {
        let agg = _mongoose.models["Trip"]["onGoingTripsAndShipments"](filter, {}, {});
        _mongoose.models['Trip'].aggregate(agg).exec((err, data) => {
            tripsInfo = data;
            if (data && !err) {
                for (let s of data) {
                    if (s && s.from && s.to) {
                        cityIdsFun(s.from, s.to);
                    }
                    if (s && s.userId && userIdsArr.indexOf(s.userId) === -1) {
                        userIdsArr.push(s.userId);
                    }
                    for (let c of s.carrier) {
                        if (c && c.userId && userIdsArr.indexOf(c.userId) === -1) {
                            userIdsArr.push(c.userId);
                        }
                    }
                }
            }
            return cb();
        });
    }

    let userInfoObj = '';
    const userInfo = (cb) => {
        _mongoose.models['Users'].find({ uid: { $in: userIdsArr } }, { _id: 0, fname: 1, lname: 1, code: 1, number: 1, email: 1, pic: 1, uid: 1 }).exec((e, users) => {
            if (e && !users) {
                responseObj.message = 'Error in getting user information.'
                responseObj.status = _status.ERROR;
                return callback(responseObj);
            }
            userInfoObj = common.arrayTomap(users, "uid", true);
            return cb()
        });
    }

    const cityNames = (cb) => {
        getCityObject(function (cityMap) {
            if (cityMap) {
                responseObj.status = _status.SUCCESS;
                responseObj.message = "Success"
            } else {
                responseObj.status = _status.ERROR;
                responseObj.message = keymapper["s2c"]["errorInCityName"][body.lang]
            }
            let trips = [];
            let carriers = [];
            for (let d of tripsInfo) {
                let from = (d && d.from && cityMap[d.from]) ? getCityName(cityMap[d.from], body) : ''
                let to = (d && d.to && cityMap[d.to]) ? getCityName(cityMap[d.to], body) : ''
                if (d.carrier && d.carrier.length > 0) {
                    for (let c of d.carrier) {
                        c.from = from;
                        c.to = to
                        c.userInfo = userInfoObj[c.userId];
                        carriers.push(c);
                    }
                    carriers.push()
                } else {
                    d.from = from;
                    d.to = to;
                    d.userInfo = userInfoObj[d.userId];
                    delete d.carrier;
                    trips.push(d)
                }
            }
            responseObj.response = {
                "trips": trips,
                "carriers": carriers
            }
            return cb();
        })
    }
    _async.series([
        tripsAndShipments.bind(),
        userInfo.bind(),
        cityNames.bind()
    ], () => {
        return callback(responseObj)
    });
}

const travellerTrips = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in getting on goint trips and shipments',
        response: {}
    }

    let trips = []
    let tripIds = []
    let cityIdArr = []
    let getAllTrips = (cb) => {
        _mongoose.models['Trip'].find({ userId: body.userInfo.uid, status: { "$in": ['active', 'filled', 'onGoing'] } }, 'createdAt tripId status from to tripType', (err, docs) => {
            if (!err && docs.length) {
                trips = JSON.parse(JSON.stringify(docs))
                for (let d of docs) {
                    tripIds.push(d.tripId)
                    cityIdArr.push(parseInt(d.from))
                    cityIdArr.push(parseInt(d.to))
                }
                cityIdArr = [...new Set(cityIdArr)]
                return cb()
            } else {
                responseObj.response['trips'] = []
                responseObj.response['newRequests'] = []
                responseObj.response['travellerInfo'] = body.userInfo
                responseObj.message = 'No Data Available'
                return callback(responseObj)
            }
        }).sort({ "createdAt": -1 })
    }

    let shipments = []
    let userIdArr = []
    let carryIdsArr = []
    let getAllShipments = (cb) => {
        _mongoose.models['CarryRequests'].find({ tripId: { '$in': tripIds }, status: { '$in': ['awaiting', 'confirmed', 'picked'] } }, 'createdAt status tripId carryId userId from to type weight paper units -_id', (err, docs) => {
            if (!err && docs.length) {
                shipments = JSON.parse(JSON.stringify(docs))
                for (let d of docs) {
                    userIdArr.push(d.userId)
                    carryIdsArr.push(d.carryId)
                }
                userIdArr = [...new Set(userIdArr)]
                carryIdsArr = [...new Set(carryIdsArr)]
            }
            return cb()
        }).sort({ "createdAt": -1 })
    }

    let userInformation = {}
    let getReqUserInfo = (cb) => {
        _mongoose.models['Users'].find({ uid: { '$in': userIdArr } }, 'fname lname uid pic -_id', (err, docs) => {
            if (!err && docs.length) {
                userInformation = JSON.parse(JSON.stringify(docs))
            }
            return cb()
        })
    }

    let shipmentEarnings = []
    let getReqEarnings = (cb) => {
        _mongoose.models['BookingPriceInfo'].find({ carryId: { '$in': carryIdsArr } }, 'carryId totalFare commissionFee -_id', (err, docs) => {
            if (!err && docs.length) {
                shipmentEarnings = docs
            }
            return cb()
        })
    }

    let cityMap = {}
    let getCityData = (cb) => {
        let params = {
            lang: "en",
            cityIds: cityIdArr
        }
        let agg = _mongoose.models["CityPredictive"]["cityName"]({}, {}, params)
        _mongoose.models["CityPredictive"].aggregate(agg).exec((err, docs) => {
            if (docs && docs.length) {
                cityMap = common.arrayTomap(docs, "cityId", true)
            }
            return cb()
        })
    }

    _async.series([
        getAllTrips.bind(),
        function (lcb) {
            _async.parallel([
                getAllShipments.bind(),
                getCityData.bind()], () => {
                    return lcb(null, null)
                })
        },
        function (lcb) {
            _async.parallel([
                getReqUserInfo.bind(),
                getReqEarnings.bind()
            ], () => {
                return lcb(null, null)
            })
        }], () => {
            // costruct final responsen

            for (let d of shipments) {
                let tempEarnings = _.find(shipmentEarnings, { 'carryId': d.carryId })
                let tempTrip = _.find(trips, { tripId: d.tripId })
                let tempUserInfo = _.find(userInformation, { uid: d.userId })
                d['earnings'] = ' SAR ' + (tempEarnings.totalFare - tempEarnings.commissionFee).toString()
                d['from'] = cityMap[tempTrip.from].name
                d['to'] = cityMap[tempTrip.to].name
                d['userInfo'] = tempUserInfo
                d['tripType'] = tempTrip.tripType
            }
            for (let d of trips) {
                d['from'] = cityMap[d.from].name
                d['to'] = cityMap[d.to].name
            }
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Travellers Trips and new requests'
            responseObj.response['travellerInfo'] = body.userInfo
            responseObj.response['trips'] = trips
            responseObj.response['newRequests'] = shipments
            return callback(responseObj)
        })
}

module.exports = {
    profile,
    userTrips,
    trip,
    shipments,
    trackingInfo,
    productDetails,
    cancelTrip,
    cancelShipment,
    ShipmentStatus,
    travellerTrips,

    priceQuote,
    raiseInvoice,
    invoices,
    getCarrierTxn,
    saveIdProofs,
    idProofDetails,
    getInvoices,

    onGoingTripsAndShipments
};