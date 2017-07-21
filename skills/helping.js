// in bot help

module.exports = function (controller) {
    // help docs
    var description = `
        This is skill's logic is to provide structured and organized help. 
        It gathers the help information from each skill 
        (nominaly modules, where the code to perform different task resides) 
        and organizes it into the structured output. Several options are available 
        to query help - type "help" to get the general help doc on the bot, 
        "help skills" to get the information about the skills,
        "help commands" to get all available commands,
        to get information on particular skill or command type 
        "help command <command_name>" or "help skill <skill_name>"
    `;
    var help = {
        name: "helping",
        description: description,
        short: "functionality and commands to provide interactive help in slack messages",
        commands: [
            {
                name: "`help`",
                triggers: "`help`, `help skills`, `help commands`, `help skill <skill_name>`, `help command <command_name>`",
                description: [
                    "This command can provide general help, as well as structured help by topic.",
                    "Use `help`, to get the most general help.",
                    "Use `help skills` to get information on skills (what bot can do) presented in the bot.",
                    "Use `help commands` to get to know ways to interact with the bot.",
                    "Finally, use `help skill <skill_name>` or `help command <command_name>` to get the information on concrete thing."
                ],
                short: "provide general help, when used with arguments gives help on topic",
                works_for: "'direct_message', 'direct_mention', 'mention'"
            }
        ]
    };
    controller.help.push(help);

    function sendHelp(convo, resp) {
        if (resp instanceof Array) {
            resp.forEach(function (line) {
                convo.say(line);
            });
        }
        else {
            convo.say(resp);
        }
    }

    function matchStr(str, pattern) {
        return new RegExp(pattern).test(str);
    }

    function composeMsg(objects, compose_fn) {
        var result = [];
        objects.forEach(function(doc) {
            result.push(compose_fn(doc));
        });
        return result;
    }

    controller.hears(['help'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
        bot.startConversation(message, function (err, convo) {
        // first check if there is arguments after help
        var args = message.text.split(" ").slice(1);
            switch (args.length) {
                case 0:
                    // general help
                    sendHelp(convo, controller.general_help);
                    break;
                case 1:
                    // help on skills and commands in general
                    if (matchStr(args[0], "skills")) {
                        var resp = ["Here is the list of my skills: "];
                        resp.push(...composeMsg(controller.help, function(doc) {
                            var commands = doc.commands.map(function(cmd) { return cmd.name; });
                            return `*${doc.name}* --- ${doc.short}\n${commands.length > 0 ? ">Available commands: " + commands : ""}`;
                        }));
                        resp.push("Get information on each skill with `help skill <skill_name>`!");
                        sendHelp(convo, resp);
                    }
                    if (matchStr(args[0], "commands")) {
                        var resp = ["Here are all of the commands I understand: "];
                        resp.push(...composeMsg(controller.help, function(doc) {
                            var cmds = doc.commands.map(function(cmd) {
                                return `*Command name:* ${cmd.name} --- ${cmd.short}`;
                            });
                            return cmds.join("\n");
                        }));
                        resp.push("Get information on each command with `help command <command_name>`!");
                        sendHelp(convo, resp);
                    }
                    break;
                case 2:
                    // help on individual commands and skills
                    break;
            }
        });
    });
}
