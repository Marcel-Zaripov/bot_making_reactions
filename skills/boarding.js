// this set of skills is responsible for bots recognizing users

module.exports = function (controller) {
    // help docs
    var description = `
        The set of functions that ensures 
        that bot is acquainted with channel users 
        (i.e. their names and ids are saved to bot’s storage) 
        in order to avoid querying slack api every time the 
        score is updated in the praise message. 
        The corner case is if either the bot was in the channel 
        before being deployed / while being offline, 
        or a new user connected to the channel 
        while the bot was offline. 
        To cover this up the function of “welcoming” is introduced, 
        which works this way: send “welcome” + either direct 
        or indirect mention of bot user, 
        e.g. “welcome @reactionbot” or “@reactionbot welcome”.
        (punctuation or any other words do not matter, 
        what triggers it is keyword welcome and mention of bot user)
    `;
    var help = {
        name: "boarding",
        description: description,
        short: "Introduce all users of channel to the bot.",
        commands: [
            {
                name: "`welcome`",
                triggers: "`welcome`",
                description: [
                    "Run `reaction_bot welcome` or `welcome reaction_bot` to introduce the bot in the channel.",
                    "This command only needs to be run in the channel if the bot joined the channel or if a new user joined while bot is offline.",
                    "Command is only run in either private or public channel, where the bot is presented."
                ],
                short: "gather information about users in current channel",
                works_for: "'direct_mention', 'mention'"
            }
        ]
    };
    controller.help.push(help);
    function save_users(bot, message) {
        // it is a work-around for bot to preserve names of users
        // that are in the channel he joined
        if (message.channel && message.channel[0] == 'C') {
            // if it is open channel - retrieve via channels api
            bot.api.channels.info({ channel: message.channel }, get_users);
        } 
        else if (message.channel && message.channel[0] == 'G') {
            // if it is private channel - get via groups api
            bot.api.groups.info({ channel: message.channel }, get_users);
        }
        else {
            // it is dm, though it should not happen, but still we do nothing but answer
            bot.reply(message, "Hello! I will keep an eye on you:wink:");
        }

        function get_users(err_ch, resp) {
            bot.api.users.list({ presence: false }, function (err_u, all_users) {
                var channel_users = all_users.members.filter(function (e) {
                    var channel = resp.channel || resp.group;
                    return channel.members.includes(e.id); 
                }).map(function (e) { return {id: e.id, name: e.name }; });
                controller.storage.channels.save({
                    id: message.channel,
                    members: channel_users,
                    praises: {}
                }, function (err) {
                    bot.reply(message, "Hello, everybody! I will keep an eye on you:wink:");
                });
            });
        }
    }

    function get_user_info(bot, message) {
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
    }

    controller.on('bot_channel_join', function (bot, message) {
        save_users(bot, message);
    });

    controller.on('bot_group_join', function (bot, message) {
        save_users(bot, message);
    });

    controller.on('user_channel_join', function (bot, message) {
        get_user_info(bot, message);
    });

    controller.on('user_group_join', function (bot, message) {
        get_user_info(bot, message);
    });

    // this is introduced in order to work around cases when bot is in channel already
    // and did not collect users' info
    controller.hears(['welcome'], ['direct_mention', 'mention'], function (bot, message) {
        save_users(bot, message);
    });
}
