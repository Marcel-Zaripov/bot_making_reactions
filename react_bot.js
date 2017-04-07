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

    // connecting to collection
    controller.collection = db.collection('scores');

    // single step of incrementing the score
    controller.default_score = 1;

    // stopwords for counting congrats
    // ATTENTION: this is synchronous
    // if json is too big may take time!
    var kewords_file = path.join(__dirname, './keywords.json');
    controller.react_keywords = JSON.parse(fs.readFileSync(kewords_file, 'utf8'));

    // activate skills from ./skills directory
    var skills_dir = path.join(__dirname, "skills");
    fs.readdirSync(skills_dir).forEach(function (file) {
        require("./skills/" + file)(controller);
    });
}


// bring up the environment
env(path.join(__dirname, ".env"));

if (!process.env.token || !process.env.db_url) {
    console.log('Error: Both Slack token and url path to MongoDB should be specified');
    process.exit(1);
}

connectToDb()
