var moment      = require("moment");
var SQL         = require('../storage/database');
const db        = new SQL();

module.exports = {


    verifySession: function(req, res, next){

        console.log(`middleware:`)

        console.log(req.session.sessionID)

        if(!req.session.sessionID) { 
            console.log(`no session, generated token`)
            req.session.sessionID = [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
            req.session.save();
        }
        next()
   
    }

}