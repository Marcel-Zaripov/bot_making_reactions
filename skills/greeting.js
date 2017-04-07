// maybe will be greeting user by the name in the future

module.exports = function (controller) {
    controller.log("Loaded greeting skills");
    controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
        // greet user, customize in future
        bot.reply(message, 'Hello! I will keep track of positive feedback for you!:wink:');
    });
}
