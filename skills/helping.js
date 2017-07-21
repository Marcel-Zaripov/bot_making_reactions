// in bot help
// help docs
var description = `
This skill's logic is to provide structured and organized help. It gathers the help information from each skill 
(nominaly modules, where the code to perform different task resides) and organizes it into the structured output. Several options are available 
to query help - type "help" to get the general help doc on the bot, "help skills" to get the information about the skills, "help commands" to get all available commands,
to get information on particular skill or command type "help command <command_name>" or "help skill <skill_name>"
`;
var help = {
    name: "helping",
    description: description,
    short: "functionality and commands to provide interactive help in slack messages",
    commands: [
        {
            name: "help",
            triggers: "`help`, `help skills`, `help commands`, `help skill <skill_name>`, `help command <command_name>`",
            description: [
                "This command can provide general help, as well as structured help by topic.",
                "Use `help`, to get the most general help.",
                "Use `help skills` to get information on skills (what bot can do) presented in the bot.",
                "Use `help commands` to get to know ways to interact with the bot.",
                "Finally, use `help skill <skill_name>` or `help command <command_name>` to get the information on concrete thing."
            ],
            short: "provides general help, when used with arguments gives help on topic",
            works_for: "'direct_message', 'direct_mention', 'mention'"
        }
    ]
};

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

module.exports = function (controller) {
    controller.help.push(help);

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
                    else if (matchStr(args[0], "commands")) {
                        var resp = ["Here are all of the commands I understand: "];
                        resp.push(...composeMsg(controller.help, function(doc) {
                            var cmds = composeMsg(doc.commands, function(cmd) {
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
                    if (matchStr(args[0], "skill")) {
                        var skill = controller.help.find(function(doc) {return matchStr(args[1].toLowerCase(), doc.name); });
                        if (skill) {
                            var resp = [`Here is what *${skill.name}* is all about: `];
                            resp.push(skill.description);
                            if (skill.commands.length > 0) {
                                resp.push("Here are all of the commands that this skill brings: ");
                                resp.push(composeMsg(skill.commands, function(cmd) {
                                    return `*Command name*: ${cmd.name} --> ${cmd.short}`;
                                }).join("\n"));
                            }
                            sendHelp(convo, resp);
                        }
                        else {
                            sendHelp(convo, `There is no such skill as ${args[1]}`);
                        }
                    }
                    else if (matchStr(args[0, "command"])) {
                        var all_cmds = controller.help.map(function(doc) {
                            return doc.commands; 
                        }).reduce(function(a, b) {return a.concat(b); });
                        var cmd = all_cmds.find(function (doc) { return matchStr(args[1].toLowerCase(), doc.name); });
                        if (cmd) {
                            var resp = [`*${cmd.name}* ${cmd.short}.`];
                            resp.push(...cmd.description);
                            resp.push(`This command is triggered by any of: ${cmd.triggers}`);
                            resp.push(`Works in: ${cmd.works_for}`);
                            sendHelp(convo, resp);
                        }
                        else {
                            sendHelp(convo, `there is no such command as ${args[1]}`);
                        }
                    }
                    break;
            }
        });
    });
}
