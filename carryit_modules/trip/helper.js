"use strict"
/**
 * 
 */
const keymapper = require('../../libs/utils/key-mapping')
module.exports = {
    /**
     * set service fee in trip
     */
    setServiceFee: (serviceFee, trip) => {
        //set pick document fee
        if (trip.pf && trip.cd) {
            let pd = _.filter(serviceFee, (s) => {
                let flag = false
                if (s.serviceType == "pick" && s.carryType == 'document') {
                    if (s.from <= trip.doc.wt && s.to > trip.doc.wt) {
                        flag = true
                    }
                }
                return flag
            })
            if (pd.length) {
                trip.doc.pf = pd[0].fee
                trip.doc.cur = pd[0].cur
            }
        }
        //set pick package fee
        if (trip.pf && trip.cp) {
            let pp = _.filter(serviceFee, (s) => {
                let flag = false
                if (s.serviceType == "pick" && s.carryType == 'package') {
                    if (s.from <= trip.pkg.wt && s.to > trip.pkg.wt) {
                        flag = true
                    }
                }
                return flag
            })
            if (pp.length) {
                trip.pkg.pf = pp[0].fee
                trip.pkg.cur = pp[0].cur
            }
        }
        // set drop document fee
        if (trip.df && trip.cd) {
            let dd = _.filter(serviceFee, (s) => {
                let flag = false
                if (s.serviceType == "drop" && s.carryType == 'document') {
                    if (s.from <= trip.doc.wt && s.to > trip.doc.wt) {
                        flag = true
                    }
                }
                return flag
            })
            if (dd.length) {
                trip.doc.df = dd[0].fee
                trip.doc.cur = dd[0].cur
            }

        }
        //set drop package fee
        if (trip.df && trip.cp) {
            let dp = _.filter(serviceFee, (s) => {
                let flag = false
                if (s.serviceType == "drop" && s.carryType == 'package') {
                    if (s.from <= trip.pkg.wt && s.to > trip.pkg.wt) {
                        flag = true
                    }
                }
                return flag
            })
            if (dp.length) {
                trip.pkg.df = dp[0].fee
                trip.pkg.cur = dp[0].cur
            }

        }
    },
    /**
     * set carry fee in trip
     */
    setCarryFee: (carryFees, trip) => {
        //set pick document fee
        for (let s of carryFees) {
            if (s.carryMode == trip.tt && s.carryType == 'document' && trip.doc) {
                if (s.default) {
                    trip.doc.minAmt = s.price
                    // trip.doc.maxAmt = s.price
                    trip.doc.cur = s.currency
                }
                // if (s.minWeight < trip.doc.wt && s.maxWeight >= trip.doc.wt) {
                //     trip.doc.maxAmt = (s.price)

                // }
                if (s.maxWeight >= trip.doc.wt) {
                    trip.doc.maxAmt = s.price
                }
            }
            if (s.carryMode == trip.tt && s.carryType == 'package' && trip.pkg) {
                if (s.default) {
                    trip.pkg.minAmt = s.price
                    trip.pkg.maxAmt = s.price
                    trip.pkg.cur = s.currency
                }
                if (s.minWeight < trip.pkg.wt && s.maxWeight >= trip.pkg.wt) {
                    trip.pkg.maxAmt = s.price
                }
            }

        }


    },
    /**
    * validate add trip obj
    */
    validateTripReq: (body) => {
        let obj = {
            valid: false,
            message: "Error in Trip Request Validation"
        }
        let tripInfo = body.trip
        if (!tripInfo) {
            obj.message = "Trip Object can not be empty"
        } else if (!(tripInfo.fromGeo && tripInfo.fromGeo.lat && tripInfo.fromGeo.lon)) {
            obj.message = "Error in getting fromGeo";
        } else if (!(tripInfo.toGeo && tripInfo.toGeo.lat && tripInfo.toGeo.lon)) {
            obj.message = "Error in getting toGeo";
        } else if (!tripInfo.depDate || !tripInfo.depTime || !tripInfo.arrDate || !tripInfo.arrTime) {
            obj.message = "Error in getting travel dates";
        } else if (tripInfo.depDate && _moment(tripInfo.depDate,"YYYY-MM-DD").isBefore(_moment().format("YYYY-MM-DD"))) {
                //obj.message = "Travel date cannot be before the today's date";
                obj.message = keymapper["s2c"]["trvlDateCntBfreToDay"][body.lang];
        } else if (tripInfo.depTime && _moment(tripInfo.depDate).isSame(_moment().format("YYYY-MM-DD")) && _moment( tripInfo.depTime, 'hh:mm A').isBefore(_moment().format())) {
                //obj.message = "Travel time cannot be before current time";
                obj.message = keymapper["s2c"]["trvltmeCntBfreCurntTme"][body.lang];
        } else if (tripInfo.arrDate && _moment(tripInfo.arrDate).isBefore(_moment().format("YYYY-MM-DD"))) {
            //obj.message = "Arrival date cannot be before the today's date";
            obj.message = keymapper["s2c"]["arrDteCntBfreTodayDte"][body.lang];
        } else if (tripInfo.arrDate && _moment(tripInfo.arrDate).isSame(_moment().format("YYYY-MM-DD")) && _moment( tripInfo.arrTime, 'hh:mm A').isBefore(_moment().format())) {
            //obj.message = "Arrival time cannot be before current time";
            obj.message = keymapper["s2c"]["arrTmeCntbfreCurTme"][body.lang];
        } else if (!tripInfo.tripType) {
            obj.message = "Error in getting trip type";
        } else if (tripInfo.tripType === "air" && !(body[tripInfo.tripType] && body[tripInfo.tripType].depTerminal && body[tripInfo.tripType].arrTerminal)) {
            obj.message = "Error in getting " + tripInfo.tripType + " object";
        } else if (tripInfo.tripType === "rail" && !body[tripInfo.tripType].trainNumber) {
            obj.message = "Error in getting " + tripInfo.tripType + " object";
        } else if (tripInfo.tripType === "road" && !body[tripInfo.tripType] && !body[tripInfo.tripType].vehicleType && body[tripInfo.tripType].vehicleNumber) {
            obj.message = "Error in getting " + tripInfo.tripType + " object";
        } else if (body.hasOwnProperty("document") && body.document && !body.document.size && !body.document.qnty) {
            obj.message = "Error in getting document object";
        } else if (body.hasOwnProperty("package") && body.package && !body.package.weight && !body.package.units && !body.package.qnty && !body.package.dimensions) {
            obj.message = "Error in getting package object";
        } else if (!body.pickPoint && !body.pickRange) {
            obj.message = "Error in getting pickPoint and pickRange";
        } else if(body.pickPoint && !(body.pickPoint.point && body.pickPoint.point.lat && body.pickPoint.point.lon && body.pickPoint.point.location)){
            obj.message = "Error in getting pickPoint location";
        } else if(body.pickPoint && !(body.pickPoint.date && body.pickPoint.time)) {
            obj.message = "Error in getting pickPoint date time";
        }else if (body.pickRange && !(body.pickRange.range && body.pickRange.range.lat && body.pickRange.range.lon && body.pickRange.range.location && body.pickRange.range.radius)) {
            obj.message = "Error in getting pickRange location";
        } else if (body.pickRange && !(body.pickRange.date && body.pickRange.time)) {
            obj.message = "Error in getting pickRange date time";
        } else if (!body.deliverPoint && !body.deliverRange) {
            obj.message = "Error in getting deliverPoint and deliverRange";
        } else if (body.deliverPoint && !(body.deliverPoint.point && body.deliverPoint.point.lat && body.deliverPoint.point.lon && body.deliverPoint.point.location)) {
            obj.message = "Error in getting deliverPoint location";
        } else if (body.deliverPoint && !(body.deliverPoint.date && body.deliverPoint.time)) {
            obj.message = "Error in getting deliverPoint date time";
        }else if (body.deliverRange && !(body.deliverRange.range && body.deliverRange.range.lat && body.deliverRange.range.lon && body.deliverRange.range.location && body.deliverRange.range.radius)) {
            obj.message = "Error in getting deliverRange location";
        } else if (body.deliverRange && !(body.deliverRange.date && body.deliverRange.time)) {
            obj.message = "Error in getting deliverRange date time";
        } else {
            obj.valid = true
            obj.message = 'Validation successful'
        }
        return obj
    }
}