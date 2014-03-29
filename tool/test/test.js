var Tool = require('../tool.js');
var util = require('util');
var assert = require('assert');

//var tool = new Tool('grammar-ast.json');
//var res = tool._file2Ast(['grammar-ast.json']);
var misc = require('../misc.js');
var fs = require('fs');

console.log('-------------------');
//console.log(util.inspect(res));

(function(){
		
	console.log('Unit Test starts');
	console.log('tool parser test');
	var grmContent = fs.readFileSync('test-parser-grammar.json', {encoding:'utf-8'});
	var createASTParser = require('../tool-parser.js');
	var tp = createASTParser(grmContent);
	var token = tp.nextToken();
	 while(token != tp.EOF){
		console.log("token:"+ util.inspect(token));
		token = tp.nextToken();
	}

	console.log(' pos='+ tp.position());
	var tp2 = createASTParser(grmContent);
	var parsedAst = tp2.createAST(grmContent);
	console.log(' pos 2='+ tp2.position());
	console.log(JSON.stringify(parsedAst, null,'  '));
	
	console.log('BitSet test');
	
	debugger;
	var bitset = misc.BitSet.of(5, 109);
	assert(bitset.member(109), 'BitSet member() test failed');
	assert(bitset.member(5), 'BitSet member() test failed');
	bitset.add(64);  
	bitset.add(31);
	assert(!bitset.member(1), 'BitSet member() test failed');
	assert(bitset.member(109), 'BitSet member() test failed');
	assert(bitset.member(64), 'BitSet member() test failed');
	assert(bitset.member(31), 'BitSet member() test failed');
	
	bitset = new misc.BitSet();
	bitset.add(64);  
	bitset.add(31);
	assert(bitset.member(64), 'BitSet member() test failed');
	assert(bitset.member(31), 'BitSet member() test failed');
	assert(!bitset.member(20), 'BitSet member() test failed');
	
	var tree = {
		type:'A',
		chr:[
			{
				type:'B',
				chr:[ {type:'C'}
				]
			}
		]
	};
	AST.processRaw(tree);

	assert(AST.isType(tree.chr[0].chr[0], 'C'), 'AST.isType test failed');
	assert(AST.isPath(tree.chr[0].chr[0], 'B','C'), 'AST.isPath (1) test failed');
	assert(AST.isPath(tree.chr[0].chr[0], 'A', 'B','C'), 'AST.isPath (2) test failed');
	assert(AST.isPath(tree.chr[0].chr[0], 'A', '~x','C'), 'AST.isPath (3) test failed');
	//assert.notEqual(AST.isPath(tree.chr[0].chr[0], 'A', 'B','C'), 'AST.isPath (3) test failed');
	console.log('Unit Test is over');
})();


