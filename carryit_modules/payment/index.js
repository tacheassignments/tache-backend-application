'use strict'
/**
 * @author Hari, Nahl
 * @description payment module
 */
const checkout = require('../checkout')
    , randomstring = require('randomstring')
    , checkout_config = _config.checkout
    , common = require('../../libs/utils/common')
    , transactions = require('../transaction')
    , notifications = require('../notifications')
    , mailer = require('../../libs/mailer');

const Authorize = (req, callback) => {

    let walletChecked = req.body.walletChecked
    let totalWalletPay = req.body.totalWalletPay
    let paidByWalletAmt = req.body.paidByWalletAmt

    let getUserInfo = (cb) => {
        _mongoose.models['CarryRequests'].findOne({ carryId: req.body.carryId }, (e, d) => {
            if (!e && d) {
                let uid = d.userId
                _mongoose.models['Users'].findOne({ uid: uid }, (e, d) => {
                    if (!e && d) {
                        req.body.userInfo = d
                        return cb()
                    } else {
                        return callback({ status: 1001, message: 'Authorisation:Error in getting user information' })
                    }
                })
            } else {
                return callback({ status: 1001, message: 'Authorisation:Error in getting user information' })
            }
        })
    }

    let getPriceInfo = (cb) => {
        let f = {
            carryId: req.body.carryId,
            tripId: req.body.tripId
        }
        if (req.body.invoiceId && req.body.invoiceId != '') {
            f.invoiceId = req.body.invoiceId
        }
        _mongoose.models['BookingPriceInfo'].findOne(f, (e, d) => {
            if (!e && d) {
                req.body.priceInfo = d
                req.body.priceInfo.payable = req.body.priceInfo.payFare
            } else {
                return callback({ status: 1001, message: 'Authorisation:Error in getting price information' })
            }
            return cb()
        })
    }

    let getCardId = (cb) => {
        if (req.body.mId && !req.body.cardToken) {
            _mongoose.models['UserCards'].findById(req.body.mId, (e, d) => {
                if (!e && d) {
                    req.body.cardId = d.cardId
                    return cb()
                } else {
                    return callback({ status: 1001, message: 'Authorisation:Error in getting card information' })
                }
            })
        } else {
            return cb()
        }
    }

    // construct request if amount is paid via multiple gateways
    let multiGatewayPay = (cb) => {
        if (walletChecked && !totalWalletPay) {
            // set payable amount
            req.body.priceInfo.payable = req.body.priceInfo.payFare - paidByWalletAmt
            // set wallet deduct amount
            req.body.paidByWalletAmt = paidByWalletAmt
            // set paymentGateway to wallet plus card
            req.body.paymentGateway = 'wpc'
            return cb()
        } else if (walletChecked && totalWalletPay) {
            // set paymentGateway to wallet only
            req.body.paymentGateway = 'wo'
            return cb()
        } else {
            // set paymentGateway to card only
            req.body.paymentGateway = 'co'
            return cb()
        }
    }

    _async.series([
        getUserInfo.bind(),
        getPriceInfo.bind(),
        getCardId.bind(),
        multiGatewayPay.bind()
    ], () => {
        let chkoutRes = {}
        let checkoutAuth = (lcb) => {
            if (totalWalletPay) { return lcb() }
            checkout.authorize(req, (response) => {
                chkoutRes = response
                return lcb()
            })
        }

        let walletRes = {}
        let walletPayment = (lcb) => {
            if (!walletChecked) { return lcb() }
            PayByWallet(req, (response) => {
                walletRes = response
                return lcb()
            })
        }

        _async.series([walletPayment.bind(), checkoutAuth.bind()], () => {
            if (!walletChecked) {
                return callback(chkoutRes)
            } else if (totalWalletPay) {
                return callback(walletRes)
            } else {
                chkoutRes['walletStatus'] = walletRes
                return callback(chkoutRes)
            }
        })
    })
}

const Capture = (req, callback) => {

    let getChargeId = (cb) => {
        _mongoose.models['PaymentInfo'].findOne({ chargeId: req.chargeId }, (e, d) => {
            if (!e && d) {
                req.chargeId = d.chargeId
                return cb()
            } else {
                return callback({ status: 1001, message: 'Capture:Error in Capturing Payment' })
            }
        })
    }
    _async.series([getChargeId.bind()], (err, res) => {
        checkout.capture(req, (response) => {
            return callback(response)
        })
    })
}

const VoidPayment = (req, callback) => {

    let getChargeId = (cb) => {
        _mongoose.models['PaymentInfo'].findOne({ chargeId: req.chargeId }, (e, d) => {
            if (!e && d) {
                req.chargeId = d.chargeId
                return cb()
            } else {
                return callback({ status: 1001, message: 'Void:Error in Void Payment' })
            }
        })
    }

    _async.series([getChargeId.bind()], (err, res) => {
        checkout.voidPayment(req, (response) => {
            return callback(response)
        })
    })
}

const Refund = (req, callback) => {
    let getChargeId = (cb) => {
        _mongoose.models['PaymentInfo'].findOne({ chargeId: req.chargeId }, (e, d) => {
            if (!e && d) {
                req.chargeId = d.chargeId
                return cb()
            } else {
                return callback({ status: 1001, message: 'Refund:Error in Refund Payment' })
            }
        })
    }

    _async.series([getChargeId.bind()], (err, res) => {
        checkout.refund(req, (response) => {
            return callback(response)
        })
    })
}

const VerifyCheckout = (req, callback) => {
    checkout.verifyCheckout(req, (response) => {
        return callback(response)
    })
}

const CarryPrice = (req, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error in fetching carry price',
        response: {}
    }

    let getUserId = (cb) => {
        _mongoose.models['CarryRequests'].findOne({ carryId: req.body.carryId }, (e, d) => {
            if (!e && d) {
                let userId = d.userId
                _mongoose.models['Users'].findOne({ uid: userId }, (e, d) => {
                    if(!e && d) {
                        responseObj.response['walletBalance'] = d.walletBalance
                        _mongoose.models['UserCards'].find({ userId: userId }, 'lastFour bin bank cardScheme cardType', (err, docs) => {
                            if (!err && docs.length) {
                                responseObj.response['savedCards'] = docs
                            }
                            return cb()
                        })
                    } else {
                        responseObj.response['walletBalance'] = "Not available"
                        responseObj.response['savedCards'] = "Not available"
                        return cb();
                    }
                })
            } else {
                return cb()
            }
        })
    }
    let getPriceInfo = (cb) => {
        let filter = { carryId: req.body.carryId }
        if (req.body.invoiceId) {
            filter['invoiceId'] = req.body.invoiceId
        }
        _mongoose.models['BookingPriceInfo'].findOne(filter).exec((err, doc) => {
            if (!err && doc) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'carry price fetched successfully'
                responseObj.response['fare'] = doc.payFare
                responseObj.response['cur'] = doc.currency
                return cb()
            } else {
                return callback(responseObj)
            }
        })
    }

    _async.parallel([
        getUserId.bind(),
        getPriceInfo.bind()], () => {
            return callback(responseObj)
        })
}

// if payment is from wallet
const PayByWallet = (req, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error in fetching carry price',
        response: {}
    }
    let wallletTxnId = ''
    let debitAmount = (cb) => {
        if (req.body.paymentGateway == 'wpc') { return cb() }
        let reqObj = {
            status: true,
            currency: req.body.priceInfo.currency,
            amount: req.body.paidByWalletAmt,
            transactionType: 'debit',
            userId: req.body.userInfo.uid,
            desciption: 'payment',
            requestId: req.body.carryId
        }
        transactions.DebitWallet(reqObj, (res) => {
            let origin = req.headers.origin
            let mweb = ''
            let invoiceParam = ''
            wallletTxnId = res.response.transactionId
            if (req.body.mweb) {
                mweb = '&mweb=true'
            }
            if (req.body.invoiceId && req.body.invoiceId != '') {
                invoiceParam = '&invoiceId=' + req.body.invoiceId
            }
            if (res.status == 1000) {
                // return success response to payment
                responseObj.response.redirectUrl = origin + "/checkout/success?tripId=" + req.body.tripId + "&carryId=" + req.body.carryId + invoiceParam + mweb + '&svc=' + req.body.svc + '&pg=' + req.body.paymentGateway// successurl
                return cb()
            } else {
                // return fail response to payment
                responseObj.response.redirectUrl = origin + "/checkout/fail?tripId=" + req.body.tripId + "&carryId=" + req.body.carryId + invoiceParam + mweb // failUrl
                return cb()
            }
        })
    }

    let updatePaymentInfo = (cb) => {
        let paymentObj = {
            chargeId: '',
            paymentId: wallletTxnId ? wallletTxnId : 'NEG',
            requestId: req.body.carryId,
            requesterUid: req.body.userInfo.uid,
            status: 'Captured',
            amount: req.body.paidByWalletAmt,
            userCurrency: 'SAR',
            paymentCurrency: 'SAR',
            paymentMode: 'wallet',
            paymentGateway: 'wallet',
            invoiceId: (req.body.invoiceId) ? (req.body.invoiceId) : ''
        }
        _mongoose.models['PaymentInfo'].create(paymentObj, (err, docs) => {
            if (!err && docs) {
                console.log(docs)
            } else {
                // payment persistance failed
                let obj = {
                    collectionName: 'PaymentInfo',
                    persistingObj: JSON.stringify(paymentObj)
                }
                _mongoose.models['PersistenceFailure'].create(obj, () => { })
            }
            return cb()
        })
    }

    _async.series([
        debitAmount.bind(),
        updatePaymentInfo.bind()
    ], () => {
        responseObj.status = _status.SUCCESS
        responseObj.message = 'Wallet Payment Successful'
        return callback(responseObj)
    })
}

// refund amount to wallet
const refundToWallet = (req, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error in wallet refund',
        response: {}
    }
    // get refund details from wallet info
    let getRefundAmount = (cb) => {
        let findBy = {
            requestId: req.carryId,
            paymentMode: 'wallet',
            invoiceId: req.invoiceId ? req.invoiceId : ''
        }
        _mongoose.models['PaymentInfo'].findOne(findBy, (e, d) => {
            if (!e && d) {
                req.walletRefundInfo = d
                creditAmount(req, (res) => {
                    if (res.status === 1000) {
                        d.status = 'Refunded'
                        d.save((err, doc) => {
                            if (!err && doc) {
                                return cb()
                            } else {
                                return callback(responseObj)
                            }
                        })
                    } else {
                        return callback(responseObj)
                    }
                })
            } else {
                return callback(responseObj)
            }
        })
    }
    // credit back to wallet info
    let creditAmount = (req, cb) => {
        let reqObj = {
            status: true,
            currency: 'SAR',
            amount: req.walletRefundInfo.amount,
            transactionType: 'credit',
            userId: req.userInfo.uid,
            desciption: 'refund',
            requestId: req.carryId
        }
        transactions.CreditWallet(reqObj, (res) => {
            if (res.status == 1000) {
                return cb(res)
            }
        })
    }

    _async.series([
        getRefundAmount.bind()
    ], () => {
        responseObj.status = _status.SUCCESS
        responseObj.message = 'Wallet Refund Successful'
        return callback(responseObj)
    })
}

// update payment status after payment and generate random keys for pickup and dropoff
const UpdatePayment = (req, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error in updating payment status',
        response: null
    }
    let pickupId = randomstring.generate({
        length: 7,
        charset: 'alphanumeric',
        capitalization: 'uppercase'
    })
    let dropoffId = randomstring.generate({
        length: 7,
        charset: 'alphanumeric',
        capitalization: 'uppercase'
    })
    let lang = 'en';

    let authResponseObj = {}
    let verifyCheckout = (cb) => {
        if (req.body.paymentGateway === 'wo') { return cb() }
        checkout.verifyCheckout({ chargeId: req.body.sid }, (res) => {
            if (res && res.status == 1000) {
                authResponseObj = res.response
            }
            return cb()
        })
    }

    let updateWallet = (cb) => {
        if (req.body.paymentGateway !== 'wpc') { return cb() }
        _mongoose.models['PaymentInfo'].findOne({ requestId: req.body.carryId, paymentGateway: 'wallet' }, (err, doc) => {
            // let debitAmount = (cb) => {
            let reqObj = {
                status: true,
                currency: doc.userCurrency,
                amount: doc.amount,
                transactionType: 'debit',
                userId: doc.requesterUid,
                desciption: 'payment',
                requestId: doc.requestId
            }
            transactions.DebitWallet(reqObj, (res) => {
                // let origin = req.headers.origin
                // let mweb = ''
                let invoiceParam = ''
                let wallletTxnId = res.response.transactionId
                /* if (req.body.mweb) {
                    mweb = '&mweb=true'
                } 
                if (req.body.invoiceId && req.body.invoiceId != '') {
                    invoiceParam = '&invoiceId=' + req.body.invoiceId
                } */
                if (res.status == 1000) {
                    doc.paymentId = wallletTxnId
                    doc.save(() => {
                        return cb()
                    })
                    // return success response to payment
                    // responseObj.response.redirectUrl = origin + "/checkout/success?tripId=" + req.body.tripId + "&carryId=" + req.body.carryId + invoiceParam + mweb + '&svc=' + req.body.svc + '&pg=' + req.body.paymentGateway// successurl
                } else {
                    // return fail response to payment
                    // responseObj.response.redirectUrl = origin + "/checkout/fail?tripId=" + req.body.tripId + "&carryId=" + req.body.carryId + invoiceParam + mweb // failUrl
                    return cb()
                }
            })
            // }
        })
    }
    // update booking status to 103(confirmed)
    let updateBookingInfo = (cb) => {
        _mongoose.models['BookingInfo'].findOne({ carryId: req.body.carryId }, (e, d) => {
            if (!e && d) {
                if (req.body.invoiceId && req.body.invoiceId !== '') {
                    d.bookingStatus = 104 // capture status
                } else {
                    d.pickupId = 'P' + pickupId
                    d.dropoffId = 'D' + dropoffId
                    d.bookingStatus = 103 // authorised status
                    d.shippingStatus = 'pending'
                }
                d.save((err, doc) => {
                    return cb(null, null)
                })
            } else {
                return cb('db error', null)
            }
        })
    }

    // update Carry Request
    let reqUserId = ''
    let updateCarryRequest = (cb) => {
        if (req.body.invoiceId && req.body.invoiceId !== '') {
            return cb()
        } else {
            _mongoose.models['CarryRequests'].findOne({ carryId: req.body.carryId }, function (e, d) {
                if (!e && d) {
                    lang = d.lang
                    reqUserId = d.userId
                    d.pickupId = 'P' + pickupId
                    d.dropoffId = 'D' + dropoffId
                    d.paymentDate = new Date()
                    //d.status = 'pending'
                    d.status = 'awaiting'
                    d.save((err, doc) => {
                        return cb(null, null)
                    })
                } else {
                    return cb('db error', null)
                }
            })
        }
    }

    // update Trip status
    let carrierUid = ''
    let updateTripStatus = (cb) => {
        let pkgWtCurrent = 0;
        let docWtCurrent = 0;
        let pkgQtCurrent = 0;
        let docQtCurrent = 0;

        _mongoose.models['BookingInfo'].find({ tripId: req.body.tripId, transactionStatus: 201 }, (e, d) => {
            if (!e && d) {
                for (let i of d) {
                    pkgWtCurrent = pkgWtCurrent + i.pkgWt
                    docWtCurrent = docWtCurrent + i.docWt
                    pkgQtCurrent = pkgQtCurrent + i.pkgQt
                    docQtCurrent = docQtCurrent + i.docQt
                }
                // let availableFlag = null
                let docAvailability = false
                let pkgAvailability = false
                if (d[0].pkgQtMax > 0 && d[0].pkgWtMax > 0) {
                    pkgAvailability = (pkgWtCurrent >= d[0].pkgWtMax || pkgQtCurrent >= d[0].pkgQtMax) ? false : true
                }
                if (d[0].docQtMax > 0 && d[0].docWtMax > 0) {
                    docAvailability = (docWtCurrent >= d[0].docWtMax || docQtCurrent >= d[0].docQtMax) ? false : true
                }

                if (!docAvailability && !pkgAvailability) {
                    _mongoose.models['Trip'].findOneAndUpdate({ tripId: req.body.tripId }, { $set: { "status": 'filled' } }, (err, res) => {
                        if (!err && res) {
                            carrierUid = res.userId
                        }
                        return cb(null, null)
                    })
                } else {
                    return cb(null, null)
                }
            } else {
                return cb('db error', null)
            }
        })
    }

    // update invoice
    let updateInvoice = (cb) => {
        if (req.body.invoiceId && req.body.invoiceId !== '') {
            _mongoose.models['Invoice'].findOneAndUpdate({ invoiceId: req.body.invoiceId }, { $set: { "status": 'paid' } }, (err, res) => {
                if (!err && res && req.body.invoiceId) {

                }
                return cb()
            })
        } else {
            return cb()
        }
    }

    // update payment success statuses
    let updatePaymentInfo = (cb) => {
        if (req.body.paymentGateway === 'wo') { return cb() }
        let paymentObj = {
            chargeId: authResponseObj.id,
            paymentId: authResponseObj.reference,
            requestId: req.body.carryId,
            requesterUid: reqUserId,
            status: authResponseObj.status,
            amount: authResponseObj.amount / 100,
            userCurrency: 'SAR',
            paymentCurrency: authResponseObj.currency,
            paymentMode: authResponseObj.source.type,
            paymentGateway: 'checkout',
            invoiceId: (req.body.invoiceId) ? (req.body.invoiceId) : ''
        }
        _mongoose.models['PaymentInfo'].create(paymentObj, (err, docs) => {
            if (!err && docs) {
                console.log(docs)
            } else {
                // payment persistance failed
                let obj = {
                    collectionName: 'PaymentInfo',
                    persistingObj: JSON.stringify(paymentObj)
                }
                _mongoose.models['PersistenceFailure'].create(obj, () => { })
            }
            return cb()
        })
    }

    // save user card
    let saveUserCard = (cb) => {
        if (!req.body.saveCard) {
            return cb()
        }
        let cardObj = {
            cardId: authResponseObj.source.id,
            userId: reqUserId,
            lastFour: authResponseObj.source.last4,
            bin: authResponseObj.source.bin,
            bank: authResponseObj.source.issuer,
            expiryMonth: authResponseObj.source.expiry_month,
            expiryYear: authResponseObj.source.expiry_year,
            cardScheme: authResponseObj.source.scheme,
            cardType: authResponseObj.source.type
        }
        _mongoose.models['UserCards'].findOneAndUpdate({ cardId: authResponseObj.source.id }, cardObj, { upsert: true }, (err, res) => {
            if (!err && res) {

            }
            return cb()
        })
    }
    _async.series([
        verifyCheckout.bind(),
        updateWallet.bind(),
        updateBookingInfo.bind(),
        function (lcb) {
            _async.parallel([
                updateCarryRequest.bind(),
                updateTripStatus.bind(),
                updateInvoice.bind(),
            ], () => {
                return lcb(null, null)
            })
        },
        updatePaymentInfo.bind(),
        saveUserCard.bind()
    ], (err, res) => {
        let notifyObj = {
            type: 'newRequest',
            carryId: req.body.carryId,
            tripId: req.body.tripId
        }
        if (req.body.invoiceId && req.body.invoiceId !== '') {
            notifyObj.type = 'invoicePayment'
            notifyObj.invoiceId = req.body.invoiceId
        }
        // send push notifications and SMS
        notifications.notify(notifyObj, () => {
            // console.log('notify')
        })
        // send email to requester
        mailer.sendMail({
            // emailType: 'new_trip',
            template: 'shipment-request-successfully',
            // subject: "New trip",
            userId: reqUserId,
            tripId: req.body.tripId,
            carryId: req.body.carryId,
            lang: lang
        }, () => {

        })
        responseObj.status = _status.SUCCESS
        responseObj.message = 'Payment updated successfully'
        return callback(responseObj)
    })
}

// update payment fail status
const UpdatePaymentFail = (req, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error in updating payment status',
        response: null
    }

    // get authorisation status
    let authResponseObj = {}
    let verifyCheckout = (cb) => {
        if (req.body.paymentGateway === 'wo') { return lCallback() }
        checkout.verifyCheckout({ chargeId: req.body.sid }, (res) => {
            if (res && res.status == 1000) {
                authResponseObj = res.response
            }
            return cb()
        })
    }
    // update booking status to 103(confirmed)
    let updateBookingInfo = (lCallback) => {
        _mongoose.models['BookingInfo'].findOne({ carryId: req.body.carryId }, (e, d) => {
            if (!e && d) {
                if (req.body.invoiceId && req.body.invoiceId !== '') {
                    d.bookingStatus = 105 // capture failed status  
                } else {
                    d.bookingStatus = 102 // Authorisation failed status    
                    d.shippingStatus = 'pending'
                }
                d.save((err, doc) => {
                    return lCallback(null, null)
                })
            } else {
                return lCallback('db error', null)
            }
        })
    }

    // update Carry Request
    let updateCarryRequest = (lCallback) => {
        if (req.body.invoiceId && req.body.invoiceId !== '') {
            return lCallback()
        } else {
            _mongoose.models['CarryRequests'].findOne({ carryId: req.body.carryId }, function (e, d) {
                if (!e && d) {
                    // d.pickupId = 'P' + pickupId
                    // d.dropoffId = 'D' + dropoffId
                    d.paymentDate = new Date()
                    d.status = 'pending'
                    d.save((err, doc) => {
                        return lCallback(null, null)
                    })
                } else {
                    return lCallback('db error', null)
                }
            })
        }
    }

    // update Trip status
    let updateTripStatus = (lCallback) => {
        let pkgWtCurrent = 0;
        let docWtCurrent = 0;
        let pkgQtCurrent = 0;
        let docQtCurrent = 0;

        _mongoose.models['BookingInfo'].find({ tripId: req.body.tripId }, (e, d) => {
            if (!e && d) {
                for (let i of d) {
                    pkgWtCurrent = pkgWtCurrent + i.pkgWt
                    docWtCurrent = docWtCurrent + i.docWt
                    pkgQtCurrent = pkgQtCurrent + i.pkgQt
                    docQtCurrent = docQtCurrent + i.docQt
                }
                let availableFlag = null
                if (d[0].pkgQtMax > 0 && d[0].pkgWtMax > 0) {
                    availableFlag = (pkgWtCurrent >= d[0].pkgWtMax || pkgQtCurrent >= d[0].pkgQtMax) ? false : true
                }
                if (d[0].docQtMax > 0 && d[0].docWtMax > 0) {
                    availableFlag = (docWtCurrent >= d[0].docWtMax || docQtCurrent >= d[0].docQtMax) ? false : true
                }
                if (!availableFlag) {
                    _mongoose.models['Trip'].findOneAndUpdate({ tripId: req.body.tripId }, { $set: { "status": 'filled' } }, (err, res) => {
                        if (!err && res) {
                        }
                        return lCallback(null, null)
                    })
                } else {
                    return lCallback(null, null)
                }
            } else {
                return lCallback('db error', null)
            }
        })
    }

    // update invoice
    let updateInvoice = (lCallback) => {
        if (req.body.invoiceId && req.body.invoiceId !== '') {
            _mongoose.models['Invoice'].findOneAndUpdate({ invoiceId: req.body.invoiceId }, { $set: { "status": 'paid' } }, (err, res) => {
                if (!err && res && req.body.invoiceId) {

                }
                return lCallback()
            })
        } else {
            return lCallback()
        }
    }

    let updatePaymentInfo = (lCallback) => {
        let paymentObj = {
            chargeId: authResponseObj.id,
            paymentId: authResponseObj.reference,
            requestId: req.body.carryId,
            status: authResponseObj.status,
            amount: authResponseObj.amount / 100,
            userCurrency: 'SAR',
            paymentCurrency: authResponseObj.currency,
            paymentMode: authResponseObj.source.type,
            paymentGateway: 'checkout',
            invoiceId: (req.body.invoiceId) ? (req.body.invoiceId) : ''
        }
        _mongoose.models['PaymentInfo'].create(paymentObj, (err, docs) => {
            if (!err && docs) {
                console.log(docs)
            } else {
                // payment persistance failed
                let obj = {
                    collectionName: 'PaymentInfo',
                    persistingObj: JSON.stringify(paymentObj)
                }
                _mongoose.models['PersistenceFailure'].create(obj, () => { })
            }
            return lCallback()
        })
    }

    // if payment fails refund incase where partial payment is done via wallet
    let refundWalletAmount = (lCallback) => {

        let checkDebitTransactions = (cb) => {
            let filter = {
                "requestId": req.body.carryId,
                "transactionType": "debit"
            }
            // if (req.body.invoiceId && req.body.invoiceId !== '') {

            // }
            _mongoose.models['WalletInfo'].findOne(filter, (err, docs) => {
                if (!err && docs) {
                    let reqObj = {
                        amount: docs.amount,
                        userId: docs.userId,
                        requestId: docs.requestId,
                        desciption: 'Payment Fail'
                    }
                    transactions.CreditWallet(reqObj, (d) => {
                        return lCallback()
                        // if (d.status === 1000) {

                        // } else {

                        // }
                    })
                } else {
                    return lCallback()
                }
            })
        }

        _async.series([
            checkDebitTransactions.bind(),

        ], (err, res) => {
            return lCallback()
        });

    }

    _async.series([
        verifyCheckout.bind(),
        updateBookingInfo.bind(),
        // updateCarryRequest.bind(),
        // updateTripStatus.bind(),
        updateInvoice.bind(),
        updatePaymentInfo.bind(),
        refundWalletAmount.bind()
    ], (err, res) => {
        responseObj.status = _status.SUCCESS
        responseObj.message = 'Payment Fail updated successfully'
        return callback(responseObj)
    })
}

// refund invoice - not required
const refundInvoice = (req, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error in updating payment status',
        response: null
    }
    for (let inv of req.invoiceArr) {
        let invPG = ''
        // check Payment gateway
        let invoicePG = (lcb) => {
            _mongoose.models['PaymentInfo'].findOne({ invoiceId: inv.invoiceId }, (err, doc) => {
                invPG = doc.paymentGateway
                return lcb()
            })
        }
        // refund invoice - checkout
        let refundInvRes = {}
        let refundInvStatus = false
        let refundInvoice = (lcb) => {
            if (invPG === 'wo') { return cb() }
            Refund({ carryId: inv.carryId, invoiceId: inv.invoiceId }, (d) => {
                if (d.response) {
                    refundInvRes = d.response
                    refundInvStatus = true
                    responseObj.status = _status.SUCCESS,
                        responseObj.message = 'success';
                    return lcb();
                } else {
                    responseObj.message = 'RefundMoneyFail: Error in Refund money'
                    return callback(responseObj)
                }
            });
        }
        // verufy refund with checkout
        let refundInvResObj = {}
        let verifyInvRefund = (lcb) => {
            if (!refundInvStatus || invPG === 'wo') {
                return lcb()
            }
            let headers = {
                Authorization: checkout_config.secretKey,
                'content-Type': 'application/json;charset=UTF-8'
            }
            _request({
                url: refundInvRes._links.payment.href,
                headers: headers,
                method: "GET",
                body: {},
                time: true,
                json: true
            }, (error, body, response) => {
                if (!error && response) {
                    refundInvResObj = response
                }
                return lcb()
            })
        }
        // refund invoice to wallet
        let refundInvToWallet = (lcb) => {
            if (invPG === 'co') { return lcb() }
            refundToWallet({ carryId: inv.carryId, invoiceId: inv.invoiceId, userInfo: req.userInfo }, (res) => {
                if (res.status === 1000) {
                    return lcb()
                } else {
                    if (invPG === 'wo') {
                        //return callback(responseObj)
                    } else {
                        return lcb()
                    }
                }
            })
        }
        // update payment info
        let updateInvPaymentInfo = (lcb) => {
            _mongoose.models['PaymentInfo'].findOne({ invoiceId: inv.invoiceId, chargeId: { '$ne': '' } }, (err, doc) => {
                if (!err && doc) {
                    doc.status = 'Refunded'
                    doc.save((er, dc) => {
                        return lcb()
                    })
                }
            })
        }

        // update invoice table
        let updateInvoice = (lcb) => {
            _mongoose.models['Invoice'].findOne({ invoiceId: inv.invoiceId }, (e, d) => {
                if (!e && d) {
                    d.status = 'Refunded'
                    d.save((err, doc) => {
                        return lcb()
                    })
                } else {
                    return lcb()
                }
            })
        }

        _async.series([
            invoicePG.bind(),
            refundInvoice.bind(),
            verifyInvRefund.bind(),
            refundInvToWallet.bind(),
            updateInvPaymentInfo.bind(),
            updateInvoice.bind()
        ], () => {
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Invoice refund successful'
            return callback(responseObj)
        })
    }
}

const refudPaymentList = (body, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'search error',
        total: 0,
        response: null
    }
    let searchKey = {}
    body['offset'] = (body.offset) ? body.offset : 0
    body['limit'] = (body.limit) ? body.limit : 10

    if (body.key && body.key != '') {
        let key = body.key.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '')
        searchKey['$or'] = [
            { 'user.name': new RegExp(key, 'i') },
            { 'user.fname': new RegExp(key, 'i') },
            { 'user.lname': new RegExp(key, 'i') },
            { 'paymentId': new RegExp(key, 'i') },
            { 'requestId': new RegExp(key, 'i') },
        ]
    }

    let filter = {
        status: { '$in': ['Refunded'] },
    }

    let refundedPaymentListCount = (cb) => {
        let agg = _mongoose.models['PaymentInfo']["refundPaymentList"](filter, searchKey, { lang: "en" });
        _mongoose.models['PaymentInfo'].aggregate(agg).exec((err, docs) => {
            if (!err && docs && docs.length) {
                responseObj.total = docs.length;
            }
            return cb();
        })
    }

    let refundedPaymentList = (cb) => {
        let agg = _mongoose.models['PaymentInfo']["refundPaymentList"](filter, searchKey, {});
        _mongoose.models['PaymentInfo'].aggregate(agg).skip(body.offset).limit(body.limit).exec((err, data) => {
            if (!err && data && data.length) {
                let dataArr = [];
                for (let d of data) {
                    delete d.carryReq;
                    d.updatedAt = _moment(d.updatedAt, "DD/MM/YYYY").format("DD MMM YYYY hh:mm a")
                    d.status = "Processed"
                    dataArr.push(d);
                }
                responseObj.response = data;
                responseObj.status = _status.SUCCESS
                responseObj.message = "Success."
                return cb()
            } else if (data.length == 0) {
                responseObj.status = _status.SUCCESS
                responseObj.message = "No Refunded data available"
                return callback(responseObj)
            } else {
                return callback(responseObj)
            }
        })
    }

    _async.series([
        refundedPaymentListCount.bind(),
        refundedPaymentList.bind(),
    ], (err, res) => {
        return callback(responseObj)
    });
}

module.exports = {
    Authorize,
    Capture,
    VoidPayment,
    Refund,
    VerifyCheckout,
    CarryPrice,
    PayByWallet,
    refundToWallet,
    refundInvoice,
    UpdatePayment,
    UpdatePaymentFail,
    refudPaymentList
}