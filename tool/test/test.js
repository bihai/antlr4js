var Tool = require('../tool.js');
var util = require('util');
//var assert = require('assert');
var assert = require('chai').assert;
var misc = require('../misc.js');
var fs = require('fs');

console.log('-------------------');

describe('misc.js', function(){
	describe('tool-parser', function(){
		it('should parse file successfully without exceptions', function(){
			console.log('Unit Test starts');
			console.log('tool parser test');
			var grmContent = fs.readFileSync('test-parser-grammar.json', {encoding:'utf-8'});
			var grammarParser = require('../tool-parser.js');
			var tp = grammarParser();
			tp.init(grmContent);
			var token = tp.nextToken();
			 while(token != tp.EOF){
				console.log("token:"+ util.inspect(token));
				token = tp.nextToken();
			}
		
			console.log(' pos='+ tp.position());
			var tp2 = grammarParser();
			var parsedAst = tp2.createAST(grmContent);
			console.log(' pos 2='+ tp2.position());
			console.log(JSON.stringify(parsedAst, null,'  '));
		assert(true);
		});
	});
	
	describe('BitSet', function(){
		console.log('BitSet of 5, 109');
		
		var bitset = misc.BitSet.of(5, 109);
		it('should contain correct members', function(){
			assert(bitset.member(109), 'BitSet member() test failed');
			assert(bitset.member(5), 'BitSet member() test failed');
		});
		
		describe('Add 64 31 to BitSet', function(){
			bitset.add(64);  
			bitset.add(31);
			it('should contain corresponding memebers', function(){
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
			});
		});
	});
	describe('Given an AST tree', function(){
		var tree = {
			type:'RULE',
			chr:[
				{
					type:'BLOCK',
					chr:[ {type:'ALT'}
					]
				}
			]
		};
		AST.processRaw(tree);
		it('should work correctly on #isPath() and #isType()', function(){
			assert(AST.isType(tree.chr[0].chr[0], 'ALT'), 'AST.isType test failed');
			assert(AST.isPath(tree.chr[0].chr[0], 'BLOCK','ALT'), 'AST.isPath (1) test failed');
			assert(AST.isPath(tree.chr[0].chr[0], 'RULE', 'BLOCK','ALT'), 'AST.isPath (2) test failed');
			assert(AST.isPath(tree.chr[0].chr[0], 'RULE', '~x','ALT'), 'AST.isPath (3) test failed');
			//assert.notEqual(AST.isPath(tree.chr[0].chr[0], 'A', 'B','C'), 'AST.isPath (3) test failed');
			
		});
	});
	
	describe('HashMap', function(){
		
		describe('#_roundUpToPowerOf2()', function(){
			var hashmap = new misc.HashMap();
			it.skip('should pass', function(){
				var r = hashmap._roundUpToPowerOf2(10);
				console.log('r = %d', r);
				assert(hashmap._roundUpToPowerOf2(10) == 16, 'expect 16');
				assert(hashmap._roundUpToPowerOf2(3) == 4, 'expect 4');
				assert(hashmap._roundUpToPowerOf2(57) == 64, 'expect 64 for 57');
			});
		});
	});
	
	describe('SimpleHashMap', function(){
		function Te(hashcode, content){
			this.hash = hashcode;
			this.content = content;
		}
		Te.prototype = {
			hashCode:function(){
				return this.hash;
			},
			equals:function(o){
				if(this == o)
					return true;
				return this.content == o.content;
			}
		}
		describe('Test nonull keys', function(){
			var k1 = new Te(1, 'k1'), 
			k2 = new Te(2, 'k2'),
			k3 = new Te(3, 'k3'),
			k4 = new Te(4, 'k4'),
			k11 = new Te(1, 'k11'),
			k111 = new Te(1, 'k111');
			k1111 = new Te(1, 'k1111');
			var map ;
			beforeEach(function(){
				map = new misc.HashMap();
				map.put(k1, 'v1');
				map.put(k2, 'v2');
				map.put(k3, 'v3');
			});
			it('should work with keys which have distinct hashcode', function(){
				
				console.log('table=%s', JSON.stringify(map.table, null, '  '));
				//assert.equal(map.table['1'].k, k1, 'map size');
				assert.equal(map.size(), 3, 'map size');
				assert.equal(map.put(k2, 'v2.1'), 'v2');
				assert.equal(map.size(), 3, 'map size');
				assert.equal(map.table['2'].k, k2);
				assert.equal(map.table['2'].v, 'v2.1');
				assert.equal(map.get(k2), 'v2.1');
				map.put(k2, 'v2.2');
				assert.equal(map.get(k2), 'v2.2');
				assert.equal(map.size(), 3, 'map size');
				
				map.remove(k1);
				assert.equal(map.size(), 2, 'map size');
				assert.equal(map.get(k1), null);
				console.log('table=%s', JSON.stringify(map.table, null, '  '));
				
				assert.equal(map.put(k4), null, 'put() returning');
				
			});
			it.only('should work with keys which have duplicate hashcode', function(){
				map.put(k11, 'v11');
				assert.equal(map.size(), 4, 'map size');
				
				map.put(k111, 'v111');
				assert.equal(map.size(), 5, 'map size');
				map.put(k1111, 'v1111');
				console.log('table=%s', JSON.stringify(map.table, null, '  '));
				
				assert.equal(map.remove(k1), 'v1');
				assert.equal(map.remove(k111), 'v111');
				assert.equal(map.size(), 4, 'map size');
				console.log('table=%s', JSON.stringify(map.table, null, '  '));
				assert.ok(map.containsKey(k11));
				assert.notOk(map.containsKey(k1));
			});
		});
		
	});
});


