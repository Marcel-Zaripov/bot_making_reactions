// maybe will be greeting user by the name in the future
// help docs
var description = `
replying to simple 'hello', 'hi', or 'howdy' by short concise message. Will be customized in the future to something fun.
`;
var help = {
    name: "greeting",
    description: description,
    short: "Say hi!",
    commands: [
        {
            name: "hello",
            triggers: "`hello`, `hi`, `howdy`",
            description: [
                "Do you really interested in the help to this command?",
                "Well, here you go...",
                "This bot is polite - so when you say hello, it always greets you back.",
                "That is really it."
            ],
            short: "friendly greets person",
            works_for: "'direct_message', 'direct_mention', 'mention'"
        }
    ]
};

module.exports = function (controller) {
    controller.help.push(help);

    controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
        // greet user, customize in future
        bot.reply(message, 'Hello! I will keep track of positive feedback for you!:wink:');
    });
}
