'use strict'
/**
 * @description Dashboard service
 * @author Saif
 * @since Sept 09 2019
 */
const common = require('../../libs/utils/common')
module.exports = {
    // get dashboard data count
    getDashboard: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }
        let shipmentCountBystatus = (cb) => {
            let now = Date.now(),
                oneDay = (1000 * 60 * 60 * 24),
                today = new Date(now - (now % oneDay)),
                tomorrow = new Date(today.valueOf() + oneDay);
            _mongoose.models['CarryRequests'].find({ status: { '$in': ['confirmed', 'delivered'] } }).exec((err, docs) => {
                if (!err && docs) {
                    responseObj.status = _status.SUCCESS
                    responseObj.message = 'Dashboard Details'
                    responseObj.response['confirmed'] = _.filter(docs, { status: 'confirmed' }).length
                    responseObj.response['delivered'] = _.filter(docs, { status: 'delivered' }).length
                    // responseObj.response['notDelivered'] = _.filter(docs, { status: 'not delivered' }).length
                }
                return cb();
            })
        }
        let goodsvalue = (cb) => {
            let now = Date.now(),
                oneDay = (1000 * 60 * 60 * 24),
                today = new Date(now - (now % oneDay)),
                tomorrow = new Date(today.valueOf() + oneDay);
            _mongoose.models['CarryRequests'].find({ type: 'package', status: { '$in': ['confirmed'] } }).exec((err, docs) => {
                if (!err && docs) {
                    let goodsValue = 0
                    for (let d of docs) {
                        goodsValue = parseFloat(d.worth) + goodsValue
                    }
                    responseObj.response['goodsValue'] = parseFloat(goodsValue).toFixed(2)
                }
                return cb();
            })
        }
        let getNotDelivered = (cb) => {
            _mongoose.models['CarryRequests'].find({ 'rmc.date': _moment().format('DD-MM-YYYY'), status: { '$in': ['confirmed', 'picked', 'delivered'] } }).exec((err, docs) => {
                if (!err && docs) {
                    let notDelivered = _.filter(docs, (o) => { return o.status != 'delivered' }).length
                    if (notDelivered > 0) {
                        responseObj.response['notDelivered'] = parseInt((notDelivered / docs.length) * 100)
                    } else {
                        responseObj.response['notDelivered'] = 0
                    }
                }
                return cb();
            })
        }


        _async.parallel([goodsvalue.bind(), shipmentCountBystatus.bind(), getNotDelivered.bind()], (err) => {
            return callback(responseObj)
        })
    },

    // get number of active trips as per date
    getActiveCarriers: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {},
            total: 0
        }
        let startDate_1 = _moment()
        let endDate_1 = _moment().add(7, 'days')
        let startDate_2 = _moment().add('months', 1)
        let endDate_2 = _moment().add('months', 1).add(7, 'days')

        if (body.dates && body.dates.date_1) {
            startDate_1 = _moment(body.dates.date_1[0], 'DD/MM/YYYY')
            endDate_1 = _moment(body.dates.date_1[1], 'DD/MM/YYYY')
        }
        if (body.dates && body.dates.date_2) {
            startDate_2 = _moment(body.dates.date_2[0], 'DD/MM/YYYY')
            endDate_2 = _moment(body.dates.date_2[1], 'DD/MM/YYYY')
        }

        let api = (date1, date2, lcb) => {
            let now = _moment(date1)
            let dates = []
            let resp = {}

            // construct an array with list of seven dates between startDate and endDate     
            while (now.isSameOrBefore(date2)) {
                dates.push(now.format('MMM DD'));
                resp[now.format('MMM DD')] = 0
                now.add(1, 'days');
            }
            _mongoose.models['Trip'].find({ 'status': {"$in": ["active"] }, 'depDate': { '$gte': _moment(date1).format('YYYYMMDD'), '$lte': _moment(date2).format('YYYYMMDD')} }).exec((err, docs) => {
                if (!err && docs) {
                    for (let d of docs) {
                        if (dates.includes((_moment(d.updatedAt, 'YYYYMMDD').format('MMM DD')))) {
                            resp[_moment(d.updatedAt, 'YYYYMMDD').format('MMM DD')] = resp[_moment(d.updatedAt, 'YYYYMMDD').format('MMM DD')] + 1
                        }
                    }
                    return lcb(null, resp);
                } else {
                    return lcb(err, null);
                }
            })
        }

        let getFirstMonth = (cb) => {
            api(startDate_1, endDate_1, (err, docs) => {
                responseObj.response['firstMonth'] = docs
                return cb()
            })
        }

        let getSecondMonth = (cb) => {
            api(startDate_2, endDate_2, (err, docs) => {
                responseObj.response['secondMonth'] = docs
                return cb()
            })
        }

        let getTripCount = (cb) => {
            _mongoose.models["Trip"].countDocuments({ 'status': {"$in": ["active"] }}).exec((err, count) => {
                if (!err && count) {
                    responseObj['total'] = count
                }
                return cb();
            })
        }

        _async.parallel([getFirstMonth.bind(), getSecondMonth.bind(), getTripCount.bind()], (err) => {
            if (!err) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Active carriers'
            }
            return callback(responseObj)
        })
    },

    // get hourly sales data as per date - to be deleted
    getDaySales: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {},
            total: 0
        }
        /* let now = Date.now(),
            oneDay = (1000 * 60 * 60 * 24),
            today = new Date(now - (now % oneDay)),
            fromDate = new Date(today.valueOf() - (7 * oneDay)); */

        let startDate = _moment().subtract(7, 'days')
        let endDate = _moment()
        let now = startDate
            , dates = []
            , resp = {}
        _mongoose.models['BookingInfo'].find({ 'updatedAt': { "$gte": startDate, "$lte": endDate }, 'shippingStatus': 'pending' }).exec((err, docs) => {
            if (!err) {
                while (now.isBefore(endDate) || now.isSame(endDate)) {
                    dates.push(now.format('MMM DD'));
                    resp[now.format('MMM DD')] = 0
                    now.add(1, 'days');
                }
                for (let d of docs) {
                    if (dates.includes((_moment(d.updatedAt, 'YYYYMMDD').format('MMM DD')))) {
                        resp[_moment(d.updatedAt, 'YYYYMMDD').format('MMM DD')] = resp[_moment(d.updatedAt, 'YYYYMMDD').format('MMM DD')] + 1
                    }
                }
                responseObj.status = _status.SUCCESS
                responseObj.message = 'active carrier'
                responseObj.response = resp
            }
            return callback(responseObj)
        })
    },

    getTopCities: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }
        let cityIdArr = []
        let counts = {}
        let getCityIds = (cb) => {
            _mongoose.models['Trip'].find({}, 'to').exec((err, docs) => {
                if (!err && docs) {
                    for (let d of docs) {
                        cityIdArr.push(parseInt(d.to))
                    }
                    // cityIdArr = [...new Set(cityIdArr)]
                    cityIdArr.forEach(function (x) { counts[x] = (counts[x] || 0) + 1 })
                }
                return cb()
            })
        }

        let getCityData = (cb) => {
            let params = {
                lang: "en",
                cityIds: cityIdArr
            }
            let agg = _mongoose.models["CityPredictive"]["cityName"]({}, {}, params)
            _mongoose.models["CityPredictive"].aggregate(agg).exec((err, docs) => {
                let cityMap = {}
                if (docs && docs.length) {
                    cityMap = common.arrayTomap(docs, "cityId", true)
                }
                let topCityData = []

                // get top 10 city with count
                for (let c of Object.keys(counts)) {
                    topCityData.push({
                        city: cityMap[c].name,
                        count: counts[c]
                    })
                }
                topCityData = _.reverse(_.sortBy(topCityData, ['count'])).slice(0, 10)
                let totalCount = _.sumBy(topCityData, (o) => { return o.count })

                // calculate percentage
                for (let c of topCityData) {
                    let percent = parseFloat((c.count / totalCount) * 100).toFixed(2)
                    c['city'] = c.city + ' - ' + percent + '%'
                    c['percent'] = percent
                    delete c.count
                }
                responseObj['response'] = topCityData
                return cb()
            })
        }

        _async.series([getCityIds.bind(), getCityData.bind()], (err) => {
            if (!err) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Top Cities data'
            }

            return callback(responseObj)
        })
    },

    // get total deliveries as per date
    getDeliveries: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }
        let startDate = _moment().subtract(7, 'days')
        let endDate = _moment()
        if (body.dates) {
            let dates = body.dates
            startDate = _moment(dates[0], 'DD/MM/YYYY')
            endDate = _moment(dates[1], 'DD/MM/YYYY')
        }
        let now = _moment(startDate)
            , dates = []
            , resp = {
                package: {},
                document: {}
            }
        _mongoose.models['CarryRequests'].find({ status: 'delivered', 'droppedDate': { '$lte': _moment(endDate).add(1, 'days').format(), '$gte': _moment(startDate).format() } }).exec((err, docs) => {
            if (!err) {
                while (now.isBefore(endDate) || now.isSame(endDate)) {
                    dates.push(now.format('MMM DD'));
                    resp.package[now.format('MMM DD')] = 0
                    resp.document[now.format('MMM DD')] = 0
                    now.add(1, 'days');
                }
                for (let d of docs) {
                    if (dates.includes((_moment(d.droppedDate).format('MMM DD'))) && d.type == 'package') {
                        resp.package[_moment(d.droppedDate).format('MMM DD')] = resp.package[_moment(d.droppedDate).format('MMM DD')] + 1
                    }
                    if (dates.includes((_moment(d.droppedDate).format('MMM DD'))) && d.type == 'document') {
                        resp.document[_moment(d.droppedDate).format('MMM DD')] = resp.document[_moment(d.droppedDate).format('MMM DD')] + 1
                    }
                }
                responseObj.status = _status.SUCCESS
                responseObj.message = 'active carrier'
                responseObj.response = resp
            }
            return callback(responseObj)
        })
    },

    // get the booking amount as per date
    getSalesPrice: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }

        let startDate = _moment().subtract(7, 'days')
        let endDate = _moment()
        if (body.dates && body.dates.length) {
            startDate = _moment(body.dates[0], 'DD/MM/YYYY')
            endDate = _moment(body.dates[1], 'DD/MM/YYYY')
        }
        let now = startDate
            , resp = {}
            , totalAmount = 0
        _mongoose.models['PaymentInfo'].find({ updatedAt: { "$gte": startDate, "$lte": _moment(endDate).add(1, 'days') } }).exec((err, docs) => {
            while (now.isBefore(endDate) || now.isSame(endDate)) {
                // dates.push(now.format('MMM DD'));
                resp[now.format('MMM DD')] = 0
                now.add(1, 'days');
            }
            if(!err && docs.length) {
                for (let d of docs) {
                    let key = _moment(d.updatedAt).format('MMM DD')
                    resp[key] = resp[key] + parseInt(d.amount)
                    totalAmount = totalAmount + parseInt(d.amount)
                }
            }
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Sales Price Data'
            responseObj.response = resp
            responseObj.total = totalAmount
            return callback(responseObj)
        })
    },

    // get the confirmed booking count as per date
    getSalesCount: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }
        let today = _moment({ h: 0, m: 0, s: 0, ms: 0 }).format()
        let tomorrow = _moment({ h: 0, m: 0, s: 0, ms: 0 }).add(1, 'days').format()
        let yesterday = _moment({ h: 0, m: 0, s: 0, ms: 0 }).subtract(1, 'days').format()
        let lastWeek = _moment({ h: 0, m: 0, s: 0, ms: 0 }).subtract(7, 'days').format()
        let lwMinusOne = _moment({ h: 0, m: 0, s: 0, ms: 0 }).subtract(8, 'days').format()
        if (body.date) {
            today = _moment(body.date, 'DD/MM/YYYY').format()
            tomorrow = _moment(body.date, 'DD/MM/YYYY').add(1, 'days').format()
            yesterday = _moment(body.date, 'DD/MM/YYYY').subtract(1, 'days').format()
            lastWeek = _moment(body.date, 'DD/MM/YYYY').subtract(7, 'days').format()
            lwMinusOne = _moment(body.date, 'DD/MM/YYYY').subtract(8, 'days').format()
        }

        // get data from db
        let api = (day1, day2, lcb) => {
            _mongoose.models['CarryRequests'].find({ paymentDate: { '$gte': day1, '$lt': day2 } }).exec((err, docs) => {
                if (!err && docs) {
                    let resp = { '00:00 AM': 0 }
                    for (let i = 1; i <= 30; i++) {
                        let key = _moment('01-01-2019', 'DD-MM-YYYY').startOf('hour').add(i, 'hours').format('h A')
                        resp[key] = 0
                    }
                    for (let i = 0; i < docs.length; i++) {
                        let key = _moment(_moment(docs[i].paymentDate).format()).add(1, 'hours').format('h A')
                        // let value = _moment(_moment(docs[i].paymentDate).format()).format('hh:00 A')
                        resp[key] = resp[key] + 1
                    }
                    return lcb(null, resp)
                } else {
                    return lcb(err, null)
                }
            })
        }

        let getTodaysData = (cb) => {
            api(today, tomorrow, (err, docs) => {
                responseObj.response['today'] = docs
                return cb()
            })
        }

        let getYesterdaysData = (cb) => {
            api(yesterday, today, (err, docs) => {
                responseObj.response['yesterday'] = docs
                return cb()
            })
        }

        let getLastweeksData = (cb) => {
            api(lwMinusOne, lastWeek, (err, docs) => {
                responseObj.response['lastweek'] = docs
                return cb()
            })
        }

        _async.parallel([
            getTodaysData.bind(),
            getYesterdaysData.bind(),
            getLastweeksData.bind()
        ], (err) => {
            if (!err) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Hourly Sales Data'
            }
            return callback(responseObj)
        })
        /* _mongoose.models['CarryRequests'].find({paymentDate: {'$gte': today, '$lt': tomorrow}  }).exec((err, docs) => {
            if (!err && docs) {
                let resp = {'00:00 AM': 0}
                for(let i = 1; i <= 30; i++) {
                    let key = _moment('01-01-2019', 'DD-MM-YYYY').startOf('hour').add(i, 'hours').format('h A')
                    resp[key] = 0
                }
                for(let i = 0; i < docs.length; i++) {
                    let key = _moment(_moment(docs[i].paymentDate).format()).add(1, 'hours').format('h A')
                    // let value = _moment(_moment(docs[i].paymentDate).format()).format('hh:00 A')
                    if(docs[i].carryId === '4tLHn'){
                        console.log('qqqq')
                    }
                    resp[key] = resp[key] + 1
                } 
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Hourly Sales Data'
                responseObj.response = resp
                return callback(responseObj)
            } else {
                return callback(responseObj)
            }
        }) */
    },

    //get Top Routes
    getRoutesCount: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }
        let cityIdArr = []
        let routesCount = {}
        let totalCount = 0
        let type = (body.type) ? body.type : 'trips'
        let startDate = (body.dates.length) ? parseInt(body.dates[0]) : 10000101
        let endDate = (body.dates.length) ? parseInt(body.dates[1]) : 30000101

        let tripIds = []
        // get trip ids if the data is of CarryRequests
        let getTripIds = (cb) => {
            if (type == 'shipments') {
                _mongoose.models['CarryRequests'].find({ status: { "$in": ['confirmed'] }, paymentDate: {'$lte': _moment(endDate, 'YYYYMMDD').format(), '$gte': _moment(startDate, 'YYYYMMDD').format()} }, (err, docs) => {
                    if (!err && docs.length) {
                        for (let d of docs) {
                            tripIds.push(d.tripId)
                        }
                        tripIds = [...new Set(tripIds)]
                    } else {
                        // need to handle
                    }
                    return cb()
                })
            } else {
                return cb()
            }
        }

        // construct routes and get their count
        let getTopRoutes = (cb) => {
            let findBy = {}

            if (tripIds.length) {
                // findBy["$expr"]["$and"].push( { "$in": ["$tripId", tripIds] })
                findBy = {
                    "$expr": {
                        "$and": [
                            { "$in": ["$tripId", tripIds] }
                        ]
                    }
                }
            } else {
                findBy = {
                    "$expr": {
                        "$and": [
                            {
                                "$gte": ["$depDate", startDate]
                            },
                            {
                                "$lte": ["$depDate", endDate]
                            }
                        ]
                    }
                }
            }

            let agg = _mongoose.models['Trip']["getTopRoutes"](findBy, {}, {})
            _mongoose.models['Trip'].aggregate(agg).exec((err, docs) => {
                if (!err && docs.length) {
                    for (let d of docs) {
                        cityIdArr.push(parseInt(d._id.split('-')[0]), parseInt(d._id.split('-')[1]))
                        totalCount = totalCount + d.count
                    }
                    cityIdArr = [...new Set(cityIdArr)]
                    routesCount = docs.slice(0, 10)
                }
                return cb()
            })
        }

        // get city names from city ids
        let cityMap = {}
        let getCityNames = (cb) => {
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

        // construct final response 
        let finalResponse = {}
        let others = 100
        let constructResponse = (cb) => {
            if (routesCount.length) {
                for (let d of routesCount) {
                    finalResponse[cityMap[d._id.split('-')[0]].name +" - "+ cityMap[d._id.split('-')[1]].name] = parseFloat(d.count / totalCount * 100).toFixed(2)
                    others = others - ((d.count/totalCount) * 100)
                }
                finalResponse['Others'] = parseFloat(others).toFixed(2)
            } else {
                finalResponse['No Data'] = 0
            }
            return cb()
        }

        _async.series([
            getTripIds.bind(),
            getTopRoutes.bind(),
            getCityNames.bind(),
            constructResponse.bind()], () => {
                // responseObj.totalCount = totalCount
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Top Routes'
                responseObj.response = finalResponse
                return callback(responseObj)
            })

    },

    // get cancellation count
    getCancelCount: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }

        let getCancelledTrips = (cb) => {
            api('Trip', (err, docs) => {
                if (!err) {
                    responseObj.response['trips'] = docs
                }
                return cb()
            })
        }

        let getCancelledShipments = (cb) => {
            api('CarryRequests', (err, docs) => {
                if (!err) {
                    responseObj.response['shipments'] = docs
                }
                return cb()
            })
        }

        let api = (collectionName, lcb) => {
            let startDate = _moment().subtract(7, 'days')
            let endDate = _moment()
            if (body.dates && body.dates.length) {
                startDate = _moment(body.dates[0], 'DD/MM/YYYY')
                endDate = _moment(body.dates[1], 'DD/MM/YYYY')
            }
            _mongoose.models[collectionName].find({status: 'cancelled', updatedAt: {"$gte": startDate, "$lte": _moment(endDate).add(1, 'days')}}).exec((err, docs) => {
                let now = startDate
                let resp = {}
                while (now.isBefore(endDate) || now.isSame(endDate)) {
                    resp[now.format('MMM DD')] = 0
                    now.add(1, 'days');
                }
                if(!err && docs.length) {
                    for (let d of docs) {
                        let key = _moment(d.updatedAt).format('MMM DD')
                        resp[key] = resp[key] + 1
                    }
                    return lcb(null, resp)
                } else {
                    return lcb(err, resp)
                }
            })
        }

        _async.parallel([
            getCancelledTrips.bind(),
            getCancelledShipments.bind()
        ], (err, docs) => {
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Cancellation Data'
            return callback(responseObj)
        })
    },

    // get commission data as per date
    getCommissionData: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }

        let startDate = _moment().subtract(7, 'days')
        let endDate = _moment()
        if (body.dates && body.dates.length) {
            startDate = _moment(body.dates[0], 'DD/MM/YYYY')
            endDate = _moment(body.dates[1], 'DD/MM/YYYY')
        }
        /* if (Object.keys(body).length == 0) {
            startDate = new Date(_moment().subtract(6, 'days'))
            endDate = new Date(_moment())
        } else {
            if (body && body.startDate && body.endDate) {
                startDate = new Date(body.startDate)
                endDate = new Date(body.endDate)
            } else {
                responseObj.message = "invalid or incompled date"
                return callback(responseObj);
            }
        } */
        let filter = {
            //status: "confirmed",
            status: "delivered",
            droppedDate: {
                $gte: new Date(startDate),
                $lte: new Date(_moment(endDate).add(1, 'days').format('YYYY-MM-DD'))
            }
        }
        let resp = {},
            now = startDate,
            totalCommision = 0
        let agg = _mongoose.models["CarryRequests"]["commissionInfo"]({}, {}, filter)
        _mongoose.models['CarryRequests'].aggregate(agg).exec((err, docs) => {
            while (now.isBefore(endDate) || now.isSame(endDate)) {
                resp[now.format('MMM DD')] = parseFloat(0).toFixed(2)
                now.add(1, 'days');
            }
            if (!err && docs.length > 0) {
                docs.forEach(function (x) {
                    // let commission = 0
                    // for (let c of x.commisionFee) {
                    //     commission += c['commissionFee']
                    let date = _moment(x.droppedDate).format('MMM DD') 
                    //resp[date] = resp[date] ? resp[date] + x.commisionFee[0].commission : x.commisionFee[0].commission
                    resp[date] = parseInt(resp[date]) +  parseInt(x.commisionFee[0].commission);
                    resp[date] = parseFloat(resp[date]).toFixed(2)
                    totalCommision += x.commisionFee[0].commission
                    // }
                })
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Commision Data for Dashboard graphs'
                responseObj.response = { 'currency': 'SAR', 'commissionData': resp, 'totalCommision': parseFloat(totalCommision).toFixed(2) }
                return callback(responseObj)
            }else if(docs.length == 0) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Commision Data for Dashboard graphs'
                responseObj.response = { 'currency': 'SAR', 'commissionData': resp, 'totalCommision': parseFloat(totalCommision).toFixed(2) }
                return callback(responseObj)
            } else {
                console.log(docs.length)
                responseObj.message = 'db error'
                return callback(responseObj)
            }
        })
    },

    // get devices count as per the date
    getDevicesCount: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }

        let startDate = _moment().subtract(7, 'days')
        let endDate = _moment()
        if (body.dates && body.dates.length) {
            startDate = _moment(body.dates[0], 'DD/MM/YYYY')
            endDate = _moment(body.dates[1], 'DD/MM/YYYY')
        }
        let resp = {},
            now = startDate,
            android = 0,
            ios = 0,
            mobileWeb = 0,
            web = 0
            let collectionName = (body.type === 'shipments') ? "CarryRequests" : "Trip"
            _mongoose.models[collectionName].find({ platform: {$exists: true}, updatedAt: { "$gte": startDate, "$lte": _moment(endDate).add(1, 'days') } }, 'platform updatedAt').exec((err, docs) => {
            while (now.isBefore(endDate) || now.isSame(endDate)) {
                now.add(1, 'days');
            }
            if (!err && docs.length > 0) {
                docs.forEach(function (x) {
                    if (x && x.platform) {       
                        if (_.isEqual(x.platform.trim(), "android")) {
                            android += 1;
                        }
                        if (_.isEqual(x.platform.trim(), "ios")) {
                            ios += 1;
                        }
                        if (_.isEqual(x.platform.trim(), "mWeb")) {
                            mobileWeb += 1;
                        }
                        if (_.isEqual(x.platform.trim(), "web")) {
                            web += 1;
                        }
                        resp['iOS'] = parseInt(ios);
                        resp['Android'] = parseInt(android);
                        resp['Mobile Web'] = parseInt(mobileWeb);
                        resp['Website'] = parseInt(web);
                    }
                })
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Device Data for Dashboard graphs'
                responseObj.response = resp
                return callback(responseObj)
            } else if(docs.length == 0) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Device Data for Dashboard graphs'
                responseObj.response = { "Android": android, "iOS": ios, "Mobile Web": mobileWeb, "Web": web }
                return callback(responseObj)
            } else {
                responseObj.message = 'db error'
                return callback(responseObj)
            }
        })
    }

}