// Runs every *.test.js file in this folder: node tests/run.js
// Needs only Node (version 14 or later); nothing to install.
"use strict";
var fs = require("fs");
var path = require("path");
var helpers = require("./helpers");

var files = fs.readdirSync(__dirname).filter(function (f) { return /\.test\.js$/.test(f); }).sort();
files.forEach(function (f) { require(path.join(__dirname, f)); });

var failed = helpers.runAll();
process.exit(failed ? 1 : 0);
