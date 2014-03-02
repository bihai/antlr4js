var misc = require('./misc.js');
var util = require('util');
var Graph = misc.Graph;
var MultiMap = misc.MultiMap;
var IntervalSet = misc.IntervalSet;
var Utils = misc.Utils;
var ANTLRParser = require('./parser.js').ANTLRParser;
var _A = ANTLRParser;

function mixin(target, obj){
	for(f in obj){
		target[f] = obj[f];
	}
}
if (typeof Object.create != 'function') {
    (function () {
        var F = function () {};
        Object.create = function (o) {
            if (arguments.length > 1) { throw Error('Second argument not supported');}
            if (o === null) { throw Error('Cannot set a null [[Prototype]]');}
            if (typeof o != 'object') { throw TypeError('Argument must be an object');}
            F.prototype = o;
            return new F;
        };
    })();
}
/**
AST sample:
{
	grammarType:'LEXER'/'PARSER',
	fileName:'....',
	children:[
		{
			text:'grammar name',
			rules:[]
		}]
}
*/
AST={
	getFirstChildWithType:function(tree, type){
		for(var i=0,l=tree.children.length;i<l;i++){
			var ch = tree.children[i];
			if(ch.type === type || ch.type == ANTLRParser[type]){
				return ch;
			}
		}
		return null;
	},
	getAllChildrenWithType:function(tree, type){
		var nodes = [];
		for(var i=0,l=tree.children.length;i<l;i++){
			var ch = tree.children[i];
			if(ch.type === type || ch.type == ANTLRParser[type]){
				nodes.push(ch);
			}
		}
		return nodes;
	},
	token:function(tree){
		if(tree.token){
			return tree.token;
		}else{
			return new AST.Token();
		}
	},
	Token:function(tree){
		this.line = 0;
	},
	addChild:function(tree, c){
		if(tree.children)
			tree.children.push(c);
		else
			tree.children = [c];
	},
	getNodesWithType:function(tree, types) {
		if(typeof(types) == 'number')
			types = IntervalSet.of(types);
		else if(typeof(types) == 'string')
			types = IntervalSet.of(ANTLRParser[types]);
		var nodes = [];
		var work = [tree];
		var t = null;
		while ( work.length > 0 ) {
			t = work.shift();
			if ( types.contains(AST.type(t))) nodes.push(t);
			if ( t.children!=null ) {
				t.children.forEach(function(tch){
						work.push(tch);
				});
			}
		}
		return nodes;
	},
	/** return number type of type */
	type:function(tree){
		if(typeof(tree.type) == 'string')
			return ANTLRParser[tree.type];
		return tree.type;
	},
	isType:function(tree, type){
		var ntype = (typeof(type) == 'string')? ANTLRParser[type] : type;
		return AST.type(tree) == ntype;
	},
	/**
	@param callback a function with parameters 
		1) treeNode  2) type (number)
	*/
	visit:function(tree, callback){
		var work = [tree];
		while(work.length >0){
			var node = work.shift();
			var type = AST.type(node);
			callback(node, type);
			if ( node.children!=null ) {
				node.children.forEach(function(c){
						work.push(c);
				});
			}
		}
	}
}
AST.Token.prototype={
	getLine:function(){
		return this.line;
	}
};
function Grammar(tool, ast){
	this.tool = tool;
	this.ast = ast;
	this.name = ast.children[0].text;
	this.tokenNameToTypeMap = {};
	this.typeToTokenList = [];
	this.rules = new OrderedHashMap();
	this.ruleNumber = 0;
	this.indexToRule = [];
	this.initTokenSymbolTables();
}
Grammar.prototype={
	initTokenSymbolTables:function(){
		this.tokenNameToTypeMap['EOF'] = 'EOF';
		this.typeToTokenList.push(null);
	},
	defineRule:function(r) {
		if ( this.rules.get(r.name)!=null ) return;
		this.rules.put(r.name, r);
		r.index = this.ruleNumber++;
		this.indexToRule.add(r);
	},
	getRule:function(name){
		return this.rules.get(name);
	}
};
function LexerGrammar(tool, ast){
	Grammar.apply(this, arguments);
}
LexerGrammar.prototype = Object.create(Grammar.prototype);
LexerGrammar.DEFAULT_MODE_NAME = 'DEFAULT_MODE';
mixin(LexerGrammar.prototype,{
	defineRule:function(r){
		if(this.modes == null){
			this.modes = new MultiMap();
		}
		this.modes.map(r.mode, r);
	}
});

function Tool(args){
	this.grammarFiles = [];
	this.errMgr = new ErrorManager(this);
	this.handleArgs(args);
	this.launch_ST_inspector = false;
	this.return_dont_exit = false;
}
Tool.VERSION = '0.1';
Tool.prototype={
	handleArgs:function(args){
		debugger;
		this.grammarFiles = [].concat(args);
		if ( this.outputDirectory ==null ) {
			this.outputDirectory = ".";
		}
		if( this.libDirectory !=null ){
			this.libDirectory = "."
		}
		if ( this.launch_ST_inspector ) {
			// TODO: STGroup.trackCreationEvents = true;
			this.return_dont_exit = true;
		}
	},
	processGrammarsOnCommandLine:function() {
		//var sortedGrammars = this.sortGrammarByTokenVocab(this.grammarFiles);
		var sortedGrammars = this._file2Ast(this.grammarFiles);
		sortedGrammars.forEach(function(t, i){
			var g = this.createGrammar(t);
			g.fileName = t.fileName;
			this.process(g, true);
		}, this);
	},
	_file2Ast:function(fileNames){
		var json = fs.readFile(fileNames[0] == null? 'grammar-ast.json': fileNames[0]);
		console.log("read:\n"+ json);
		return JSON.parse(json);
	},
	
	/**
	@Deprecated it is copied from Java, but obsolete in javascript
	*/
	sortGrammarByTokenVocab:function(fileNames){
		var g = new Graph();
		var roots = [];
		fileNames.forEach(function( fileName ) {
			var t = this.parseGrammar(fileName);
			if ( t==null || t instanceof GrammarASTErrorNode) return; // came back as error node
			if ( t.hasErrors ) return;
			var root = t;
			roots.push(root);
			root.fileName = fileName;
			var grammarName = root.getChild(0).getText();

			var tokenVocabNode = findOptionValueAST(root, "tokenVocab");
			// Make grammars depend on any tokenVocab options
			if ( tokenVocabNode!=null ) {
				var vocabName = tokenVocabNode.getText();
				g.addEdge(grammarName, vocabName);
			}
			// add cycle to graph so we always process a grammar if no error
			// even if no dependency
			g.addEdge(grammarName, grammarName);
		}, this);

		var sortedGrammarNames = g.sort();

		var sortedRoots = [];
		sortedGrammarNames.forEach(function(grammarName){
			for(var i=0,l=roots.length; i<l; i++){
				var root = roots[i];
				if ( root.grammarName == grammarName ) {
					sortedRoots.push(root);
					break;
				}
			}
		}, this);

		return sortedRoots;
	},
	parseGrammar:function(file){
		// TODO
		
	},
	createGrammar:function(ast){
		var g = null;
		if ( ast.grammarType==ANTLRParser.LEXER || ast.grammarType== 'LEXER' ) g = new LexerGrammar(this, ast);
		else g = new Grammar(this, ast);
        
		// ensure each node has pointer to surrounding grammar
		//GrammarTransformPipeline.setGrammarPtr(g, ast);
		return g;
	},
	process:function(g, gencode){
		//g.loadImportedGrammars();
        //
		var transform = new GrammarTransformPipeline(g, this);
		transform.process();
		// TODO: deal with Combined grammar
		this.processNonCombinedGrammar(g, gencode);
		console.log(util.inspect(g));
	},
	processNonCombinedGrammar:function(g, gencode){
		if ( g.ast==null || g.ast.hasErrors ) return;
		//if ( internalOption_PrintGrammarTree ) System.out.println(g.ast.toStringTree());

		var ruleFail = this.checkForRuleIssues(g);
		if ( ruleFail ) return;
		var prevErrors = this.errMgr.getNumErrors();
		// MAKE SURE GRAMMAR IS SEMANTICALLY CORRECT (FILL IN GRAMMAR OBJECT)
		var sem = new SemanticPipeline(g);
		sem.process();
	},
	checkForRuleIssues:function(g) {
		// check for redefined rules
		var RULES = AST.getFirstChildWithType(g.ast, 'RULES');
		var rules = AST.getAllChildrenWithType(RULES, 'RULE');
		AST.getAllChildrenWithType(g.ast, "MODE").forEach(function(mode){
				AST.getAllChildrenWithType(mode,"RULE").forEach(function(rm){
						rules.push(rm);
				}, this);
		}, this);

		var redefinition = false;
		var ruleToAST = {};
		rules.forEach(function(ruleAST){
			var ID = ruleAST.children[0];
			var ruleName = ID.text;
			var prev = ruleToAST[ruleName];
			if ( prev !=null ) {
				var prevChild = prev.children[0];
				g.tool.errMgr.grammarError('RULE_REDEFINITION',
										   g.fileName,
										   AST.token(ID),
										   ruleName,
										   AST.token(prevChild).getLine());
				redefinition = true;
				return;
			}
			ruleToAST[ruleName] = ruleAST;
		},this);
		var _undefined = false;
		
		function ruleRuf(ref){
			var ruleAST = ruleToAST[ref.text];
			if ( ruleAST==null ) {
				_undefined = true;
				errMgr.grammarError('UNDEFINED_RULE_REF',
									g.fileName, ref.token, ref.text);
			}
		}
		
		AST.visit(g.ast, function(ref, type){
				if(type == ANTLRParser.TOKEN_REF){
					if(ref.text == 'EOF') return;
					if(g.isLexer()) ruleRuf(ref);
				}else if(type == ANTLRParser.RULE_REF){
					ruleRuf(ref);
				}
		});
		

		return redefinition || _undefined;
	},
	exit:function(e){
		process.exit(e);
	},
	help:function(){
		console.info("ANTLR4JS Parser Generator  Version " + Tool.VERSION);
	},
	log:function(component, m){
		console.log('['+ component+ ']'+ m);
	}
}
function GrammarTransformPipeline(g, tool){
	this.g = g;
	this.tool = tool;
}
GrammarTransformPipeline.prototype={
	process:function() {
		var root = g.ast;
		if ( root==null ) return;
        tool.log("grammar", "before: "+ util.inspect(root));

        this.integrateImportedGrammars(g);
		//reduceBlocksToSets(root);
        //expandParameterizedLoops(root);

        tool.log("grammar", "after: "+ util.inspect(root));
	},
	integrateImportedGrammars:function(rootGrammar){
		var root = rootGrammar.ast;
		var id = root.children[0];
		//GrammarASTAdaptor adaptor = new GrammarASTAdaptor(id.token.getInputStream());

	 	var tokensRoot = AST.getFirstChildWithType(root, 'TOKENS_SPEC');

		var actionRoots = root.getNodesWithType("AT");

		// Compute list of rules in root grammar and ensure we have a RULES node
		var RULES = AST.getFirstChildWithType(root, "RULES");
		var rootRuleNames = {};
		if ( RULES==null ) { // no rules in root, make RULES node, hook in
			RULES = {type:"RULES", children:[]};
			//RULES.g = rootGrammar;
			AST.addChild(root, RULES);
		}
		else {
			// make list of rules we have in root grammar
			var rootRules = AST.getNodesWithType(RULES,'RULE');
			rootRules.forEach(function(r){
					rootRuleNames[r.children[0].text] = true;
			});
		}
	}
};

function LeftRecursiveRuleAnalyzer(){
	
}
LeftRecursiveRuleAnalyzer.hasImmediateRecursiveRuleRefs = function(t, ruleName) {
	if ( t==null ) return false;
	var blk = AST.getFirstChildWithType(t, ANTLRParser.BLOCK);
	if ( blk==null ) return false;
	var n = blk.children ==null? 0: blk.children.length;
	for (var i = 0; i < n; i++) {
		var alt = blk.children[i];
		var first = alt.children[0];
		if ( first==null ) continue;
		if ( AST.type(first) == ANTLRParser.RULE_REF && first.text === ruleName ) return true;
		var rref = first.children[1];
		if ( rref!=null && AST.isType(rref,ANTLRParser.RULE_REF) && rref.text === ruleName ) return true;
	}
	return false;
};
function RuleCollector(g){
	this.g = g;
	this.rules = new OrderedHashMap();
	this.ruleToAltLabels = new MultiMap();
	this.altLabelToRuleName = {};
	this.currentModeName = 'DEFAULT_MODE';
}
RuleCollector.prototype={
	process:function(ast){
		var self = this;
		AST.visit(ast, function(node, type){
			if(type == ANTLRParser.RULE){
				var block = AST.getFirstChildWithType(node, ANTLRParser.BLOCK);
				if(AST.isType(node.children[1], 'RULE_REF')){
					self.discoverRule(node, node.children[0], 
						AST.getAllChildrenWithType(node, ANTLRParser.AT), block);
					
				}else if(AST.isType(node.children[1], 'TOKEN_REF')){
					self.discoverLexerRule(node, ID, block);
					
				}
				var l = block.children ? block.children.length: 0;
				for(var i=0; i<l; i++)
					self.discoverOuterAlt(block.children[i]);//LEXER_ALT_ACTION | ALT
			}
		});
	},
	discoverRule:function(rule, ID, actions, block){
		var numAlts = block.children == null? 0: block.children.length;
		var r = null;
		if ( LeftRecursiveRuleAnalyzer.hasImmediateRecursiveRuleRefs(rule, ID.text) ) {
			//r = new LeftRecursiveRule(g, ID.text, rule);
			this.g.errMgr.grammarError('Left recursive rule is not supported ',
				this.g.fileName, 'Rule: '+ ID.text);
		}
		else {
			r = new Rule(this.g, ID.text, rule, numAlts);
		}
		this.rules.put(r.name, r);

		actions.forEach(function(a){
			// a = ^(AT ID ACTION)
			var action =  a.children[1];
			r.namedActions[a.children[0].text] = action;
			action.resolver = r;
		});
	},
	discoverOuterAlt:function(alt) {
		if ( alt.altLabel!=null ) {
			ruleToAltLabels.map(currentRuleName, alt.altLabel);
			var altLabel = alt.altLabel.text;
			this.altLabelToRuleName.put(Utils.capitalize(altLabel), currentRuleName);
			this.altLabelToRuleName.put(Utils.decapitalize(altLabel), currentRuleName);
		}
	},
	discoverLexerRule:function(rule, ID,block){
		var numAlts = block.children == null? 0: block.children.length;
		var r = new Rule(this.g, ID.text, rule, numAlts);
		r.mode = this.currentModeName;
		this.rules.put(r.name, r);
	}
};
function Rule(g, name, ast, numberOfAlts){
	this.g = g;
	this.name = name;
	this.ast = ast;
	this.numberOfAlts = numberOfAlts;
	alt = new Array(numberOfAlts+1); // 1..n
	for (var i=1; i<=numberOfAlts; i++)
		alt[i] = new Alternative(this, i);
}
function Alternative(r, altNum) { this.rule = r; this.altNum = altNum; }

function SymbolCollector(g){
	this.g = g;
	this.namedActions = [];
	this.terminals = [];
	this.tokenIDRefs = [];
	this.tokensDefs = [];
	this.currentOuterAltNumber = 1;
	this.rewriteEBNFLevel = 0;
}
SymbolCollector.prototype ={
	process:function(ast){
		var self = this;
		AST.visit(ast, function(node, type){
				switch(type){
				case ANTLRParser.GRAMMAR:
					var actions = AST.getAllChildrenWithType(node,'AT');
					actions.forEach(function(action){
							var sc, name, ACTION;
							if(action.children.length == 3){
								this.globalNamedAction(action.children[0],
									action.children[1], action.children[2]);
							}else{
								this.globalNamedAction(null,
									action.children[1], action.children[2]);
							}
							
					}, self);
					break;
					
				case ANTLRParser.TOKENS_SPEC:
					node.children.forEach(function(id){
							this.defineToken(id);
					}, self);
					break;
					
				case ANTLRParser.RULE:
					//if(AST.isType(node.children[1], 'RULE_REF')){
					self.discoverRule(node.children[0]);
					var block = AST.getFirstChildWithType(node, ANTLRParser.BLOCK);
					var l = block.children ? block.children.length: 0;
					for(var i=0; i<l; i++)
						self.discoverOuterAlt(block.children[i]);
					//}
					break;
					
				default:
					break;
				}
		});
	},
	globalNamedAction:function(ast, scope, ID, action){
		this.namedActions.push(ast);
		action.resolver = this.g;
	},
	defineToken:function(ID){
		this.terminals.push(ID);
		this.tokenIDRefs.push(ID);
		this.tokensDefs.push(ID);
	},
	discoverRule:function(ID){
		this.currentRule = this.g.getRule(ID.text);
	},
	discoverOuterAlt:function(alt) {
		this.currentRule.alt[this.currentOuterAltNumber].ast = alt;
	}
};
function SemanticPipeline(g){
	this.g = g;
}
SemanticPipeline.prototype={
	process:function() {
		if ( this.g.ast==null ) return;

		// COLLECT RULE OBJECTS
		var ruleCollector = new RuleCollector(g);
		ruleCollector.process(g.ast);

		// DO BASIC / EASY SEMANTIC CHECKS
		var basics = new BasicSemanticChecks(g, ruleCollector);
		basics.process();

		// don't continue if we get errors in this basic check
		//if ( false ) return;

		// TODO: TRANSFORM LEFT-RECURSIVE RULES
		/* var lrtrans =
			new LeftRecursiveRuleTransformer(g.ast, ruleCollector.rules.values(), g);
		lrtrans.translateLeftRecursiveRules(); */

		// STORE RULES IN GRAMMAR
		ruleCollector.rules.values().forEach(function(r){
				this.g.defineRule(r);
		});

		// COLLECT SYMBOLS: RULES, ACTIONS, TERMINALS, ...
		var collector = new SymbolCollector(this.g);
		collector.process(this.g.ast);

		// CHECK FOR SYMBOL COLLISIONS
		var symcheck = new SymbolChecks(this.g, collector);
		symcheck.process(); // side-effect: strip away redef'd rules.

		/* for (GrammarAST a : collector.namedActions) {
			g.defineAction(a);
		}

		// LINK (outermost) ALT NODES WITH Alternatives
		for (Rule r : g.rules.values()) {
			for (int i=1; i<=r.numberOfAlts; i++) {
				r.alt[i].ast.alt = r.alt[i];
			}
		}

		// ASSIGN TOKEN TYPES
		g.importTokensFromTokensFile();
		if ( g.isLexer() ) {
			assignLexerTokenTypes(g, collector.tokensDefs);
		}
		else {
			assignTokenTypes(g, collector.tokensDefs,
							 collector.tokenIDRefs, collector.terminals);
		}

		// CHECK RULE REFS NOW (that we've defined rules in grammar)
		symcheck.checkRuleArgs(g, collector.rulerefs);
		identifyStartRules(collector);
		symcheck.checkForQualifiedRuleIssues(g, collector.qualifiedRulerefs);

		// don't continue if we got symbol errors
		if ( g.tool.getNumErrors()>0 ) return;

		// CHECK ATTRIBUTE EXPRESSIONS FOR SEMANTIC VALIDITY
		AttributeChecks.checkAllAttributeExpressions(g);

		UseDefAnalyzer.trackTokenRuleRefsInActions(g); */
	}
};

function ErrorManager(tool){
	this.tool = tool;
	this.errors = 0;
	this.warnings = 0;
	this.errorTypes = [];
}
ErrorManager.prototype ={
	getNumErrors:function(){
		return this.errors;
	},
	grammarError:function(etype, fileName, token, arg){
		this.errors++;
		this.errorTypes.push(etype);
		console.info(this._msg(etype, fileName, token, arg));
	},
	_msg:function(etype, fileName, token, arg){
		var args = arguments.slice(4);
		return 'Error '+ etype + ', file '+ fileName + ', ' + util.inspect(token)+
			args.join('\n');
	}
};

function main(){
	var args = process.argv.slice(2);
	
	var antlr = new Tool(args);
    if ( args.length == 0 ) { antlr.help(); antlr.exit(0); }
    
    antlr.processGrammarsOnCommandLine();
    
	if ( antlr.return_dont_exit ) return;
    
	if (antlr.errMgr.getNumErrors() > 0) {
		antlr.exit(1);
	}
	antlr.exit(0);
}
main();
