const functions = require("firebase-functions");
const admin = require("firebase-admin");
const FieldValue = admin.firestore.FieldValue;
admin.initializeApp();

const { PubSub } = require("@google-cloud/pubsub");
const pubsubClient = new PubSub({ projectId: process.env.GCLOUD_PROJECT });

exports.firePubsub = functions.https.onRequest(async (request, response) => {
  const publisher = pubsubClient.topic("topic1");
  const data = {
    name: "FunctionsTrigger",
  };
  const dataBuffer = Buffer.from(JSON.stringify(data));
  await publisher.publish(dataBuffer);

  response.status(200).send("Fired PubSub");
});

exports.myFunction = functions.pubsub
  .topic("topic1")
  .onPublish(async (message, context) => {
    var allUsers = await admin.firestore().collectionGroup("users").get();

    allUsers.forEach(async (doc) => {
      // console.log(doc.id, '=>',  doc.data())
      var allHabits = await admin
        .firestore()
        .collection("users")
        .doc(doc.id)
        .collection("habits")
        .get();

      allHabits.forEach(async (habit) => {
        // console.log(habit.id, '=>',  habit.data())

        var thiHabit = await admin
          .firestore()
          .collection("users")
          .doc(doc.id)
          .collection("habits")
          .doc(habit.id)
          .update({
            lastTriggerAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      });
      // var docs =
    });
  });

// exports.webhook = functions.pubsub.schedule('0 23 * * *')
// .timeZone('Asia/Kolkata') // Users can choose timezone - default is America/Los_Angeles
// .onRun((context) => {
// console.log(context)
// });

/**
 * WeLcome email
 */

exports.onHabitsTasksUpdated = functions.firestore
  .document("users/{uid}/habits/{habitId}/tasks/{taskId}")
  .onWrite(async (change, context) => {
    var uid = context.params.uid;
    var userDocument = await admin
      .firestore()
      .doc("users/" + uid)
      .get();
    var token = userDocument.data().token;

    var message = {
      tokens: [token],
      notification: {
        title: "Tasks got updated for a new habit",
        // body: JSON.stringify(change.after.data().tasks),
      },
      data: {
        tasks: JSON.stringify(change.after.data()),
      },
    };

    return admin
      .messaging()
      .sendMulticast(message)
      .then((res) => console.log("then", res))
      .catch((err) => console.log("catch", err));
  });

exports.onHabitsCreatedForUser = functions.firestore
  .document("users/{uid}/habits/{habitId}")
  .onWrite(async (change, context) => {
    if (change.after.data() === undefined) {
      console.log("habit", "habit deleted");
      //habit was deleted
    }
    // else if(change.after.data()!==undefined && change.before.data() === undefined) {
    //   console.log("habit", "habit created");
    //      //habit was created
    // }
    else {
      console.log("habit", " updated");
      //Habit was updated/created

      var uid = context.params.uid;
      var habitId = context.params.habitId;
      var habitDocument = change.after.data();
      var startDate = habitDocument.habitStartDate.toDate();
      var currentDateTime = new Date();
      var shouldCreateReminders = false;

      switch (habitDocument.habitReminderFrequency) {
        case "Everyday":
          shouldCreateReminders = true;
          break;
        case "Every x days":
          var everyxDays = habitDocument.habitReminderFrequencyDays[0];
          break;
        case "Weekly":
          habitDocument.habitReminderFrequencyDays.map((k) => {
            var day = 0;

            switch (k) {
              case "Su":
                day = 0;
                break;
              case "Mo":
                day = 1;
                break;
              case "Tu":
                day = 2;
                break;
              case "We":
                day = 3;
                break;
              case "Th":
                day = 4;
                break;
              case "Fr":
                day = 5;
                break;
              case "Sa":
                day = 6;
                break;
            }

            if (currentDateTime.getDay() + 1 == day) {
              shouldCreateReminders = true;
            }else if(currentDateTime.getDay() ==6 && day==0){
              shouldCreateReminders = true;
            }
          });

          break;
          case "Monthly" : 
          habitDocument.habitReminderFrequencyDays.map((k)=>{
          if(k==currentDateTime.getDate()+1){
            shouldCreateReminders = true;
          }
          })
        
          break;
      }


      if(shouldCreateReminders){
        console.log("shouldCreateReminders")
        var updatedTimings = habitDocument.habitRemindAt.map((e) => {
          var newHours = e.split(":");
          var remindDate = startDate;
          remindDate = remindDate.setHours(
            parseInt(newHours[0]),
            parseInt(newHours[1])
          );
  
          var remindDateInDateFormat = new Date(remindDate);
  
          return {
            completeStatus: false,
            createdAt: new Date(),
            remindAt: remindDateInDateFormat,
          };
        });
      }
    }
  return
  });

/////////////////////////////////////////

//HELPER FUNCTIONS

////////////////////////////////////////

function formatDatetoYYYYMMDD(date) {
  var d = new Date(date),
    month = "" + (d.getMonth() + 1),
    day = "" + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return year + month + day;
}

function toCustomIsoString(date) {
  var tzo = -date.getTimezoneOffset(),
    dif = tzo >= 0 ? "+" : "-",
    pad = function (num) {
      return (num < 10 ? "0" : "") + num;
    };

  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes()) +
    ":" +
    pad(date.getSeconds()) +
    dif +
    pad(Math.floor(Math.abs(tzo) / 60)) +
    ":" +
    pad(Math.abs(tzo) % 60)
  );
}
