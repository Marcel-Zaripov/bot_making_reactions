'use strict';

var fs = require('fs');
var path = require('path');
var env = require('node-env-file');
var botkit = require('botkit');
var mongodb = require('mongodb');
var winston = require('winston');


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

    // logging set up
    function logging_date() {
        return new Date(Date.now()).toISOString();
    }

    var logger = new(winston.Logger)({
        levels: winston.config.syslog.levels,
        exitOnError: false,
        transports: [
            new(winston.transports.File)({
                filename: "./bot.log",
                timestamp: logging_date
            }),
            new(winston.transports.Console)({
                colorize: true,
                timestamp: logging_date
            })
        ]
    });

    // bringing up the bot
    var controller = botkit.slackbot({
        debug: false,
        logger: logger,
        json_file_store: 'json_storage'
    });
    controller.spawn({
        token: process.env.token
    }).startRTM(function (err) {
        if (err) {
            throw err;
        }
    });

    // using giphy-api for gif fetching
    var giphy_options = process.env.giphy_api_key ?
                        {apiKey: process.env.giphy_api_key} :
                        {}
    controller.giphy = require("giphy-api")(giphy_options);

    // connecting to collection
    controller.collection = db.collection('scores');

    // single step of incrementing the score
    controller.default_score = 1;

    // stopwords for counting congrats
    // tags for gifs
    // ATTENTION: this is synchronous
    // if json is too big may take time!
    var kewords_file = path.join(__dirname, './keywords_tags.json');
    var keywords_tags = JSON.parse(fs.readFileSync(kewords_file, 'utf8'));
    controller.react_keywords = keywords_tags.keywords;
    controller.gif_tags = keywords_tags.tags;

    // for now help docs will live here
    // may restructure it to be contain in json files
    // help object schema:
    // {
    //     name: "name of the skill",
    //     description: "some description of the skill",
    //     short: "short description of skill",
    //     commands: [
    //         {
    //             name: "name",
    //             triggers: "name that triggers command in bot message",
    //             description: [
    //                 "what this command does",
    //                 "split by lines to be sent each individually"
    //             ],
    //             short: "short description of command",
    //             works_for: ['direct_mention', 'mention', 'ambient', 'direct_message']
    //         }
    //     ]
    // }
    controller.help = [];
    controller.general_help = [
        "I will be glad to help you discover my functionality!",
        "To get the list of my skills, i.e. what I can do, say `@reaction_bot help skills` or send `help skills` in direct message.",
        "To get the list of active commands, say `@reaction_bot help commands` or send `help commands` in direct message.",
        "Finally, you can get some detailed info on each of the command or skill with either `help skill <skill_name>` or `help command <command_name>`"
    ];
    // activate skills from ./skills directory
    var skills_dir = path.join(__dirname, "skills");
    fs.readdirSync(skills_dir).forEach(function (file) {
        require("./skills/" + file)(controller);
        controller.log("Loaded " + file.split(".")[0] + " skills");
    });
}


// bring up the environment
env(path.join(__dirname, ".env"));

if (!process.env.token || !process.env.db_url) {
    console.log('Error: Both Slack token and url path to MongoDB should be specified');
    process.exit(1);
}

connectToDb()
