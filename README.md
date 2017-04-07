Reaction Bot for Slack
======================

## Main Functionality for now is:
### 1) Save scores for each reaction to MongoDB by user;  
### 2) Report score to user with either "report" or "stats"  

---

## To run:
set token and db_url in the .env file  
run from the project folder by either `npm start` or `node react_bot.js`  
invite @reactionbot to channel in Slack or say "@reactionbot welcome" if bot has already been in the channel  
list of keywords for saving reactions is in the [keywords.json](keywords.json)  

---

## Required npm modules:
1) **botkit**  
2) **mongodb**  
3) **winston**  
4) **node-env-file**  
