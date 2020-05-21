'use strict'
/**
 * @author Harikrishna
 * @description commission related services
 */
const SaveCommission = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in updating commission'
    }  
    let id = args._id  
    if (id == undefined || id == null || id == '') {
        id = _mongoose.Types.ObjectId()
    }
    try {
        // check duplicate
        let checkDups = (cb) => {
            _mongoose.models['ConfigCommissionFee'].find({'carryType': args.carryType, 'carryMode': args.carryMode}).where('_id').ne(id).exec((err, doc) => {
                if (!err && doc.length > 0) {
                    responseObj.message = 'Configuration already exists'
                    responseObj.response = null
                } else if (err) {
                    responseObj.message = err
                    responseObj.response = null
                } else {
                    return cb();
                }
                return callback(responseObj)
            })
        }

        // add/upadate commission
        let addCommission = (cb) => {
            _mongoose.models['ConfigCommissionFee'].findOneAndUpdate({ _id: _mongoose.Types.ObjectId(args._id), }, args, { upsert: true, new: true }, (e, d) => {
                if(!e && d) {
                    responseObj.status = _status.SUCCESS
                    responseObj.message = "Commission updated successfully"
                    return cb();
                }
                return callback(responseObj)
            })
        }

        _async.series([checkDups.bind(), addCommission.bind()], (err) => {
            return callback(responseObj)
        })
        
    }
    catch (e) {
        responseObj.status = _status.DB_ERROR
        responseObj.message = e.message
        return callback(responseObj)

    }
}
// Get commission
const GetCommission = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error in fetching commission',
        response: null
    }
    try {
        _mongoose.models['ConfigCommissionFee'].find({"carryType": args.carryType}).lean().exec((e, d) => {
            if (!e && d) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'commission data fetched successfully'
                responseObj.response = d
            }
            return callback(responseObj)
        })
    }
    catch (e) {
        responseObj.status = _status.DB_ERROR
        responseObj.message = "DB error while fetching commission"
        responseObj.response = e.message
        return callback(responseObj)
    }
}
module.exports = {
    SaveCommission,
    GetCommission
}