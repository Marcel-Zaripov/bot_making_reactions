'use strict';


var botkit = require('botkit');
var mongodb = require('mongodb');


function connectToDb() {
    var db_url = process.env.db_url;
    mongodb.MongoClient.connect(db_url, function (err, db) {
        if (err) {
            throw err;
        }
        console.log('Connected to MongoDB');
        startBot(db);
    });
}


function startBot(db) {

    // single step of incrementing the score
    var default_score = 1;
    var collection = db.collection('scores');
    var controller = botkit.slackbot({
        debug: false,
        json_file_store: 'json_storage'
    });
    controller.spawn({
        token: process.env.token
    }).startRTM(function (err) {
        if (err) {
            throw err;
        }
    });

    controller.hears(['hello', 'hi'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
        // customize in future
        bot.reply(message, 'Hello! I will keep track of positive feedback for you!:wink:');
    });

    controller.hears(['report', 'stats'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
        bot.api.users.info({user: message.user}, function (err, response) {

            // first get the slack name of the user
            var { name: user_name } = response.user;
            bot.startConversation(message, function (err, convo) {
                collection.findOne({_id: message.user}, function (db_err, result) {
                    if (db_err) {
                        let response = "Sorry, @" + user_name +
                                       "! Could not reach the database this time.:disappointed:";
                        convo.say(response);
                    }
                    if (result == null) {
                        let response = "Sorry, @" + user_name +
                                       "! Looks like you don't have any scores just yet. " +
                                       "Anyway, Don't hang your head! You will get some soon!:wink:";
                        convo.say(response);
                    }
                    else {
                        let response = "Well, @" + user_name +
                                        ". Your score up to this time is: `" +
                                        result.score + "`. So keep it up! :thumbsup:";
                        convo.say(response);
                    }
                });
            });
        });
    });

    controller.on('reaction_added', function (bot, message) {

        // only other users' reactions add to the score
        if (message.user != message.item_user) {
            collection.findAndModify(
                {_id: message.item_user},
                [['_id', 1]],
                {$inc: {score: default_score}},
                {new: true, upsert: true},
                function (err, result) {
                    controller.storage.users.get(message.user, function (err, user) {
                        if (user && user.praise[message.item.ts]) {
                            // if user exists in db and this message had reactions before
                            // just update the message (NOTE: message is identified by ts)

                            // change the score for current message and save it to store
                            user.praise[message.item.ts].current_score += default_score;
                            controller.storage.users.save(user, function (err) {
                                let response = {};
                                response.text = "`" + user.praise[message.item.ts].current_score + "` " +
                                                "Nice job! @" + message.item_user +
                                                " : `" + result.value.score + "`";
                                response.ts = user.praise[message.item.ts].ts;
                                response.channel = user.praise[message.item.ts].channel;
                                bot.api.chat.update(response, function (err, json) {
                                    if (err) {
                                        throw err;
                                    }
                                });
                            });
                        }
                        else {
                            // this is the case user was not congratulated before
                            let response = "`" + default_score + "` " +
                                           "Nice job! @" + user.name +
                                           " : `" + result.value.score + "`";

                            // hack in the message because
                            // add_reaction event message does not have channel property
                            message.channel = message.item.channel;
                            bot.reply(message, response, function (err, sent_message) {
                                bot.api.users.info({user: message.item_user}, function (err, resp) {

                                    // compile object first, based on the user object retrieved before
                                    var data;
                                    var msg_meta = {
                                                    ts: sent_message.ts,
                                                    channel: sent_message.channel,
                                                    current_score: default_score
                                                    };
                                    if (user) {
                                        data = user;
                                        if (Object.keys(data.praise).length > 3) {

                                            // if more than 3 records for a user
                                            // delete the praise for the earliest message
                                            let smlst = Object.keys(data.praise)
                                                            .sort(function (a, b) {
                                                                return parseFloat(a) - parseFloat(b);
                                                            })[0];
                                            delete data.praise[smlst];
                                        }
                                    }
                                    else {
                                        data.id = message.item_user;
                                        data.name = resp.user.name;
                                        data.praise = {};
                                    }
                                    data.praise[message.item.ts] = msg_meta;
                                    controller.storage.users.save(data);
                                });
                            });
                        }
                    });
                });
        }
    });
}


if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}
if (!process.env.db_url) {
    console.log('Error: Specify url path to db in environment with db_url');
    process.exit(1);
}

connectToDb()
