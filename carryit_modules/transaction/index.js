'use strict'
/**
 * @author Aniket
 * @description wallet related services
 */

const randomstring = require('randomstring')
    , keymapper = require('../../libs/utils/key-mapping')
    , helpAdaptor = require('../../libs/helper')
    , common = require('../../libs/utils/common')
    , notifications = require('../notifications')
    , mailer = require('../../libs/mailer')

const lang = keymapper["s2c"];

// Credit the balance to wallet
const CreditWallet = (body, callback) => {

    let responseObj = {
        status: _status.ERROR,
        message: 'Error in add data to wallet'
    }
    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(body, "walle_credit_RQ" + currentTime, "transactions")

    // Update user wallet amount
    let updateUserInfo = (cb) => {
        _mongoose.models['Users'].findOne({ 'uid': body.userId }, (e, s) => {
            if (s) {
                s.walletBalance += parseFloat(body.amount)
                new _mongoose.models['Users'](s).save((e, s) => {
                    if (s) {
                        responseObj.status = _status.SUCCESS
                        responseObj.message = 'credited into wallet successfully'
                    } else {
                        responseObj.message = 'db error'
                        helpAdaptor.logWriter(responseObj, "walle_credit_RS" + currentTime, "transactions")
                        return callback(responseObj)
                    }
                })
                return cb();
            } else {
                responseObj.message = 'db error'
                helpAdaptor.logWriter(responseObj, "walle_credit_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        })
    }

    let addIntoWallet = (cb) => {
        let transactionId = randomstring.generate({
            length: 5,
            charset: 'alphanumeric',
            // capitalization: 'uppercase'
        })

        let walletInfo = new _mongoose.models['WalletInfo']();
        walletInfo.status = true;
        walletInfo.currency = 'SAR';
        walletInfo.amount = parseFloat(body.amount);
        walletInfo.transactionId = transactionId;
        walletInfo.transactionType = 'credit';
        walletInfo.userId = body.userId;
        walletInfo.requestId = body.requestId;
        walletInfo.desciption = body.description;

        walletInfo.save((e, s) => {
            if (s) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'credited into wallet successfully'
                return cb();
            } else {
                responseObj.message = 'db error'
                helpAdaptor.logWriter(responseObj, "walle_credit_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        })
    }

    _async.series(
        [updateUserInfo.bind(),
        addIntoWallet.bind()],
        (err) => {
            helpAdaptor.logWriter(responseObj, "walle_credit_RS" + currentTime, "transactions")
            return callback(responseObj)
        })
}

// Debit the balance from wallet
const DebitWallet = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in add data to wallet'
    }

    // Update user wallet amount
    let updateUserInfo = (cb) => {
        _mongoose.models['Users'].findOne({ 'uid': body.userId }, (e, s) => {
            if (s) {
                if (s.walletBalance && s.walletBalance >= parseInt(body.amount)) {
                    s.walletBalance -= parseFloat(body.amount);
                    new _mongoose.models['Users'](s).save((e, s) => {
                        if (!e && s) {
                            responseObj.status = _status.SUCCESS
                            responseObj.message = 'Debited from wallet successfully'
                        } else {
                            responseObj.message = 'db error'
                            helpAdaptor.logWriter(responseObj, "wallet_debit_RS" + currentTime, "transactions")
                            return callback(responseObj)
                        }
                    })
                    return cb();
                } else {
                    responseObj.status = _status.ERROR
                    responseObj.message = 'Insufficient wallet balance'
                    helpAdaptor.logWriter(responseObj, "wallet_debit_RS" + currentTime, "transactions")
                    return callback(responseObj)
                }

            } else {
                responseObj.message = 'db error'
                helpAdaptor.logWriter(responseObj, "wallet_debit_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        })
    }


    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(body, "wallet_debit_RQ" + currentTime, "transactions")
    let subtractFromWallet = (cb) => {
        let transactionId = randomstring.generate({
            length: 7,
            charset: 'alphanumeric',
            // capitalization: 'uppercase'
        })

        let walletInfo = new _mongoose.models['WalletInfo']();
        walletInfo.status = true;
        walletInfo.currency = 'SAR';
        walletInfo.amount = parseFloat(body.amount);
        walletInfo.transactionId = transactionId;
        walletInfo.transactionType = 'debit';
        walletInfo.userId = body.userId;
        walletInfo.desciption = body.description;
        walletInfo.requestId = body.requestId

        walletInfo.save((e, s) => {
            if (s) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'Debited from wallet successfully'
                responseObj.response = s
                return cb();
            } else {
                responseObj.message = 'db error'
                helpAdaptor.logWriter(responseObj, "wallet_debit_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        })
    }

    _async.series(
        [updateUserInfo.bind(), subtractFromWallet.bind()],
        (err) => {
            helpAdaptor.logWriter(responseObj, "walle_debit-" + currentTime, "transactions")
            return callback(responseObj)
        })
}

//fetching the user data with wallet history
const getWalletInfo = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error',
        response: {}
    }

    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(body, "wallet_info_RQ" + currentTime, "transactions")


    let getwallethistory = (cb) => {
        let walletBalance = 0
        let walletHistory = []
        _mongoose.models['WalletInfo'].find({ userId: body.userId }, ['amount', 'currency', 'transactionId', 'transactionType', 'createdAt'], (err, docs) => {
            if (!err && docs) {
                docs.forEach(d => {
                    let obj = {}
                    obj.amount = parseFloat(d.amount).toFixed(2);
                    obj.currency = d.currency
                    obj.transactionId = d.transactionId
                    obj.transactionType = d.transactionType
                    obj.date = _moment(d.createdAt).format('DD-MM-YYYY h:mm A')
                    walletHistory.push(obj)
                    if (d.transactionType == 'credit') {
                        walletBalance += d.amount
                    } else {
                        walletBalance -= d.amount
                    }

                });
                responseObj.status = _status.SUCCESS
                responseObj.response.walletHistory = walletHistory
                responseObj.response.walletBalance = parseFloat(walletBalance).toFixed(2);
                responseObj.message = 'success'
                return cb();
            } else {
                responseObj.message = 'db error'
                helpAdaptor.logWriter(responseObj, "wallet_info_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        }).sort({ createdAt: -1 })
    }

    _async.parallel([getwallethistory.bind()], (err) => {
        helpAdaptor.logWriter(responseObj, "wallet_info_RS" + currentTime, "transactions")
        return callback(responseObj)
    })
}

//total wallet info and for single wallet info as per transactionId
const totalWalletInfo = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: "error in fetching wallet data",
        response: null
    }
    body['offset'] = (body.offset) ? body.offset : 0
    body['limit'] = (body.limit) ? body.limit : 10

    let filter = {}

    let searchKey = {}
    if (body.key && body.key != '') {
        let key = body.key.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '')
        searchKey['$or'] = [
            { 'transactionId': new RegExp(key, 'i') },
            { 'fullName': new RegExp(key, 'i') }
        ]
    }
    if (body && body.transactionId) {
        filter = {}
        filter.transactionId = body.transactionId
    }

    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(body, "total_wallet_info_RQ" + currentTime, "transactions")

    let totalCount = (cb) => {
        let agg = _mongoose.models['WalletInfo']["totalWalletInfo"](filter, searchKey, { lang: "en", count: true });
        _mongoose.models['WalletInfo'].aggregate(agg).exec((err, data) => {
            if (!err && data) {
                responseObj.total = data[0]
                return cb()
            }
            helpAdaptor.logWriter(responseObj, "total_wallet_info_RS" + currentTime, "transactions")
            return callback(responseObj);
        });
    }

    let walletData = (cb) => {
        let agg = _mongoose.models['WalletInfo']["totalWalletInfo"](filter, searchKey, { lang: "en", count: false });
        _mongoose.models['WalletInfo'].aggregate(agg).skip(body.offset).limit(body.limit).exec((err, data) => {
            if (!err && data) {
                let temp = JSON.parse(JSON.stringify(data))
                for (let d of temp) {
                    d.createdAt = _moment(d.createdAt).format('DD/MM/YYYY hh:mm a')
                }

                responseObj.message = "wallet data"
                responseObj.response = temp
                responseObj.status = _status.SUCCESS;
                return cb()
            }
            helpAdaptor.logWriter(responseObj, "total_wallet_info_RS" + currentTime, "transactions")
            return callback(responseObj);
        });
    }
    _async.series([
        totalCount.bind(),
        walletData.bind(),
    ],
        (err) => {
            helpAdaptor.logWriter(responseObj, "total_wallet_info_RS" + currentTime, "transactions")
            return callback(responseObj)
        })
}
// saving banking info of user
const saveBankInformation = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: "Error in storing bank information.",
        //message: lang["errInStoreBankInfo"][body.lang],
        response: null
    }

    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(body, "save_bank_info_RQ" + currentTime, "transactions")

    if (!(body && body.accountName && body.accountNumber && body.bankName && body.iban)) {
        responseObj.message = "Error in getting required fields"
        //responseObj.message = lang["errInRequiredFields"][body.lang]
        return callback(responseObj);
    }
    let bankInfo = {
        accountName: body.accountName,
        accountNumber: body.accountNumber,
        bankName: body.bankName,
        iban: body.iban,
        userId: body.uid
    }

    _mongoose.models['BankInfo'].findOne({ userId: body.uid }).exec((err, data) => {
        if (!err && data) {
            _mongoose.models['BankInfo'].update({ userId: body.uid }, { $set: bankInfo }, { upsert: true }).exec((err, data) => {
                if (!err && data) {
                    responseObj.status = _status.SUCCESS;
                    responseObj.message = "Success";
                }
                helpAdaptor.logWriter(responseObj, "save_bank_info_RS" + currentTime, "transactions")
                return callback(responseObj);
            });
        } else {
            _mongoose.models["BankInfo"](bankInfo).save((e, s) => {
                if (e && !s) {
                    return callback(responseObj);
                }
                responseObj.status = _status.SUCCESS
                responseObj.message = 'success'
                return callback(responseObj);
            })
        }
    })
}

// get bank detail of user
const bankDetails = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        //message: "Error in getting bank information.",
        message: lang["errIngettingBankInfo"][body.lang],
        response: null
    }

    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(body, "bank_details_RQ" + currentTime, "transactions")

    let filter = { userId: body.uid };
    _mongoose.models['BankInfo'].findOne(filter).exec((err, data) => {
        if (err) {
            responseObj.message = "db error"
            helpAdaptor.logWriter(responseObj, "bank_details_RS" + currentTime, "transactions")
            return callback(responseObj);
        }
        if (!err && data) {
            responseObj.status = _status.SUCCESS;
            responseObj.message = "Success";
            responseObj.response = data
        } else {
            responseObj.status = _status.SUCCESS;
            responseObj.message = "Bank details are not available";
            responseObj.response = data
        }
        helpAdaptor.logWriter(responseObj, "bank_details_RS" + currentTime, "transactions")
        return callback(responseObj);
    });
}

/**
 * Gives the total information about traveller's transaction by there trips
 */
const travellerAccount = (body, callback) => {

    let responseObj = {
        status: _status.ERROR,
        //message: 'Error in getting carrier transaction',
        message: lang["errInGettingCarrierTxn"][body.lang],
        response: null
    }

    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(body, "traveller_acc_RQ" + currentTime, "transactions")

    _mongoose.models['TravellerAccount'].find({ 'carrierUid': body.userInfo.uid }).exec((err, docs) => {
        let currentBalance = 0
        let totalTransferred = 0
        let totalDocEarnings = 0
        let totalPkgEarnings = 0
        let transactions = []
        if (!err && docs.length) {
            for (let d of docs) {
                currentBalance = currentBalance + d.amount
                if (d.transactionType == 'debit') {
                    d.amount = Math.abs(d.amount)
                    totalTransferred = totalTransferred + d.amount
                    transactions.push({
                        transactionId: d.transactionId,
                        date: _moment(d.date).format('DD-MM-YYYY h:mm A'),
                        amount: d.amount,
                        currency: d.cur
                    })
                }
                if (d.requestType && d.requestType == 'package' && d.status == 'unprocessed') {
                    totalPkgEarnings = totalPkgEarnings + d.amount
                }
                if (d.requestType && d.requestType == 'document' && d.status == 'unprocessed') {
                    totalDocEarnings = totalDocEarnings + d.amount
                }
            }
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Success'
        } else if (!err && docs.length === 0) {
            responseObj.status = _status.SUCCESS
            responseObj.message = 'No Data Available'
        } else {
        }
        responseObj.response = {
            currency: 'SAR',
            currentBalance: currentBalance,
            totalTransferred: totalTransferred,
            totalDocEarnings: totalDocEarnings,
            totalPkgEarnings: totalPkgEarnings,
            transactions: transactions
        }
        helpAdaptor.logWriter(responseObj, "traveller_acc_RS" + currentTime, "transactions")
        return callback(responseObj);
    })
}

/**
 * add entry of traveler payment for trip and
 * change status to unprocessed to processed 
 */
const transferEarnings = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in updating Traveller Account',
        response: {}
    }

    let currentTime = new Date().getTime()

    if (!body.tripId || !body.transactionId || !body.referenceId) {
        responseObj.message = "Incomplete data"
        return callback(responseObj)
    }

    let obj = {
        "status": "processed",
        "tripId": body.tripId,
        "cur": "SAR",
        "amount": 0,
        "carrierUid": 0,
        "transactionId": body.transactionId,
        "referenceId": body.referenceId,
        "remarks": body.remark,
        "transactionType": "debit",
    }

    helpAdaptor.logWriter(body, "transfer_earning_RQ" + currentTime, "transactions")

    let totalAmount = (cb) => {
        _mongoose.models['TravellerAccount'].find({ "tripId": body.tripId }, (err, data) => {
            if (!err && data && data.length) {
                for (let d of data) {
                    if (d.transactionType == "debit") {
                        responseObj.message = "Payment already done"
                        return callback(responseObj);
                    } else {
                        obj.amount += d.amount
                        obj.carrierUid = d.carrierUid
                    }
                }
                return cb()
            } else {
                return callback(responseObj)
            }
        })
    }

    let addPaymentEntry = (cb) => {
        _mongoose.models['TravellerAccount'].create(obj, (err, data) => {
            if (!err && data) {
                responseObj.status = _status.SUCCESS,
                    responseObj.message = 'Saved entry successfully to Traveller Account',
                    responseObj.response = data
                return cb();
            } else {
                helpAdaptor.logWriter(responseObj, "transfer_earning_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        })
    }

    let updateStatus = (cb) => {
        let filter = {
            tripId: body.tripId,
        }
        _mongoose.models['TravellerAccount'].updateMany(filter, { status: 'processed' }, (err, data) => {
            if (!err && data) {
                responseObj.status = _status.SUCCESS,
                    responseObj.message = 'Status updated successfully'
                return cb();
            } else {
                helpAdaptor.logWriter(responseObj, "transfer_earning_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        })
    }

    let changeTripStatus = (cb) => {
        let filter = { tripId: body.tripId };
        _mongoose.models['Trip'].findOneAndUpdate(filter, { status: "paid" }, { upsert: true }).exec((err, data) => {
            if (!err && data) {
                notifications.notify({type: 'tripPayment', carryId: '', tripId: body.tripId}, () => {
                    // console.log('notify')
                })
                return cb();
            } else {
                helpAdaptor.logWriter(responseObj, "transfer_earning_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        });
    }

    _async.series([
        totalAmount.bind(),
        addPaymentEntry.bind(),
        updateStatus.bind(),
        changeTripStatus.bind(),
    ], (err, res) => {
        helpAdaptor.logWriter(responseObj, "transfer_earning_RS" + currentTime, "transactions")
        return callback(responseObj)
    });
}

//fetch comleted trips data
const compledtTripsData = (body, callback) => {

    let responseObj = {
        status: _status.ERROR,
        message: 'Error in fetching trip data',
        response: {}
    }
    let searchKey = {}
    body['offset'] = (body.offset) ? body.offset : 0
    body['limit'] = (body.limit) ? body.limit : 10

    if (body.key && body.key != '') {
        let key = body.key.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '')
        searchKey['$or'] = [
            { 'tripId': new RegExp(key, 'i') },
            { 'user.name': new RegExp(key, 'i') },
        ]
    }

    let filter = {
        status: { '$in': ['completed'] },
    }

    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(body, "completed_trips_RQ" + currentTime, "transactions")

    let tripsCount = (cb) => {
        let agg = _mongoose.models['Trip']["compledtTripsData"](filter, searchKey, { lang: "en", count: true });
        _mongoose.models['Trip'].aggregate(agg).exec((err, docs) => {
            if (!err && docs && docs.length) {
                responseObj.response.total = docs[0].count
            }
            return cb();
        })
    }

    let totalTrips = (cb) => {
        let agg = _mongoose.models['Trip']["compledtTripsData"](filter, searchKey, {});
        _mongoose.models['Trip'].aggregate(agg).skip(body.offset).limit(body.limit).exec((err, data) => {
            if (!err && data && data.length) {
                responseObj.response.trips = data
                responseObj.status = _status.SUCCESS
                responseObj.message = "total completed trips."
                return cb()
            } else if (data.length == 0) {
                responseObj.status = _status.SUCCESS
                responseObj.message = "No data available"
                helpAdaptor.logWriter(responseObj, "completed_trips_RS" + currentTime, "transactions")
                return callback(responseObj)
            } else {
                helpAdaptor.logWriter(responseObj, "completed_trips_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        })
    }

    _async.series([
        tripsCount.bind(),
        totalTrips.bind(),
    ], (err, res) => {
        helpAdaptor.logWriter(responseObj, "completed_trips_RS" + currentTime, "transactions")
        return callback(responseObj)
    });

}

//fetch paid trips data
const paidTripsData = (body, callback) => {

    let responseObj = {
        status: _status.ERROR,
        message: 'Error in fetching trip data',
        response: {}
    }
    let searchKey = {}
    body['offset'] = (body.offset) ? body.offset : 0
    body['limit'] = (body.limit) ? body.limit : 10
    if (body.key && body.key != '') {
        let key = body.key.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '')
        searchKey['$or'] = [
            { 'tripId': new RegExp(key, 'i') },
            { 'user.name': new RegExp(key, 'i') },
            { 'travellerAccount.transactionId': new RegExp(key, 'i') },
            { 'travellerAccount.referenceId': new RegExp(key, 'i') }
        ]
    }

    let filter = {
        status: { '$in': ['paid'] },
    }

    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(body, "paid_trips_RQ" + currentTime, "transactions")

    let tripsCount = (cb) => {
        let agg = _mongoose.models['Trip']["paidTripsData"](filter, searchKey, { lang: "en", count: true });
        _mongoose.models['Trip'].aggregate(agg).exec((err, docs) => {
            if (!err && docs && docs.length) {
                responseObj.response.total = docs[0].count
            }
            return cb();
        })
    }

    let totalTrips = () => {
        let agg = _mongoose.models['Trip']["paidTripsData"](filter, searchKey, {});
        _mongoose.models['Trip'].aggregate(agg).skip(body.offset).limit(body.limit).exec((err, data) => {
            if (!err && data && data.length) {
                responseObj.response.trips = data
                responseObj.status = _status.SUCCESS
                responseObj.message = "Total paid trips"
                return callback(responseObj)
            } else if (data.length == 0) {
                responseObj.status = _status.SUCCESS
                responseObj.message = "no data available"
                helpAdaptor.logWriter(responseObj, "paid_trips_RS" + currentTime, "transactions")
                return callback(responseObj)
            } else {
                helpAdaptor.logWriter(responseObj, "paid_trips_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        })
    }

    _async.series([
        tripsCount.bind(),
        totalTrips.bind(),
    ], (err, res) => {
        helpAdaptor.logWriter(responseObj, "paid_trips_RS" + currentTime, "transactions")
        return callback(responseObj)
    });

}

//single completed trip data
const singleCompledtTripData = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in fetching trip data',
        response: {}
    }

    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(body, "single_completed_trip_RQ" + currentTime, "transactions")

    let cityIds = []
    let userIds = []
    let tripUser = ''
    let response = {}
    let getTripInfo = (cb) => {
        let filter = {
            tripId: body.tripId
        }
        if (body.type == "completed") {
            filter.status = "completed"
        } else if (body.type == "paid") {
            filter.status = "paid"
        } else {
            return callback(responseObj)
        }

        let agg = _mongoose.models['Trip']["singleCompledtTripData"](filter, {}, {});
        _mongoose.models['Trip'].aggregate(agg).exec((err, data) => {

            if (!err && data && data.length) {
                response = data
                response[0].bankDetails = {}
                tripUser = data[0].userId
                for (let d of data) {
                    cityIds.push(parseInt(d.from))
                    cityIds.push(parseInt(d.to))
                    userIds = d.carryRqsts.users
                }
                return cb()
            } else if (data != undefined && data.length == 0) {
                responseObj.status = _status.SUCCESS
                responseObj.message = "No data available"
                helpAdaptor.logWriter(responseObj, "single_completed_trip_RS" + currentTime, "transactions")
                return callback(responseObj)
            } else {
                helpAdaptor.logWriter(responseObj, "single_completed_trip_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        })
    }

    let bankInfo = (cb) => {
        _mongoose.models["BankInfo"].find({ userId: tripUser }, {
            "_id": 0,
            "userId": 1,
            "accountName": 1,
            "accountNumber": 1,
            "bankName": 1,
            "iban": 1,
        }).exec((err, data) => {
            if (!err && data && data.length) {
                let temp = JSON.parse(JSON.stringify(data[0]))
                temp.transactionId = ''
                temp.referenceId = ''
                response[0].bankDetails = temp
                return cb()
            } else if (!err && data.length == 0) {
                response[0].bankDetails = {
                    "accountName": null,
                    "accountNumber": null,
                    "bankName": null,
                    "iban": null,
                    "transactionId": '',
                    "referenceId": ''
                }
                return cb()
            } else {
                return callback(responseObj)
            }
        })
    }

    let citys = []
    let getCityData = (cb) => {
        let params = {
            lang: "en",
            cityIds: cityIds
        }
        let agg = _mongoose.models["CityPredictive"]["cityName"]({}, {}, params)
        _mongoose.models["CityPredictive"].aggregate(agg).exec((err, docs) => {

            if (docs && docs.length) {
                citys = common.arrayTomap(docs, "cityId", true)
                return cb()
            } else {
                helpAdaptor.logWriter(responseObj, "single_completed_trip_RS" + currentTime, "transactions")
                return callback(responseObj)
            }

        })
    }

    let transactionId = ''
    let referenceId = ''
    let users = []
    let userName = (cb) => {
        _mongoose.models['Users'].find({ 'uid': userIds }, ["fname", "lname", "uid"], (e, s) => {
            if (s && s.length) {
                users = common.arrayTomap(s, "uid", true)
                return cb();
            } else {
                responseObj.message = 'db error'
                helpAdaptor.logWriter(responseObj, "single_completed_trip_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        })
    }

    _async.series([
        getTripInfo.bind(),
        bankInfo.bind(),
        getCityData.bind(),
        userName.bind(),
    ], () => {
        helpAdaptor.logWriter(responseObj, "single_completed_trip_RS" + currentTime, "transactions")

        for (let d of response) {
            d.from = `${citys[d.from].name}, ${citys[d.from].country}`
            d.to = `${citys[d.to].name}, ${citys[d.to].country}`
            d.depDate = `${_moment(d.depDate, "YYYY-MM-DD").format('DD/MM/YYYY')} ${_moment(d.depTime, 'HH:mm').format("hh:mm a")}`
            d.arrDate = `${_moment(d.arrDate, "YYYY-MM-DD").format('DD/MM/YYYY')} ${_moment(d.arrTime, 'HH:mm').format("hh:mm a")}`
            d.requestchrg = 0
            d.pickUpFee = 0
            d.deliveryFee = 0
            d.commission = 0
            for (let b of d.bookingPriceInfo) {
                d.requestchrg = parseFloat( +d.requestchrg + b.carryFee + b.commissionFee).toFixed(2)
                d.pickUpFee += b.pickFee
                d.deliveryFee += b.dropFee
                d.commission += b.commissionFee
                d.currency = b.currency
            }

            for (let c of d.carryRqsts.carryRequests) {
                if (users && users[c.name] && users[c.name].fname && users[c.name].lname) {
                    c.name = users[c.name].fname + ' ' + users[c.name].lname
                }
                if (c.transactionId && c.transactionType == "debit") {
                    d.bankDetails.transactionId = c.transactionId
                    transactionId = c.transactionId
                }

                if (c.transactionType == "debit" && c.referenceId) {
                    d.bankDetails.referenceId = c.referenceId
                    referenceId = c.referenceId
                }

                if (c.transactionType == "debit") {
                    var index = d.carryRqsts.carryRequests.indexOf(c);
                    if (index > -1) {
                        d.carryRqsts.carryRequests.splice(index, 1);
                    }
                }
            }
            d.amount = d.carryRqsts.amount;
            d.totalRequest = d.carryRqsts.carryRequests.length
            d.currency = d.currency;
            d.requestDetails = d.carryRqsts.carryRequests
            delete d["bookingPriceInfo"]
            delete d["depTime"]
            delete d["arrTime"]
            delete d["carryRqsts"]
        }
        responseObj.status = _status.SUCCESS
        responseObj.message = "success"
        responseObj.response = response[0]
        responseObj.response.transactionId = transactionId
        responseObj.response.referenceId = referenceId

        return callback(responseObj)
    });
}

// single requester data for accounts
let singleRqsterData = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in fetching requester data',
        response: null
    }

    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(body, "single_requester_data_RQ" + currentTime, "transactions")

    if (!body || !body.carryId) {
        responseObj.message = "Incomplete data"
        return callback(responseObj)
    }
    let invoiceIds = []
    let getrqsterInfo = (cb) => {
        let filter = {
            carryId: body.carryId
        }
        let agg = _mongoose.models['CarryRequests']["singleRqsterData"](filter, body.carryId, {});
        _mongoose.models['CarryRequests'].aggregate(agg).exec((err, data) => {
            if (!err && data && data.length) {
                for (let d of data) {
                    d.currency = d.amount.cur
                    d.requestchrg = 0
                    d.pickUpFee = 0
                    d.deliveryFee = 0
                    d.commission = 0
                    d.invoiceAmount = 0
                    d.invoices = []
                    d.amount = d.amount.amount
                    d.rqstedDate = _moment(d.rqstedDate, 'DD/MM/YYYY').format('DD/MM/YYYY hh:mm a')
                    d.droppedDate = _moment(d.droppedDate, 'DD/MM/YYYY').format('DD/MM/YYYY hh:mm a')
                    for (let b of d.bookingPriceInfo) {
                        if (b.invoiceId) {
                            invoiceIds.push(b.invoiceId)
                            d.requestchrg -= (b.carryFee + b.commissionFee)
                        }
                        d.requestchrg += (b.carryFee + b.commissionFee)
                        d.pickUpFee += b.pickFee
                        d.deliveryFee += b.dropFee
                        d.commission += b.commissionFee
                    }
                    delete d["bookingPriceInfo"]
                }
                responseObj.status = _status.SUCCESS
                responseObj.message = "success"
                responseObj.response = data
                return cb()
            } else if (data.length == 0) {
                responseObj.status = _status.SUCCESS
                responseObj.message = "data not available"
                helpAdaptor.logWriter(responseObj, "single_requester_data_RS" + currentTime, "transactions")
                return callback(responseObj)
            } else {
                helpAdaptor.logWriter(responseObj, "single_requester_data_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        })
    }

    let getInvoiceData = (cb) => {
        let filter = {
            invoiceId: { $in: invoiceIds }
        }
        _mongoose.models['Invoice'].find(filter, ["invoiceId", "carryId", "extraPayFare", "weight", "extraWeight", "updatedAt", "currency"], (err, docs) => {
            if (!err && docs && docs.length) {
                for (let d of docs) {
                    let obj = JSON.parse(JSON.stringify(d));
                    obj.updatedAt = _moment(d.updatedAt, "DD/MM/YYYY").format("DD/MM/YYYY - hh:mm a")
                    responseObj.response[0]['invoiceAmount'] += d.extraPayFare
                    responseObj.response[0]['invoices'].push(obj)
                }
                return cb();
            } else if (docs.length == 0) {
                return cb();
            } else {
                helpAdaptor.logWriter(responseObj, "single_requester_data_RS" + currentTime, "transactions")
                return callback(responseObj)
            }
        })
    }

    _async.series([
        getrqsterInfo.bind(),
        getInvoiceData.bind()
    ], () => {
        helpAdaptor.logWriter(responseObj, "single_requester_data_RS" + currentTime, "transactions")
        return callback(responseObj)
    });

}

//bank data for payment
const payForTrip = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in fetching payment data',
        response: {}
    }

    let currentTime = new Date().getTime()
    helpAdaptor.logWriter(body, "pay_For_Trip_RQ" + currentTime, "transactions")

    if (!body || !body.tripId) {
        responseObj.message = "Incomplete data"
        return callback(responseObj)
    }


    let filter = {
        tripId: body.tripId
    }
    let result = {
        "tripId": body.tripId,
        "name": null,
        "accountNumber": null,
        "bankName": null,
        "IBAN": null,
        "currency": null,
        "amount": null,
    }
    let carrierUid = ''
    const amount = (cb) => {
        _mongoose.models['TravellerAccount'].find(filter, {
            "_id": 0,
            "cur": 1,
            "carrierUid": 1,
            "amount": 1,
        }, (err, data) => {
            if (!err && data) {
                // return callback(responseObj)
                for (let d of data) {
                    result.amount += d.amount
                    result.currency = d.cur
                    carrierUid = d.carrierUid
                }
                return cb()
            }else {
                return callback(responseObj)
            }
        })
    }

    const bankDetails = (cb) => {
        _mongoose.models['BankInfo'].findOne({ userId: carrierUid }, {}, (err, data) => {
            if (!err && data) {
                result.name = data.accountName
                result.accountNumber = data.accountNumber
                result.bankName = data.bankName
                result.IBAN = data.iban
                // responseObj.response = data
            } else if (err) {
                return callback(responseObj)
            }
            return cb();
        })
    }

    _async.series([
        amount.bind(),
        bankDetails.bind()
    ], () => {
        responseObj.status = _status.SUCCESS
        responseObj.message = 'payment details'
        responseObj.response = result
        return callback(responseObj)
    });
}
const sendMail = (body, callback) => {
    let data = {
        data: {
            name: body.name,
            // email: body.email
            number:body.number,
            password : body.password
        },
        body: {
            template: "newUser",
            toemail: body.email,
            subject: "demo testing mail.."
        }
    }

    let emailInfo = {
        emailType: 'demo',
        isSend: false,
        data: data
    }

    mailer.sendMail(data, function (res) {
        if (res && res.status == 1000) {
            emailInfo.isSend = true
        } else {
            emailInfo.isSend = false
        }
        _mongoose.models['Emails'].create(emailInfo, (err, data) => {
            if (!err && data) {
                return callback(res)

            } else {
                res.status = 1001
                return callback(res)
            }
        })
    })
}


module.exports = {
    CreditWallet,
    DebitWallet,
    getWalletInfo,
    totalWalletInfo,
    saveBankInformation,
    bankDetails,
    travellerAccount,
    transferEarnings,
    compledtTripsData,
    paidTripsData,
    singleCompledtTripData,
    singleRqsterData,
    payForTrip,
    sendMail
}