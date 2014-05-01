var Tool = require('../tool.js');
var util = require('util');
var assert = require('assert');
var misc = require('../misc.js');
var fs = require('fs');
var ps = require('../tool-parser.js');

var lexerAST = ps().createAST(fs.readFileSync('LessLexer.ga', {encoding:'utf-8'}));

console.log(JSON.stringify(lexerAST, null, '  '));
/* 
var parserAST = ps().createAST(fs.readFileSync('LessParser.ga', {encoding:'utf-8'}));
console.log(JSON.stringify(parserAST, null, '  '));
 */

var tool = new Tool(['LessLexer.ga']);
tool.processGrammarsOnCommandLine();
