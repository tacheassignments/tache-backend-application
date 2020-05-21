'use strict'
/**
 * @author Harikrishna
 * @description price related services
 */
const UpdatePrice = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'Error in updating price'
    }
    try {
        /* _mongoose.models['ConfigCarryFee'].findOneAndUpdate({ _id: _mongoose.Types.ObjectId(args._id) }, args, { upsert: true, new: true }, (e, d) => {
            if (e || !d) {
                return callback(responseObj)
            } else {
                responseObj.status = _status.SUCCESS
                responseObj.message = "updated price successfully"
                return callback(responseObj)
            }
        }) */
        let id = args._id
        if (id == undefined || id == null || id == '') {
            id = _mongoose.Types.ObjectId()
        }
        // validations
        if(!args.maxWeight || args.maxWeight == '' || !args.minWeight || args.minWeight == '') {
            responseObj.message = 'Please enter a valid weight'
            return callback(responseObj)
        }
        if(!args.price || args.price == '') {
            responseObj.message = 'Please enter a valid weight'
            return callback(responseObj)
        }
        if(args.maxWeight <= args.minWeight) {
            responseObj.message = 'Min weight should be less than Max weight'
            return callback(responseObj)
        }
        // maxWeight: { $gte: carryWeight }, minWeight: { $lte: carryWeight }
        let checkDups = (cb) => {
            let filter = {
                "carryType": args.carryType,
                "carryMode": args.carryMode,
                "$or": [
                    { "maxWeight": { "$gt": args.minWeight, "$lte": args.maxWeight } },
                    { "minWeight": { "$gte": args.minWeight, "$lt": args.maxWeight } }
                ]
              /* "$or": [
                  {
                      "$and":[
                        { maxWeight: { $gt: args.minWeight }},
                        { minWeight: { $lte: args.minWeight }}
                    ],
                },{
                    "$and": [
                        { maxWeight: { $gte: args.maxWeight }},
                        { minWeight: { $lte: args.maxWeight }}
                       ]
                }],  */
                }
                if (args._id) {
                    filter["$or"] = [
                        { "maxWeight": { "$gt": args.minWeight, "$lte": args.maxWeight } },
                        { "minWeight": { "$gte": args.minWeight, "$lt": args.maxWeight } }]
                } else {
                    filter["$or"] = [
                        {
                            "$and":[
                              { maxWeight: { $gt: args.minWeight }},
                              { minWeight: { $lte: args.minWeight }}
                          ],
                      },{
                          "$and": [
                              { maxWeight: { $gte: args.maxWeight }},
                              { minWeight: { $lte: args.maxWeight }}
                             ]
                      }
                    ] 
                }
            _mongoose.models['ConfigCarryFee'].find(filter).where('_id').ne(id).exec((err, docs) => {
                if (!err && docs.length > 0) {
                    responseObj.message = 'Price configuration already exists'
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

        let checkDuplicate = (cb) => {
            _mongoose.models['ConfigCarryFee'].find
        }

        let addUpdatePrice = (cb) => {
            _mongoose.models['ConfigCarryFee'].findOneAndUpdate({ '_id': id }, args, { upsert: true, new: true }, (e, d) => {
                if (e || !d) {
                    return callback(responseObj)
                } else {
                    responseObj.status = _status.SUCCESS
                    responseObj.message = "Price updated successfully"
                    return callback(responseObj)
                }
            })
        }

        _async.series([
            checkDups.bind(), 
            addUpdatePrice.bind()], ()=> {
            return callback(responseObj)
        })
    }
    catch (e) {
        responseObj.status = _status.DB_ERROR
        responseObj.message = e.message
        return callback(responseObj)

    }
}
// Get price
const GetPrice = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error in fetching price',
        response: null
    }
    try {
        if (args.f && args.f.weight) {
            args.f.minWeight = {
                $lt: args.f.weight
            }
            args.f.maxWeight = {
                $gte: args.f.weight
            }
            delete args.f.weight
        }
        _mongoose.models['ConfigCarryFee'].find(args.f, args.p).lean().exec((e, d) => {
            if (!e && d) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'price fetched successfully'
                responseObj.response = d
            }
            return callback(responseObj)
        })
    }
    catch (e) {
        responseObj.status = _status.DB_ERROR
        responseObj.message = "DB error while fetching price"
        responseObj.response = e.message
        return callback(responseObj)
    }
}

// get list of price configurations for B2E
const getPriceConf = (args, callback) => {
    let responseObj = {
        status: _status.ERROR,
        message: 'error in fetching price',
        response: null
    }
    try {
        _mongoose.models['ConfigCarryFee'].find({'carryType': args.carryType}).lean().exec((e, d) => {
            if (!e && d) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'price configuration list fetched successfully'
                responseObj.response = d
            }
            return callback(responseObj)
        })
    }
    catch (e) {
        responseObj.status = _status.DB_ERROR
        responseObj.message = "DB error while fetching price"
        responseObj.response = e.message
        return callback(responseObj)
    }
}
module.exports = {
    UpdatePrice,
    GetPrice,
    getPriceConf
}