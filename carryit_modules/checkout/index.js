'user strict'
/**
 * @author hari, nahl
 * @description checkout module
 */
// checkout config
const checkout = _config.checkout
const common = require('../../libs/utils/common')
const randomstring = require("randomstring")

const authorize = (req, callback) => {
    let responseObj = {
        status: _status.Error,
        message: 'error in authorizing payment',
        response: null
    }
    let params = {}
    let args = req.body
    let source = {}
    if (args.cardId && !args.cardToken) {
        source = {
            "type": "id",
            "id": args.cardId
        }
    } else {
        source = {
            "type": "token",
            "token": args.cardToken
        }
    }
    let authRequest = (lCallback) => {
        let origin = req.headers.origin
        let mweb = ''
        let invoiceParam = ''
        let referenceId = randomstring.generate(7)
        if (args.mweb) {
            mweb = '&mweb=true'
        } 
        if (args.invoiceId && args.invoiceId != '') {
            invoiceParam = '&invoiceId=' + args.invoiceId
        } 
        params = {
            headers: {
                Authorization: checkout.secretKey,
                'content-Type': 'application/json;charset=UTF-8'
            },
            data: {
                "source": source,
                "amount": parseFloat(args.priceInfo.payable) * 100,
                "currency": "SAR",
                "reference": referenceId,
                "description": "Carryit-Booking",
                "capture": (args.invoiceId) ? true : false, 
                "customer": {
                  "email": args.userInfo.email,
                  "name": args.userInfo.fname
                },
                "3ds": {
                  "enabled": true,
                  "attempt_n3d": true
                },
                "success_url": origin + "/checkout/success?tripId=" + args.tripId + "&carryId=" + args.carryId + invoiceParam + mweb + '&svc=' + args.svc + '&pg=' + args.paymentGateway,
                "failure_url": origin + "/checkout/fail?tripId=" + args.tripId + "&carryId=" + args.carryId + invoiceParam + mweb + '&pg=' + args.paymentGateway,
              },
            uri: checkout.checkoutUrl
        }
        return lCallback()
    }
    let fireAuth = (lCallback) => {
        common.httpPost(params, (err, ack) => {
            console.log('err', err)
            console.log('ack', JSON.stringify(ack))
            responseObj.response = ack
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Authorisation Request sent successful'
            return lCallback()
        })
    }
    _async.series([
        authRequest.bind(),
        fireAuth.bind()
    ], () => {
        return callback(responseObj)
    })

}

const capture = (req, callback) => {
    let responseObj = {
        status: _status.Error,
        message: 'error in capturing payment',
        response: null
    }
    let params = {}
    let args = req
    let captureRequest = (lCallback) => {
        params = {
            headers: {
                Authorization: checkout.secretKey,
                'content-Type': 'application/json;charset=UTF-8'
            },
            data: {},
            uri: checkout.checkoutUrl + args.chargeId + "/captures"
        }
        return lCallback()
    }
    let fireCapture = (lCallback) => {
        common.httpPost(params, (err, ack) => {
            console.log('err', err)
            console.log('ack', ack)
            responseObj.response = ack
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Capture Request sent successful'
            return lCallback()
        })
    }
    _async.series([
        captureRequest.bind(),
        fireCapture.bind()
    ], () => {
        return callback(responseObj)
    })
}

const voidPayment = (req, callback) => {
    let responseObj = {
        status: _status.Error,
        message: 'error in authorizing payment',
        response: null
    }
    let params = {}
    let args = req
    let voidRequest = (lCallback) => {
        params = {
            headers: {
                Authorization: checkout.secretKey,
                'content-Type': 'application/json;charset=UTF-8'
            },
            data: {},
            uri: checkout.checkoutUrl + args.chargeId + "/voids"
        }
        return lCallback()
    }
    let fireVoid = (lCallback) => {
        common.httpPost(params, (err, ack) => {
            console.log('err', err)
            console.log('ack', ack)
            responseObj.response = ack
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Void Request sent successful'
            return lCallback()
        })
    }
    _async.series([
        voidRequest.bind(),
        fireVoid.bind()
    ], () => {
        return callback(responseObj)
    })
}

const refund =(args, callback) => {
    let responseObj = {
        status: _status.Error,
        message: 'error in authorizing payment',
        response: null
    }
    let params = {}
    //let args = req.body
    let refundReq = (lCallback) => {
        params = {
            headers: {
                Authorization: checkout.secretKey,
                'content-Type': 'application/json;charset=UTF-8'
            },
            data: {},
            uri: checkout.checkoutUrl + args.chargeId + "/refunds"
        }
        return lCallback()
        
    }
    let fireRefund = (lCallback) => {
        common.httpPost(params, (err, ack) => {
            console.log('err', err)
            console.log('ack', ack)
            responseObj.response = ack
            responseObj.status = _status.SUCCESS
            return lCallback()
        })
    }
    _async.series([
        refundReq.bind(),
        fireRefund.bind()
    ], () => {
        return callback(responseObj)
    })
}

const verifyCheckout = (req, callback) => {
    let responseObj = {
        status: _status.Error,
        message: 'error in checkout verification',
        response: null
    }
    let headers = {
        Authorization: checkout.secretKey,
        'content-Type': 'application/json;charset=UTF-8'
    }
    _request({
        url: checkout.checkoutUrl + req.chargeId,
        headers: headers,
        method: "GET",
        body: {},
        time: true,
        json: true
    }, (error, body, response) => {
        if (!error) {
            responseObj.status = _status.SUCCESS
            responseObj.message = 'Checkout verification successful'
            responseObj.response = response
        }
        return callback(responseObj)
    })
}
module.exports = {
    authorize,
    capture,
    voidPayment,
    refund,
    verifyCheckout
}