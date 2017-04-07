// collect and save scores to mongodb
// response are still hardcoded and always static
// maybe will be changed in future

module.exports = function (controller) {
    controller.log("Loaded scoring skills");
    function match_keywords(keywords, message) {
        return keywords.some(function (item) {
            return (new RegExp(item).test(message));
        });
    }

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

    controller.hears(controller.react_keywords, ['ambient'], function (bot, message) {
        bot.api.reactions.add({
            timestamp: message.ts,
            channel: message.channel,
            name: 'clap',
        }, function(err, res) {
            if (err) {
                console.log('Failed to add emoji reaction :(', err);
            }
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
        if (message.item.channel[0] == 'C') {
            bot.api.channels.history(chl_query, function (err, data) {
                process_reacts(err, data);
            });
        }
        else if (message.item.channel[0] == 'G') {
            bot.api.groups.history(chl_query, function (err, data) {
                process_reacts(err, data);
            });
        }

        function process_reacts(err, data) {
            if (err) {
                throw err;
            }
            var text = data.messages.length ? data.messages[0].text : "";
            
            // get the mentions of users in the message
            var users = extract_users(text);
            if (users.length && match_keywords(controller.react_keywords, text)) {
                // if there are direct mentions we count scores
                // otherwise do nothing
                var updts = users.map(function (e) {
                    return {
                        updateOne: {
                            filter: { _id : e },
                            update: { $inc : { score : controller.default_score } },
                            upsert: true
                        }
                    };
                });
                controller.collection.bulkWrite(updts, { w: 1 }, function (err, n_rec, status) {
                    controller.collection.find({ '_id': { $in: users } }).toArray(function (err, docs) {
                        controller.storage.channels.get(message.item.channel, function (err, ch) {
                            // create list of "@user: score" elements
                            try {
                                // WARNING: Not sure if it will work in private channels
                                var u_scores = ch.members.filter(function (e) {
                                    return users.includes(e.id);
                                }).map(function (e) {
                                    var score = docs.filter(function (d) { return d._id == e.id; })[0].score;
                                    return "@" + e.name + ": `" + score + "`"; 
                                });
                            }
                            catch(excp) {
                                var u_scores = users.map(function (e) {
                                    var score = docs.filter(function (d) { return d._id == e; })[0].score;
                                    return "@" + e + ": `" + score + "`"; 
                                });
                            }
                            if (ch && ch.praises && ch.praises[message.item.ts]) {
                                // if channel is in storage and
                                // the celebrating message was produced and saved earlier,
                                // identified by its timestamp (ts)
                                // we will just update that message
                                ch.praises[message.item.ts].current_score += controller.default_score;
                                controller.storage.channels.save(ch, function (err) {
                                    var response = {};
                                    response.text = "`" + ch.praises[message.item.ts].current_score + "`" +
                                                    "scores! " + "Nice job! " + u_scores.join(", ");
                                    response.ts = ch.praises[message.item.ts].ts;
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
                                let response = "`" + controller.default_score + "` " + "scores! " +
                                               "Nice job! " + u_scores.join(", ");

                                // hack in the message because
                                // add_reaction event message does not have channel property
                                message.channel = message.item.channel;
                                bot.reply(message, response, function (err, sent_message) {
                                    if (ch && ch.praises && Object.keys(ch.praises).length > 5) {
                                        // if more than 5 records in the channel
                                        // delete the praise for the earliest message
                                        let smlst = Object.keys(ch.praises)
                                                        .sort(function (a, b) {
                                                            return parseFloat(a) - parseFloat(b);
                                                        })[0];
                                        delete ch.praises[smlst];
                                    }
                                    // we preserve this info in order to be able to update
                                    // this message later
                                    // the logic is as follows:
                                    // channel.praises.ts_of_msg_with_reacts maps to
                                    // this info below
                                    var msg_meta = {
                                            ts: sent_message.ts,
                                            current_score: controller.default_score
                                    };
                                    // in case channel was not saved before
                                    if (!ch) {
                                        ch = {};
                                        ch.id = message.item.channel;
                                        ch.praises = {};
                                    }
                                    ch.praises[message.item.ts] = msg_meta;
                                    controller.storage.channels.save(ch);
                                });
                            }
                        });
                    });
                });
            }
        }
    });
}
