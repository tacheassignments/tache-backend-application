'use strict'
/**
 * @description access functions service
 * @author Saif
 * @since Aug 19 2019
 */
const nodemailer = require('nodemailer')
    , sgTransport = require('nodemailer-sendgrid-transport')
    , randomstring = require("randomstring")
    , helpAdaptor = require('../../libs/helper')
    , mailer = require('../../libs/mailer')

let auth = require('../../libs/auth');

//Sendgrid transport options
const options = {
    auth: {
        api_user: 'marensa',
        api_key: 'marensa#1'
    }
}

module.exports = {
    // add tabs
    addTabs: (req, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }

        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(req, "add_tads_RQ-" + currentTime, "User-Role-Management")

        _mongoose.models['Tabs'].create(req, (err, res) => {
            if (!err && res) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'success'
                responseObj['response'] = res
            } else {
                responseObj['error'] = err
                responseObj.response = null
            }
            helpAdaptor.logWriter(responseObj, "add_tads_RS-" + currentTime, "User-Role-Management")
            return callback(responseObj);
        })

    },

    // add events
    addEvents: (req, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }

        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(req, "add_events_RQ-" + currentTime, "User-Role-Management")

        _mongoose.models['Events'].create(req, (err, res) => {
            if (!err && res) {
                responseObj.status = _status.SUCCESS
                responseObj.message = 'success'
                responseObj['response'] = res
            } else {
                responseObj['error'] = err
                responseObj.response = null
            }
            helpAdaptor.logWriter(responseObj, "add_events_RS-" + currentTime, "User-Role-Management")
            return callback(responseObj);
        })
    },

    // get list of funcs and their events
    getTabs: (req, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null
        }

        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(req, "get_tads_RQ-" + currentTime, "User-Role-Management")

        let agg = _mongoose.models["Tabs"]["list"]({}, {}, { lang: "en" })
        _mongoose.models['Tabs'].aggregate(agg).exec((err, docs) => {
            if (docs && docs.length) {
                responseObj.response = docs
                responseObj.status = _status.SUCCESS
                responseObj.message = "Tab List with events"
            }
            helpAdaptor.logWriter(responseObj, "get_tads_RS-" + currentTime, "User-Role-Management")
            return callback(responseObj)
        })
    },

    // add roles
    addRoles: (req, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }

        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(req, "add_roles_RQ-" + currentTime, "User-Role-Management")

        let id = req._id, userInfo = req.userInfo
        // if(!userInfo) {
        //     responseObj.message = 'Access Denied'
        //     responseObj.response = null
        //     return callback(responseObj)
        // }
        if (id == undefined || id == null || id == '') {
            id = _mongoose.Types.ObjectId()
        }
        let checkDups = (cb) => {
            _mongoose.models['Roles'].find().where('roleName').eq(req.roleName).where('_id').ne(id).exec((err, res) => {
                if (!err && res.length > 0) {
                    responseObj.message = 'Role name already exists'
                    responseObj.response = null
                } else if (err) {
                    responseObj.message = err
                    responseObj.response = null
                } else {
                    return cb();
                }
            helpAdaptor.logWriter(responseObj, "add_roles_RS-" + currentTime, "User-Role-Management")
                return callback(responseObj)
            })
        }
        let addUpdateRoles = (cb) => {
            _mongoose.models['Roles'].findOneAndUpdate({ '_id': id }, req, { upsert: true, new: true }, (err, res) => {
                if (!err && res) {
                    responseObj.status = _status.SUCCESS
                    responseObj.message = 'success'
                    responseObj['response'] = res
                } else {
                    responseObj['error'] = err
                    responseObj.response = null
                }
                return cb();
            })
        }
        _async.series([
            checkDups.bind(),
            addUpdateRoles.bind()
        ], (err) => {
            helpAdaptor.logWriter(responseObj, "add_roles_RS-" + currentTime, "User-Role-Management")
            return callback(responseObj)
        })
    },

    // get roles
    getRoles: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null
        }

        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(body, "get_roles_RQ-" + currentTime, "User-Role-Management")

        let filter = {}
        body['offset'] = (body.offset) ? body.offset : ''
        body['limit'] = (body.limit) ? body.limit : ''
        let getRoles = (cb) => {
            if (body.key && body.key != '') {
                let key = body.key.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '')
                filter['$or'] = [
                    { 'roleName': new RegExp(key, 'i') }
                ]
            }
            _mongoose.models['Roles'].find(filter).skip(body.offset).limit(body.limit).exec((err, docs) => {
                let clone = JSON.parse(JSON.stringify(docs))
                if (clone && clone.length) {
                    for (let d of clone) {
                        d.modifiedDate = _moment(d.modifiedDate, 'YYYY-MM-DD').format("DD MMM YY")
                    }
                    responseObj.response = clone
                    responseObj.status = _status.SUCCESS
                    responseObj.message = "Roles List"
                }
                return cb();
            })
        }

        let getRolesCount = (cb) => {
            _mongoose.models["Roles"].countDocuments(filter, (err, count) => {
                if (!err && count) {
                    responseObj['total'] = count
                }
                return cb();
            })
        }

        _async.parallel([
            getRoles.bind(),
            getRolesCount.bind()], () => {
                helpAdaptor.logWriter(responseObj, "get_roles_RS-" + currentTime, "User-Role-Management")
                return callback(responseObj)
            })
    },

    getOneRole: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null
        }
        
        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(body, "add_roles_RQ-" + currentTime, "User-Role-Management")

        _mongoose.models['Roles'].findOne(body, (err, doc) => {
            if(!err && doc) {
                responseObj.response = doc
                responseObj.status = _status.SUCCESS
                responseObj.message = "Roles Details"
            }
            helpAdaptor.logWriter(responseObj, "add_roles_RS-" + currentTime, "User-Role-Management")
            return callback(responseObj)
        })
    },

    // add employee
    addEmployee: (req, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: {}
        }

        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(req, "add_employee_RQ-" + currentTime, "User-Role-Management")

        let id = req._id
        if (id == undefined || id == null || id == '') {
            id = _mongoose.Types.ObjectId()
        }
        let checkDups = (cb) => {
            _mongoose.models['Employee'].find().where('email').eq(req.email).where('_id').ne(id).exec((err, res) => {
                if (!err && res.length > 0) {
                    responseObj.message = 'Email Id already exists'
                    responseObj.response = null
                } else if (err) {
                    responseObj.message = err
                    responseObj.response = null
                } else {
                    return cb();
                }
                helpAdaptor.logWriter(responseObj, "add_employee_RS-" + currentTime, "User-Role-Management")
                return callback(responseObj)
            })
        }
        let addUpdateEmp = (cb) => {
            _mongoose.models['Employee'].findOneAndUpdate({ '_id': id }, req, { upsert: true, new: true }, (err, res) => {
                if (!err && res) {
                    let data = {
                data: {
                    email: req.email,
                    name : res.fName,
                    password : res.password,
                    role : res.role
                },
                body: {
                    template: "newEmployee",
                    toemail: req.email,
                    subject: "New employee"
                }
            }
            let emailInfo = {
                emailType: 'new_employee',
                isSend: false,
                data: data
            }
            mailer.sendMail(data, function (res) {
                if (res && res.status == 1000) {
                    emailInfo.isSend = true
                } else {
                    emailInfo.isSend = false
                }
                _mongoose.models['Emails'].create(emailInfo, (err, data) => {
                    // if (!err && data) {
                            responseObj.status = _status.SUCCESS
                            responseObj.message = 'password changed successfully please check your email'
                            return cb();
        
                    // } else {
                    //     helpAdaptor.logWriter(responseObj, "forgot_Emp_pwd_RS-" + currentTime, "User-Role-Management")
                    //     return callback(responseObj);
                    // }
                })
            })



                    // sendMailToEmp(res, 'addEmp',function(obj){   
                    //     if(obj.res == true) {
                    //         responseObj.status = _status.SUCCESS
                    //         responseObj.message = 'success'
                    //         responseObj['response'] = res
                    //         return cb();
                    //     }else {
                    //         helpAdaptor.logWriter(responseObj, "add_employee_RS-" + currentTime, "User-Role-Management")                            
                    //         return callback(responseObj);
                    //     }           
                    //     })
                } else {
                    responseObj['error'] = err
                    responseObj.response = null
                    helpAdaptor.logWriter(responseObj, "add_employee_RS-" + currentTime, "User-Role-Management")
                    return callback(responseObj);
                }             
            })
        }
        _async.series([
            checkDups.bind(),
            addUpdateEmp.bind()
        ], (err) => {
            helpAdaptor.logWriter(responseObj, "add_employee_RS-" + currentTime, "User-Role-Management")
            return callback(responseObj)
        })
    },

    // get the list of employees
    getEmployees: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null
        }

        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(body, "get_employees_RQ-" + currentTime, "User-Role-Management")

        let filter = {}
        body['offset'] = (body.offset) ? body.offset : 0
        body['limit'] = (body.limit) ? body.limit : 10
        let getEmployees = (cb) => {
            if (body.key && body.key != '') {
                let key = body.key.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '')
                filter['$or'] = [
                    { 'fName': new RegExp(key, 'i') },
                    { 'lName': new RegExp(key, 'i') },
                    { 'email': new RegExp(key, 'i') },
                    { 'role': new RegExp(key, 'i') },
                    { 'empId': new RegExp(key, 'i')}
                ]
            }
            _mongoose.models['Employee'].find(filter).skip(body.offset).limit(body.limit).exec((err, docs) => {
                if (docs && docs.length) {
                    responseObj.response = docs
                    responseObj.status = _status.SUCCESS
                    responseObj.message = "Employee List"
                }
                return cb();
            })
        }

        let getEmpsCount = (cb) => {
            _mongoose.models["Employee"].countDocuments(filter, (err, count) => {
                if (!err && count) {
                    responseObj['total'] = count
                }
                return cb();
            })
        }

        _async.parallel([
            getEmployees.bind(),
            getEmpsCount.bind()], () => {
                helpAdaptor.logWriter(responseObj, "get_employees_RS-" + currentTime, "User-Role-Management")   
                return callback(responseObj)
            })
    },

    // get single employee record
    getOneEmp: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null
        }

        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(body, "get_one_employee_RQ-" + currentTime, "User-Role-Management")

        _mongoose.models['Employee'].findOne(body, (err, doc) => {
            if(!err && doc) {
                responseObj.response = doc
                responseObj.status = _status.SUCCESS
                responseObj.message = "Employee Details"
            }
            helpAdaptor.logWriter(responseObj, "get_one_employee_RS-" + currentTime, "User-Role-Management")
            return callback(responseObj)
        })
    },

    // emp login
    empLogin: (req, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error during login',
            response: {}
        }

        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(req, "empLogin_RQ-" + currentTime, "User-Role-Management")

        let body = {
            email: req.email,
            password: req.password
        }
        let filter = {}
        let checkUser = (cb) => {
            let agg = _mongoose.models["Employee"]["loginData"](body, filter, { lang: "en" })
            _mongoose.models['Employee'].aggregate(agg).exec((err, docs) => {
                if (!err && docs.length) {
                    responseObj.response['userInfo'] = docs[0]
                } else {
                    helpAdaptor.logWriter(responseObj, "empLogin_RS-" + currentTime, "User-Role-Management")
                    return callback(responseObj)
                }
                return cb();
            })
        }
        let generateJWT = (cb) => {
            responseObj.status = _status.SUCCESS
            responseObj.message = "user logged in successfully"
            responseObj.response['accessToken'] =  auth.generateJWT(responseObj.response.userInfo)
            return cb()
        }
        _async.series([
            checkUser.bind(),
            generateJWT.bind()
        ], () => {
            helpAdaptor.logWriter(responseObj, "empLogin_RS-" + currentTime, "User-Role-Management")
            return callback(responseObj)
        })
    },

    // change emp password
    changeEmpPwd: (req, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error during login',
            response: {}
        }
        
        _mongoose.models['Employee'].findOneAndUpdate({ 'email': req.userInfo.email, 'password': req.userInfo.password },
            {$set: { 'password': req.password}}, (err, res) => {
                if (!err && res) {
                    responseObj.status = _status.SUCCESS
                    responseObj.message = 'Password updated successfully'
                } else {
                    responseObj['error'] = err
                }
                delete responseObj.response
                return callback(responseObj);
            })
    },

    //forgot password for emplyee
    ForgotEmpPwd: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error in forgot password',
            response: {}
        }

        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(body, "forgot_Emp_pwd_RQ-" + currentTime, "User-Role-Management")

        let newPwd = randomstring.generate({
            length: 10,
            charset: 'alphanumeric',
        });

        let findEmployee = (cb) => {
            _mongoose.models['Employee'].findOneAndUpdate({ 'email': body.email },
            {$set: { 'password': newPwd}}, (err, res) => {

                if (!err && res) {
                    responseObj.status = _status.SUCCESS
                    responseObj.message = 'Employee found...'
                    return cb();
                } else {
                    responseObj.status = _status.ERROR
                    responseObj.message = 'Employee not found...'
                    helpAdaptor.logWriter(responseObj, "forgot_Emp_pwd_RS-" + currentTime, "User-Role-Management")
                    return callback(responseObj)
                }
            })
        }

        let sendMail = (cb) => {
            let data = {
                data: {
                    email: body.email,
                    password : newPwd
                },
                body: {
                    template: "empForgotPwd",
                    toemail: body.email,
                    subject: "Employee forgot password"
                }
            }
            let emailInfo = {
                emailType: 'emp_forgot_pwd',
                isSend: false,
                data: data
            }
            mailer.sendMail(data, function (res) {
                if (res && res.status == 1000) {
                    emailInfo.isSend = true
                } else {
                    emailInfo.isSend = false
                }
                _mongoose.models['Emails'].create(emailInfo, (err, data) => {
                    // if (!err && data) {
                            responseObj.status = _status.SUCCESS
                            responseObj.message = 'password changed successfully please check your email'
                            return cb();
        
                    // } else {
                    //     helpAdaptor.logWriter(responseObj, "forgot_Emp_pwd_RS-" + currentTime, "User-Role-Management")
                    //     return callback(responseObj);
                    // }
                })
            })
        }
        _async.series([
            findEmployee.bind(),
            sendMail.bind()
        ], (err) => {
            helpAdaptor.logWriter(responseObj, "forgot_Emp_pwd_RS-" + currentTime, "User-Role-Management")
            return callback(responseObj)
        })
    },

    //add department
    addDepartment: (req, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null
        }

        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(req, "add_department_RQ-" + currentTime, "User-Role-Management")

        let id = req._id
        if (id == undefined || id == null || id == '') {
            id = _mongoose.Types.ObjectId()
        }
        let checkDups = (cb) => {
            _mongoose.models['Department'].find().where('deptName').eq(req.deptName).where('_id').ne(id).exec((err, res) => {
                if (!err && res.length > 0) {
                    responseObj.message = 'Department name already exists'
                    responseObj.response = null
                } else if (err) {
                    responseObj.message = err
                    responseObj.response = null
                } else {
                    return cb();
                }
                helpAdaptor.logWriter(responseObj, "add_department_RS-" + currentTime, "User-Role-Management")
                return callback(responseObj)
            })
        }
        let addUpdateDept = (cb) => {
            _mongoose.models['Department'].findOneAndUpdate({ '_id': id }, req, { upsert: true, new: true }, (err, res) => {
                if (!err && res) {
                    responseObj.status = _status.SUCCESS
                    responseObj.message = 'success'
                    responseObj['response'] = res
                } else {
                    responseObj['error'] = err
                    responseObj.response = null
                }
                return cb();
            })
        }
        _async.series([
            checkDups.bind(),
            addUpdateDept.bind()
        ], (err) => {
            helpAdaptor.logWriter(responseObj, "add_department_RS-" + currentTime, "User-Role-Management")
            return callback(responseObj)
        })
    },

    //get department list 
    getDepartment: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null
        }

        let currentTime = new Date().getTime()
        helpAdaptor.logWriter(body, "get_department_RQ-" + currentTime, "User-Role-Management")

        let filter = {}
        body['offset'] = (body.offset) ? body.offset : ''
        body['limit'] = (body.limit) ? body.limit : ''
        let getDepartment = (cb) => {
            if (body.key && body.key != '') {
                let key = body.key.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '')
                filter['$or'] = [
                    { 'deptName': new RegExp(key, 'i') },
                    { 'deptCode': new RegExp(key, 'i') }
                ]
            }
            _mongoose.models['Department'].find(filter).skip(body.offset).limit(body.limit).exec((err, docs) => {
                if (docs && docs.length) {
                    responseObj.response = docs
                    responseObj.status = _status.SUCCESS
                    responseObj.message = "Department List"
                }
                return cb();
            })
        }
        let getDeptCount = (cb) => {
            _mongoose.models["Department"].countDocuments(filter, (err, count) => {
                if (!err && count) {
                    responseObj['total'] = count
                }
                return cb();
            })
        }

        _async.parallel([
            getDepartment.bind(),
            getDeptCount.bind()], () => {
                return callback(responseObj)
            })
    },

    // get single department record
    getOneDept: (body, callback) => {
        let responseObj = {
            status: _status.ERROR,
            message: 'error',
            response: null
        }
        _mongoose.models['Department'].findOne(body, (err, doc) => {
            if(!err && doc) {
                responseObj.response = doc
                responseObj.status = _status.SUCCESS
                responseObj.message = "Department Details"
            }
            return callback(responseObj)
        })
    }
}

function sendMailToEmp  (body,type, callback)  {
    var email = {
        from: 'no-reply@carryIt.com',
        to: body.email,
        subject: 'testing',
        text: 'this is testing mail...',
        html:''
        // attachments: doc.body.attachments
    };
    if(type == 'forgotpwd') {
        email.subject = 'Forgot password'
        email.html = '<h3>Your password is changed successfully, </h3><h4>your password is - ' + body.password + '</h4>'
    }else if (type == 'addEmp') {
        email.subject = 'New Employee'
        email.html = `<h1>Hi ${body.fName},</h1><br><h2>Welcome to the carryIt you are selceted for the role - ${body.role} </h2><h3>
            Email : ${body.email},<br>
            Password : ${body.password}`
    }
    let client = nodemailer.createTransport(sgTransport(options));
    
    client.sendMail(email, function (err, info) {
        if (err) {
            return callback({res : false})
        } else {
            return callback({res : true})
        }
    });
}