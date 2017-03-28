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
    var default_score = 1;
    var collection = db.collection('scores');
    var controller = botkit.slackbot({
        debug: false
    });
    controller.spawn({
        token: process.env.token
    }).startRTM(function (err) {
        if (err) {
            throw err;
        }
    });

    controller.hears(['hello', 'hi'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
        bot.reply(message, 'Hello! I will keep track of positive feedback for you!');
    });

    controller.hears(['report', 'stats'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
        bot.api.users.info({user: message.user}, function(err, response) {
            var { name: user_name } = response.user;
            bot.startConversation(message, function(err, convo) {
                collection.findOne({_id: message.user}, function(db_err, item) {
                    if (db_err) {
                        let response = "Sorry, @" + user_name +
                                       "! Could not reach the database this time.:disappointed:";
                        convo.say(response);
                    }
                    if (item == null) {
                        let response = "Sorry, @" + user_name +
                                       "! Looks like you don't have any scores just yet. " +
                                       "Anyway, Don't hang your head! You will get some soon!:wink:";
                        convo.say(response);
                    }
                    else {
                        let response = "Well, @" + user_name +
                                        ". Your score up to this time is: `" + 
                                        item.score + "`. So keep it up! :thumbsup:";
                        convo.say(response);
                    }
                });
            });
        });
    });

    controller.on('reaction_added', function (bot, message) {
        if (message.user != message.item_user) {
            collection.update(
                {_id: message.item_user},
                {$inc: {score: default_score}},
                {upsert: true}
            );
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
