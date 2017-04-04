'use strict';


var botkit = require('botkit');
var mongodb = require('mongodb');


function connectToDb() {
    var db_url = process.env.db_url;
    mongodb.MongoClient.connect(db_url, function (err, db) {
        if (err) {
            throw err;
        }
        console.log('***** Connected to MongoDB *****');
        startBot(db);
    });
}


function startBot(db) {


    function extract_users(msg_text) {
        var r = /<@\S+>/g;
        var m = msg_text.match(r);
        if (m) {
            return m.map(function (e) { return e.slice(2, -1); });
        } 
        else {
            return [];
        }
    }

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

    controller.on('bot_channel_join', function (bot, message) {
        // it is a work-around for bot to preserve names of users
        // that are in the channel he joined,
        bot.api.channels.info(message.channel, function (err, channel) {
            bot.api.users.list({ 'presence': false }, function (err, all_users) {
                var channel_users = all_users.members.filter(function (e) {
                    return channel.members.includes(e.id); 
                }).map(function (e) { return {id: e.id, name: e.name }; });
                controller.storage.channels.save({
                    id: message.channel,
                    members: channel_users
                }, function (err) {
                    bot.reply(message, "Hello, everybody! I will keep an eye on you:wink:");
                });
            });
        });
    });

    controller.on('user_channel_join', function (bot, message) {
        // make sure the user's name saved when he connects to
        // the channel where the bot is presented
        bot.api.users.info({user: message.user}, function (err, resp) {
            controller.storage.channels.get(message.channel, function (err, channel) {
                var user = {
                    id: resp.user.id,
                    name: resp.user.name
                };
                channel.members.push(user);
                controller.storage.channels.save({channel}, function (err) {
                    var text = "Hello, " + user.name + "! I am @reactionbot and I will keep the scores for reactions!";
                    bot.reply(message, text);
                });
            });
        });
    });

    controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
        // greet user, customize in future
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
        // find who is praised in the message first
        var chl_query = {
            channel: message.item.channel,
            latest: message.item.ts,
            count: 1,
            inclusive: 1
        };
        // retrieve the message
        bot.api.channels.history(chl_query, function (err, data) {
            if (err) {
                throw err;
            }
            // get the mentions of users in the message
            var users = extract_users(data.messages[0].text);
            var updts = users.map(function (e) {
                return {
                    updateOne: {
                        filter: { _id : e },
                        update: { $inc : { score : default_score } },
                        upsert: true
                    }
                };
            });
            collection.bulkWrite(updts, { w: 1 }, function (err, n_rec, status) {
                collection.find({ '_id': { $in: users } }).toArray(function (err, docs) {
                    controller.storage.channels.get(message.item.channel, function (err, ch) {
                        // create list of "@user: score" elements
                        // WARNING: Not sure if it will work in private channels
                        var u_scores = ch.members.filter(function (e) {
                            return users.includes(e.id);
                        }).map(function (e) {
                            var score = docs.filter(function (d) { return d._id === e.id; })[0].score;
                            return "@" + e.name + ": `" + score + "`"; 
                        });
                        if (ch.praises[message.item.ts]) {
                            // if channel is in storage and
                            // the celebrating message was produced and saved earlier,
                            // identified by its timestamp (ts)
                            // we will just update that message
                            ch.praise[message.item.ts].current_score += default_score;
                            controller.storage.channels.save(ch, function (err) {
                                var response = {};
                                response.text = "`" + ch.praise[message.item.ts].current_score + "`" +
                                                "scores! " + "Nice job! " + u_scores.join(", ");
                                response.ts = ch.praise[message.item.ts].ts;
                                response.channel = ch.id;
                                bot.api.chat.update(response, function (err, json) {
                                    if (err) {
                                        throw err;
                                    }
                                });
                            });
                        }
                        else {
                            // no celebrating message yet, so create one and
                            // save it to storage
                            let response = "`" + default_score + "` " + "scores! " +
                                           "Nice job! " + u_scores.join(", ");

                            // hack in the message because
                            // add_reaction event message does not have channel property
                            message.channel = message.item.channel;
                            bot.reply(message, response, function (err, sent_message) {

                                if (Object.keys(ch.praises).length > 5) {
                                    // if more than 5 records in the channel
                                    // delete the praise for the earliest message
                                    let smlst = Object.keys(ch.praise)
                                                    .sort(function (a, b) {
                                                        return parseFloat(a) - parseFloat(b);
                                                    })[0];
                                    delete ch.praise[smlst];
                                }
                                // we preserve this info in order to be able to update
                                // this message later
                                // the logic is as follows:
                                // channel.praises.ts_of_msg_with_reacts maps to
                                // this info below
                                var msg_meta = {
                                        ts: sent_message.ts,
                                        current_score: default_score
                                };
                                ch.praises[message.item.ts] = msg_meta;
                                controller.storage.channels.save(ch);
                            });
                        }
                    });
                });
            });
        });
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
