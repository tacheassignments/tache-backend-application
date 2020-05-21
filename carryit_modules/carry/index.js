'use strict'
/**
 * 
 */
const randomstring = require("randomstring")
    , common = require('../../libs/utils/common')
    , restructure = require('../../libs/utils/restructure')
    , helper = require('./helper')
    , helpAdaptor = require('../../libs/helper')
    , keymapper = require('../../libs/utils/key-mapping')
    , payment = require('../payment')
    , checkout_config = _config.checkout
    , transactions = require('../transaction')
    , notifications = require('../notifications')
    , mailer = require('../../libs/mailer')

module.exports = {
    // calculate price for the request
    priceQuote: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'search error',
        }
        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(body, "priceRQ-" + currentTime, "Carry-Request")
        body.userId = body.uid
        body.carryId = randomstring.generate(5)
        body.attachments = body["att"]
        let tripObj = null
        let getTripDetails = (n) => {
            let filter = { tripId: body.tripId, status: { "$in": ["active"] } }
            _mongoose.models['Trip'].find(filter, (e, s) => {
                if (s && s.length) {
                    tripObj = s[0]
                    //validate the request
                    let retObj = helper.validateRequest(body, tripObj)
                    if (retObj.valid) {
                        // fetch city data
                        let getCityData = (cb) => {
                            let params = {
                                lang: "en",
                                cityIds: [parseInt(tripObj.to), parseInt(tripObj.from)]
                            }
                            let agg = _mongoose.models["CityPredictive"]["cityName"]({}, {}, params)
                            _mongoose.models["CityPredictive"].aggregate(agg).exec((err, data) => {
                                if (!err && data && data.length) {
                                    let cityMap = common.arrayTomap(data, "cityId", true)
                                    body['from'] = cityMap[tripObj.from].name + ', ' + cityMap[tripObj.from].country
                                    body['to'] = cityMap[tripObj.to].name + ', ' + cityMap[tripObj.to].country
                                    body['depDate'] = _moment(tripObj.depDate, 'YYYYMMDD').format('DD MMM YY')
                                    body['depTime'] = _moment(tripObj.depTime, 'HH:mm').format('HH:mm A')
                                    body['arrDate'] = _moment(tripObj.arrDate, 'YYYYMMDD').format('DD MMM YY')
                                    body['arrTime'] = _moment(tripObj.arrTime, 'HH:mm').format('hh:mm A')
                                }
                                return cb()
                            })
                        }
                        // fetch user data
                        let getUserData = (cb) => {
                            _mongoose.models['Users'].findOne({ 'uid': body.userId }).exec((err, data) => {
                                if (!err && data) {
                                    body['receiver'] = {
                                        'name': data.fname + ' ' + data.lname,
                                        'number': data.number,
                                        'email': data.email,
                                        'pic': (data.pic) ? data.pic : '',
                                        'code': data.code
                                    }
                                    return cb()
                                }
                            })
                        }
                        let arr = []
                        arr.push(getCityData)
                        if (!body.otherReceiver) {
                            arr.push(getUserData)
                        }
                        _async.parallel(arr, (err) => {
                            return n()
                        })
                        // return n()
                    } else {
                        responseObj.message = retObj.message
                        return callback(responseObj)
                    }

                } else {
                    responseObj.message = keymapper["s2c"]["tripNotAvailable"][body.lang]
                    //responseObj.message = "Trip is not available"
                    return callback(responseObj)
                }
            })
        }
        /**save carry request */
        let saveCarryRequest = (n) => {
            // smc is required if sdc is false
            if (!body.sdc && (!body.smc || _.isEmpty(body.smc))) {
                responseObj.message = "sender meeting address is not available"
                return callback(responseObj)
            }

            // rmc is required if rpc is false
            if (!body.rpc && (!body.rmc || _.isEmpty(body.rmc))) {
                responseObj.message = "receiver meeting address is not available"
                return callback(responseObj)
            }

            // tripObj.pickPoint.point is required if sdc id true
            if (body.sdc && (!tripObj.pickPoint || !tripObj.pickPoint.point)) {
                responseObj.message = "pickPoint is not avalable in Trip"
                return callback(responseObj)
            }

            // tripObj.deliverPoint.point is required if rpc is true
            if (body.rpc && (!tripObj.deliverPoint || !tripObj.deliverPoint.point)) {
                responseObj.message = "deliverPoint is not avalable in Trip"
                return callback(responseObj)
            }
            if (body.sdc) {
                //body.smc = tripObj.pickPoint.point
                let pickPoint = tripObj.pickPoint.point;
                pickPoint.date = tripObj.pickPoint.date;
                pickPoint.time = tripObj.pickPoint.time;
                body.smc = pickPoint;
            } else {
                let pickPoint = body.smc;
                pickPoint.landMark = body.pLandmark;
                pickPoint.range = tripObj.pickRange.radius
                body.smc = pickPoint
                body.smc['date'] = tripObj.pickRange.date;
                body.smc['time'] = tripObj.pickRange.time;
            }
            if (body.rpc) {
                //body.rmc = tripObj.deliverPoint.point
                let deliverPoint = tripObj.deliverPoint.point;
                deliverPoint.date = tripObj.deliverPoint.date;
                deliverPoint.time = tripObj.deliverPoint.time;
                body.rmc = deliverPoint;
            } else {
                let dropPoint = body.rmc;
                dropPoint.landMark = body.dLandmark;
                dropPoint.range = tripObj.deliverRange.radius
                body.rmc = dropPoint
                body.rmc['date'] = tripObj.deliverRange.date;
                body.rmc['time'] = tripObj.deliverRange.time;
            }
            body.quantity = 1;
            //body.status = "pending";
            body.status = "onHold";
            body.lang = body.lang
            new _mongoose.models["CarryRequests"](body).save((e, s) => {
                if (s && s.id) {

                }
                return n()
            })
        }
        let available = false
        let checkAvailability = (n) => {
            /*  let bookingInfo = {
                  carryId: body.carryId,
                  tripId: body.tripId,
                  pkgWt: (body.type == "package") ? body.weight : 0,
                  pkgQt: (body.type == "package") ? body.quantity : 0,
                  docWt: (body.type == "document") ? body.weight : 0,
                  docQt: (body.type == "document") ? body.quantity : 0,
                  pkgWtMax: (tripObj.package) ? tripObj.package.weight : 0,
                  pkgQtMax: (tripObj.package) ? tripObj.package.qnty : 0,
                  docWtMax: (tripObj.document) ? tripObj.document.weight : 0,
                  docQtMax: (tripObj.document) ? tripObj.document.qnty : 0,
                  bookingStatus: 101,
                  transactionStatus: 201
              }*/
            let filter = { tripId: body.tripId, transactionStatus: 201 }
            _mongoose.models['BookingInfo'].find(filter, (e, s) => {
                if (s && s.length == 0) {
                    //block 
                    /* new _mongoose.models["BookingInfo"](bookingInfo).save((e, s) => {
                         if (s && s.id) {
                             available = true
                         }
                         return n()
                     })*/
                    return n()
                } else if (s && s.length > 0) {
                    let totalDocWeight = 0, totalDocQnty = 0, totalPkgWeight = 0, totalPkgQnty = 0
                    for (let b of s) {
                        totalDocWeight = totalDocWeight + b.docWt
                        totalDocQnty = totalDocQnty + b.docQt
                        totalPkgWeight = totalPkgWeight + b.pkgWt
                        totalPkgQnty = totalPkgQnty + b.pkgQt
                    }

                    if (body.type == "package") {
                        totalPkgWeight = totalPkgWeight + body.weight;
                        totalPkgQnty = totalPkgQnty + 1;
                        if (totalPkgWeight > tripObj.package.weight) {
                            //not available
                            available = false
                            //responseObj.message = "Package Weight is exceeding the traveller limit"
                            responseObj.message = keymapper["s2c"]["pkgwgtExcTrvlLmt"][body.lang]
                        }
                        else if (totalPkgQnty > tripObj.package.qnty) {
                            //not available
                            available = false
                            //responseObj.message = "Package quantity is exceeding the traveller limit"
                            responseObj.message = keymapper["s2c"]["pkgQtyExcTrvlLmt"][body.lang]
                        }
                        else {
                            available = true

                        }
                    }
                    else if (body.type == "document") {
                        totalDocWeight = totalDocWeight + body.weight
                        totalDocQnty = totalDocQnty + 1;
                        if (totalDocWeight > tripObj.document.weight) {
                            //not available
                            available = false
                            //responseObj.message = "Document Weight is exceeding the traveller limit"
                            responseObj.message = keymapper["s2c"]["docWgtExcTrvlLmt"][body.lang]
                        }
                        else if (totalDocQnty > tripObj.document.qnty) {
                            //not available
                            available = false
                            //responseObj.message = "Document quantity is exceeding the traveller limit"
                            responseObj.message = keymapper["s2c"]["docQtyExcTrvlLmt"][body.lang]
                        }
                        else {
                            available = true

                        }
                    }
                    if (available) {
                        //block 
                        /*  new _mongoose.models["BookingInfo"](bookingInfo).save((e, s) => {
                              if (s && s.id) {
                                  available = true
                              }
                              return n()
                          })*/
                        return n()
                    } else {
                        //responseObj.message = "trip is not avaialable"
                        return callback(responseObj)
                    }

                }

            })
        }
        let priceObj = null
        let calculateprice = (n) => {
            body.tripType = tripObj.tripType
            helper.calculatePrice(body, (o) => {
                priceObj = o
                return n()
            })
        }

        _async.series([
            getTripDetails.bind(),
            saveCarryRequest.bind(),
            checkAvailability.bind(),
            calculateprice.bind(),
        ], () => {
            if (priceObj) {
                body["att"] = body["attachments"]
                responseObj.response = {
                    price: {
                        carryId: priceObj.carryId,
                        tripId: priceObj.tripId,
                        currency: "SAR",
                        pickFee: priceObj.pickFee,
                        dropFee: priceObj.dropFee,
                        carryFee: priceObj.carryFee,
                        totalFare: priceObj.totalFare,
                        vat: priceObj.vat,
                        payFare: priceObj.payFare,
                        details: priceObj.details,
                        commissionFee: priceObj.commissionFee,
                        totalFareWithCommissionFee: parseFloat(priceObj.totalFare + priceObj.commissionFee).toFixed(2)
                    },
                    shipment: body

                }
                responseObj.status = _status.SUCCESS
                responseObj.message = "success"
            } else {
                responseObj.message = "Error in getting price object"
            }
            helpAdaptor.logWriter(responseObj, "priceRS-" + currentTime, "Carry-Request")
            return callback(responseObj)
        })

    },

    //Put booking on hold before payment
    holdRequest: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'search error',
        }
        let tripObj = null
        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(body, "holdRQ-" + currentTime, "Carry-Request")
        let getTripDetails = (n) => {
            let filter = { tripId: body.tripId, status: { "$in": ["active"] } }
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
        let carryObj = null
        let getcarryDetails = (n) => {
            let filter = { carryId: body.carryId }
            _mongoose.models['CarryRequests'].findOne(filter, (e, s) => {
                if (s) {
                    carryObj = s
                    return n()
                } else {
                    //responseObj.message = "carry is not available"
                    responseObj.message = keymapper["s2c"]["carryNotAvailable"][body.lang]
                    return callback(responseObj)
                }

            })
        }
        _async.parallel([
            getTripDetails.bind(),
            getcarryDetails.bind()
        ], (e) => {
            if (tripObj && carryObj) {
                /** block the trip */
                let bookingInfo = {
                    carryId: carryObj.carryId,
                    tripId: carryObj.tripId,
                    pkgWt: (carryObj.type == "package") ? carryObj.weight : 0,
                    pkgQt: (carryObj.type == "package") ? carryObj.quantity : 0,
                    docWt: (carryObj.type == "document") ? carryObj.weight : 0,
                    docQt: (carryObj.type == "document") ? carryObj.quantity : 0,
                    pkgWtMax: (tripObj.package) ? tripObj.package.weight : 0,
                    pkgQtMax: (tripObj.package) ? tripObj.package.qnty : 0,
                    docWtMax: (tripObj.document) ? tripObj.document.weight : 0,
                    docQtMax: (tripObj.document) ? tripObj.document.qnty : 0,
                    bookingStatus: 101,
                    transactionStatus: 201
                }
                _mongoose.models['BookingInfo'].findOne({ carryId: carryObj.carryId, tripId: carryObj.tripId }, (err, doc) => {
                    if (!err && !doc) {
                        new _mongoose.models["BookingInfo"](bookingInfo).save((e, s) => {
                            if (s && s.id) {
                                responseObj.status = _status.SUCCESS
                                responseObj.message = "your request is kept on hold, please continue the payment for confirm the booking"
                                responseObj.response = {
                                    paymentUrl: _config.paymentUrl + "?tripId=" + bookingInfo.tripId + "&carryId=" + bookingInfo.carryId
                                }
                            } else {
                                let obj = {
                                    collectionName: 'BookingInfo',
                                    persistingObj: JSON.stringify(bookingInfo)
                                }
                                _mongoose.models['PersistenceFailure'].create(obj, () => { })
                                responseObj.message = "Not confirmed"
                            }
                            callback(responseObj)
                        })
                    } else if (!err && doc) {
                        responseObj.status = _status.ERROR
                        //responseObj.message = 'Request already on hold'
                        responseObj.message = keymapper["s2c"]["ReqOnHold"][body.lang]
                        return callback(responseObj)
                    } else {
                        responseObj.status = _status.ERROR
                        responseObj.message = 'db error'
                        return callback(responseObj)
                    }
                })
            } else {
                helpAdaptor.logWriter(responseObj, "holdRS-" + currentTime, "Carry-Request")
                callback(responseObj)
            }
        })
    },

    // get list of request for - operations
    list: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null
        }
        let filter = {}
        let cityIdArr = []
        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(body, "RequestListRQ-" + currentTime, "Carry-Request")
        body['offset'] = (body.offset) ? body.offset : 0
        body['limit'] = (body.limit) ? body.limit : 10
        if (body.key && body.key != '') {
            let key = body.key.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '')
            filter['$or'] = [
                { 'user.fname': new RegExp(key, 'i') },
                { 'user.lname': new RegExp(key, 'i') },
                { 'user.fullName': new RegExp(key, 'i') },
                { 'user.code': new RegExp(key, 'i') },
                { 'user.number': new RegExp(key, 'i') },
                { 'user.mobile': new RegExp(key, 'i') },
                { 'type': new RegExp(key, 'i') },
                { 'carryId': new RegExp(key, 'i') },
            ]
        }
        let getCarryList = (cb) => {
            let agg = _mongoose.models["CarryRequests"]["list"](body, filter, { lang: "en" })

            _mongoose.models["CarryRequests"].aggregate(agg).skip(body.offset).limit(body.limit).exec((err, docs) => {
                if (docs) {
                    for (let d of docs) {
                        d.depDate = _moment(d.trip.depDate, 'YYYY-MM-DD').format("DD/MM/YYYY")
                        d.arrDate = _moment(d.trip.arrDate, 'YYYY-MM-DD').format("DD/MM/YYYY")
                        d.depTime = _moment(d.trip.depTime, 'hh:mm').format("LT");
                        d.arrTime = _moment(d.trip.arrTime, 'hh:mm').format("LT");
                        d.createdAt = _moment(d.createdAt).format('DD/MM/YYYY hh:mm A')
                        d.paymentDate = _moment(d.paymentDate).format('DD/MM/YYYY hh:mm A')
                        /*   d.city = common.arrayTomap(d.city, "cityId", true) */
                        d.from = d.trip.from
                        d.to = d.trip.to
                        cityIdArr.push(parseInt(d.trip.from))
                        cityIdArr.push(parseInt(d.trip.to))
                        delete d.trip
                        delete d.city
                    }
                    responseObj.response = restructure.mapServerToClient(docs)
                    responseObj.response = docs
                    responseObj.status = _status.SUCCESS
                    responseObj.message = "Carry Requests List"
                }
                return cb();
            })
        }

        let getCityData = (cb) => {
            let params = {
                lang: "en",
                cityIds: cityIdArr
            }
            let agg = _mongoose.models["CityPredictive"]["cityName"]({}, {}, params)
            _mongoose.models["CityPredictive"].aggregate(agg).exec((err, docs) => {
                if (docs && docs.length) {
                    responseObj["cityMap"] = common.arrayTomap(docs, "cityId", true)
                }
                return cb()
            })
        }

        let getListCount = (cb) => {
            let agg = _mongoose.models["CarryRequests"]["list"](body, filter, { lang: "en", count: true })
            _mongoose.models["CarryRequests"].aggregate(agg).exec((err, data) => {
                if (!err && data && data.length) {
                    responseObj.total = data[0].count
                }
                return cb();
            })
        }

        _async.series([
            getCarryList.bind(),
            getCityData.bind(),
            getListCount.bind()
        ], () => {
            helpAdaptor.logWriter(responseObj, "RequestListRS-" + currentTime, "Carry-Request")
            return callback(responseObj)
        })

    },

    // get single carry request record - operations
    getOneRequest: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null
        }
        let filter = {}
        let cityIdArr = []
        let userId = "";
        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(body, "getOneReqRecordRQ-" + currentTime, "Carry-Request")
        let getCarryRequest = (cb) => {
            let agg = _mongoose.models["CarryRequests"]["getOneRequest"]({ carryId: body.carryId }, filter, { lang: body.lang })
            _mongoose.models["CarryRequests"].aggregate(agg).exec((err, docs) => {
                if (docs && docs.length) {
                    let d = docs[0]
                    // if (d.trip && d.trip.userId && d.otherReceiver && _.isEqual(d.otherReceiver, true)) {
                    userId = d.trip.userId;
                    // }
                    d.depDate = _moment(d.trip.depDate, 'YYYY-MM-DD').format("DD/MM/YYYY")
                    d.arrDate = _moment(d.trip.arrDate, 'YYYY-MM-DD').format("DD/MM/YYYY")
                    d.depTime = _moment(d.trip.depTime, 'HH:mm').format('hh:mm a')
                    d.arrTime = _moment(d.trip.arrTime, 'HH:mm').format('hh:mm a')
                    //d.createdAt = _moment(d.createdAt).format("DD/MM/YYYY LT")
                    //d.createdAt = _moment(d.createdAt).format("DD/MM/YYYY") + " " + _moment(d.createdAt).format("hh:mm a") 
                    d.createdAt = _moment(d.createdAt).format("DD/MM/YYYY hh:mm A")
                    if (d.paymentDate) {
                        d.paymentDate = _moment(d.paymentDate).format('DD/MM/YYYY hh:mm A')
                        //d.paymentDate = _moment(d.paymentDate).format("DD/MM/YYYY LT")
                    }
                    if (d.pickedDate) {
                        //d.pickedDate = _moment(d.pickedDate).format("DD/MM/YYYY LT")
                        d.pickedDate = _moment(d.pickedDate).format('DD/MM/YYYY hh:mm A')
                    }
                    if (d.droppedDate) {
                        d.droppedDate = _moment(d.droppedDate).format('DD/MM/YYYY hh:mm A')
                    }

                    d.priceDetails = (d.priceDetails && d.priceDetails[0]) ? d.priceDetails[0] : {};
                    if (d.priceDetails && d.priceDetails.totalFare && d.priceDetails.commissionFee) {
                        d.priceDetails.deliveryFee = d.priceDetails.totalFare - d.priceDetails.commissionFee;
                    }
                    d.invoiceDetails = (d.invoiceDetails && d.invoiceDetails[0]) ? d.invoiceDetails[0] : {};
                    if (d.invoiceDetails && !_.isEmpty(d.invoiceDetails)) {
                        if (d.invoiceDetails.createdAt) {
                            d.invoiceDetails.createdAt = _moment(d.invoiceDetails.createdAt).format('DD/MM/YYYY - hh:mm A')
                        }
                    }
                    d.from = d.trip.from
                    d.to = d.trip.to
                    cityIdArr.push(parseInt(d.trip.from))
                    cityIdArr.push(parseInt(d.trip.to))
                    delete d.trip
                    delete d.city
                    // responseObj.response = restructure.mapServerToClient(d)
                    responseObj.response = d
                    responseObj.status = _status.SUCCESS
                    responseObj.message = "Single Carry Request"
                    helpAdaptor.logWriter(responseObj, "getOneReqRecordRS-" + currentTime, "Carry-Request")
                    return cb()
                } else {
                    return callback(responseObj)
                }
            })
        }

        let getCityData = (cb) => {
            let params = {
                lang: "en",
                cityIds: cityIdArr
            }
            let agg = _mongoose.models["CityPredictive"]["cityName"]({}, {}, params)
            _mongoose.models["CityPredictive"].aggregate(agg).exec((err, docs) => {
                if (docs && docs.length) {
                    responseObj["cityMap"] = common.arrayTomap(docs, "cityId", true)
                }
                return cb()
            })
        }

        let getCarrierDetails = (cb) => {
            if (!_.isEmpty(userId, "")) {
                let projection = {
                    _id: 0,
                    fname: 1,
                    lname: 1,
                    email: 1,
                    number: 1,
                    pic: 1,
                    code: 1
                };
                _mongoose.models["Users"].findOne({ uid: userId }, projection).exec((err, docs) => {
                    let userObj = {};
                    if (docs) {
                        userObj.name = docs.fname + " " + docs.lname;
                        userObj.number = docs.number;
                        userObj.email = docs.email;
                        userObj.pic = (docs.pic) ? docs.pic : "";
                        userObj.code = docs.code;
                        responseObj.response.carrierDetails = userObj;
                    }
                    return cb()
                })
            } else {
                return cb()
            }
        }

        let getPaymnetGateway = (cb) => {
            _mongoose.models['PaymentInfo'].find({ requestId: body.carryId }, (err, docs) => {
                let wallet = null
                let checkout = null
                let paymentGateway = 'N/A'
                if (!err && docs) {
                    for (let d of docs) {
                        if (d.paymentGateway == 'wallet') {
                            wallet = true
                        }
                        if (d.paymentGateway == 'checkout') {
                            checkout = true
                        }
                    }
                    if (wallet && checkout) {
                        paymentGateway = 'Wallet + Checkout'
                    } else if (!wallet && checkout) {
                        paymentGateway = 'Checkout'
                    } else {
                        paymentGateway = 'Wallet'
                    }
                }
                responseObj.response['paymentGateway'] = paymentGateway
                return cb()
            })
        }

        let invoiceIdArr = []
        let invoiceDetails = (cb) => {
            _mongoose.models['Invoice'].find({ carryId: body.carryId, status: 'paid' }, (err, docs) => {
                if (!err && docs) {
                    for (let d of docs) {
                        // if (d.status = 'paid') {
                        invoiceIdArr.push(d)
                        // }
                    }
                    responseObj.response['invoiceDetails'] = docs
                }
                return cb()
            })
        }

        let getPriceInformation = (cb) => {
            let priceObj = {
                "currency": "SAR",
                "pickFee": 0,
                "dropFee": 0,
                "totalFare": 0,
                "vat": 0,
                "payFare": 0,
                "commissionFee": 0,
                "carryFee": 0
            }
            _mongoose.models['BookingPriceInfo'].find({ carryId: body.carryId, invoiceId: { '$ne': 'NEG' } }, (err, docs) => {
                if (!err && docs.length) {
                    for (let d of docs) {
                        if (d.invoiceId && invoiceIdArr.includes(d.invoiceId)) {
                            priceObj['pickFee'] = priceObj['pickFee'] + d.pickFee
                            priceObj['dropFee'] = priceObj['dropFee'] + d.dropFee
                            priceObj['totalFare'] = priceObj['totalFare'] + d.totalFare
                            priceObj['vat'] = priceObj['vat'] + d.vat
                            priceObj['payFare'] = priceObj['payFare'] + d.payFare
                            priceObj['commissionFee'] = priceObj['commissionFee'] + d.commissionFee
                            priceObj['carryFee'] = priceObj['carryFee'] + d.carryFee
                        }
                        if (!d.invoiceId) {
                            priceObj['pickFee'] = priceObj['pickFee'] + d.pickFee
                            priceObj['dropFee'] = priceObj['dropFee'] + d.dropFee
                            priceObj['totalFare'] = priceObj['totalFare'] + d.totalFare
                            priceObj['vat'] = priceObj['vat'] + d.vat
                            priceObj['payFare'] = priceObj['payFare'] + d.payFare
                            priceObj['commissionFee'] = priceObj['commissionFee'] + d.commissionFee
                            priceObj['carryFee'] = priceObj['carryFee'] + d.carryFee
                        }
                    }
                }
                responseObj.response['priceDetails'] = priceObj
                return cb()
            })
        }

        _async.series([
            getCarryRequest.bind(),
            function (lcb) {
                _async.parallel([
                    getPaymnetGateway.bind(),
                    getCityData.bind(),
                    getCarrierDetails.bind(),
                    invoiceDetails.bind(),
                    getPriceInformation.bind(),
                ], () => {
                    return lcb()
                })
            }
        ], () => {
            return callback(responseObj)
        })



    },
    // get confirmation details after payment
    confirmation: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }
        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(body, "confirmationRQ-" + currentTime, "Carry-Request")
        // fetch price info with carryId
        let priceInfo = (cb) => {
            _mongoose.models['BookingPriceInfo'].findOne({ 'carryId': body.carryId },
                '-_id currency pickFee dropFee carryFee totalFare vat payFare', (err, doc) => {
                    if (!err && doc) {
                        responseObj.response['bookingPriceInfo'] = doc
                        return cb();
                    } else {
                        return callback(responseObj)
                    }
                })
        }

        // fetch trip details with tripId
        let tripInfo = (cb) => {
            let cityMap = []
            let usrData = {}
            _mongoose.models['Trip'].findOne({ 'tripId': body.tripId }, (err, tripInfo) => {
                if (!err && tripInfo) {
                    // fetch city data
                    let getCityData = (n) => {
                        let params = {
                            lang: "en",
                            cityIds: [parseInt(tripInfo.to), parseInt(tripInfo.from)]
                        }
                        let agg = _mongoose.models["CityPredictive"]["cityName"]({}, {}, params)
                        _mongoose.models["CityPredictive"].aggregate(agg).exec((err, cityData) => {
                            if (!err && cityData && cityData.length) {
                                cityMap = common.arrayTomap(cityData, "cityId", true)
                            }
                            return n()
                        })
                    }
                    // fetch user data
                    let getUserData = (n) => {
                        _mongoose.models['Users'].findOne({ 'uid': tripInfo.userId }).exec((err, cInfo) => {
                            if (!err && cInfo) {
                                usrData = cInfo
                            }
                            return n()
                        })
                    }
                    _async.parallel([getCityData.bind(),
                    getUserData.bind()], () => {
                        responseObj.response['tripInfo'] = {
                            tripid: tripInfo.tripId,
                            carrierName: usrData.fname + ' ' + usrData.lname,
                            mobCode: usrData.code,
                            carrierNumber: usrData.number,
                            carrierMmail: usrData.email,
                            carrierPic: (usrData.pic) ? usrData.pic : '',
                            from: cityMap[tripInfo.from].name + ', ' + cityMap[tripInfo.from].country,
                            depDate: _moment(tripInfo.depDate, 'YYYYMMDD').format('DD MMM YY'),
                            depTime: _moment(tripInfo.depTime, 'HH:mm').format('hh:mm A'),
                            to: cityMap[tripInfo.to].name + ', ' + cityMap[tripInfo.to].country,
                            arrDate: _moment(tripInfo.arrDate, 'YYYYMMDD').format('DD MMM YY'),
                            arrTime: _moment(tripInfo.arrTime, 'HH:mm').format('hh:mm A')
                        }
                        return cb();
                    })
                } else {
                    return callback(responseObj)
                }
                // return cb();
            })
        }

        // fetch carry details with carryId
        let shipmentInfo = (cb) => {
            _mongoose.models['CarryRequests'].findOne({ 'carryId': body.carryId }, (err, doc) => {
                if (!err && doc) {
                    responseObj.response['receiverInfo'] = {
                        type: doc.type,
                        receiver: doc.receiver,
                        desc: doc.desc,
                        weight: doc.weight,
                        dimension: doc.dimension,
                        goodValue: doc.worth,
                        cur: doc.cur,
                        attachments: doc.attachments
                    }
                    if (doc.type === 'package') {
                        responseObj.response['receiverInfo']['units'] = doc.units;
                    }
                    if (doc.type === 'document') {
                        responseObj.response['receiverInfo']['units'] = doc.units;
                        responseObj.response['receiverInfo']['paper'] = doc.paper;
                    }

                    return cb();
                } else {
                    return callback(responseObj)
                    //return cb
                }
            })
        }
        _async.series([
            priceInfo.bind(),
            tripInfo.bind(),
            shipmentInfo.bind()
        ], (err) => {
            if (!err) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Confirmation details'
            }
            helpAdaptor.logWriter(responseObj, "confirmationRS-" + currentTime, "Carry-Request")
            return callback(responseObj)
        })
    },
    //get selected trip carriers
    carrierList: (args, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }
        if (!(args && args.tripId)) {
            responseObj.message = "Please provide required fields"
            return callback(responseObj);
        }

        let userIdsArr = [];
        let carrierIdsArr = [];
        let carryRequestsArr = [];
        const carryReqFun = (lcallback) => {
            let filter = { tripId: args.tripId, "status": { $in: ["confirmed"] } };
            _mongoose.models['CarryRequests'].find(filter).exec((e, carrryItems) => {
                if (e || !carrryItems) {
                    responseObj.message = 'error in getting carry items'
                    responseObj.status = _status.ERROR;
                }
                if (!responseObj.response) {
                    responseObj.response = {};
                }
                if (!_.isEmpty(carrryItems)) {
                    carryRequestsArr = carrryItems;
                    carrryItems.forEach(crItem => {
                        if (crItem) {
                            if (crItem.userId) {
                                if (_.isEmpty(userIdsArr) || userIdsArr.indexOf(crItem.userId) === -1) {
                                    userIdsArr.push(crItem.userId);
                                }
                            }
                            if (crItem.carryId) {
                                if (_.isEmpty(carrierIdsArr) || carrierIdsArr.indexOf(crItem.carryId) === -1) {
                                    carrierIdsArr.push(crItem.carryId);
                                }
                            }
                        }
                    });
                }
                return lcallback();
            });
        };

        const carryReqUserNamesFun = (lcallback) => {
            _mongoose.models['Users'].find({ uid: { $in: userIdsArr } }).exec((e, user) => {
                if (e || !user) {
                    responseObj.message = 'error in getting carry user name.'
                    responseObj.status = _status.ERROR;
                }
                let userNamesObj = {};
                user.forEach(eachUser => {
                    if (eachUser && eachUser.uid) {
                        let nameObj = {};
                        if (eachUser.fname) {
                            nameObj.fname = eachUser.fname;
                        }
                        if (eachUser.lname) {
                            nameObj.lname = eachUser.lname;
                        }
                        userNamesObj[eachUser.uid] = nameObj
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
                responseObj.status = _status.SUCCESS;
                responseObj.message = 'Success';
                responseObj.response.carryRequests = ctArr;
                return lcallback();
            });
        };

        let getCarrierPriceInfo = (cb) => {
            _mongoose.models["PaymentInfo"].aggregate([{ $match: { "requestId": { "$in": carrierIdsArr } } },
            {
                $group: { _id: "$requestId", totalAmount: { $sum: "$amount" } }
            }], (e, doc) => {
                let piceObj = {}
                if (doc) {
                    piceObj = common.arrayTomap(doc, "_id", false)
                }
                let data = responseObj.response.carryRequests;

                let carrierArr = []
                for (let p of data) {
                    if (p && p.carryId && piceObj[p.carryId]) {
                        p["price"] = piceObj[p.carryId]["totalAmount"];
                        carrierArr.push(p);
                    }
                }
                responseObj.status = _status.SUCCESS;
                responseObj.message = 'Success';
                responseObj.response.carryRequests = carrierArr;
                return cb();
            })
        }

        _async.series([
            carryReqFun.bind(),
            carryReqUserNamesFun.bind(),
            getCarrierPriceInfo.bind()
        ], () => {
            return callback(responseObj)
        })
    },

    // accept request
    accept: (args, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'Error in updating payment success status',
            response: {}
        }
        let walletOnlyPayment = false

        let payments = {}
        let paymentsArr = []
        let captureStatus = true
        let getPaymentRecords = (cb) => {
            _mongoose.models['PaymentInfo'].find({ requestId: args.carryId }, (err, docs) => {
                if (!err && docs) {
                    for (let i of docs) {
                        paymentsArr.push(i)
                        if (payments[i.paymentGateway]) {
                            payments[i.paymentGateway] = i
                        } else {
                            payments[i.paymentGateway] = {}
                            payments[i.paymentGateway] = i
                        }
                    }
                    return cb()
                } else {
                    responseObj.message = 'Error in fetching payment information'
                    return callback(responseObj)
                }
            })
        }

        let captureRes = {}
        let capturePayment = (cb) => {
            if (payments['checkout']) {
                payment.Capture(payments['checkout'], (d) => {
                    if (d.response) {
                        captureRes = d.response
                    }
                    return cb()
                })
            } else {
                return cb()
            }
        }

        let verifyCheckOut = (cb) => {
            if (payments['checkout']) {
                //verify
                payment.VerifyCheckout(payments['checkout'], (res) => {
                    if (res && res.status == 1000) {
                        payments['checkout'].status = res.response.status
                        captureStatus = (res.response.status !== 'Captured') ? false : true
                    }
                    return cb()
                })
            } else {
                return cb()
            }
        }

        let tripId = ''
        let updateStatus = (cb) => {

            for (let payObj in payments) {
                paymentsArr.push(payments[payObj])
            }

            let updatePaymentInfo = (lcb) => {
                _async.each(paymentsArr, (payObj, next) => {
                    _mongoose.models['PaymentInfo'].findById(payObj._id, (err, doc) => {
                        doc.status = payObj.status
                        doc.save((er, dc) => {
                            next()
                        })
                    })
                }, (e) => {
                    return lcb()
                })
            }

            let updateBookingInfo = (lcb) => {
                let bookingStatus = _statusCodes.booking.CONFIRMED
                if (!captureStatus) {
                    bookingStatus = _statusCodes.booking.CONFIRM_FAILED
                }
                _mongoose.models['BookingInfo'].findOne({ carryId: args.carryId }, (err, doc) => {
                    if (!err && doc) {
                        tripId = doc.tripId
                        doc.bookingStatus = bookingStatus
                        doc.save((er) => {
                            return lcb()
                        })
                    } else {
                        return lcb()
                    }
                })
            }

            let updateCarryRequest = (lcb) => {
                _mongoose.models['CarryRequests'].findOne({ carryId: args.carryId }, (err, doc) => {
                    if (!err && doc) {
                        doc.status = 'confirmed'
                        doc.save((er) => {
                            return lcb()
                        })
                    } else {
                        return lcb()
                    }
                })
            }

            _async.parallel([
                updatePaymentInfo.bind(),
                updateBookingInfo.bind(),
                updateCarryRequest.bind()
            ], () => {
                return cb()
            })
        }

        _async.series([
            getPaymentRecords.bind(),
            capturePayment.bind(),
            verifyCheckOut.bind(),
            updateStatus.bind()
        ], (err, res) => {
            notifications.notify({ type: 'confirm', carryId: args.carryId, tripId: tripId }, () => {
                // console.log('notify')
            })
            // send email to traveller
            mailer.sendMail({
                // emailType: 'new_trip',
                template: 'package-ready-collect',
                // subject: "New trip",
                userId: args.userInfo.uid,
                tripId: tripId,
                carryId: args.carryId,
                lang: args.lang
            }, () => {

            })
            responseObj.status = _status.SUCCESS
            responseObj.message = 'UpdatePayment Success: Updated successfully'
            return callback(responseObj)
        })
    },

    //decline request
    decline: (args, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'Error in updating payment failed status',
            response: {}
        }

        /* let paymentGateway = ''
        let checkPaymentGateway = (cb) => {
            _mongoose.models['PaymentInfo'].find({ requestId: args.carryId }, (e, d) => {
                if (!e && d.length) {
                    paymentGateway = d[0].paymentGateway
                    return cb()
                } else {
                    return callback(responseObj)
                }
            })
        } */
        let payments = {}
        let paymentsArr = []
        let voidStatus = false
        let getPaymentRecords = (cb) => {
            _mongoose.models['PaymentInfo'].find({ requestId: args.carryId }, (err, docs) => {
                if (!err && docs) {
                    for (let i of docs) {
                        paymentsArr.push(i)
                        if (payments[i.paymentGateway]) {
                            payments[i.paymentGateway] = i
                        } else {
                            payments[i.paymentGateway] = {}
                            payments[i.paymentGateway] = i
                        }
                    }
                    return cb()
                } else {
                    responseObj.message = 'Error in fetching payment information'
                    return callback(responseObj)
                }
            })
        }
        let voidPayRes = {}
        let voidPayment = (cb) => {
            if (payments['checkout']) {
                payment.VoidPayment(payments['checkout'], (d) => {
                    if (d.response) {
                        voidPayRes = d.response
                    }
                    return cb()
                })
            } else {
                return cb()
            }
        }
        let refundToWallet = (cb) => {
            if (payments['wallet']) {
                let reqObj = {
                    amount: payments['wallet'].amount,
                    userId: payments['wallet'].requesterUid,
                    requestId: payments['wallet'].requestId,
                    desciption: payments['wallet'].invoiceId != '' ? 'Invoice Refund' : 'Refund'
                }
                transactions.CreditWallet(reqObj, (d) => {
                    if (d.status === 1000) {
                        payments['wallet'].status = 'Refunded'
                    } else {
                        voidStatus = false
                    }
                    return cb()
                })
            } else {
                return cb()
            }
        }

        let voidResObj = {}

        let verifyCheckOut = (cb) => {
            if (payments['checkout']) {
                //verify
                payment.VerifyCheckout(payments['checkout'], (res) => {
                    if (res && res.status == 1000) {
                        payments['checkout'].status = res.response.status
                        voidStatus = (res.response.status !== 'Voided') ? false : true
                    }
                    return cb()
                })
            } else {
                return cb()
            }
        }

        /* let updateBookingInfo = (cb) => {
            _mongoose.models['BookingInfo'].findOne({ carryId: args.carryId }, (e, d) => {
                if (!e && d) {
                    d.bookingStatus = 106
                    d.save((err, doc) => {
                        return cb(null, null)
                    })
                } else {
                    return cb('db error', null)
                }
            })
        }

        let updateCarryRequests = (cb) => {
            _mongoose.models['CarryRequests'].findOne({ carryId: args.carryId }, (e, d) => {
                if (!e && d) {
                    d.status = 'declined'
                    d.save((err, doc) => {
                        return cb(null, null)
                    })
                } else {
                    return cb('db error', null)
                }
            })
        }

        let updatePaymentInfo = (cb) => {
            if (paymentGateway === 'wo') { return cb() }
            _mongoose.models['PaymentInfo'].findOne({ requestId: args.carryId, chargeId: { '$ne': '' } }, (e, d) => {
                if (!e && d) {
                    d.status = voidResObj.status
                    d.save((err, doc) => {
                        return cb(null, null)
                    })
                } else {
                    // payment persistance failed -  need to work
                    return cb(null, null)
                }
            })
        } */
        let tripId = ''
        let updateStatus = (cb) => {

            for (let payObj in payments) {
                paymentsArr.push(payments[payObj])
            }

            let updatePaymentInfo = (lcb) => {
                _async.each(paymentsArr, (payObj, next) => {
                    _mongoose.models['PaymentInfo'].findById(payObj._id, (err, doc) => {
                        doc.status = payObj.status
                        doc.save((er, dc) => {
                            next()
                        })
                    })
                }, (e) => {
                    return lcb()
                })
            }

            let updateBookingInfo = (lcb) => {
                let bookingStatus = _statusCodes.booking.DECLINED
                if (!voidStatus) {
                    bookingStatus = _statusCodes.booking.DECLINED_FAILED
                }
                _mongoose.models['BookingInfo'].findOne({ carryId: args.carryId }, (err, doc) => {
                    if (!err && doc) {
                        tripId = doc.tripId
                        doc.transactionStatus = '202'
                        doc.bookingStatus = bookingStatus
                        doc.save((er) => {
                            return lcb()
                        })
                    } else {
                        return lcb()
                    }
                })
            }

            let updateCarryRequest = (lcb) => {
                _mongoose.models['CarryRequests'].findOne({ carryId: args.carryId }, (err, doc) => {
                    if (!err && doc) {
                        tripId = doc.tripId
                        doc.status = 'declined'
                        doc.save((er) => {
                            return lcb()
                        })
                    } else {
                        return lcb()
                    }
                })
            }

            _async.parallel([
                updatePaymentInfo.bind(),
                updateBookingInfo.bind(),
                updateCarryRequest.bind()
            ], () => {
                return cb()
            })
        }

        // update trip status to active if it was full
        let updateTripStatus = (cb) => {
            if (!tripId) { return cb() }
            _mongoose.models['Trip'].findOne({ tripId: tripId }, (e, d) => {
                if (!e && d && d.status == 'filled') {
                    d.status = 'active'
                    d.save((er, dc) => {
                        return cb()
                    })
                } else {
                    return cb()
                }
            })
        }


        _async.series([
            getPaymentRecords.bind(),
            function (lcallback) {
                _async.parallel([
                    voidPayment.bind(),
                    refundToWallet.bind()
                ], () => {
                    return lcallback()
                })
            },
            verifyCheckOut.bind(),
            updateStatus.bind(),
            updateTripStatus.bind()
        ], (err, res) => {
            notifications.notify({ type: 'decline', carryId: args.carryId, tripId: tripId }, () => {
                // console.log('notify')
            })
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Shipment request has been declined successfully'
            //responseObj.message = keymapper["s2c"]["shpDeclinedSuccess"][args.lang]
            return callback(responseObj)
        })
    },

    // cancel requests new
    cancel: (args, callback) => {
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
        /* if (!args.reason && !(args.hasOwnProperty('manualRefund') && args["manualRefund"])) {
            //responseObj.message = "Error in getting reason";
            responseObj.message = keymapper["s2c"]["errIngettingReason"][args.lang]
            return callback(responseObj);
        } */

        let payments = {}
        let paymentsArr = []
        let getPaymentRecords = (cb) => {
            _mongoose.models['PaymentInfo'].find({ requestId: args.carryId }, (err, docs) => {
                if (!err && docs) {
                    for (let i of docs) {
                        if (payments[i.paymentGateway]) {
                            payments[i.paymentGateway].push(i)
                        } else {
                            payments[i.paymentGateway] = []
                            payments[i.paymentGateway].push(i)
                        }
                    }
                    return cb()
                } else {
                    responseObj.message = 'Error in fetching payment information'
                    return callback(responseObj)
                }
            })
        }
        let refundRes = {}
        let refundFromCheckOut = (cb) => {
            if (payments['checkout']) {
                _async.each(payments['checkout'], (payObj, next) => {
                    //refund
                    payment.Refund(payObj, (d) => {
                        if (d.response) {
                            refundRes = d.response
                        }
                        next()
                    });
                }, (e) => {
                    return cb()
                })
            } else {
                return cb()
            }
        }
        let refundStatus = true
        let refundToWallet = (cb) => {
            if (payments['wallet']) {
                _async.each(payments['wallet'], (payObj, next) => {
                    let reqObj = {
                        amount: payObj.amount,
                        userId: payObj.requesterUid,
                        requestId: payObj.requestId,
                        desciption: payObj.invoiceId != '' ? 'Invoice Refund' : 'Refund'
                    }
                    transactions.CreditWallet(reqObj, (d) => {
                        if (d.status === 1000) {
                            payObj.status = 'Refunded'
                        } else {
                            refundStatus = false
                        }
                        next()
                    })
                }, (e) => {
                    return cb()
                })
            } else {
                return cb()
            }
        }
        let verifyCheckOut = (cb) => {
            if (payments['checkout']) {
                _async.each(payments['checkout'], (payObj, next) => {
                    //verify
                    payment.VerifyCheckout(payObj, (res) => {
                        if (res && res.status == 1000) {
                            payObj.status = res.response.status
                            refundStatus = (res.response.status !== 'Refunded') ? false : true
                        }
                        next()
                    })
                }, (e) => {
                    return cb()
                })

            } else {
                return cb()
            }
        }
        let tripId = ''
        let updateStatus = (cb) => {

            let updatePaymentInfo = (lcb) => {
                /*  _async.each(payments,(paymentGateway,next)=>{
                     console.log(paymentGateway)
                     //update payment status
                     _async.each(paymentGateway,(payObj,next) => {
                         _mongoose.models['PaymentInfo'].findById(payObj._id, (err, doc) => {
                             doc.status = payObj.status
                             doc.save((er, dc) => {
                                 next()
                             })
                         })
                         
                     },(e)=>{
                         return next()
                     })
     
                 },(e)=>{
                     return lcb()
                 }) */
                for (let payobj in payments) {
                    paymentsArr = paymentsArr.concat(payments[payobj])
                }
                _async.each(paymentsArr, (payObj, next) => {
                    _mongoose.models['PaymentInfo'].findById(payObj._id, (err, doc) => {
                        doc.status = payObj.status
                        doc.save((er, dc) => {
                            next()
                        })
                    })
                }, (e) => {
                    return lcb()
                })
            }

            let updateBookingInfo = (lcb) => {
                let bookingStatus = _statusCodes.booking.REFUNDED
                if (!refundStatus) {
                    bookingStatus = _statusCodes.booking.REFUND_FAILED
                }
                _mongoose.models['BookingInfo'].findOne({ carryId: args.carryId }, (err, doc) => {
                    if (!err && doc) {
                        tripId = doc.tripId
                        doc.bookingStatus = bookingStatus
                        doc.transactionStatus = '202'
                        doc.save((er) => {
                            return lcb()
                        })
                    } else {
                        return lcb()
                    }
                })
            }

            let updateCarryRequest = (lcb) => {
                _mongoose.models['CarryRequests'].findOne({ carryId: args.carryId }, (err, doc) => {
                    if (!err && doc) {
                        tripId = doc.tripId
                        doc.status = 'cancelled'
                        doc.save((er) => {
                            return lcb()
                        })
                    } else {
                        return lcb()
                    }
                })
            }

            let updateInvoice = (lcb) => {
                /* _async.each(paymentsArr, (payObj, next) => {
                    if (payObj.invoiceId) {
                        _mongoose.models['Invoice'].findOne({ invoiceId: payObj.invoiceId }, (err, doc) => {
                            doc.status = payObj.status
                            doc.save((er, dc) => {
                                next()
                            })
                        })
                    } else {
                        next()
                    }
                }, (e) => {
                    return lcb()
                }) */
                _mongoose.models['Invoice'].find({ carryId: args.carryId }, (err, docs) => {
                    if (!err && docs) {
                        for (let d of docs) {
                            d.status = 'cancelled'
                        }
                    }
                    return lcb()
                })
            }

            _async.parallel([
                updatePaymentInfo.bind(),
                updateBookingInfo.bind(),
                updateCarryRequest.bind(),
                updateInvoice.bind(),
            ], () => {
                return cb()
            })
        }

        // update trip status to active if it was full
        let updateTripStatus = (cb) => {
            if (!tripId) { return cb() }
            _mongoose.models['Trip'].findOne({ tripId: tripId }, (e, d) => {
                if (!e && d && d.status == 'filled') {
                    d.status = 'active'
                    d.save((er, dc) => {
                        return cb()
                    })
                } else {
                    return cb()
                }
            })
        }
        _async.series([
            getPaymentRecords.bind(),
            function (lcallback) {
                _async.parallel([
                    refundFromCheckOut.bind(),
                    refundToWallet.bind()
                ], () => {
                    return lcallback()
                })
            },
            verifyCheckOut.bind(),
            updateStatus.bind(),
            updateTripStatus.bind()

        ], () => {
            notifications.notify({ type: 'cancel', carryId: args.carryId, tripId: tripId }, () => {
                // console.log('notify')
            })
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Shipment has been cancelled successfully'
            //responseObj.message = keymapper["s2c"]["shpCancelledSuccess"][args.lang]
            return callback(responseObj)
        })
    },

    // manual cancellation of request from operations    
    manualCancellation: (args, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'Error in cancellation',
            response: null
        }
        if (args.refundGateway == 'wallet') {
            let refundAmount = 0
            let requesterUid = ''
            let calculateRefundAmt = (cb) => {
                _mongoose.models['PaymentInfo'].find({ requestId: args.carryId }, (err, docs) => {
                    if (!err && docs.length) {
                        requesterUid = docs[0].requesterUid
                        for (let d of docs) {
                            refundAmount = refundAmount + d.amount
                        }
                        return cb()
                    } else {
                        return callback(responseObj)
                    }
                })
            }

            let refundStatus = false
            let refundToWallet = (cb) => {
                let reqObj = {
                    amount: refundAmount,
                    userId: requesterUid,
                    requestId: args.carryId,
                    desciption: 'Refund'
                }
                transactions.CreditWallet(reqObj, (d) => {
                    if (d.status === 1000) {
                        refundStatus = true
                    } else {
                        return callback(responseObj)
                    }
                    return cb()
                })
            }
            let tripId = ''
            let updateStatus = (cb) => {

                let updatePaymentInfo = (lcb) => {
                    _mongoose.models['PaymentInfo'].updateMany({ requestId: args.carryId }, { "$set": { "status": 'Refunded' } }, { "multi": true }, (err, docs) => {
                        return lcb()
                    })
                }

                let updateBookingInfo = (lcb) => {
                    let bookingStatus = _statusCodes.booking.REFUNDED
                    if (!refundStatus) {
                        bookingStatus = _statusCodes.booking.REFUND_FAILED
                    }
                    _mongoose.models['BookingInfo'].findOne({ carryId: args.carryId }, (err, doc) => {
                        if (!err && doc) {
                            doc.bookingStatus = bookingStatus
                            doc.save((er) => {
                                return lcb()
                            })
                        } else {
                            return lcb()
                        }
                    })
                }

                let updateCarryRequest = (lcb) => {
                    _mongoose.models['CarryRequests'].findOne({ carryId: args.carryId }, (err, doc) => {
                        if (!err && doc) {
                            tripId = doc.tripId
                            doc.status = 'cancelled'
                            doc.save((er) => {
                                return lcb()
                            })
                        } else {
                            return lcb()
                        }
                    })
                }

                let updateInvoice = (lcb) => {
                    _mongoose.models['Invoice'].updateMany({ carryId: args.carryId, status: 'paid' }, { "$set": { "status": 'Refunded' } }, { "multi": true }, (err, docs) => {
                        return lcb()
                    })
                }

                _async.parallel([
                    updatePaymentInfo.bind(),
                    updateBookingInfo.bind(),
                    updateCarryRequest.bind(),
                    updateInvoice.bind(),
                ], () => {
                    return cb()
                })
            }

            // update trip status to active if it was full
            let updateTripStatus = (cb) => {
                if (!tripId) { return cb() }
                _mongoose.models['Trip'].findOne({ tripId: tripId }, (e, d) => {
                    if (!e && d && d.status == 'filled') {
                        d.status = 'active'
                        d.save((er, dc) => {
                            return cb()
                        })
                    } else {
                        return cb()
                    }
                })
            }
            _async.series([
                calculateRefundAmt.bind(),
                refundToWallet.bind(),
                updateStatus.bind(),
                updateTripStatus.bind()
            ], () => {
                responseObj.status = _statusCodes.status.SUCCESS
                //responseObj.message = keymapper["s2c"]["shpCancelledSuccess"][args.lang]
                responseObj.message = 'Shipment has been cancelled successfully'
                return callback(responseObj)
            })
        } else if (args.refundGateway == 'source') {
            if (args.requestStatus == 'awaiting') {
                module.exports.decline(args, (res) => {
                    if (res.status == 1000) {
                        responseObj.status = _statusCodes.status.SUCCESS
                        responseObj.message = 'Shipment has been cancelled successfully'
                        //responseObj.message = keymapper["s2c"]["shpCancelledSuccess"][args.lang]
                    }
                    return callback(responseObj)
                })
            } else {
                module.exports.cancel(args, (res) => {
                    if (res.status == 1000) {
                        responseObj.status = _statusCodes.status.SUCCESS
                        //responseObj.message = 'Shipment has been cancelled successfully'
                        responseObj.message = keymapper["s2c"]["shpCancelledSuccess"][args.lang]
                    }
                    return callback(responseObj)
                })
            }
        }
        else {
            return callback(responseObj)
        }
    },

    // get refund information for the request - operations
    getRefundInfo: (args, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'Error in cancellation',
            response: null
        }
        _mongoose.models['PaymentInfo'].find({ requestId: args.carryId }, (err, docs) => {
            let wallet = false
            let checkout = false
            let amount = 0
            let paymentId = ''
            if (!err && docs.length) {
                for (let d of docs) {
                    amount = amount + d.amount
                    wallet = (d.paymentGateway == 'wallet') ? true : false
                    checkout = (d.paymentGateway == 'checkout') ? true : false
                    paymentId = d.invoiceId == '' ? d.paymentId : paymentId
                }
                let res = {
                    wallet: wallet,
                    checkout: checkout,
                    amount: amount,
                    paymentId: paymentId,
                    paymentDate: _moment(docs[0].createdAt).format('DD/MM/YYYY hh:mm A'),
                    paymentCurrency: docs[0].paymentCurrency
                }
                responseObj.status = _statusCodes.status.SUCCESS
                responseObj.message = 'Request Manual Refund details'
                responseObj.response = res
            }
            return callback(responseObj)
        })
    }
}
