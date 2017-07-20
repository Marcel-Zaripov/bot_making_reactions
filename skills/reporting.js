// the ways to query the bot for score accumulated over time

module.exports = function (controller) {
    // help docs
    var description = `
        This skill primary task is to collect inforamtion about 
        reactions added to users from the database. 
        The important note here: bot queries for name of the user 
        from its storage, thus it is important that the user was introduced to bot 
        with either welcome in or when joining to the same channel as bot.
        Then, on sending “report” or “stats” by direct message 
        or with direct / indirect mention, 
        the bot will respond with total score of the user.
    `;
    var help = {
        name: "reporting",
        description: description,
        short: "the functions to get the user statistics.",
        commands: [
            {
                name: "`report`",
                triggers: "`report`, `stats`",
                description: [
                    "Use `report` command in direct_message or with mention of bot to see your current stats.",
                    "The stats are the number of reactions that the events that mentioned you gatherd collectively.",
                    "For now it is just sum, but maybe later you will see something like what reactions in what quantity you got:)"
                ],
                short: "show stats up to this point",
                works_for: "'direct_message', 'direct_mention', 'mention'"
            }
        ]
    };
    controller.help.push(help);
    controller.hears(['report', 'stats'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
        bot.api.users.info({user: message.user}, function (err, response) {

            // first get the slack name of the user
            var { name: user_name } = response.user;
            bot.startConversation(message, function (err, convo) {
                controller.collection.findOne({_id: message.user}, function (db_err, result) {
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
}
