/**
 *@description Main Controller
 *@author Fahid Mohammad
 *@email mec.fahid@gmail.com
 */

// Import Dummy Module
const { dummyReturn } = require('../tache_modules/dummy')

let express = require('express')
    , router = express.Router()
// Dummy Route
router.get('/', function (req, res) {
	res.json({
		"API":"Tache Assignment",
		"Version":"1.0",
		"Author":"Sandeep"
	})
});

// Dummy Route
router.get('/dummy', function (req, res) {
	let data = dummyReturn("Gummt");
	res.json({
		status:1000, 
		data:data
	})
})

//Export the controller
module.exports = router;