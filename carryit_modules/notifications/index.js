const axios = require('axios')
const smsController = require('../../libs/sms')
const mailer = require('../../libs/mailer')

const notify = (args, callback) => {

    let title = ''
    let lang = 'en'
    let notifyToTvlr = false
    let emailTemplate = null
    let obj = {
        notificationType: args.type,
        userId: '',
        requestType: '',
        message: '',
        status: 'unread',
        shipmentDetails: {},
        tripDetails: {}
    }

    if (args.type == 'newRequest') {
        obj.message = { en: 'Hey, you have a new request', ar: 'مرحبًا ، لديك طلب جديد' }
        title = { en: 'New Request', ar: 'تنبيه جديد' }
        notifyToTvlr = true
        emailTemplate = 'shipment-request'
    } else if (args.type == 'decline') {
        title = { en: 'Request declined', ar: 'تم رفض الطلب' }
        obj.message = { en: 'Your request is declined, the amount will be refunded shortly', ar: 'تم رفض طلبك، سيتم إعادة المبلغ قريبًا' }
        // emailTemplate = ''
    } else if (args.type == 'cancel') {
        title = { en: 'Request cancelled', ar: 'تم إلغاء الطلب' }
        obj.message = { en: 'Sorry, your request has been cancelled, the amount will be refunded shortly', ar: 'عفواً، تم إلغاء طلبك،  سيتم إعادة المبلغ قريبًا' }
    } else if (args.type == 'confirm') {
        title = { en: 'Request confirmed', ar: 'تم تأكيد الطلب' }
        obj.message = { en: 'Hey, Your request has been confirmed successfully', ar: 'مرحبًا، تم تأكيد طلبك بنجاح' }
        emailTemplate = 'package-ready-pickup'
    } else if (args.type == 'pickup') {
        title = { en: 'Picked Up successfully', ar: 'تم الإستلام بنجاح' }
        obj.message = { en: 'Your shipment has been picked up successfully', ar: 'تم إستلام شحنتك بنجاح' }
    } else if (args.type == 'delivered') {
        title = { en: 'Delivered successfully', ar: 'تم التوصيل بنجاح' }
        obj.message = { en: 'Your shipment has been delivered successfully', ar: 'تم توصيل شحنتك بنجاح' }
        emailTemplate = 'successfully-delivered'
    } else if (args.type == 'tripCompleted') {
        title = { en: 'Trip Completed', ar: 'اكتملت الرحل' }
        notifyToTvlr = true
        obj.message = { en: 'Congratulations, your trip is completed', ar: 'تهانينا، لقد اكتملت رحلتك' }
    } else if (args.type == 'tripPayment') {
        notifyToTvlr = true
        title = { en: 'Earning Transferred', ar: 'تم تحويل المبلغ' }
        obj.message = { en: 'Trip earnings have been tranferred to your account', ar: 'سيتم تحويل المبلغ الذي حصلت عليه الى حسابك' }
    } else if (args.type == 'newInvoice') {
        title = { en: 'New Invoice', ar: 'فاتورة جديدة' }
        obj.message = { en: 'An Invoice has been raised', ar: 'تم إصدار الفاتورة' }
    } else if (args.type == 'invoicePayment') {
        notifyToTvlr = true
        title = { en: 'Invoice Payment Done', ar: 'تم دفع الفاتورة' }
        obj.message = { en: 'The invoice paymnet has been done', ar: 'تم دفع مبلغ الفاتورة' }
    } else {
        title = { en: 'New Notification', ar: 'تنبيه جديد ' }
        obj.message = { en: 'You have a new notification', ar: 'لديك تنبيه جديد' }
    }
    // traveller details
    let getTravellerDetails = (cb) => {
        _mongoose.models['Trip'].findOne({ tripId: args.tripId }, (err, doc) => {
            if (!err && doc) {
                if (notifyToTvlr) {
                    obj.userId = doc.userId,
                        lang = (doc.lang) ? doc.lang : 'en'
                }
                _mongoose.models['Users'].findOne({ uid: doc.userId }, (error, user) => {
                    obj.tripDetails['userid'] = user.uid
                    obj.tripDetails['name'] = user.fname + ' ' + user.lname
                    obj.tripDetails['profilePic'] = user.pic
                    obj.tripDetails['tripId'] = args.tripId
                    return cb()
                })
            } else {
                return cb()
            }
        })
    }

    // requester details
    let getRequesterDetails = (cb) => {
        _mongoose.models['CarryRequests'].findOne({ carryId: args.carryId }, (err, doc) => {
            // obj.requestType = doc.type
            if (!err && doc) {
                if (!notifyToTvlr) {
                    obj.userId = doc.userId
                    lang = (doc.lang) ? doc.lang : 'en'
                }
                _mongoose.models['Users'].findOne({ uid: doc.userId }, (error, user) => {
                    obj.shipmentDetails['userid'] = user.uid
                    obj.shipmentDetails['name'] = user.fname
                    obj.shipmentDetails['profilePic'] = user.pic
                    obj.shipmentDetails['requestType'] = doc.type
                    obj.shipmentDetails['reqStatus'] = doc.status
                    obj.shipmentDetails['deliveryDate'] = doc.rmc.date
                    obj.shipmentDetails['carryId'] = args.carryId
                    obj.shipmentDetails['currency'] = 'SAR'
                    obj.shipmentDetails['deliverLoc'] = doc.rmc.location
                    return cb()
                })
            } else {
                return cb()
            }
        })
    }

    // earnings
    let calculateEarnings = (cb) => {
        /* let findBy = {}
        if (args.type == 'tripPayment' || args.type == 'tripCompleted') {
            findBy = {
                tripId: args.tripId,
                transactionType: 'debit'
            }
        } else {
            findBy = {
                requestId: args.carryId
            }
        } */
        if (args.type == 'tripPayment' || args.type == 'tripCompleted') {
            _mongoose.models['TravellerAccount'].find({ tripId: args.tripId, transactionType: 'credit' }, (err, docs) => {
                if (!err && docs) {
                    for (let d of docs) {
                        if (obj.tripDetails['earnings']) {
                            obj.tripDetails['earnings'] = obj.tripDetails['earnings'] + d.amount
                        } else {
                            obj.tripDetails['earnings'] = 0
                            obj.tripDetails['earnings'] = obj.tripDetails['earnings'] + d.amount
                        }
                    }
                    obj.tripDetails['currency'] = 'SAR'
                }
                return cb()
            })
        } else {
            _mongoose.models['BookingPriceInfo'].findOne({ carryId: args.carryId, invoiceId: { '$exists': false } }, (err, doc) => {
                if (!err && doc) {
                    obj.tripDetails['earnings'] = doc.totalFare
                    obj.tripDetails['currency'] = 'SAR'
                }
                return cb()
            })
        }
        /* _mongoose.models['TravellerAccount'].findOne(findBy, (err, doc) => {
            if (!err && doc) {
                obj.tripDetails['earnings'] = doc.amount
            }
            return cb()
        }) */
    }

    // invoice amount
    let invoiceAmount = (cb) => {
        if (args.invoiceId && args.invoiceId != '') {
            _mongoose.models['BookingPriceInfo'].findOne({ invoiceId: args.invoiceId }, (err, doc) => {
                if (!err && doc) {
                    obj.shipmentDetails['invoiceAmount'] = doc.payFare
                }
                return cb()
            })
        } else {
            return cb()
        }
    }

    // persist notification
    let persistNotification = (cb) => {
        _mongoose.models['Notifications'].create(obj, (err, doc) => {
            return cb()
        })
    }

    // delete old notifcations once request is delivered
    let deleteNotify = (cb) => {
        if (args.type == 'delivered') {
            _mongoose.models['Notifications'].deleteMany({ 'userId': obj.userId, 'shipmentDetails.carryId': args.carryId, 'shipmentDetails.reqStatus': { '$in': ['picked', 'confirmed'] } }, () => {

            })
        }
        if (args.type == 'confirm' || args.type == 'decline') {
            _mongoose.models['Notifications'].deleteMany({ 'userId': obj.tripDetails.userid, 'shipmentDetails.carryId': args.carryId, 'shipmentDetails.reqStatus': { '$in': ['awaiting'] } }, () => {

            })
        }
        return cb()
    }

    // send push notifcations
    let sendNotification = (cb) => {
        // get fcmToken
        let fcmTokenArr = []
        let getFCMToken = (lcb) => {
            _mongoose.models['FCMSchema'].find({ uid: obj.userId }, (err, fcmData) => {
                if (!err && fcmData.length) {
                    fcmTokenArr = fcmData;
                }
                return lcb()
            })
        }
        // Send Notification
        let notify = (lcb) => {
            let responseObj = {}
            // if (!fcmTokenArr.length > 0) return cb(responseObj);
            const baseURL = "https://fcm.googleapis.com/fcm/send"
            _.map(fcmTokenArr, function (v) {
                // Notification Payload
                const data = {
                    "priority": "high",
                    "to": v.fcmt,
                    "notification": {
                        title: title[lang],
                        body: obj.message[lang]
                    },
                    "data": {
                        notificationType: args.type,
                        carryId: args.carryId,
                        tripId: args.tripId
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
            return lcb()
        }

        _async.series([getFCMToken.bind(), notify.bind()], () => {
            return cb()
        })
    }
    // send sms notifications
    let sendSMSNotification = (cb) => {
        let smsReq = {
            userId: '',
            template: args.type,
            lang: lang
        }
        if (notifyToTvlr) {
            smsReq.userId = obj.tripDetails['userid']
        } else {
            smsReq.userId = obj.shipmentDetails['userid']
        }
        smsController.sendText(smsReq, () => {

        })
        return cb()
    }
    // send email notification - for optimisation later
    let sendEmailNotification = (cb) => {
        if (emailTemplate) {
            // send mail to user
            mailer.sendMail({
                // emailType: 'new_trip',
                template: emailTemplate,
                // subject: "New trip",
                userId: obj.userId,
                tripId: args.tripId,
                carryId: args.carryId,
                lang: lang
            }, () => {

            })
        }
        return cb()
    }
    //
    _async.series([
        // userInfo.bind(),
        function (lcb) {
            _async.parallel([
                getRequesterDetails.bind(),
                calculateEarnings.bind(),
                getTravellerDetails.bind(),
                invoiceAmount.bind()], () => {
                    return lcb()
                })
        },
        persistNotification.bind(),
        // getFCMToken.bind(),
        function (lcb) {
            _async.parallel([
                deleteNotify.bind(),
                sendNotification.bind(),
                sendSMSNotification.bind(),
                sendEmailNotification.bind()], () => {
                    return lcb()
                })
        }
    ], () => {
        return callback()
    })
}

const getUserNotifications = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in getting user notification details',
        response: {}
    }

    const totalNotification = (cb) => {
        _mongoose.models['Notifications'].aggregate([
            { "$match": { userId: body.userId } },
            { "$addFields": { "message": "$message." + body.lang } },
            { "$sort": { "createdAt": -1 } }
        ]).exec((err, data) => {
            if (err) {
                return callback(responseObj);
            } else if (_.isEmpty(data)) {
                responseObj.totalNotifications = 0;
                return cb()
            }
            responseObj.totalNotifications = data.length
            return cb()
        });
    }

    const notificationsList = (cb) => {
        body.offset = (body.offset) ? body.offset : 0;
        body.limit = (body.limit) ? body.limit : 10;
        _mongoose.models['Notifications'].aggregate([
            { "$match": { userId: body.userId } },
            { "$addFields": { "message": "$message." + body.lang } },
            { "$sort": { "createdAt": -1 } }
        ]).skip(body.offset).limit(body.limit).exec((err, data) => {
            if (err) {
                return callback(responseObj);
            } else if (_.isEmpty(data)) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'No new notifications'
                return callback(responseObj)
            }
            responseObj.response = data
            responseObj.message = 'success'
            responseObj.status = _status.SUCCESS
            return cb();
        });
    }
    _async.series([totalNotification.bind(), notificationsList.bind()], () => {
        return callback(responseObj);
    })
}

const deleteNotification = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in deleting user notification',
        response: {}
    }
    _mongoose.models['Notifications'].findByIdAndRemove(body._id).exec((err, data) => {
        if (err) {
            return callback(responseObj);
        } else if (_.isEmpty(data)) {
            responseObj.message = 'No notification found'
            return callback(responseObj)
        } else {
            responseObj.message = 'success';
            responseObj.status = _status.SUCCESS
            return callback(responseObj);
        }
    })
}

const addSmsTemplate = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in getting user notification details',
        response: {}
    }
    let obj = {
        template: body.template,
        en: body.en,
        ar: body.ar
    }
    _mongoose.models['SMSTemplates'].create(obj, (err, doc) => {
        if (!err && doc) {
            responseObj.status = _status.SUCCESS
            responseObj.message = 'SMS Template has been added successfully'
            responseObj.response = doc
        }
        return callback(responseObj)
    })
}

module.exports = {
    notify,
    getUserNotifications,
    deleteNotification,
    addSmsTemplate
}