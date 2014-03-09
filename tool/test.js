var Tool = require('./tool.js');
var util = require('util');
var assert = require('assert');

var tool = new Tool('grammar-ast.json');
var res = tool._file2Ast(['grammar-ast.json']);
var misc = require('./misc.js');

console.log('-------------------');
//console.log(util.inspect(res));

(function(){
	console.log('Unit Test starts');
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
		children:[
			{
				type:'B',
				children:[ {type:'C'}
				]
			}
		]
	};
	AST.processRaw(tree);

	assert(AST.isType(tree.children[0].children[0], 'C'), 'AST.isType test failed');
	assert(AST.isPath(tree.children[0].children[0], 'B','C'), 'AST.isPath (1) test failed');
	assert(AST.isPath(tree.children[0].children[0], 'A', 'B','C'), 'AST.isPath (2) test failed');
	assert(AST.isPath(tree.children[0].children[0], 'A', '~x','C'), 'AST.isPath (3) test failed');
	//assert.notEqual(AST.isPath(tree.children[0].children[0], 'A', 'B','C'), 'AST.isPath (3) test failed');
	console.log('Unit Test is over');
})();
