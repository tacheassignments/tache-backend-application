'use strict'
/**
 * @description air carry service
 * @author Nahl
 * @since July 6 2019
 */
const randomstring = require("randomstring")
    , moment = require("moment")
    , restructure = require('../../libs/utils/restructure')
    , common = require('../../libs/utils/common')
    , helper = require('./helper')
    , helpAdaptor = require('../../libs/helper')
    , keymapper = require('../../libs/utils/key-mapping')
    , mailer = require('../../libs/mailer')
    , smsController = require('../../libs/sms');
module.exports = {
    addTrip: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'search error',
        }
        let tripInfo = body.trip
        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(body, "addTripRQ-" + currentTime, "Trips")
        // validate the trip req obj
        let retObj = helper.validateTripReq(body)

        if (!retObj || !retObj.valid) {
            responseObj.message = retObj.message;
            return callback(responseObj);
        }

        tripInfo.userId = body.uid
        tripInfo.lang = body.lang
        tripInfo.tripId = randomstring.generate(5)
        tripInfo.depDate = parseInt(moment(tripInfo.depDate).format("YYYYMMDD"))
        tripInfo.arrDate = Number(moment(tripInfo.arrDate).format("YYYYMMDD"))
        tripInfo.depTime = moment(tripInfo.depTime, 'hh:mm A').format("HH:mm")
        tripInfo.arrTime = moment(tripInfo.arrTime, 'hh:mm A').format("HH:mm")
        // tripInfo.pickPoint = body.pickPoint
        // tripInfo.deliverPoint = body.deliverPoint
        tripInfo.pickFlag = false
        if (body.pickRange) {
            tripInfo.pickRange = body.pickRange
            tripInfo.pickFlag = true
        }
        tripInfo.deliverFlag = false
        if (body.deliverRange) {
            tripInfo.deliverRange = body.deliverRange
            tripInfo.deliverFlag = true
        }
        tripInfo.dropAtCarrier = false
        if (body.pickPoint) {
            tripInfo.pickPoint = body.pickPoint
            tripInfo.dropAtCarrier = true
        }
        tripInfo.collectFrmCarrier = false
        if (body.deliverPoint) {
            tripInfo.deliverPoint = body.deliverPoint
            tripInfo.collectFrmCarrier = true
        }
        tripInfo.carryDocument = false
        if (body.document && body.document.size) {
            tripInfo.document = body.document
            // tripInfo.document.weight = Number(body.document.qnty) * 1000
            tripInfo.document.weight = 1000
            tripInfo.document.units = "gms"
            tripInfo.carryDocument = true
        }
        tripInfo.carryPackage = false
        if (body.package && body.package.weight) {
            tripInfo.package = body.package
            tripInfo.carryPackage = true
        }
        if (body.air) {
            tripInfo.air = body.air
        }
        if (body.rail) {
            tripInfo.rail = body.rail
        }
        if (body.road) {
            tripInfo.road = body.road
        }
        tripInfo.from = null
        /** get the dep city with the longitude and latitude */
        let setFromCity = (n) => {
            _mongoose.models['CityGeo'].find(
                { geo: { $near: [tripInfo.fromGeo.lon, tripInfo.fromGeo.lat], $maxDistance: 0.9 } }, (e, s) => {
                    if (s && s.length) {
                        tripInfo.from = s[0].cityId
                    }
                    return n()
                }
            )
        }
        tripInfo.to = null
       
        /** get the arrival city with the longitude and latitude */
        let setToCity = (n) => {
            _mongoose.models['CityGeo'].find(
                { geo: { $near: [tripInfo.toGeo.lon, tripInfo.toGeo.lat], $maxDistance: 0.9 } }, (e, s) => {
                    if (s && s.length) {
                        tripInfo.to = s[0].cityId
                    }
                    return n()
                }
            )
        }

        _async.parallel([
            setFromCity.bind(),
            setToCity.bind()
        ], () => {
            if (tripInfo.from && tripInfo.to) {
                let tripId = ''
                tripInfo.platform = body.platform
                tripInfo.status = "active";
                tripInfo.searchKey = tripInfo.from + "||" + tripInfo.to + "||" + tripInfo.depDate
                helpAdaptor.logWriter(tripInfo, "addTripRQPersistence-" + currentTime, "Trips")
                new _mongoose.models["Trip"](tripInfo).save((e, s) => {
                    if (s && s.id) {

                        responseObj.status = _status.SUCCESS
                        responseObj.message = "success"
                        responseObj.response = {
                            tripId: tripInfo.tripId
                        }
                        tripId = tripInfo.tripId
                        // send sms notification
                        smsController.sendText({
                            userId: body.uid,
                            template: 'addTrip',
                            lang: s.lang
                        }, () => {

                        })

                        // send mail to user
                        mailer.sendMail({
                            emailType: 'new_trip',
                            template: "added-trip",
                            subject: "New trip",
                            userId: body.uid,
                            tripId: tripId,
                            lang: body.lang
                        }, () => {

                        })

                        callback(responseObj)
                    }
                })
            } else {
                callback(responseObj)
            }
            helpAdaptor.logWriter(responseObj, "addTripRS-" + currentTime, "Trips")

        })

    },
    search: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'search error',
            response: null
        }
        let cityMap = {}
        let currentTime = new Date().getTime()
        /** get the dep city with the longitude and latitude */
        let getFromCity = (n) => {
            _mongoose.models['CityGeo'].find(
                { geo: { $near: [body.fromGeo.lon, body.fromGeo.lat], $maxDistance: 0.9 } }, (e, s) => {
                    if (s && s.length) {
                        body.from = s[0].cityId
                        cityMap[s[0].cityId] = s[0].cityName.en
                    }
                    return n()
                }
            )
        }
        /** get the arrival city with the longitude and latitude */
        let getToCity = (n) => {
            _mongoose.models['CityGeo'].find(
                { geo: { $near: [body.toGeo.lon, body.toGeo.lat], $maxDistance: 0.9 } }, (e, s) => {
                    if (s && s.length) {
                        body.to = s[0].cityId
                        cityMap[s[0].cityId] = s[0].cityName.en
                    }
                    return n()
                }
            )
        }
        let getCityData = (n) => {
            let params = {
                lang: "en",
                cityIds: [parseInt(body.from), parseInt(body.to)]
            }
            let agg = _mongoose.models["CityPredictive"]["cityName"]({}, {}, params)
            _mongoose.models["CityPredictive"].aggregate(agg).exec((err, docs) => {
                if (docs && docs.length) {
                    cityMap = common.arrayTomap(docs, "cityId", true)
                }
                return n()
            })
        }
        let trips = null
        let filter = {}
        let tripIds = [];
        let tripAvailableWeight = {};
        let currentDate = moment().format("DD-MM-YYYY");
        let getTrips = (n) => {
            let args = {
                searchKey: body.from + "||" + body.to + "||" + moment(body.depDate, 'DD-MM-YYYY').format("YYYYMMDD"),
                status: { "$in": ["active"] },
                depTime: { '$gte': (_.isEqual(currentDate, body.depDate) ? moment().format("HH:mm") : "00:00") }
                // hours: {"$gte": (_.isEqual(currentDate, body.depDate) ? parseInt(moment().format("HH")) : 0)},
                // mins: {"$gte": (_.isEqual(currentDate, body.depDate) ? parseInt(moment().format("mm")) : 0)}
            }
            if (body.filter && !_.isEmpty(body.filter)) {
                filter["$and"] = []
                if (body.filter.tripType) {
                    // filter["$and"].push({"tripType": body.filter.tripType})
                    args['tripType'] = body.filter.tripType
                }
                if (body.filter.weight && body.filter.weight.length) {
                    // filter by package weight
                    let wtArr = []
                    for (let i of body.filter.weight) {
                        wtArr.push({ "package.weight": { "$gte": parseInt(i.min), "$lte": parseInt(i.max) } })
                    }
                    filter["$and"].push({ "$or": wtArr })
                }
                if (body.filter.category && body.filter.category.length) {
                    // filter by service category
                    let ctArr = []
                    for (let cat of body.filter.category) {
                        if (cat === 'pf') {
                            ctArr.push({ "pickFlag": true })
                        }
                        if (cat === 'df') {
                            ctArr.push({ "deliverFlag": true })
                        }
                        if (cat === 'dcl') {
                            ctArr.push({ "dropAtCarrier": true })
                        }
                        if (cat === 'ccl') {
                            ctArr.push({ "collectFrmCarrier": true })
                        }
                    }
                    /* if (body.filter.category.pf) {
                        // filter by pick up flag
                        ctArr.push({ "pickFlag": body.filter.category.pf })
                        // filter["$and"].push({ "pickFlag": body.filter.category.pf })
                    }
                    if (body.filter.category.df) {
                        // filter by drop flag
                        ctArr.push({ "deliverFlag": body.filter.category.df })
                        // filter["$and"].push({ "deliverFlag": body.filter.category.df })
                    }
                    if (body.filter.category.dcl) {
                        // filter by dropAtCarrier flag
                        ctArr.push({ "dropAtCarrier": body.filter.category.dcl })
                        // filter["$and"].push({ "dropAtCarrier": body.filter.category.dcl })
                    }
                    if (body.filter.category.ccl) {
                        // filter by collectFrmCarrier flag
                        ctArr.push({ "collectFrmCarrier": body.filter.category.ccl })
                        // filter["$and"].push({ "collectFrmCarrier": body.filter.category.ccl })
                    } */
                    filter["$and"].push({ "$and": ctArr })
                }
                if (body.filter.size) {
                    let szArr = []
                    let maxSize = parseInt(body.filter.size.charAt(1))
                    for (let n = 0; n <= maxSize; n++) {
                        szArr.push({ "document.size": 'A' + n })
                    }
                    filter["$and"].push({ "$or": szArr })
                }
                if (_.isEmpty(filter["$and"])) { delete filter["$and"] }
            }
            body['offset'] = (body.offset) ? body.offset : 0
            body['limit'] = (body.limit) ? body.limit : 10
            helpAdaptor.logWriter(body, "searchTripRQ-" + currentTime, "Trips")
            let agg = _mongoose.models["Trip"]["search"](args, filter, {})
            _mongoose.models["Trip"].aggregate(agg).skip(body.offset).limit(body.limit).exec((err, docs) => {
                helpAdaptor.logWriter(docs, "searchTripRS-" + currentTime, "Trips")
                if (docs && docs.length) {
                    let cityIds = []
                    for (let d of docs) {
                        tripIds.push(d.tripId);
                        d.depDate = moment(d.depDate, 'YYYY-MM-DD').format("DD-MM-YYYY")
                        d.arrDate = moment(d.arrDate, 'YYYY-MM-DD').format("DD-MM-YYYY")
                        var then = d.depDate + " " + d.depTime;
                        var now = d.arrDate + " " + d.arrTime;
                        d.depTime = moment(d.depTime, 'hh:mm').format("LT");
                        d.arrTime = moment(d.arrTime, 'hh:mm').format("LT");
                        var ms = moment(now, "DD/MM/YYYY HH:mm").diff(moment(then, "DD/MM/YYYY HH:mm"));
                        var diffDate = moment.duration(ms);
                        let dur = "";
                        dur += (diffDate.days() > 0) ? diffDate.days() + "d " : "";
                        dur += (diffDate.hours() > 0) ? diffDate.hours() + "hr " : "";
                        dur += (diffDate.minutes() > 0) ? diffDate.minutes() + "min " : "";
                        d.dur = dur.trim();
                        cityIds.push(d.from)
                    }
                    trips = restructure.mapServerToClient(docs)
                    return n()
                } else {
                    responseObj.status = _status.SUCCESS;
                    responseObj.message = "No trips";
                    if (!responseObj.response) {
                        responseObj.response = {};
                    }
                    responseObj.response.trips = [];
                    //responseObj.response = { trips: [] }
                    return n()
                }
            })
        }
        let serviceFee = null
        let getServiceFee = (n) => {
            let agg = _mongoose.models["ConfigServiceFee"]["agg1"]()
            _mongoose.models["ServiceFee"].aggregate(agg).exec((err, docs) => {
                if (docs && docs.length) {
                    serviceFee = docs
                }
                return n()
            })
        }
        let carryFee = null
        let getCarryFee = (n) => {
            _mongoose.models["ConfigCarryFee"].find({}, (err, docs) => {
                if (docs && docs.length) {
                    carryFee = docs
                }
                return n()
            })
        }

        let getTripsCount = (n) => {
            let args = {
                searchKey: body.from + "||" + body.to + "||" + moment(body.depDate, 'DD-MM-YYYY').format("YYYYMMDD"),
                status: { "$in": ["active"] },
                depTime: { '$gte': (_.isEqual(currentDate, body.depDate) ? moment().format("HH:mm") : "00:00") }
                // hours: {"$gte": (_.isEqual(currentDate, body.depDate) ? parseInt(moment().format("HH")) : 0)},
                // mins: {"$gte": (_.isEqual(currentDate, body.depDate) ? parseInt(moment().format("mm")) : 0)}
            }
            let agg = _mongoose.models["Trip"]["search"](args, filter, {})
            _mongoose.models["Trip"].aggregate(agg).exec((err, docs) => {
                if (docs && docs.length) {
                    if (!responseObj.response) {
                        responseObj.response = {};
                    }
                    responseObj.response.tripCount = docs.length;
                    responseObj.response.flightCount = _.filter(docs, { tripType: 'air' }).length
                    responseObj.response.trainCount = _.filter(docs, { tripType: 'rail' }).length
                    responseObj.response.roadCount = _.filter(docs, { tripType: 'road' }).length
                    return n()
                } else {
                    responseObj.status = _status.SUCCESS;
                    responseObj.message = "No trips";
                    if (!responseObj.response) {
                        responseObj.response = {};
                    }
                    responseObj.response.tripCount = 0;
                    return n()
                }
            })
        }

        let getCheckAvailability = (cb) => {
            if (_.isEmpty(tripIds)) {
                return cb();
            }

            let filter = { tripId: { "$in": tripIds }, transactionStatus: '201' }

            _mongoose.models['BookingInfo'].aggregate([{ "$match": filter }, {
                "$group": {
                    _id: "$tripId", pkgWt: { $sum: "$pkgWt" }, pkgQt: { $sum: "$pkgQt" },
                    docWt: { $sum: "$docWt" },
                    docQt: { $sum: "$docQt" }
                }
            }], (e, s) => {
                if (!(s && s.length == 0)) {
                    tripAvailableWeight = common.arrayTomap(s, "_id", true)
                }
                return cb();
            })
        }

        _async.parallel([
            getFromCity.bind(),
            getToCity.bind(),
            getCarryFee.bind(),
        ], (e) => {
            _async.series([
                getTrips.bind(),
                getTripsCount.bind(),
                getCheckAvailability.bind()
            ], (err) => {
                // getTrips(() => {
                if (trips && cityMap) {
                    for (let t of trips) {
                        let availablePkgWeight = 0;
                        let availablePkgQty = 0;
                        let availableDocWeight = 0;
                        let availableDocQty = 0;
                        if (tripAvailableWeight && !_.isEmpty(tripAvailableWeight) && tripAvailableWeight[t.tid]) {
                            if (t.pkg && t.pkg.wt) {
                                let availableWeight = t.pkg.wt - tripAvailableWeight[t.tid]["pkgWt"]
                                availablePkgWeight = (availableWeight > 0) ? availableWeight : 0;

                                let availableQty = t.pkg.qnt - tripAvailableWeight[t.tid]["pkgQt"]
                                availablePkgQty = (availableQty > 0) ? availableQty : 0;
                            }

                            if (t.doc && t.doc.wt) {
                                let availableWeight = t.doc.wt - tripAvailableWeight[t.tid]["docWt"]
                                availableDocWeight = (availableWeight > 0) ? availableWeight : 0;

                                let availableQty = t.doc.qnt - tripAvailableWeight[t.tid]["docQt"]
                                availableDocQty = (availableQty > 0) ? availableQty : 0;
                            }
                        } else {
                            availablePkgWeight = (t && t.pkg && t.pkg.wt) ? t.pkg.wt : 0
                            availableDocWeight = (t && t.doc && t.doc.wt) ? t.doc.wt : 0
                            availablePkgQty = (t && t.pkg && t.pkg.qnt) ? t.pkg.qnt : 0
                            availableDocQty = (t && t.doc && t.doc.qnt) ? t.doc.qnt : 0
                        }

                        t["availablePkgWeight"] = availablePkgWeight;
                        t["availablePkgQnty"] = availablePkgQty;
                        t["availableDocWeight"] = availableDocWeight;
                        t["availableDocQnty"] = availableDocQty;
                        // helper.setServiceFee(serviceFee, t)
                        helper.setCarryFee(carryFee, t)
                        t.from = cityMap[t.from]
                        t.to = cityMap[t.to]
                    }
                    // responseObj.response = {
                    //     trips: trips,
                    // }
                    if (!responseObj.response) {
                        responseObj.response = {};
                    }
                    responseObj.response.trips = trips;
                    responseObj.status = _status.SUCCESS
                    responseObj.message = "success"
                }
                callback(responseObj)
                // })
            })

        })
    },

    /**
     * on click of resend button by the requester after decline his request by traveller
     */
    resendTrips: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'resend error',
            response: null
        }

        if (!body.tripId) {
            callback(responseObj);
        }
        let searchKey = null
        let cityIds = []
        let cityMap = {}
        let depDate = null

        const singleTripDetails = (cb) => {
            _mongoose.models['Trip'].findOne({ tripId: body.tripId }, ("searchKey"), (err, res) => {
                searchKey = res.searchKey
                let tempArray = res.searchKey.split("||")
                cityIds.push(parseInt(tempArray[0]))
                cityIds.push(parseInt(tempArray[1]))
                depDate = moment(tempArray[2], 'YYYYMMDD').format("DD-MM-YYYY")
                return cb()
            })
        }

        let getCityData = (n) => {
            let params = {
                lang: "en",
                cityIds: cityIds
            }
            let agg = _mongoose.models["CityPredictive"]["cityName"]({}, {}, params)
            _mongoose.models["CityPredictive"].aggregate(agg).exec((err, docs) => {
                if (docs && docs.length) {
                    cityMap = common.arrayTomap(docs, "cityId", true)
                }
                return n()
            })
        }

        let trips = null
        let filter = {}
        let tripIds = [];
        let tripAvailableWeight = {};
        let currentDate = moment().format("DD-MM-YYYY");

        let getTrips = (cb) => {
            let args = {
                searchKey: searchKey,
                status: { "$in": ["active"] },
                depTime: { '$gte': (_.isEqual(currentDate, depDate) ? moment().format("HH:mm") : "00:00") },
                tripId: {"$nin" : [body.tripId]}
            }

            body['offset'] = (body.offset) ? body.offset : 0
            body['limit'] = (body.limit) ? body.limit : 10

            let agg = _mongoose.models["Trip"]["search"](args, filter, {})
            _mongoose.models["Trip"].aggregate(agg).skip(body.offset).limit(body.limit).exec((err, docs) => {
                if (docs && docs.length) {
                    let cityIds = []
                    for (let d of docs) {
                        tripIds.push(d.tripId);
                        d.depDate = moment(d.depDate, 'YYYY-MM-DD').format("DD-MM-YYYY")
                        d.arrDate = moment(d.arrDate, 'YYYY-MM-DD').format("DD-MM-YYYY")
                        var then = d.depDate + " " + d.depTime;
                        var now = d.arrDate + " " + d.arrTime;
                        d.depTime = moment(d.depTime, 'hh:mm').format("LT");
                        d.arrTime = moment(d.arrTime, 'hh:mm').format("LT");
                        var ms = moment(now, "DD/MM/YYYY HH:mm").diff(moment(then, "DD/MM/YYYY HH:mm"));
                        var diffDate = moment.duration(ms);
                        let dur = "";
                        dur += (diffDate.days() > 0) ? diffDate.days() + "d " : "";
                        dur += (diffDate.hours() > 0) ? diffDate.hours() + "hr " : "";
                        dur += (diffDate.minutes() > 0) ? diffDate.minutes() + "min " : "";
                        d.dur = dur.trim();
                        cityIds.push(d.from)
                    }
                    trips = restructure.mapServerToClient(docs)
                    return cb()
                } else {
                    responseObj.status = _status.SUCCESS;
                    responseObj.message = "No trips";
                    if (!responseObj.response) {
                        responseObj.response = {};
                    }
                    responseObj.response.trips = [];
                    return cb()
                }
            })
        }

        let getTripsCount = (n) => {
            let args = {
                searchKey: searchKey,
                status: { "$in": ["active"] },
                depTime: { '$gte': (_.isEqual(currentDate, depDate) ? moment().format("HH:mm") : "00:00") },
                tripId: {"$nin" : [body.tripId]}
            }
            let agg = _mongoose.models["Trip"]["search"](args, filter, {})
            _mongoose.models["Trip"].aggregate(agg).exec((err, docs) => {
                if (docs && docs.length) {
                    if (!responseObj.response) {
                        responseObj.response = {};
                    }
                    responseObj.response.tripCount = docs.length;
                    responseObj.response.flightCount = _.filter(docs, { tripType: 'air' }).length
                    responseObj.response.trainCount = _.filter(docs, { tripType: 'rail' }).length
                    responseObj.response.roadCount = _.filter(docs, { tripType: 'road' }).length
                    return n()
                } else {
                    responseObj.status = _status.SUCCESS;
                    responseObj.message = "No trips";
                    if (!responseObj.response) {
                        responseObj.response = {};
                    }
                    responseObj.response.tripCount = 0;
                    return n()
                }
            })
        }
        let carryFee = null
        let getCarryFee = (n) => {
            _mongoose.models["ConfigCarryFee"].find({}, (err, docs) => {
                if (docs && docs.length) {
                    carryFee = docs
                }
                return n()
            })
        }

        let getCheckAvailability = (cb) => {
            if (_.isEmpty(tripIds)) {
                return cb();
            }

            let filter = { tripId: { "$in": tripIds }, transactionStatus: '201' }

            _mongoose.models['BookingInfo'].aggregate([{ "$match": filter }, {
                "$group": {
                    _id: "$tripId", pkgWt: { $sum: "$pkgWt" }, pkgQt: { $sum: "$pkgQt" },
                    docWt: { $sum: "$docWt" },
                    docQt: { $sum: "$docQt" }
                }
            }], (e, s) => {
                if (!(s && s.length == 0)) {
                    tripAvailableWeight = common.arrayTomap(s, "_id", true)
                }
                return cb();
            })
        }


        _async.series([
            singleTripDetails.bind(),
            getCityData.bind(),
            getTrips.bind(),
            getTripsCount.bind(),
            getCarryFee.bind(),
            getCheckAvailability.bind()
        ], (err) => {
            if (trips && cityMap) {
                for (let t of trips) {
                    let availablePkgWeight = 0;
                    let availablePkgQty = 0;
                    let availableDocWeight = 0;
                    let availableDocQty = 0;
                    if (tripAvailableWeight && !_.isEmpty(tripAvailableWeight) && tripAvailableWeight[t.tid]) {
                        if (t.pkg && t.pkg.wt) {
                            let availableWeight = t.pkg.wt - tripAvailableWeight[t.tid]["pkgWt"]
                            availablePkgWeight = (availableWeight > 0) ? availableWeight : 0;

                            let availableQty = t.pkg.qnt - tripAvailableWeight[t.tid]["pkgQt"]
                            availablePkgQty = (availableQty > 0) ? availableQty : 0;
                        }

                        if (t.doc && t.doc.wt) {
                            let availableWeight = t.doc.wt - tripAvailableWeight[t.tid]["docWt"]
                            availableDocWeight = (availableWeight > 0) ? availableWeight : 0;

                            let availableQty = t.doc.qnt - tripAvailableWeight[t.tid]["docQt"]
                            availableDocQty = (availableQty > 0) ? availableQty : 0;
                        }
                    } else {
                        availablePkgWeight = (t && t.pkg && t.pkg.wt) ? t.pkg.wt : 0
                        availableDocWeight = (t && t.doc && t.doc.wt) ? t.doc.wt : 0
                        availablePkgQty = (t && t.pkg && t.pkg.qnt) ? t.pkg.qnt : 0
                        availableDocQty = (t && t.doc && t.doc.qnt) ? t.doc.qnt : 0
                    }

                    t["availablePkgWeight"] = availablePkgWeight;
                    t["availablePkgQnty"] = availablePkgQty;
                    t["availableDocWeight"] = availableDocWeight;
                    t["availableDocQnty"] = availableDocQty;
                    helper.setCarryFee(carryFee, t)
                    t.from = cityMap[t.from].name
                    t.to = cityMap[t.to].name
                }
                if (!responseObj.response) {
                    responseObj.response = {};
                }
                responseObj.response.trips = trips;
                responseObj.status = _status.SUCCESS
                responseObj.message = "trips data"
            }
            return callback(responseObj)
        })
    },

    /**
     * @description complete trip information
     */
    review: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null
        }
        let cityIdArr = []
        let tripObj = {};
        const getTripReview = (cb) => {
            let filter = {
                tripId: body.tid,
                status: { "$in": ["active"] }
            }
            let agg = _mongoose.models["Trip"]["review"](filter, {}, { lang: "en" })
            _mongoose.models["Trip"].aggregate(agg).exec((err, docs) => {
                if (docs && docs.length) {
                    for (let d of docs) {
                        d.depDate = moment(d.depDate, 'YYYY-MM-DD').format("DD-MM-YYYY")
                        d.arrDate = moment(d.arrDate, 'YYYY-MM-DD').format("DD-MM-YYYY")
                        d.depTime = moment(d.depTime, 'HH:mm').format('hh:mm A')
                        d.arrTime = moment(d.arrTime, 'HH:mm').format('hh:mm A')
                        if (d.pickPoint && d.pickPoint.date) {
                            d.pickPoint.date = moment(d.pickPoint.date, 'DD-MM-YYYY').format("DD-MM-YYYY")
                        }
                        if (d.deliverPoint && d.deliverPoint.date) {
                            d.deliverPoint.date = moment(d.deliverPoint.date, 'DD-MM-YYYY').format("DD-MM-YYYY")
                        }
                        if (d.pick && d.pick.fDate && d.pick.tDate) {
                            d.pick.fDate = moment(d.pick.fDate, 'DD-MM-YYYY').format("DD-MM-YYYY")
                            d.pick.tDate = moment(d.pick.tDate, 'DD-MM-YYYY').format("DD-MM-YYYY")
                        }
                        if (d.deliver && d.deliver.fDate && d.deliver.tDate) {
                            d.deliver.fDate = moment(d.deliver.fDate, 'DD-MM-YYYY').format("DD-MM-YYYY")
                            d.deliver.tDate = moment(d.deliver.tDate, 'DD-MM-YYYY').format("DD-MM-YYYY")
                        }
                        cityIdArr.push(parseInt(d.from))
                        cityIdArr.push(parseInt(d.to))
                        // let cityMap = common.arrayTomap(d.city, "cityId", true)
                        // d.from = cityMap[d.from].name
                        // d.to = cityMap[d.to].name
                        // delete d.city
                    }
                    cityIdArr = [...new Set(cityIdArr)]
                    responseObj.response = restructure.mapServerToClient(docs[0]);
                    responseObj.status = _status.SUCCESS
                    responseObj.message = "Trip details"
                    return cb();
                    // return callback(responseObj)
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
                responseObj.status = _status.SUCCESS
                responseObj.message = "Trip details"
                if (err) {
                    responseObj.status = _status.ERROR
                    responseObj.message = "Error in getting city names";
                }
                if (docs && docs.length) {
                    responseObj["cityMap"] = common.arrayTomap(docs, "cityId", true)
                }
                if (responseObj.response && responseObj["cityMap"]) {
                    if (responseObj.response.to && responseObj["cityMap"][responseObj.response.to]) {
                        let cityobj = responseObj["cityMap"][responseObj.response.to];
                        if (cityobj && cityobj.name && cityobj.country) {
                            responseObj.response.to = cityobj.name + " " + cityobj.country
                        }
                    }
                    if (responseObj.response.from && responseObj["cityMap"][responseObj.response.from]) {
                        let cityobj = responseObj["cityMap"][responseObj.response.from];
                        if (cityobj && cityobj.name && cityobj.country) {
                            responseObj.response.from = cityobj.name + ", " + cityobj.country
                        }
                    }
                    delete responseObj["cityMap"];
                    tripObj = responseObj.response;
                }
                return cb()
            })
        }

        let getCheckAvailability = (cb) => {
            let filter = { tripId: tripObj.tid, transactionStatus: '201' }
            let availablePkgWeight = 0;
            let availableDocWeight = 0;
            let availablePkgQty = 0;
            let availableDocQty = 0;

            _mongoose.models['BookingInfo'].find(filter, (e, s) => {
                if (s && s.length == 0) {
                    availablePkgWeight = (tripObj && tripObj.pkg && tripObj.pkg.wt) ? tripObj.pkg.wt : 0
                    availableDocWeight = (tripObj && tripObj.doc && tripObj.doc.wt) ? tripObj.doc.wt : 0
                    availablePkgQty = (tripObj && tripObj.pkg && tripObj.pkg.qnt) ? tripObj.pkg.qnt : 0
                    availableDocQty = (tripObj && tripObj.doc && tripObj.doc.qnt) ? tripObj.doc.qnt : 0
                } else {
                    let totalDocWeight = 0, totalDocQnty = 0, totalPkgWeight = 0, totalPkgQnty = 0
                    for (let b of s) {
                        totalDocWeight = totalDocWeight + b.docWt
                        totalDocQnty = totalDocQnty + b.docQt
                        totalPkgWeight = totalPkgWeight + b.pkgWt
                        totalPkgQnty = totalPkgQnty + b.pkgQt
                    }
                    if (tripObj.pkg && tripObj.pkg.wt) {
                        let availableWeight = tripObj.pkg.wt - totalPkgWeight
                        availablePkgWeight = (availableWeight > 0) ? availableWeight : 0;

                        let availableQty = tripObj.pkg.qnt - totalPkgQnty
                        availablePkgQty = (availableQty > 0) ? availableQty : 0;
                    }

                    if (tripObj.doc && tripObj.doc.wt) {
                        let availableWeight = tripObj.doc.wt - totalDocWeight
                        availableDocWeight = (availableWeight > 0) ? availableWeight : 0;

                        let availableQty = tripObj.doc.qnt - totalDocQnty
                        availableDocQty = (availableQty > 0) ? availableQty : 0;
                    }
                }
                tripObj["availablePkgWeight"] = availablePkgWeight;
                tripObj["availablePkgQnty"] = availablePkgQty;
                tripObj["availableDocWeight"] = availableDocWeight;
                tripObj["availableDocQnty"] = availableDocQty;
                responseObj.response = restructure.mapServerToClient(tripObj);
                return cb();
            })
        }

        _async.series([
            getTripReview.bind(),
            getCityData.bind(),
            getCheckAvailability.bind()
        ], () => { return callback(responseObj) })
    },
    /**
     * @description list of trips for B2E
     */
    list: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null,
            total: 0
        }
        let filter = {}
        let cityIdArr = []
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
                { 'tripId': new RegExp(key, 'i') },
                { 'tripType': new RegExp(key, 'i') }
            ]
        }
        let getTripData = (cb) => {
            let agg = _mongoose.models["Trip"]["list"](body, filter, { lang: "en" })
            _mongoose.models["Trip"].aggregate(agg).skip(body.offset).limit(body.limit).exec((err, docs) => {
                if (docs) {
                    for (let d of docs) {
                        d.depDate = moment(d.depDate, 'YYYY-MM-DD').format("DD MMM YY")
                        d.depTime = moment(d.depTime, 'HH:mm').format('hh:mm A')
                        d.arrDate = moment(d.arrDate, 'YYYY-MM-DD').format("DD MMM YY")
                        d.arrTime = moment(d.arrTime, 'HH:mm').format('hh:mm A')
                        if (d.pick && d.pick.fDate && d.pick.tDate) {
                            d.pick.fDate = moment(d.pick.fDate, 'DD-MM-YYYY').format("DD MMM YY")
                            d.pick.tDate = moment(d.pick.tDate, 'DD-MM-YYYY').format("DD MMM YY")
                        }
                        if (d.deliver && d.deliver.fDate && d.deliver.tDate) {
                            d.deliver.fDate = moment(d.deliver.fDate, 'DD-MM-YYYY').format("DD MMM YY")
                            d.deliver.tDate = moment(d.deliver.tDate, 'DD-MM-YYYY').format("DD MMM YY")
                        }
                        // d.city = common.arrayTomap(d.city, "cityId", true)
                        cityIdArr.push(parseInt(d.from))
                        cityIdArr.push(parseInt(d.to))
                    }
                    cityIdArr = [...new Set(cityIdArr)]
                    // responseObj.response = restructure.mapServerToClient(docs)
                    responseObj.response = docs
                    responseObj.status = _status.SUCCESS
                    responseObj.message = "Trip List"
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

        let getTripCount = (cb) => {
            let agg = _mongoose.models["Trip"]["list"](body, filter, { lang: "en", count: true })
            _mongoose.models["Trip"].aggregate(agg).exec((err, data) => {
                if (!err && data && data.length) {
                    responseObj.total = data[0].count
                }
                return cb();
            })
        }
        _async.series([
            getTripData.bind(),
            getCityData.bind(),
            getTripCount.bind()
        ], () => { return callback(responseObj) })
    },
    /**
     * @description single record of trips for B2E
     */
    getOneTrip: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null,
            total: 0
        }
        let tripDetails = {}
        let tripReqDetails = {}
        let cityIdArr = []
        let getTripData = (cb) => {
            let filter = {}

            let agg = _mongoose.models["Trip"]["getOneTrip"]({ tripId: body.tripId }, filter, { lang: body.lang })
            _mongoose.models["Trip"].aggregate(agg).exec((err, docs) => {
                if (docs && docs.length) {
                    let d = docs[0]
                    d.depDate = moment(d.depDate, 'YYYY-MM-DD').format("DD/MM/YYYY")
                    d.arrDate = moment(d.arrDate, 'YYYY-MM-DD').format("DD/MM/YYYY")
                    d.arrTime = moment(d.arrTime, 'HH:mm').format('hh:mm A')
                    d.depTime = moment(d.depTime, 'HH:mm').format('hh:mm A')
                    cityIdArr.push(parseInt(d.from))
                    cityIdArr.push(parseInt(d.to))
                    if (d.pickPoint && d.pickPoint.date && d.pickPoint.time) {
                        d.pickPoint.date = moment(d.pickPoint.date, 'DD-MM-YYYY').format("DD/MM/YYYY")
                        //d.pickPoint.time = moment(d.pickPoint.time, 'HH:mm').format('hh:mm A')
                    }
                    if (d.pickRange && d.pickRange.date && d.pickRange.time) {
                        d.pickRange.date = moment(d.pickRange.date, 'DD-MM-YYYY').format("DD/MM/YYYY")
                        d.pickRange.time = d.pickRange.time
                    }
                    if (d.deliverPoint && d.deliverPoint.date && d.deliverPoint.time) {
                        d.deliverPoint.date = moment(d.deliverPoint.date, 'DD-MM-YYYY').format("DD/MM/YYYY")
                        //d.deliverPoint.time = moment(d.deliverPoint.time, 'HH:mm').format('hh:mm A')
                    }
                    if (d.deliverRange && d.deliverRange.date && d.deliverRange.time) {
                        d.deliverRange.date = moment(d.deliverRange.date, 'DD-MM-YYYY').format("DD/MM/YYYY")
                        d.deliverRange.time = d.deliverRange.time
                    }
                    // d.city = common.arrayTomap(d.city, "cityId", true)
                    // d.from = d.city[d.from].name + ', ' + d.city[d.from].country
                    // d.to = d.city[d.to].name + ', ' + d.city[d.to].country
                    // delete d.city
                    tripDetails = d
                    responseObj.status = _status.SUCCESS
                    responseObj.message = "Single Trip Data"
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
                    responseObj['cityMap'] = common.arrayTomap(docs, "cityId", true)
                }
                return cb()
            })
        }
        let tripReqData = (cb) => {
            let filter = {
                status: { "$ne": "onHold" }
            }
            let agg = _mongoose.models["CarryRequests"]["getTripReq"]({ tripId: body.tripId }, filter, { lang: "en" })
            _mongoose.models["CarryRequests"].aggregate(agg).exec((err, docs) => {
                if (docs && docs.length) {
                    tripReqDetails = docs
                }
                return cb();
            })
        }
        let earnings = 0
        let totalEarnings = (cb) => {
            _mongoose.models['TravellerAccount'].find({ tripId: body.tripId, transactionType: 'credit' }, (err, docs) => {
                if (!err && docs.length) {
                    for (let d of docs) {
                        earnings = earnings + d.amount
                    }
                }
                return cb()
            })
        }
        _async.series([
            getTripData.bind(),
            getCityData.bind(),
            tripReqData.bind(),
            totalEarnings.bind()
        ], (err) => {
            if (!err) {
                responseObj.response = {
                    tripDetails: tripDetails,
                    tripReqDetails: tripReqDetails,
                    totalEarnings: earnings
                }
            }
            return callback(responseObj)
        })
    },
    checkTripAvailability: (tripObj, carryRequest, callback) => {
        let filter = { tripId: tripObj.tripId, transactionStatus: 201 }
        let available = false
        _mongoose.models['BookingInfo'].find(filter, (e, s) => {
            if (s && s.length == 0) {
                available = true
            } else {
                let totalDocWeight = 0, totalDocQnty = 0, totalPkgWeight = 0, totalPkgQnty = 0
                for (let b of s) {
                    totalDocWeight = totalDocWeight + b.docWt
                    totalDocQnty = totalDocQnty + b.docQt
                    totalPkgWeight = totalPkgWeight + b.pkgWt
                    totalPkgQnty = totalPkgQnty + b.pkgQt
                }
                if (carryRequest.type == "package") {
                    available = true;
                    // if (carryRequest.extraWeight >= tripObj.package.weight) {
                    //     //not available
                    //     available = false
                    // }
                    // if (totalPkgWeight >= tripObj.package.weight) {
                    //     //not available
                    //     available = false
                    // }
                    // if (totalPkgQnty >= tripObj.package.qnty) {
                    //     //not available
                    //     available = false
                    // }

                    totalPkgWeight = parseInt(totalPkgWeight) + parseInt(carryRequest.extraWeight)
                    if (totalPkgWeight > tripObj.package.weight) {
                        //not available
                        available = false
                    }
                    // else if (totalPkgQnty > tripObj.package.qnty) {
                    //     //not available
                    //     available = false
                    // }
                    else {
                        available = true
                    }
                }
                else if (carryRequest.type == "document") {
                    available = true;
                    // if (carryRequest.extraWeight >= tripObj.document.weight) {
                    //     //not available
                    //     available = false
                    // }
                    // if (totalDocWeight >= tripObj.document.weight) {
                    //     //not available
                    //     available = false
                    // }
                    // if (totalDocQnty >= tripObj.document.qnty) {
                    //     //not available
                    //     available = false
                    // }
                    totalDocWeight = parseInt(totalDocWeight) + parseInt(carryRequest.extraWeight)
                    if (totalDocWeight > tripObj.document.weight) {
                        //not available
                        available = false
                    }
                    else if (totalDocQnty > tripObj.document.qnty) {
                        //not available
                        available = false
                    }
                    else {
                        available = true

                    }
                }
            }
            callback(available)
        })
    },
    holdInvoice: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'Error in holding the invoice.',
        }
        let tripObj = null
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
                    //responseObj.message = "Carry is not available"
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
                let extraWeight = 0;
                if (body.invoice) {
                    if (body && body.extraWeight && body.type === "document") {
                        extraWeight = body.extraWeight;
                    } else if (body && body.extraWeight && body.type === "package") {
                        extraWeight = body.extraWeight;
                    }
                }
                let bookingInfo = {
                    carryId: carryObj.carryId,
                    tripId: carryObj.tripId,
                    pkgWt: (carryObj.type === "package") ? parseInt(carryObj.weight) + parseInt(extraWeight) : 0,
                    pkgQt: (carryObj.type === "package") ? carryObj.quantity : 0,
                    docWt: (carryObj.type === "document") ? parseInt(carryObj.weight) + parseInt(extraWeight) : 0,
                    docQt: (carryObj.type === "document") ? carryObj.quantity : 0,
                    pkgWtMax: (tripObj.package) ? tripObj.package.weight : 0,
                    pkgQtMax: (tripObj.package) ? tripObj.package.qnty : 0,
                    docWtMax: (tripObj.document) ? tripObj.document.weight : 0,
                    docQtMax: (tripObj.document) ? tripObj.document.qnty : 0,
                    bookingStatus: 101,
                    transactionStatus: 201
                }
                if (body.invoice) {
                    bookingInfo.invoice = true;
                    bookingInfo.invoiceId = body.invoiceId
                    bookingInfo.bookingStatus = 108;
                }
                let filter = { tripId: carryObj.tripId, carryId: carryObj.carryId }
                _mongoose.models['BookingInfo'].findOne(filter, (e, s) => {
                    if (s) {
                        let setValues = {
                            invoice: true,
                            bookingStatus: 108,
                            pkgWt: (carryObj.type === "package") ? parseInt(carryObj.weight) + parseInt(extraWeight) : 0,
                            docWt: (carryObj.type === "document") ? parseInt(carryObj.weight) + parseInt(extraWeight) : 0,
                            shippingStatus: "pending",
                            invoiceId: body.invoiceId
                        }
                        _mongoose.models['BookingInfo'].update(filter, { $set: setValues }, (e, s) => {
                            if (s) {
                                responseObj.status = _status.SUCCESS
                                responseObj.message = "your request is kept on hold, please continue the payment for confirm the booking"
                                responseObj.response = {
                                    paymentUrl: _config.paymentUrl + "?tripId=" + bookingInfo.tripId + "&carryId=" + bookingInfo.carryId
                                }
                            } else {
                                responseObj.message = "Not confirmed"
                            }
                            callback(responseObj)
                        });

                    } else {
                        new _mongoose.models["BookingInfo"](bookingInfo).save((e, s) => {
                            if (s && s.id) {
                                responseObj.status = _status.SUCCESS
                                responseObj.message = "your request is kept on hold, please continue the payment for confirm the booking"
                                responseObj.response = {
                                    paymentUrl: _config.paymentUrl + "?tripId=" + bookingInfo.tripId + "&carryId=" + bookingInfo.carryId
                                }
                            } else {
                                responseObj.message = "Not confirmed"
                            }
                            callback(responseObj)
                        })
                    }
                });
            } else {
                callback(responseObj)
            }
        })
    },
    tripCost: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'Error in holding the invoice.',
        }
        if (!((body && body.tripType) || body.package || body.document)) {
            responseObj.status = _status.ERROR;
            responseObj.message = "Please provide required inputs"
        }
        let carryType = "";
        let carryWeight = "";
        let tripPrice = 0;

        let packagePrice = (n) => {
            if (body.package) {
                let packageObj = body.package;
                if (!(packageObj.weight)) {
                    responseObj.status = _status.ERROR;
                    responseObj.message = "provide package weight"
                }
                carryType = "package";
                carryWeight = parseInt(packageObj.weight);
            } else {
                return n();
            }
            let filter = { carryMode: body.tripType, carryType: carryType, maxWeight: { $gte: carryWeight }, minWeight: { $lte: carryWeight } }
            _mongoose.models["ConfigCarryFee"].findOne(filter, (e, s) => {
                tripPrice = (s) ? s.price : 100;
                return n()
            })
        }

        let documentPrice = (n) => {
            if (body.document) {
                let documentObj = body.document;
                if (!(documentObj.weight)) {
                    responseObj.status = _status.ERROR;
                    responseObj.message = "provide document weight"
                }
                carryType = "document";
                // carryWeight = Number(documentObj.qnty) * 1000;
                carryWeight = 1000

            } else {
                return n();
            }
            let filter = { carryMode: body.tripType, carryType: carryType, maxWeight: { $gte: carryWeight }, minWeight: { $lte: carryWeight } }
            _mongoose.models["ConfigCarryFee"].findOne(filter, (e, s) => {
                tripPrice += (s) ? s.price : 100;
                return n()
            })
        }
        _async.series([
            packagePrice.bind(),
            documentPrice.bind(),
        ], () => {
            responseObj.response = {
                price: tripPrice
            }
            responseObj.message = "Success";
            responseObj.status = _status.SUCCESS;
            return callback(responseObj)
        })
    },

    onGoingTrips: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'Error in changing the Trip status.',
        }
        let currentDate = Number(moment().format("YYYYMMDD"))
        let filter = {
            depDate: { "$eq": parseInt(currentDate) },
            status: { "$in": ["active"] },
            hours: { "$lte": parseInt(moment().format("HH")) },
            mins: { "$lte": parseInt(moment().format("mm")) }
        }
        let agg = _mongoose.models["Trip"]["onGoingTrips"](filter, {}, {})
        _mongoose.models["Trip"].aggregate(agg).exec((err, docs) => {
            if (err) {
                return cb()
            } else {
                let tripIdsArr = []
                for (let i of docs) {
                    tripIdsArr.push(i.tripId);
                }
                _mongoose.models['Trip'].updateMany({ tripId: { "$in": tripIdsArr } }, { $set: { status: "onGoing" } }, (err, res) => {
                    if (res) {
                        responseObj.message = "Success";
                        responseObj.status = _status.SUCCESS;
                        responseObj.response = {};
                    }
                    return callback(responseObj);
                });
            }
        })
    },
    makeTripAsInactive: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'Error in changing the Trip status.',
        }
        _mongoose.models['Trip'].update({ tripId: body.tripId }, { $set: { status: (body.toggle) ? "active" : "inActive" } }, (err, res) => {
            if (!err && res) {
                responseObj.message = "Success";
                responseObj.status = _status.SUCCESS;
                responseObj.response = {};
            }
            return callback(responseObj);
        })
    }
}
