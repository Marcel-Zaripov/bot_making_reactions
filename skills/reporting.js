// the ways to query the bot for score accumulated over time

module.exports = function (controller) {
    controller.log("Loaded reporting skills");
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
