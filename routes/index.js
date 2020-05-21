
const index = require('../controllers')
	, user = require('../controllers/user')
	, fs = require('fs')

module.exports.initialize = function (app) {
	/*    --------------------------------------------------
		::Controller - API's
	-------------------------------------------------- */
	app.use('/', index)
	app.use('/user', user)
	app.use('/serversetup', (req, res) => {
		res.send('carryit api')
	})
	app.use('/.well-known/apple-developer-merchantid-domain-association.txt', (req, res) => {
		 // **modify your existing code here**
		 fs.readFile('./well-known/apple-developer-merchantid-domain-association.txt', 'utf8', (e, data) => {
			if (e) throw e;
			res.send(data);
		});
	})

}
