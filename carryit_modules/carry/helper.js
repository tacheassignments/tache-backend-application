'use strict'
/** 
 * @description helper for the carry request
 * @author Nahl
 * @since Aug 28 2019
 */
module.exports = {
    /** validate the request with trip */
    validateRequest: (carryReq, trip) => {
        let obj = {
            valid: false,
            message: "Error in validation"
        }
        // toDo - validation for size/dimension is not added
        let type = carryReq.type
        let tripObj = JSON.parse(JSON.stringify(trip))
        if (!tripObj.hasOwnProperty(type)) {
            obj.message = 'Carry type does not match'
        } else if (carryReq.quantity > tripObj[type].qnty) {
            obj.message = 'Quantity is exceeding the traveller limit'
        } else if (tripObj[type].weight && carryReq.weight > tripObj[type].weight) {
            obj.message = 'Weight is exceeding the traveller limit'
            /*  } else if (tripObj[type].size) {
                 if (parseInt(carryReq.dimension.charAt(0)) > parseInt(tripObj[type].size.charAt(0)) || parseInt(carryReq.dimension.charAt(2)) > parseInt(tripObj[type].size.charAt(2))) {
                     obj.message = 'Size exceeding carrier limit'
                 } */
        } else if (tripObj[type].size && carryReq.paper && parseInt(tripObj[type].size.charAt(1)) > carryReq.paper.charAt(1)) {
            obj.message = 'Document size exceeding the traveller size'
        } else if (!carryReq.sdc && !carryReq.smc) {
            obj.message = 'smc is not available'
        } else if (!carryReq.rpc && !carryReq.rmc) {
            obj.message = 'rmc is not available'
        } else {
            obj.valid = true
            obj.message = 'Validation Successful'
        }
        return obj
    },
    /**calculate price */
    calculatePrice: (carryReq, callback) => {
        let vatConfig = { v: 5, t: "p" }
        let vatOnUser = false
        /** get carry price */
        let baseFare = null
        let getCarryPriceDoc = (n) => {
            let carryWeight = carryReq.weight;
            if (carryReq.type === "package") {
                carryWeight = parseFloat(carryReq.weight);
            }
            //carryReq.weight = carryWeight;
            let filter = { carryMode: carryReq.tripType, carryType: carryReq.type, maxWeight: { $gte: carryWeight }, minWeight: { $lte: carryWeight } }
            // let there be only one matching document
            _mongoose.models["ConfigCarryFee"].findOne(filter, (e, s) => {
                // if no docs then take the default one
                if (s) {
                    baseFare = s.price
                    return n()
                } else {
                    // get the default price and set let saif will do it
                    baseFare = 100
                    return n()
                }

            })

        }
        /** get servie fee */

        let pickServiceFee = 0
        let dropServiceFee = 0
        let getServiceFeeDocs = (n) => {
            let filter = { carryType: carryReq.type }
            // let there matching documents for pick and drop service
            _mongoose.models["ConfigServiceFee"].find(filter, (e, s) => {
                if (s && s.length > 0) {
                    for (let f of s) {
                        if (f.serviceType == 'pick' && !carryReq.sdc) {
                            pickServiceFee = f.fee
                        }
                        if (f.serviceType == 'drop' && !carryReq.rpc) {
                            dropServiceFee = f.fee
                        }
                    }
                }
                return n()
            })

        }
        /** get commission */
        let commission = 0
        let commissionConfig = null
        let getCommissionDocs = (n) => {
            let filter = { carryMode: carryReq.tripType, carryType: carryReq.type }
            _mongoose.models["ConfigCommissionFee"].find(filter, (e, s) => {
                if (s && s.length > 0) {
                    commission = s[0].percentage
                    commissionConfig = {
                        v: s[0].percentage,
                        t: 'p'
                    }
                }
                return n()
            })
        }
        _async.parallel([
            getCarryPriceDoc.bind(),
            getServiceFeeDocs.bind(),
            getCommissionDocs.bind()
        ], () => {
            //apply vat
            if (baseFare) {
                let totalFare = pickServiceFee + dropServiceFee + baseFare
                let tax = parseFloat((totalFare * (vatConfig.v / 100)).toFixed(2))
                let payFare = parseFloat((totalFare + tax).toFixed(2))
                if (carryReq.invoice) {
                    totalFare = Math.abs(parseInt(totalFare) - parseInt(carryReq.totalFare));
                    tax = Math.abs(parseFloat((totalFare * (vatConfig.v / 100)).toFixed(2)));
                    payFare = Math.abs(parseFloat((totalFare + tax).toFixed(2)));
                }
                let commissionFee = 0
                // let commissionVat = 0
                // let commissionAmount = 0
                if (commission > 0) {
                    commissionFee = parseFloat((totalFare * (commission / 100)).toFixed(2))
                    payFare = payFare + commissionFee
                    // commissionVat = parseFloat((commissionFee * (vatConfig.v / 100)).toFixed(2))
                    // commissionAmount = commissionFee + commissionVat
                }
                /** save price details */
                let priceObj = {
                    carryId: carryReq.carryId,
                    tripId: carryReq.tripId,
                    currency: "SAR",
                    pickFee: (carryReq.invoice) ? 0 : pickServiceFee,
                    dropFee: (carryReq.invoice) ? 0 : dropServiceFee,
                    carryFee: (carryReq.invoice) ? totalFare : baseFare,
                    totalFare: totalFare,
                    vat: tax,
                    payFare: payFare,
                    commissionFee: commissionFee,
                    //commissionVat: commissionVat,
                    //commissionAmount: commissionAmount,
                    vatConfig: vatConfig,
                    commissionConfig: commissionConfig
                }
                if (carryReq.invoice) {
                    priceObj.invoice = true;
                    _mongoose.models['BookingPriceInfo'].findOneAndUpdate({ carryId: carryReq.carryId, invoiceId: 'NEG' }, priceObj, { upsert: true }).exec((e, s) => {
                        if (s && s.id) {

                        }
                        callback(priceObj)
                    })
                } else {
                    new _mongoose.models["BookingPriceInfo"](priceObj).save((e, s) => {
                        if (s && s.id) {

                        } else {
                            let obj = {
                                collectionName: 'BookingPriceInfo',
                                persistingObj: JSON.stringify(priceObj)
                            }
                            _mongoose.models['PersistenceFailure'].create(obj, () => {})
                        }
                        callback(priceObj)
                    })
                }

            } else {
                callback(priceObj);
            }
        })
    }
}
