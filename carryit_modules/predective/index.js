'use strict'
/**
 * @description predective search  
 * @author Nahl
 * @since July 17 2019
 * @note build like redis or get from redis
 */
module.exports = {
    /** city predective search */
    city: (req, callback) => {
        let responseObj = {
            status: _status.ERROR
        }
        if (req.query && req.query.key && req.query.lang) {
            let sugg = new RegExp(req.query.key, 'i')
            let projection = {
                city: "$cityName.en",
                country: "$countryName.en",
                cityId: 1,
                _id: 0
            }
            let filter = {
                $or: [
                    { 'cityName.en': sugg }
                ]
            }
            if (req.query.lang == 'ar') {
                filter = {
                    $or: [
                        { 'cityName.ar': sugg }
                    ]
                }
                projection = {
                    city: "$cityName.ar",
                    country: "$countryName.ar",
                    cityId: 1,
                    _id: 0
                }
            }
            let pipeline = [
                {
                    $match: filter
                },
                {
                    $project: projection
                }
            ]
            _mongoose.models["CityPredictive"].aggregate(pipeline).exec((err, docs) => {
                responseObj.status = _status.SUCCESS
                responseObj.data = docs
                callback(responseObj)
            })
        } else {
            callback(responseObj)
        }
    }
}