const functions = require("firebase-functions");
const admin = require('firebase-admin');
const FieldValue = admin.firestore.FieldValue;
admin.initializeApp();


/**
 * WeLcome email
 */


 exports.onHabitsLogsUpdated = functions.firestore
 .document('users/{uid}/habits/{habitId}/logs/{year}/{month}/{date}')
 .onWrite(async (change, context) => { 

  var uid = context.params.uid;
  var userDocument = await admin.firestore().doc("users/" + uid).get();
  var token = userDocument.data().token





var message = {
  tokens: [token],
 notification : {
   title : "Tasks got updated for a new habit",
   "body" : JSON.stringify(change.after.data().tasks),
   data : {
    tasks : JSON.stringify(change.after.data().tasks)
  }
 }
//  data : {
//    tasks : JSON.stringify(change.after.data().tasks)
//  }
}



return admin
.messaging()
.sendMulticast(message)
.then((res) => console.log("then", res))
.catch((err) => console.log("catch", err));


 });


 exports.onHabitsCreatedForUser = functions.firestore
 .document('users/{uid}/habits/{habitId}')
 .onWrite(async (change, context) => { 
  // console.log("change", change.after.data())
    var uid = context.params.uid;
    var userDocument = await admin.firestore().doc("users/" + uid).get();
    var token = userDocument.data().token


    var habitId =context.params.habitId;
    var habitDocument =  change.after.data();
   var startDate= habitDocument.habitStartDate.toDate();

//var remindTimings = habitDocument.habitRemindAt
var updatedTimings =  habitDocument.habitRemindAt.map((e) => {

  var newHours = e.split(":");
  

  var remindDate = startDate;
 

   remindDate =  remindDate.setHours(parseInt(newHours[0]), parseInt(newHours[1]));
var remindDateInDateFormat = new Date(remindDate);

  return {
    completeStatus :false,
    createdAt : (new Date()),
    remindAt :  remindDateInDateFormat
  }
})

//console.log(updatedTimings)

var writeLogsNext = await admin.firestore().doc("users/" + uid+ "/habits/" +habitId + "/logs/" + startDate.getFullYear() + "/" +(startDate.getMonth()+1) + "/" + startDate.getDate() ).update({
"tasks" : updatedTimings
}, {merge :true})








  //  var message = {
  //    tokens: [token],
  //   notification : {
  //     title : "Hello",
  //     "body" : habitId
  //   }
  //  }







   
 return
  //  admin
  // .messaging()
  // .sendMulticast(message)
  // .then((res) => console.log("then", res))
  // .catch((err) => console.log("catch", err));
 
  });



























// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/**
 * WeLcome email
 */
// exports.sendWelcomeEmail = functions.auth.user().onCreate((user) => {
//     console.log(user)
//   });


/////////////////////////////////////////
 

//HELPER FUNCTIONS


////////////////////////////////////////

function toCustomIsoString(date) {
  var tzo = -date.getTimezoneOffset(),
      dif = tzo >= 0 ? '+' : '-',
      pad = function(num) {
          return (num < 10 ? '0' : '') + num;
      };

  return date.getFullYear() +
      '-' + pad(date.getMonth() + 1) +
      '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) +
      ':' + pad(date.getMinutes()) +
      ':' + pad(date.getSeconds()) +
      dif + pad(Math.floor(Math.abs(tzo) / 60)) +
      ':' + pad(Math.abs(tzo) % 60);
}