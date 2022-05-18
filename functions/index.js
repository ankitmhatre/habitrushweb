const functions = require("firebase-functions");
const admin = require("firebase-admin");
const FieldValue = admin.firestore.FieldValue;
admin.initializeApp();

const { PubSub } = require("@google-cloud/pubsub");
const moment = require("moment-timezone");
const pubsubClient = new PubSub({ projectId: process.env.GCLOUD_PROJECT });

exports.firePubsub = functions.https.onRequest(async (request, response) => {
  const publisher = pubsubClient.topic("topic1");
  const data = {
    trigger: "functions",
  };
  const dataBuffer = Buffer.from(JSON.stringify(data));
  await publisher.publish(dataBuffer);

  response.status(200).send("Fired PubSub");
});

exports.createTasksAllHabitsAllUsers = functions.pubsub
  .topic("topic1")
  .onPublish(async (message, context) => {
    if (
      message.json.trigger === "cronjob" ||
      message.json.trigger === "functions"
    ) {
      var allUsers = await admin
        .firestore()
        .collectionGroup("users")
        .where("active", "==", true)
        .get();

      if (allUsers.empty) {
        console.log("No matching users.");
        return null;
      }

      allUsers.forEach(async (user) => {
        // console.log(doc.id, '=>',  doc.data())
        var allHabits = await admin
          .firestore()
          .collection("users")
          .doc(user.id)
          .collection("habits")
          .where("archived", "==", false)
          .where("active", "==", true)
          .get();

        if (allHabits.empty) {
          console.log("No matching users.");
          return null;
        }

        allHabits.forEach(async (habit) => {
          // console.log(habit.id, '=>',  habit.data())

          var updatedHabit = await admin
            .firestore()
            .collection("users")
            .doc(doc.id)
            .collection("habits")
            .where("archived", "==", false)
            .where("active", "==", true)
            .update({
              lastTriggerAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
      });
    }
    return null;
  });

/////////////////////////////////////////
exports.onHabitsTasksUpdated = functions.firestore
  .document("users/{uid}/habits/{habitId}/reminders/{taskId}")
  .onWrite(async (change, context) => {
    var uid = context.params.uid;
    var userDocument = await admin
      .firestore()
      .doc("users/" + uid)
      .get();
    var token = userDocument.data().token;

    var hybridHabitReminder= change.after.data();
    hybridHabitReminder['habitId'] = context.params.habitId;
    var message = {
      tokens: token,
      //       notification: {
      // title : change.data().habitName,
      //          body: change.data().remindAtInLocalTime.toDate().toString(),

      //       },
      data: {
        title: change.after.data().habitName,
        body: change.after.data().remindAtInLocalTime.toDate().toString(),
        type: "habitReminder",
        payload: JSON.stringify(hybridHabitReminder),
      },
    };




    return admin
      .messaging()
      .sendMulticast(message)
      .then((res) => console.log("onHabitsTasksUpdated:then", res))
      .catch((err) => console.log("onHabitsTasksUpdated:  catch", err));
  });

/////////////////////////////////////////

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
      var uid = context.params.uid;
      var habitId = context.params.habitId;
      var habitDocument = change.after.data();
      var isHabitCreated = false;

      var startDateTimeOffsetInDays = 0;
      var endDateTimeOffsetInDays = 0;
      var createReminderOnDatesWhenCreated = [];

      /**
       * GET CURRENT DATE TIME IN LOCAL OF WHERE THE HABIT IS CREATED/UPDATED
       */
      var currentDateTimeInLocal = moment(new Date());
      var startDate = moment(new Date());
      var endDate = moment(new Date());
      var habitStartDate = moment(habitDocument.habitStartDate.toDate());

      lastCompletedDate =
        habitDocument.habitLastCompletedAtDate !== 0
          ? moment(habitDocument.habitLastCompletedAtDate.toDate())
          : 0;

      if (habitDocument.habitCreatedTimeOffset.n) {
        currentDateTimeInLocal.subtract(
          habitDocument.habitCreatedTimeOffset.m,
          "m"
        );

        startDate.subtract(habitDocument.habitCreatedTimeOffset.m, "m");
        endDate.subtract(habitDocument.habitCreatedTimeOffset.m, "m");

        habitStartDate.subtract(habitDocument.habitCreatedTimeOffset.m, "m");

        if (lastCompletedDate !== 0) {
          lastCompletedDate.subtract(
            habitDocument.habitCreatedTimeOffset.m,
            "m"
          );
        }
      } else {
        currentDateTimeInLocal.add(habitDocument.habitCreatedTimeOffset.m, "m");
        startDate.add(habitDocument.habitCreatedTimeOffset.m, "m");
        endDate.add(habitDocument.habitCreatedTimeOffset.m, "m");
        habitStartDate.add(habitDocument.habitCreatedTimeOffset.m, "m");

        if (lastCompletedDate !== 0) {
          lastCompletedDate.add(habitDocument.habitCreatedTimeOffset.m, "m");
        }
      }

      //////////////////////////////////////////////

      //   console.log("startDateee", startDate.startOf("day"));

      //   console.log("habit Date", habitStartDate.startOf("day"));
      //   console.log("end  Date", endDate.endOf("day"));
      //   console.log(
      //     "startDateDateDIFFF",
      //     startDate.date() - habitStartDate.date()
      //   );

      // console.log(" startan nd habit date ", startDate.startOf("day").isSameOrAfter(habitStartDate.startOf("day")))
      // if (startDate.startOf("day").isAfter(habitStartDate.startOf("day"))) {
      //   console.log("HABIT STARTS LATER DAYS");
      //   return "HABIT STARTS LATER DAYS";
      // }

      //   console.log("HABIT STARTS NOWWW");

      //   //       console.log("falls under start date : LETS CONTINUE")

      /////////////////////////////////////////////////////////////////////////

      /**
       *  CHECKING HERE IF HABIT CREATED OT UPDATED
       */
      if (change.before.data() === undefined) {
        //HABIT CREATED
        isHabitCreated = true;

        endDateTimeOffsetInDays = 2;
        // endDate.set({ h: 0, m: 0, s: 0 });
        endDate.add(endDateTimeOffsetInDays, "d").endOf("d");
        console.log("endDate", endDate);

        var tempHabitStartDate = habitStartDate
          .clone()
          .set({ h: 0, m: 0, s: 0 });
        console.log("habitStartDate", habitStartDate);
        console.log("endDate", endDate);
        console.log(
          "days difference",
          endDate.startOf().diff(tempHabitStartDate.startOf(), "d")
        );

        console.log("///////////////////////////////////////////////");

        for (
          var m = tempHabitStartDate;
          endDate - tempHabitStartDate > 0;
          tempHabitStartDate.add(1, "days")
        ) {
          console.log("createReminderOnDatesWhenCreated", m);
          createReminderOnDatesWhenCreated.push(m.clone());
        }
        console.log("///////////////////////////////////////////////");

        console.log("habitStartDate", habitStartDate);
        console.log("endDate", endDate);

        if (createReminderOnDatesWhenCreated.length == 0) {
          console.log(
            "HABIT CREATED, HABIT START DATE IS BEYOND OUR SCHEDULING SCOPE, CRON JOB WILL TAKE CARE"
          );
          return;
        }
      } else {
        startDate.set({ h: 0, m: 0, s: 0 });
        startDate.add(2, "d");
        //HABIT UPDATED
        isHabitCreated = false;
        startDateTimeOffsetInDays = 2;
        endDateTimeOffsetInDays = 2;
        // endDate.set({ h: 0, m: 0, s: 0 });
        endDate = startDate.clone().endOf("d");

        console.log("=======habitStartDate", habitStartDate);
        console.log("======startdate", startDate);
        console.log("=======endDate", endDate);

        if (
          habitStartDate.isSameOrBefore(startDate, "d") &&
          habitStartDate.isSameOrBefore(endDate, "d")
        ) {
          createReminderOnDatesWhenCreated.push(startDate.clone());
        }
        if (createReminderOnDatesWhenCreated.length == 0) {
          console.log(
            "HABIT UPDATED, HABIT START DATE IS BEYOND OUR SCHEDULING SCOPE, NEXT CRON JOB WILL TAKE CARE"
          );
          return;
        }
      }

      var createdReminders = [];
      console.log(
        "habitDocument.habitReminderFrequency",
        habitDocument.habitReminderFrequency
      );
      console.log(
        "habitDocument.habitReminderFrequencyDays",
        habitDocument.habitReminderFrequencyDays
      );

      createReminderOnDatesWhenCreated.map((createReminderDate) => {
        console.log("createReminderDate", createReminderDate);

        var shouldCreateReminders = false;

        switch (habitDocument.habitReminderFrequency) {
          case "Everyday":
            shouldCreateReminders = true;
            break;
          case "Every x days":
            if (habitDocument.habitLastCompletedAtDate === 0) {
              var everyXDays = habitDocument.habitReminderFrequencyDays[0];

              //new habit

              if (habitStartDate.get("d") == createReminderDate.get("d")) {
                shouldCreateReminders = true;
              }
              console.log(
                "-----------------------------------------------------------------"
              );
              console.log(createReminderDate);
              var coHab = habitStartDate.clone().set({ h: 0, m: 0, s: 0 });
              console.log(coHab);
              console.log(
                "createReminderDate.diff(coHab, 'd')",
                createReminderDate.diff(coHab, "d")
              );
              console.log("everyXDays)", everyXDays);

              var cond = createReminderDate.diff(coHab, "d") == everyXDays + 1;
              console.log(cond);
              console.log(
                "-----------------------------------------------------------------"
              );

              if (cond) {
                shouldCreateReminders = true;
              }
            } else {
              var everyXDays = habitDocument.habitReminderFrequencyDays[0];
              var differenceInDays = createReminderDate.diff(
                lastCompletedDate,
                "days"
              );
              shouldCreateReminders = differenceInDays >= everyXDays;

              console.log("lastCompletedDate", lastCompletedDate);
              // console.log("currentDateTime", currentDateTimeInLocal);
              console.log(differenceInDays);
              console.log(shouldCreateReminders);
            }
            break;
          case "Weekly":
            habitDocument.habitReminderFrequencyDays.map((k) => {
              switch (k) {
                case "Su":
                  if (createReminderDate.day() == 0) {
                    shouldCreateReminders = true;
                  }
                  break;
                case "Mo":
                  if (createReminderDate.day() == 1) {
                    shouldCreateReminders = true;
                  }
                  break;
                case "Tu":
                  if (createReminderDate.day() == 2) {
                    shouldCreateReminders = true;
                  }
                  break;
                case "We":
                  if (createReminderDate.day() == 3) {
                    shouldCreateReminders = true;
                  }
                  break;
                case "Th":
                  if (createReminderDate.day() == 4) {
                    shouldCreateReminders = true;
                  }
                  break;
                case "Fr":
                  if (createReminderDate.day() == 5) {
                    shouldCreateReminders = true;
                  }
                  break;
                case "Sa":
                  if (createReminderDate.day() == 6) {
                    shouldCreateReminders = true;
                  }
                  break;
              }
            });

            break;
          case "Monthly":
            console.log("startDate", createReminderDate.date());
            console.log("Monthly", habitDocument.habitReminderFrequencyDays);
            habitDocument.habitReminderFrequencyDays.map((k) => {
              if (k == createReminderDate.date()) {
                shouldCreateReminders = true;
              }
            });

            break;
        }

        console.log(
          "shouldCreateReminders",
          shouldCreateReminders,
          createReminderDate
        );

        if (shouldCreateReminders) {
          createdReminders.push(createReminderDate.clone());
        }
      });

      if (createdReminders.length <= 0) {
        console.log("NO VALID DATES");
        return;
      } else {
        var finalReminderDateTimeLocal = [];

        createdReminders.map((reminderDate) => {
          console.log("reminderDate", reminderDate);

          reminderDate.clone().set({ h: 0, m: 0, s: 0 });

          habitDocument.habitRemindAt.forEach((e) => {
            var newHours = e.split(":").map((e) => parseInt(e));
            console.log("newHours", newHours);
            console.log("total minutes first ", reminderDate);

            var totalMinutes = newHours[0] * 60 + newHours[1];
            console.log("Adding minutes", totalMinutes);
            reminderDate.add(totalMinutes, "m");

            var tTime = reminderDate.clone();
            if (habitDocument.habitCreatedTimeOffset.n) {
              tTime.add(habitDocument.habitCreatedTimeOffset.m, "m");
            } else {
              tTime.subtract(habitDocument.habitCreatedTimeOffset.m, "m");
            }
            finalReminderDateTimeLocal.push({
              habitName: habitDocument.habitName,
              completeStatus: false,
              createdAt: new Date(),
              remindAtInLocalTime: tTime,
            });
            reminderDate.subtract(totalMinutes, "m");
          });
        });
        console.log("finalReminderDateTimeLocal", finalReminderDateTimeLocal);

        try {
          await admin.firestore().runTransaction(async (t) => {
            finalReminderDateTimeLocal.forEach((eeach) => {
              //await db.collection('cities').doc('new-city-id').set(data);
              var docRefff = admin
                .firestore()
                .collection("users")
                .doc(uid)
                .collection("habits")
                .doc(habitId)
                .collection("reminders")
                .doc(eeach.remindAtInLocalTime.clone().valueOf().toString());

              t.set(docRefff, eeach);
            });
          });

          console.log("Transaction success!");
        } catch (e) {
          console.log("Transaction failure:", e);
        }
      }

      //      console.log(reminders);
    }

    //   return {
    //     completeStatus: false,
    //     createdAt: new Date(),
    //     remindAt: remindDateInDateFormat,
    //   };
    return;
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
