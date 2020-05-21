'use strict'
/**
 * 
 */
module.exports = {
    addServiceFee: (args, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'Error in adding service fee'
        }
        let id = args._id
        if (id == undefined || id == null || id == '') {
            id = _mongoose.Types.ObjectId()
            args['createdAt'] = Date.now()
        }
        args['updatedAt'] = Date.now()
        try {
            let addServiceFee = (cb) => {
                _mongoose.models['ConfigServiceFee'].findOneAndUpdate({ _id: _mongoose.Types.ObjectId(args._id) }, args, { upsert: true, new: true }, (e, d) => {
                    if(!e && d) {
                        responseObj.status = _status.SUCCESS
                        responseObj.message = "added service fee successfully"
                        return cb();
                    }
                    return callback(responseObj)
                })
            }

            let checkDups = (cb) => {
                _mongoose.models['ConfigServiceFee'].find({ 'carryType': args.carryType, 'serviceType': args.serviceType }).where('_id').ne(id).exec((err, doc) => {
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

            _async.series([checkDups.bind(), addServiceFee.bind()], (err) => {
                return callback(responseObj)
            })

        }
        catch (e) {
            responseObj.status = _status.DB_ERROR
            responseObj.message = e.message
            return callback(responseObj)
        }
    },

    // get existing service fee configurations
    getServiceFee: (args, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'Error in adding service fee',
            response: null
        }
        let filter = (args.carryType) ? {'carryType': args.carryType} : {}
        _mongoose.models['ConfigServiceFee'].find(filter).exec((err, docs) => {
            if(!err && docs) {
                responseObj.status = _status.SUCCESS
                responseObj.message = "Service Fee List"
                responseObj.response = docs
            }
            return callback(responseObj)
        })
    }
}