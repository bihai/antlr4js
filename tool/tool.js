var misc = require('./misc.js');
var util = require('util');
var fs = require('fs');
var Graph = misc.Graph;
var MultiMap = misc.MultiMap;
var IntervalSet = misc.IntervalSet;
var OrderedHashMap = misc.OrderedHashMap;
var LinkedHashMap = misc.LinkedHashMap;
var Utils = misc.Utils;
var MurmurHash = misc.MurmurHash;
var cnst = require('./constants.js');
var ANTLRParser = cnst.ANTLRParser,
	Token = cnst.Token;
var grammarParser = require('./tool-parser.js');
var rt = require('./runtime.js'); 
var _A = ANTLRParser,
	UUID_COUNT = 1;

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
function extend(subclass, superclass, override){
	subclass.prototype = Object.create(superclass.prototype);
	subclass._super = superclass.prototype;
	subclass.superclass = superclass;
	mixin(subclass.prototype, override);
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
	processRaw:function(json){
		var work = [json];
		while(work.length >0){
			var node = work.shift();
			node._uuid = UUID_COUNT++;
			var nt = AST.typeNum(node);
			console.log('AST.processRaw() %s %d', node.type, nt);
			if(node.type == null){
				console.log('null type node %j', node);
			}
			node.type = nt;
			if ( node.chr!=null ) {
				for(var i=0,l=node.chr.length; i<l; i++){
					var c = node.chr[i];
					c.parent = node;
					work.push(c);
				}
			}
		}
		return json;
	},
	getFirstChildWithType:function(tree, type){
		for(var i=0,l=tree.chr.length;i<l;i++){
			var ch = tree.chr[i];
			if(ch.type === type || ch.type == ANTLRParser[type]){
				return ch;
			}
		}
		return null;
	},
	getAllChildrenWithType:function(tree, type){
		var nodes = [];
		for(var i=0,l=tree.chr.length;i<l;i++){
			var ch = tree.chr[i];
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
		if(tree.chr)
			tree.chr.push(c);
		else
			tree.chr = [c];
	},
	getNodesWithType:function(tree, types) {
		if(typeof(types) == 'number')
			types = IntervalSet.of(types);
		else if(typeof(types) == 'string'){
			types = IntervalSet.of(ANTLRParser[types]);
		}
		var nodes = [];
		var work = [tree];
		var t = null;
		while ( work.length > 0 ) {
			t = work.shift();
			if ( types.contains(AST.type(t))) nodes.push(t);
			if ( t.chr!=null ) {
				t.chr.forEach(function(tch){
						work.push(tch);
				});
			}
		}
		return nodes;
	},
	/** return number type of type */
	typeNum:function(tree){
		if(typeof(tree.type) == 'string')
			return ANTLRParser[tree.type];
		return tree.type;
	},
	
	type:function(tree){
		return tree.type;
	},
	isType:function(tree, type){
		var isStr1 = typeof(tree.type) == 'string';
		var isStr2 = typeof(type) == 'string';
		if(isStr1 && isStr2){
			return tree.type == type;
		}else{
			var ntype2 = isStr2 ? ANTLRParser[type] : type;
			var ntype1 = isStr1 ? ANTLRParser[tree.type] : tree.type;
			return ntype1 == ntype2;
		}
	},
	/**
	@param callback a function with parameters 
		1) treeNode  2) type (number) 3) parent
	*/
	visit:function(tree, callback){
		var work = [tree];
		while(work.length >0){
			var node = work.shift();
			var type = AST.type(node);
			var p = node.parent;
			//delete node.parent;
			if(callback(node, type, p))
				break;
			
			if ( node.chr ==null ) continue;
			for(var i=0,l=node.chr.length; i<l; i++){
				var c = node.chr[i];
				if(c.parent == null)
					c.parent = node;
				work.push(c);
			}
		}
	},
	/** recursively visit
	*/
	recVisit:function(tree, callback){
		var node = tree;
		var type = AST.type(node);
		var p = node.parent;
		callback(node, type, p);
		if ( node.chr ==null ) return;
		for(var i=0,l=node.chr.length; i<l; i++){
			var c = node.chr[i];
			if(c.parent == null)
				c.parent = node;
			AST.recVisit(c, callback);
		}
	},
	/** @parameter path is array like ['...', '<super-parent-type>','<parent-type>']
	 path element can lead with '~', means matching any type except the one.
	 e.g. "~ELEMENT_OPTIONS"  any type except ELEMENT_OPTIONS.
	*/
	isPath:function(tree, parent, parentOfp, pOfpOfp){
		for(var i= arguments.length -1; i; i--){
			if(tree == null)
				return false;
			var not = arguments[i].charAt(0) == '~';
			if(not && !AST.isType(tree, arguments[i].substring(1))  ||
				!not && AST.isType(tree, arguments[i])) 
				tree = tree.parent;
			else{
				console.log('type:'+ arguments[i]);
				return false;
			}
		}
		return true;
	},
	getChildCount:function(tree){
		if(tree.chr)
			return tree.chr.length;
		else
			return 0;
	},
	getFirstDescendantWithType:function(tree, type){
		if ( AST.isType(tree, type) ) return this;
        if ( tree.chr==null ) return null;
        for (var i=0,l=tree.chr.length;i<l; i++) {
        	var t = tree.chr[i];
            
            if ( AST.isType(t, type) ) return t;
            var d = AST.getFirstDescendantWithType(t, type);
            if ( d!=null ) return d;
        }
        return null;
	},
	firstLeaf:function(tree){
		var node = tree;
		while(node.chr && node.chr.length > 0){
			node = ast.chr[0];
		}
		return node;
	}
}
AST.Token.prototype={
	getLine:function(){
		return this.line;
	}
};

var TreePatternLexer = (function(){
	var EOF = -1;
	var BEGIN = 1;
	var END = 2;
	var ID = 3;
	var ARG = 4;
	var PERCENT = 5;
	var COLON = 6;
	var DOT = 7;
	
function TreePatternLexer(pattern){
	this.p = -1;
	this.sval = '';
	this.error = false;
	this.pattern = pattern;
	this.n = pattern.length();
	this.consume();
}
TreePatternLexer.prototype={
	nextToken:function(){
		this.sval = ''; // reset, but reuse buffer
		while ( this.c != EOF ) {
			if ( this.c==' ' || this.c=='\n' || this.c=='\r' || this.c=='\t' ) {
				this.consume();
				continue;
			}
			if ( (this.c >='a' && this.c <='z') || (this.c >='A' && this.c <='Z') || this.c=='_' ) {
				this.sval += this.c;
				this.consume();
				while ( (this.c >='a' && this.c <='z') || (this.c>='A' && this.c<='Z') ||
						(this.c >='0' && this.c<='9') || this.c=='_' )
				{
					this.sval += this.c;
					this.consume();
				}
				return ID;
			}
			if ( this.c=='(' ) {
				this.consume();
				return BEGIN;
			}
			if ( this.c==')' ) {
				this.consume();
				return END;
			}
			if ( this.c=='%' ) {
				this.consume();
				return PERCENT;
			}
			if ( this.c==':' ) {
				this.consume();
				return COLON;
			}
			if ( this.c=='.' ) {
				this.consume();
				return DOT;
			}
			if ( this.c=='[' ) { // grab [x] as a string, returning x
				this.consume();
				while ( this.c!=']' ) {
					if ( this.c=='\\' ) {
						this.consume();
						if ( this.c!=']' ) {
							this.sval+='\\';
						}
						this.sval += this.c;
					}
					else {
						this.sval += this.c;
					}
					this.consume();
				}
				this.consume();
				return ARG;
			}
			this.consume();
			this.error = true;
			return EOF;
		}
		return EOF;
	},
	consume:function() {
		this.p++;
		if ( this.p>=this.n ) {
			this.c = EOF;
		}
		else {
			this.c = this.pattern.charAt(this.p);
		}
	}
};

function TreePatternParser(tokenizer, wizard, adaptor){
	this.tokenizer = tokenizer;
	this.wizard = wizard;
	this.adaptor = adaptor;
	this.ttype = tokenizer.nextToken(); // kickstart
}
TreePatternParser.prototype={
	pattern:function() {
		if ( this.ttype==BEGIN ) {
			return this.parseTree();
		}
		else if ( this.ttype==ID ) {
			var node = this.parseNode();
			if ( this.ttype==EOF ) {
				return node;
			}
			return null; // extra junk on end
		}
		return null;
	},
	parseTree:function() {
		if ( this.ttype != BEGIN ) {
			throw new Error("no BEGIN");
		}
		this.ttype = this.tokenizer.nextToken();
		var root = this.parseNode();
		if ( root==null ) {
			return null;
		}
		while ( this.ttype==BEGIN ||
				this.ttype== ID ||
				this.ttype== PERCENT ||
				this.ttype== DOT )
		{
			if ( this.ttype== BEGIN ) {
				var subtree = this.parseTree();
				this.adaptor.addChild(root, subtree);
			}
			else {
				var child = this.parseNode();
				if ( child==null ) {
					return null;
				}
				this.adaptor.addChild(root, child);
			}
		}
		if ( this.ttype != END ) {
			throw new Error("no END");
		}
		this.ttype = this.tokenizer.nextToken();
		return root;
	}
	/* parseNode:function() {
		// "%label:" prefix
		var label = null;
		if ( this.ttype == PERCENT ) {
			this.ttype = tokenizer.nextToken();
			if ( this.ttype != ID ) {
				return null;
			}
			label = this.tokenizer.sval.toString();
			this.ttype = this.tokenizer.nextToken();
			if ( this.ttype != COLON ) {
				return null;
			}
			this.ttype = this.tokenizer.nextToken(); // move to ID following colon
		}

		// Wildcard?
		if ( this.ttype == DOT ) {
			this.ttype = this.tokenizer.nextToken();
			var wildcardPayload = new CommonToken(0, ".");
			var node =
				new TreeWizard.WildcardTreePattern(wildcardPayload);
			if ( label!=null ) {
				node.label = label;
			}
			return node;
		}

		// "ID" or "ID[arg]"
		if ( ttype != TreePatternLexer.ID ) {
			return null;
		}
		String tokenName = tokenizer.sval.toString();
		ttype = tokenizer.nextToken();
		if ( tokenName.equals("nil") ) {
			return adaptor.nil();
		}
		String text = tokenName;
		// check for arg
		String arg = null;
		if ( ttype == TreePatternLexer.ARG ) {
			arg = tokenizer.sval.toString();
			text = arg;
			ttype = tokenizer.nextToken();
		}
		
		// create node
		int treeNodeType = wizard.getTokenType(tokenName);
		if ( treeNodeType==Token.INVALID_TOKEN_TYPE ) {
			return null;
		}
		Object node;
		node = adaptor.create(treeNodeType, text);
		if ( label!=null && node.getClass()==TreeWizard.TreePattern.class ) {
			((TreeWizard.TreePattern)node).label = label;
		}
		if ( arg!=null && node.getClass()==TreeWizard.TreePattern.class ) {
			((TreeWizard.TreePattern)node).hasTextArg = true;
		}
		return node;
	} */
};
return TreePatternLexer;
})();


function Grammar(tool, ast){
	this.tool = tool;
	this.ast = ast;
	this.name = ast.chr[0].text;
	this.tokenNameToTypeMap = new LinkedHashMap();
	this.typeToTokenList = [];
	this.rules = new OrderedHashMap();
	this.ruleNumber = 0;
	this.indexToRule = [];
	this.lexerActions = new LinkedHashMap();
	this.sempreds = new LinkedHashMap();
	this.stringLiteralToTypeMap = new LinkedHashMap();
	this.namedActions = {};
	this.maxTokenType = Token.MIN_USER_TOKEN_TYPE -1;
	this.initTokenSymbolTables();
}
Grammar.isTokenName=function(id) {
	var  c = id.charAt(0);
	return c.toUpperCase() == c;
};
Grammar.getStringLiteralAliasesFromLexerRules=function(ast){
	var lexerRuleToStringLiteral = [];
	var ruleNodes = AST.getNodesWithType(ast, ANTLRParser.RULE);
	if ( ruleNodes==null || ruleNodes.length == 0 ) return null;
	ruleNodes.forEach(function(r){
		var name = r.chr[0];
		if(AST.isType(name, ANTLRParser.TOKEN_REF) && AST.isType(r.chr[1], ANTLRParser.BLOCK)){
			var block = r.chr[1];
			if(block.chr.length != 1) return;
			if(block.chr[0].length != 1) return;
			
			switch(AST.type(block.chr[0].type)){
			case ANTLRParser.ALT:
				var alt = block.chr[0];
				if(!AST.isType(alt.chr[0], 'STRING_LITERAL'))
					return;
				if(alt.chr.length == 1){
					lexerRuleToStringLiteral.push({a:name, b:alt.chr[0]});
				}else if(alt.chr.length == 2){
					var t = AST.type(alt.chr[1].type);
					if(t == ANTLRParser.ACTION || t == ANTLRParser.SEMPRED){
						lexerRuleToStringLiteral.push({a:name, b:alt.chr[0]});
					}
				}
				break;
			case ANTLRParser.LEXER_ALT_ACTION:
				if(block.chr[0].length > 3 || block.chr[0].length < 1)
					break;
				var alt = block.chr[0].chr[0];
				if(!AST.isType(alt, ANTLRParser.ALT)) break;
				if(alt.chr.length != 1 ||
					!AST.isType(alt.chr[0].type, ANTLRParser.STRING_LITERAL))
					break;
				lexerRuleToStringLiteral.push({a:name, b:alt.chr[0]});
				break;
			default:
				break;
			}
		}
	},this);
	return lexerRuleToStringLiteral;
};

Grammar.prototype={
	initTokenSymbolTables:function(){
		this.tokenNameToTypeMap.put('EOF',Token.EOF);
		this.typeToTokenList.push(null);
	},
	defineRule:function(r) {
		if ( this.rules.get(r.name)!=null ) return;
		this.rules.put(r.name, r);
		r.index = this.ruleNumber++;
		this.indexToRule.push(r);
	},
	getRule:function(name){
		return this.rules.get(name);
	},
	isLexer:function(){
		return this.ast.grammarType == 'LEXER'|| this.ast.grammarType == ANTLRParser.LEXER;
	},
	isParser:function() { return this.getType()==ANTLRParser.PARSER || this.ast.grammarType == 'PARSER'; },
	getType:function() {
        if ( this.ast!=null ) return this.ast.grammarType;
        return 0;
    },
	getDefaultActionScope:function() {
        switch ( this.ast.grammarType ) {
            case "LEXER" :
                return "lexer";
            case "PARSER" :
            case 'COMBINED' :
                return "parser";
            case ANTLRParser.LEXER :
                return "lexer";
            case ANTLRParser.PARSER :
            case ANTLRParser.COMBINED :
                return "parser";
        }
        return null;
    },
    getTypeString:function(){
    	if ( this.ast==null ) return null;
    	return this.ast.grammarType.toLowerCase();
    },
    defineAction:function(atAST) {
        if ( AST.getChildCount(atAST)==2 ) {
            var name = atAST.chr[0].text;
            this.namedActions[name] = atAST.chr[1];
        }
        else {
			var scope = atAST.chr[0].text;
            var gtype = this.getTypeString();
            if ( scope == gtype || (scope == "parser") &&gtype =="combined"){
				var name = atAST.chr[1].text;
				this.namedActions[name] = atAST.chr[2];
			}
        }
    },
    defineStringLiteral:function(lit, ttype) {
		if ( !this.stringLiteralToTypeMap.containsKey(lit) ) {
			this.stringLiteralToTypeMap.put(lit, ttype);
			// track in reverse index too
			if ( ttype>=this.typeToStringLiteralList.size() ) {
				Utils.setSize(this.typeToStringLiteralList, ttype+1);
			}
			this.typeToStringLiteralList[ttype] =lit;

			this.setTokenForType(ttype, lit);
			return ttype;
		}
		return Token.INVALID_TYPE;
	},
	setTokenForType:function(ttype, text) {
		if ( ttype>= this.typeToTokenList.length ) {
			Utils.setSize(this.typeToTokenList, ttype+1);
		}
		var prevToken = this.typeToTokenList[ttype];
		if ( prevToken==null || prevToken.charAt(0)=='\'' ) {
			// only record if nothing there before or if thing before was a literal
			this.typeToTokenList[ttype] = text;
		}
	},
	defineTokenName:function(name, ttype){
		if(ttype === undefined){
			ttype = this.getNewTokenType();
		}
		var prev = this.tokenNameToTypeMap.get(name);
		if ( prev!=null ) return prev;
		this.tokenNameToTypeMap.put(name, ttype);
		this.setTokenForType(ttype, name);
		this.maxTokenType = Math.max(this.maxTokenType, ttype);
		return ttype;
	},
	getNewTokenType:function() {
		this.maxTokenType++;
		return this.maxTokenType;
	},
	importTokensFromTokensFile:function(){
		var vocab = this.getOptionString("tokenVocab");
		if ( vocab!=null ) {
			var vparser = new TokenVocabParser(this.tool, vocab);
			var tokens = vparser.load();
			this.tool.log("grammar", "tokens=" + tokens);
			for(var t in tokens){
			//for (String t : tokens.keySet()) {
				if ( t.charAt(0)=='\'' ) this.defineStringLiteral(t, tokens[t]);
				else this.defineTokenName(t, tokens[t]);
			}
		}
	},
	getOptionString:function(key){
		//return this.ast.getOptionString(key)
		var options = null;
		this.ast.chr.some(function(node){
				if(AST.isType(node.type, 'OPTIONS')){
					options = node;
					return true;
				}
				return false;
		}, this);
		if(options){
			options.chr.some(function(node){
					if(node.type == ANTLRParser.ASSIGN && node.chr[0].text == key){
						return true;
					}
					return false;
			}, this);
		}
	},
	getOutermostGrammar:function() {
        if ( this.parent==null ) return this;
        return this.parent.getOutermostGrammar();
    },
    defineTokenAlias:function( name, lit) {
		var ttype = this.defineTokenName(name);
		this.stringLiteralToTypeMap.put(lit, ttype);
		this.setTokenForType(ttype, name);
		return ttype;
	},
	getTokenType:function(token) {
		var I = null;
		if ( token.charAt(0)=='\'') {
			I = this.stringLiteralToTypeMap.get(token);
		}
		else { // must be a label like ID
			I = this.tokenNameToTypeMap.get(token);
		}
		if(!I)
			debugger;
		var i = (I!=null)? I : Token.INVALID_TYPE;
		//tool.log("grammar", "grammar type "+type+" "+tokenName+"->"+i);
		return i;
	},
	getMaxTokenType:function() {
		return this.typeToTokenList.length - 1; // don't count 0 (invalid)
	}
};
function LexerGrammar(tool, ast){
	Grammar.apply(this, arguments);
}
LexerGrammar.prototype = Object.create(Grammar.prototype);
LexerGrammar.DEFAULT_MODE_NAME = 'DEFAULT_MODE';
mixin(LexerGrammar.prototype,{
	defineRule:function(r){
		Grammar.prototype.defineRule.call(this, r);
		if(this.modes == null){
			this.modes = new MultiMap();
		}
		this.modes.map(r.mode, r);
	}
});

function TokenVocabParser(){
	//todo
}


function Tool(args){
	this.grammarFiles = [];
	this.generate_ATN_dot = false;
	this.force_atn = false;
	this.errMgr = new ErrorManager(this);
	this.handleArgs(args);
	this.launch_ST_inspector = false;
	this.return_dont_exit = false;
}
Tool.VERSION = '0.1';
Tool.prototype={
	handleArgs:function(args){
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
		var grammars = [];
		fileNames.forEach(function(file){
				var json = grammarParser().createAST(fs.readFileSync(file, {encoding:'utf-8'}));
				json = eval(json);
				json.fileName = file;
				grammars.push(AST.processRaw(json));
		}, this);
		return grammars;
	},
	
	/**
	@Deprecated it is copied from Java, but obsolete in javascript
	*/
	/* sortGrammarByTokenVocab:function(fileNames){
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
	}, */
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
		if ( this.errMgr.getNumErrors()>prevErrors ) return;
		
		
		var factory = null;
		if ( g.isLexer() )
			factory = new LexerATNFactory(g);
		else factory = new ParserATNFactory(g);
		g.atn = factory.createATN();
		/* 
		if ( this.generate_ATN_dot ) generateATNs(g);

		// PERFORM GRAMMAR ANALYSIS ON ATN: BUILD DECISION DFAs
		var anal = new AnalysisPipeline(g);
		anal.process();

		//if ( generate_DFA_dot ) generateDFAs(g);

		if ( g.tool.getNumErrors()>prevErrors ) return;

		// GENERATE CODE
		if ( gencode ) {
			var gen = new CodeGenPipeline(g);
			gen.process();
		} */
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
			var ID = ruleAST.chr[0];
			var ruleName = ID.text;
			var prev = ruleToAST[ruleName];
			if ( prev !=null ) {
				var prevChild = prev.chr[0];
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
			console.log('## ruleRef() %s', ref.text);
			if ( ruleAST==null ) {
				_undefined = true;
				errMgr.grammarError('UNDEFINED_RULE_REF',
									g.fileName, ref.token, ref.text);
			}
		}
		console.log('-----------------------' );
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
	getNumErrors:function() { return this.errMgr.getNumErrors(); },
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
		var root = this.g.ast;
		if ( root==null ) return;
        this.tool.log("grammar", "before: "+ util.inspect(root));

        this.integrateImportedGrammars(this.g);
        //todo:
		//reduceBlocksToSets(root);
        //expandParameterizedLoops(root);

        this.tool.log("grammar", "after: "+ util.inspect(root));
	},
	integrateImportedGrammars:function(rootGrammar){
		var root = rootGrammar.ast;
		var id = root.chr[0];
		//GrammarASTAdaptor adaptor = new GrammarASTAdaptor(id.token.getInputStream());

	 	var tokensRoot = AST.getFirstChildWithType(root, 'TOKENS_SPEC');

		var actionRoots = AST.getNodesWithType(root, "AT");

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
					rootRuleNames[r.chr[0].text] = true;
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
	var n = blk.chr ==null? 0: blk.chr.length;
	for (var i = 0; i < n; i++) {
		var alt = blk.chr[i];
		var first = alt.chr[0];
		if ( first==null ) continue;
		if ( AST.type(first) == ANTLRParser.RULE_REF && first.text === ruleName ) return true;
		var rref = first.chr !=null && first.chr.length >1 ? first.chr[1] : null;
		if ( rref!=null && AST.isType(rref,ANTLRParser.RULE_REF) && rref.text === ruleName ) return true;
	}
	return false;
};

function GrammarTreeVisitor(){
	this.currentModeName = 'DEFAULT_MODE';
	this.currentOuterAltNumber = 1;
	this.rewriteEBNFLevel = 0;
}

function RuleCollector(g){
	GrammarTreeVisitor.call(this);
	this.g = g;
	this.rules = new OrderedHashMap();
	this.ruleToAltLabels = new MultiMap();
	this.altLabelToRuleName = {};
	this.currentModeName = 'DEFAULT_MODE';
}
RuleCollector.prototype={
	process:function(ast){
		var self = this;
		AST.recVisit(ast, function(node, type, parent){
			
			if(parent != null && parent.type == ANTLRParser.BLOCK && 
				parent.parent != null && parent.parent.type == ANTLRParser.RULE){
				//debugger;
				this.currentOuterAltNumber++;
			}
			if(type == ANTLRParser.RULE){
				this.currentOuterAltNumber = 0;
				var block = AST.getFirstChildWithType(node, ANTLRParser.BLOCK);
				if(AST.isType(node.chr[0], 'RULE_REF')){
					self.discoverRule(node, node.chr[0], 
						AST.getAllChildrenWithType(node, ANTLRParser.AT), block);
					
				}else if(AST.isType(node.chr[0], 'TOKEN_REF')){
					var modis = [];
					var modiNode = AST.getFirstChildWithType(node, ANTLRParser.RULEMODIFIERS);
					if(modiNode && modiNode.chr && modiNode.chr[0].type === ANTLRParser.FRAGMENT){
						modis.push(modiNode.chr[0]);
					}
					self.discoverLexerRule(node, node.chr[0], modis, block);
					
				}
				var l = block.chr ? block.chr.length: 0;
				for(var i=0; i<l; i++)
					self.discoverOuterAlt(block.chr[i]);//LEXER_ALT_ACTION | ALT
			}else if(type == ANTLRParser.BLOCK){
				this.currentOuterAltNumber++;
			}
		});
	},
	discoverRule:function(rule, ID, actions, block){
		var numAlts = block.chr == null? 0: block.chr.length;
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
			var action =  a.chr[1];
			r.namedActions[a.chr[0].text] = action;
			action.resolver = r;
		});
	},
	discoverOuterAlt:function(alt) {
		if ( alt.altLabel!=null ) {
			ruleToAltLabels.map(this.currentRuleName, alt.altLabel);
			var altLabel = alt.altLabel.text;
			this.altLabelToRuleName.put(Utils.capitalize(altLabel), this.currentRuleName);
			this.altLabelToRuleName.put(Utils.decapitalize(altLabel), this.currentRuleName);
		}
	},
	discoverLexerRule:function(rule, ID,modifiers, block){
		var numAlts = block.chr == null? 0: block.chr.length;
		var r = new Rule(this.g, ID.text, rule, numAlts);
		r.mode = this.currentModeName;
		if ( modifiers.length != 0 ) r.modifiers = modifiers;
		this.rules.put(r.name, r);
	}
};
function Rule(g, name, ast, numberOfAlts){
	this.g = g;
	this.name = name;
	this.ast = ast;
	this.numberOfAlts = numberOfAlts;
	this.actions = [];
	this.actionIndex = -1;
	this.index = 0;
	this.alt = []; // 1..n
	for (var i=1; i<=numberOfAlts; i++)
		this.alt[i] = new Alternative(this, i);
}
Rule.prototype={
	defineActionInAlt:function( currentAlt, actionAST) {
		this.actions.push(actionAST);
		this.alt[currentAlt].actions.push(actionAST);
		if ( this.g.isLexer() ) {
			this.defineLexerAction(actionAST);
		}
	},
	defineLexerAction:function( actionAST) {
		this.actionIndex = this.g.lexerActions.size();
		if ( this.g.lexerActions.get(actionAST)==null ) {
			this.g.lexerActions.put(actionAST, actionIndex);
		}
	},
	definePredicateInAlt:function(currentAlt, predAST) {
		this.actions.push(predAST);
		this.alt[currentAlt].actions.push(predAST);
		if ( this.g.sempreds.get(predAST)==null ) {
			this.g.sempreds.put(predAST, this.g.sempreds.size());
		}
	},
	hasAltSpecificContexts:function(){
		return this.getAltLabels()!=null;
	},
	getAltLabels:function() {
		console.log('getAltLabels() %s num of alts %d', this.name, this.numberOfAlts);
		try{
		var labels = [];
		for (var i=1; i<=this.numberOfAlts; i++) {
			var altLabel = this.alt[i].ast.altLabel;
			if ( altLabel!=null ) {
				labels.push({a:i, b: this.alt[i].ast, c:altLabel.text});
			}
		}
		if ( labels.length == 0 ) return null;
		return labels;
		}catch(e){
			console.error('i=%d', i);
			throw e;
		}
	},
	isFragment:function() {
		if ( this.modifiers==null ) return false;
		this.modifiers.some(function(a){
			return  a.type =="FRAGMENT"|| ANTLRParser.FRAGMENT ;
		}, this);
		return false;
	}
};

function LeftRecursiveRule(){
	//todo
}

LeftRecursiveRule.prototype = Object.create(Rule.prototype);

function Alternative(r, altNum) {
	this.actions = [];
	this.rule = r; this.altNum = altNum;
	this.labelDefs = new MultiMap();
	this.tokenRefs = new MultiMap();
}

function SymbolCollector(g){
	GrammarTreeVisitor.call(this);
	this.g = g;
	this.rulerefs = [];
	this.qualifiedRulerefs = [];
	this.namedActions = [];
	this.terminals = [];
	this.tokenIDRefs = [];
	this.tokensDefs = [];
	this.strings = {};//hash set
	this.currentOuterAltNumber = 1;
	this.rewriteEBNFLevel = 0;
}
SymbolCollector.prototype ={
	process:function(ast){
		var self = this;
		AST.recVisit(ast, function(node, type, parent){
				
				switch(type){
				case ANTLRParser.GRAMMAR:
					var actions = AST.getAllChildrenWithType(node,'AT');
					actions.forEach(function(action){
							var sc, name, ACTION;
							if(action.chr.length == 3){
								this.globalNamedAction(action.chr[0],
									action.chr[1], action.chr[2]);
							}else{
								this.globalNamedAction(null,
									action.chr[1], action.chr[2]);
							}
							
					}, self);
					break;
				
				case ANTLRParser.TOKENS_SPEC:
					node.chr.forEach(function(id){
							this.defineToken(id);
					}, self);
					break;
					
				case ANTLRParser.RULE:
					self.currentOuterAltNumber = 0;
					//if(AST.isType(node.chr[1], 'RULE_REF')){
					self.discoverRule(node.chr[0]);
					var block = AST.getFirstChildWithType(node, ANTLRParser.BLOCK);
					var l = block.chr ? block.chr.length: 0;
					for(var i=0; i<l; i++){
						self.currentOuterAltNumber++;
						self.discoverOuterAlt(block.chr[i]);
					}
					//}
					break;
				case ANTLRParser.RULE_REF:
					var ch = node.chr;
					if(ch != null && ch.length > 0 && AST.isType(ch[0],'ARG_ACTION'))
						self.actionInAlt(ch[0]);
					break;
				case ANTLRParser.ACTION:
					if(AST.isPath(node.parent, 'ALT') || AST.isPath(node.parent, '~ELEMENT_OPTIONS','ASSIGN') ||
						AST.isPath(node.parent, 'PLUS_ASSIGN')){
						self.actionInAlt(node);
						}
					break;
				case ANTLRParser.SEMPRED:
					self.sempredInAlt(node);
					break;
				case ANTLRParser.ASSIGN:
				case ANTLRParser.PLUS_ASSIGN:
					if(AST.isType(parent, 'ALT') || AST.isType(parent, 'ASSIGN') &&
						!self.g.isLexer()){
						self.label(node, node.chr[0], node.chr[1]);
					}
					break;
				case ANTLRParser.STRING_LITERAL:
					if( !(self.g.isLexer() && AST.isType(parent, 'RANGE')) && !AST.isType(parent.parent, 'ELEMENT_OPTIONS')){
						self.stringRef(node);
					}
					break;
				case ANTLRParser.TOKEN_REF:
					if( !AST.isType(parent, 'RULE'))
						self.tokenRef(node);
					break;
				case ANTLRParser.RULE_REF:
					if( !AST.isType(parent, 'RULE'))
						self.ruleRef(node);
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
		//console.log('SymbolCollector.discoverRule %j\n'+ ID.text, this.currentRule);
	},
	discoverOuterAlt:function(alt) {
		console.log('discoverOuterAlt() %s alt[%d]', this.currentRule.name, this.currentOuterAltNumber);
		this.currentRule.alt[this.currentOuterAltNumber].ast = alt;
	},
	actionInAlt:function(action) {
		this.currentRule.defineActionInAlt(this.currentOuterAltNumber, action);
		action.resolver = this.currentRule.alt[this.currentOuterAltNumber];
	},
	sempredInAlt:function(pred){
		this.currentRule.definePredicateInAlt(this.currentOuterAltNumber, pred);
		pred.resolver = this.currentRule.alt[this.currentOuterAltNumber];
	},
	label:function(op, ID, element) {
		var lp = new LabelElementPair(g, ID, element, op.type);
		this.currentRule.alt[this.currentOuterAltNumber].labelDefs.map(ID.text, lp);
	},
	
	stringRef:function(ref) {
		this.terminals.push(ref);
		this.strings[ref.text] == true;
		if ( this.currentRule!=null ) {
			this.currentRule.alt[this.currentOuterAltNumber].tokenRefs.map(ref.text, ref);
		}
	},
	
	tokenRef:function(ref){
		this.terminals.push(ref);
		this.tokenIDRefs.push(ref);
		if ( this.currentRule!=null ) {
			this.currentRule.alt[this.currentOuterAltNumber].tokenRefs.map(ref.text, ref);
		}
	},
	
	ruleRef:function(ref, arg) {
//		if ( inContext("DOT ...") ) qualifiedRulerefs.add((GrammarAST)ref.getParent());
		this.rulerefs.push(ref);
    	if ( this.currentRule!=null ) {
    		this.currentRule.alt[this.currentOuterAltNumber].ruleRefs.map(ref.text, ref);
    	}
	}
};
var LabelElementPair = (function(){
	var tokenTypeForTokens = new misc.BitSet();
	tokenTypeForTokens.add(ANTLRParser.TOKEN_REF);
    tokenTypeForTokens.add(ANTLRParser.STRING_LITERAL);
    tokenTypeForTokens.add(ANTLRParser.WILDCARD);
    
	function LabelElementPair(g, label, element, labelOp){
		this.label = label;
		this.element = element;
        // compute general case for label type
        if ( AST.getFirstDescendantWithType(element, tokenTypeForTokens)!=null ) {
            if ( labelOp==ANTLRParser.ASSIGN || labelOp == 'ASSIGN') this.type = 'TOKEN_LABEL';
            else this.type = 'TOKEN_LIST_LABEL';
        }
        else if ( AST.getFirstDescendantWithType(element, ANTLRParser.RULE_REF)!=null ) {
            if ( labelOp == 'ASSIGN' || labelOp==ANTLRParser.ASSIGN ) this.type = 'RULE_LABEL';
            else this.type = 'RULE_LIST_LABEL';
        }

        // now reset if lexer and string
        if ( g.isLexer() ) {
            if ( AST.getFirstDescendantWithType(element, ANTLRParser.STRING_LITERAL)!=null ) {
                if (labelOp == 'ASSIGN' || labelOp==ANTLRParser.ASSIGN ) this.type = 'LEXER_STRING_LABEL';
            }
        }
	}
	LabelElementPair.prototype={
		toString:function() {
			return this.label.text+" "+this.type+" "+this.element;
		}
    };
	return LabelElementPair
})();

function SymbolChecks(g, collector){
	this.g = g;
	this.nameToRuleMap = {};
	this.tokenIDs = {};//hash set;
	this.actionScopeToActionNames = {};
    this.collector = collector;
	this.errMgr = g.tool.errMgr;
    collector.tokenIDRefs.forEach(function(tokenId){
        this.tokenIDs[tokenId.text] = true;
    }, this);
}
SymbolChecks.prototype={
	process:function(){
		if ( this.g.rules!=null ) {
			this.g.rules.values().forEach(function(r){
					this.nameToRuleMap[r.name] = r;
			}, this);
		}
		this.checkActionRedefinitions(this.collector.namedActions);
		//this.checkForTokenConflicts(this.collector.tokenIDRefs);  // sets tokenIDs
		this.checkForLabelConflicts(this.g.rules.values());
	},
	checkActionRedefinitions:function(actions) {
		if ( actions==null ) return;
		var scope = this.g.getDefaultActionScope();
		var name;
		var nameNode;
		actions.forEach(function(ampersandAST){
			nameNode = ampersandAST.chr[0];
			if ( AST.getChildCount(ampersandAST)==2 ) {
				name = nameNode.text;
			}
			else {
				scope = nameNode.text;
                name = ampersandAST.chr[1].text;
            }
            var scopeActions = this.actionScopeToActionNames[scope];
            if ( scopeActions==null ) { // init scope
                scopeActions = {};
                actionScopeToActionNames[scope] = scopeActions;
            }
            if ( !(name in scopeActions) ) {
                scopeActions[name] = true;
            }
            else {
                this.errMgr.grammarError('ACTION_REDEFINITION',
                                          g.fileName, AST.token(nameNode), name);
            }
        }, this);
    },
    checkForTokenConflicts:function(){},
    
    checkForLabelConflicts:function(rules) {
    	rules.forEach(function(r){
            this.checkForAttributeConflicts(r);
            var labelNameSpace = {};
            for (var i=1; i<=r.numberOfAlts; i++) {
				if (r.hasAltSpecificContexts()) {
					labelNameSpace = {};
				}

                var a = r.alt[i];
                //for (List<LabelElementPair> pairs : a.labelDefs.values() ) {
                a.labelDefs.values().forEach(function(pairs){
                	pairs.forEach(function(p){
                    //for (LabelElementPair p : pairs) {
                        this.checkForLabelConflict(r, p.label);
                        var name = p.label.text;
                        var prev = labelNameSpace[name];
                        if ( prev==null ) labelNameSpace[name] = p;
                        else this.checkForTypeMismatch(prev, p);
                    }, this);
                }, this);
            }
        }, this);
    },
    checkForLabelConflict:function(r, labelID){
    	var name = labelID.text;
		if (name in nameToRuleMap) {
			this.errMgr.grammarError('LABEL_CONFLICTS_WITH_RULE', this.g.fileName, labelID.token, name, r.name);
		}

		if (name in tokenIDs) {
			this.errMgr.grammarError('LABEL_CONFLICTS_WITH_TOKEN', g.fileName, labelID.token, name, r.name);
		}

		/* if (r.args != null && r.args.get(name) != null) {
			ErrorType etype = ErrorType.LABEL_CONFLICTS_WITH_ARG;
			errMgr.grammarError(etype, g.fileName, labelID.token, name, r.name);
		} */

		/* if (r.retvals != null && r.retvals.get(name) != null) {
			ErrorType etype = ErrorType.LABEL_CONFLICTS_WITH_RETVAL;
			errMgr.grammarError(etype, g.fileName, labelID.token, name, r.name);
		}

		if (r.locals != null && r.locals.get(name) != null) {
			ErrorType etype = ErrorType.LABEL_CONFLICTS_WITH_LOCAL;
			errMgr.grammarError(etype, g.fileName, labelID.token, name, r.name);
		} */
    },
    checkForTypeMismatch:function(prevLabelPair, labelPair){
    	if ( prevLabelPair.type != labelPair.type ) {
            var typeMismatchExpr = labelPair.type +"!="+ prevLabelPair.type;
            this.errMgr.grammarError(
                'LABEL_TYPE_CONFLICT', this.g.fileName,
                labelPair.label.token, labelPair.label.text, typeMismatchExpr);
        }
    },
    checkForAttributeConflicts:function( r) {	}
};

function SemanticPipeline(g){
	this.g = g;
}
SemanticPipeline.prototype={
	process:function() {
		if ( this.g.ast==null ) return;
		// COLLECT RULE OBJECTS
		var ruleCollector = new RuleCollector(this.g);
		ruleCollector.process(this.g.ast);

		// DO BASIC / EASY SEMANTIC CHECKS
		/* var basics = new BasicSemanticChecks(g, ruleCollector);
		basics.process(); */

		// don't continue if we get errors in this basic check
		//if ( false ) return;

		// TODO: TRANSFORM LEFT-RECURSIVE RULES
		/* var lrtrans =
			new LeftRecursiveRuleTransformer(g.ast, ruleCollector.rules.values(), g);
		lrtrans.translateLeftRecursiveRules(); */

		// STORE RULES IN GRAMMAR
		ruleCollector.rules.values().forEach(function(r){
				console.log('SemanticPipeline.process() define rule %s', r.name);
				this.g.defineRule(r);
		}, this);
		// COLLECT SYMBOLS: RULES, ACTIONS, TERMINALS, ...
		var collector = new SymbolCollector(this.g);
		collector.process(this.g.ast);

		// CHECK FOR SYMBOL COLLISIONS
		var symcheck = new SymbolChecks(this.g, collector);
		symcheck.process(); // side-effect: strip away redef'd rules.

		collector.namedActions.forEach(function(a){
				this.g.defineAction(a);
		}, this);

		// LINK (outermost) ALT NODES WITH Alternatives
		this.g.rules.values().forEach(function(r){
			for (var i=1; i<=r.numberOfAlts; i++) {
				r.alt[i].ast.alt = r.alt[i];
			}
		}, this);
		
		// ASSIGN TOKEN TYPES
		this.g.importTokensFromTokensFile();
		if ( this.g.isLexer() ) {
			this.assignLexerTokenTypes(this.g, collector.tokensDefs);
		}
		else {
			this.assignTokenTypes(this.g, collector.tokensDefs,
							 collector.tokenIDRefs, collector.terminals);
		}
		
		// CHECK RULE REFS NOW (that we've defined rules in grammar)
		//symcheck.checkRuleArgs(this.g, collector.rulerefs);
		this.identifyStartRules(collector);
		//symcheck.checkForQualifiedRuleIssues(g, collector.qualifiedRulerefs);

		// don't continue if we got symbol errors
		if ( this.g.tool.getNumErrors()>0 ) return;

		// CHECK ATTRIBUTE EXPRESSIONS FOR SEMANTIC VALIDITY
		//AttributeChecks.checkAllAttributeExpressions(this.g);

		//UseDefAnalyzer.trackTokenRuleRefsInActions(this.g);
	},
	identifyStartRules:function(collector) {
		collector.rulerefs.forEach(function(ref){
			var ruleName = ref.text;
			var r = this.g.getRule(ruleName);
			if ( r!=null ) r.isStartRule = false;
		}, this);
	},
	assignLexerTokenTypes:function(g, tokensDefs) {
		var G = this.g.getOutermostGrammar(); // put in root, even if imported
		tokensDefs.forEach(function(def){
			// tokens { id (',' id)* } so must check IDs not TOKEN_REF
			if ( Grammar.isTokenName(def.text) ) {
				G.defineTokenName(def.text);
			}
		},this);

		/* Define token types for nonfragment rules which do not include a 'type(...)'
		 * or 'more' lexer command.
		 */
		//for (Rule r : g.rules.values()) {
		this.g.rules.values().forEach(function(r){
			if ( !r.isFragment() && !this.hasTypeOrMoreCommand(r) ) {
				G.defineTokenName(r.name);
			}
		}, this);

		// FOR ALL X : 'xxx'; RULES, DEFINE 'xxx' AS TYPE X
		var litAliases =
			Grammar.getStringLiteralAliasesFromLexerRules(g.ast);
		var conflictingLiterals = {};
		if ( litAliases!=null ) {
			for(var i=0,l=litAliases.length; i<l; i++){
				var pair = litAliases[i];
				var nameAST = pair.a;
				var litAST = pair.b;
				if ( !G.stringLiteralToTypeMap.containsKey(litAST.text) ) {
					G.defineTokenAlias(nameAST.text, litAST.text);
				}
				else {
					// oops two literal defs in two rules (within or across modes).
					conflictingLiterals[litAST.text] = true;
				}
			}
			for (var lit in conflictingLiterals) {
				// Remove literal if repeated across rules so it's not
				// found by parser grammar.
				G.stringLiteralToTypeMap.remove(lit);
			}
		}

	},
	hasTypeOrMoreCommand:function(r) {
		var ast = r.ast;
		if (ast == null) {
			return false;
		}

		var altActionAst = AST.getFirstDescendantWithType(ast, ANTLRParser.LEXER_ALT_ACTION);
		if (altActionAst == null) {
			// the rule isn't followed by any commands
			return false;
		}

		if(altActionAst.chr == null) return false;
		// first child is the alt itself, subsequent are the actions
		for (var i = 1,l=altActionAst.chr.length; i < l; i++) {
			var node = altActionAst.chr[i];
			if (AST.isType(node, ANTLRParser.LEXER_ACTION_CALL)) {
				if ("type" == node.chr[0].text) {
					return true;
				}
			}
			else if ("more"== node.text) {
				return true;
			}
		}

		return false;
	},
	assignTokenTypes:function( g, tokensDefs, tokenIDs, terminals){
		debugger;
		tokensDefs.forEach(function(alias){
			if (g.getTokenType(alias.text) != Token.INVALID_TYPE) {
				g.tool.errMgr.grammarError('TOKEN_NAME_REASSIGNMENT', g.fileName, alias.token, alias.text);
			}

			g.defineTokenName(alias.text);
		}, this);

		// DEFINE TOKEN TYPES FOR TOKEN REFS LIKE ID, INT
		tokenIDs.forEach(function(idAST){
			if (g.getTokenType(idAST.text) == Token.INVALID_TYPE) {
				g.tool.errMgr.grammarError('IMPLICIT_TOKEN_DEFINITION', g.fileName, idAST.token, idAST.text);
			}

			g.defineTokenName(idAST.text);
		}, this);

		// VERIFY TOKEN TYPES FOR STRING LITERAL REFS LIKE 'while', ';'
		terminals.forEach(function(termAST){
			if (!AST.isType(termAST, ANTLRParser.STRING_LITERAL)) {
				return;
			}

			if (g.getTokenType(termAST.text) == Token.INVALID_TYPE) {
				g.tool.errMgr.grammarError('IMPLICIT_STRING_DEFINITION', g.fileName, termAST.token, termAST.text);
			}
		}, this);

		g.tool.log("semantics", "tokens="+ util.inspect(g.tokenNameToTypeMap));
        g.tool.log("semantics", "strings="+ util.inspect(g.stringLiteralToTypeMap));
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
		var args = Array.prototype.slice.call(arguments, 3);
		return 'Error '+ etype + ', file '+ fileName + ', ' + token +
			' text: '+ args;
	}
};

var ATNType = {
	LEXER: 1,
	PARSER: 2
};

function ParserATNFactory(g){
	//g, atn, currentRule, currentOuterAlt
	if (g == null) {
		throw new Error("Null g");
	}
	this.g = g;
	this.preventEpsilonClosureBlocks = [];
	this.preventEpsilonOptionalBlocks = [];
    
	var atnType = g instanceof LexerGrammar ? ATNType.LEXER : ATNType.PARSER;
	var maxTokenType = g.getMaxTokenType();
	this.atn = new rt.ATN(atnType, maxTokenType);
}
ParserATNFactory.prototype = {
	Handle:function(left, right){
		this.left = left;
		this.right = right;
	},
	newState:function(nodeTypeConst, node) {
		var cause;
		try {
			var s = new nodeTypeConst();
			if ( this.currentRule==null ) s.setRuleIndex(-1);
			else s.setRuleIndex(this.currentRule.index);
			this.atn.addState(s);
			return s;
		} catch (ex) {
			cause = ex;
		} 

		var message = util.format("Could not create %s of type %s.", 'ATNState', nodeTypeConst.prototype.className);
		throw new Error('UnsupportedOperation - '+ message+ ' : '+ cause);
	},
	_createATN:function(rules) {
		this.createRuleStartAndStopATNStates();

		//var adaptor = new GrammarASTAdaptor();
		for (var i = 0,l = rules.length; i<l; i++) {
			var r = rules[i];
			// find rule's block
			var blk = AST.getFirstChildWithType(r.ast, ANTLRParser.BLOCK);
			//var nodes = new CommonTreeNodeStream(adaptor,blk);
			var b = new ATNBuilder(this);
			try {
				this.setCurrentRuleName(r.name);
				var h = b.ruleBlock(null, blk);
				this.rule(r.ast, r.name, h);
			}
			catch ( re) {
				//todo:
				//ErrorManager.fatalInternalError("bad grammar AST structure", re);
				console.error("bad grammar AST structure");
				throw re;
			}
		}
	},
	createRuleStartAndStopATNStates:function() {
		this.atn.ruleToStartState = new Array(this.g.rules.size());
		this.atn.ruleToStopState = new Array(this.g.rules.size());
		this.g.rules.values().forEach(function(r){
			var start = this.newState(rt.RuleStartState, r.ast);
			var stop = this.newState(rt.RuleStopState, r.ast);
			start.stopState = stop;
			start.isPrecedenceRule = r instanceof LeftRecursiveRule;
			start.setRuleIndex(r.index);
			stop.setRuleIndex(r.index);
			this.atn.ruleToStartState[r.index] = start;
			this.atn.ruleToStopState[r.index] = stop;
		}, this);
	},
	block:function(blkAST, ebnfRoot, /*[]*/alts) {
		if ( ebnfRoot==null ) {
			if ( alts.length==1 ) {
				var h = alts[0];
				blkAST.atnState = h.left;
				return h;
			}
			var start = this.newState(rt.BasicBlockStartState, blkAST);
			if ( alts.length>1 ) this.atn.defineDecisionState(start);
			return this.makeBlock(start, blkAST, alts);
		}
		switch ( ebnfRoot.type ) {
			case ANTLRParser.OPTIONAL :
				var start = this.newState(rt.BasicBlockStartState, blkAST);
				atn.defineDecisionState(start);
				var h = this.makeBlock(start, blkAST, alts);
				return this.optional(ebnfRoot, h);
			case ANTLRParser.CLOSURE :
				var star = newState(rt.StarBlockStartState, ebnfRoot);
				if ( alts.length > 1 ) this.atn.defineDecisionState(star);
				h = this.makeBlock(star, blkAST, alts);
				return this.star(ebnfRoot, h);
			case ANTLRParser.POSITIVE_CLOSURE :
				var plus = newState(rt.PlusBlockStartState, ebnfRoot);
				if ( alts.length > 1 ) this.atn.defineDecisionState(plus);
				h = this.makeBlock(plus, blkAST, alts);
				return this.plus(ebnfRoot, h);
		}
		return null;
	},
	
	makeBlock:function(start, blkAST, alts) {
		var end = this.newState(rt.BlockEndState, blkAST);
		start.endState = end;
		alts.forEach (function(alt) {
			// hook alts up to decision block
			this.epsilon(start, alt.left);
			this.epsilon(alt.right, end);
			// no back link in ATN so must walk entire alt to see if we can
			// strip out the epsilon to 'end' state
			var opt = new TailEpsilonRemover(atn);
			opt.visit(alt.left);
		}, this);
		var h = new this.Handle(start, end);
//		FASerializer ser = new FASerializer(g, h.left);
//		System.out.println(blkAST.toStringTree()+":\n"+ser);
		blkAST.atnState = start;
		return h;
	},
	
	star:function(starAST, elem){
		var blkStart = elem.left;
		var blkEnd = elem.right;
		this.preventEpsilonClosureBlocks.push({a:currentRule, b:blkStart, c:blkEnd});

		var entry = this.newState(rt.StarLoopEntryState, starAST);
		entry.nonGreedy = !starAST._greedy;
		this.atn.defineDecisionState(entry);
		var end = this.newState(rt.LoopEndState, starAST);
		var loop = this.newState(rt.StarLoopbackState, starAST);
		entry.loopBackState = loop;
		end.loopBackState = loop;

		var blkAST = starAST.chr[0];
		if ( starAST._greedy ) {
			if (this.expectNonGreedy(blkAST)) {
				this.g.tool.errMgr.grammarError('EXPECTED_NON_GREEDY_WILDCARD_BLOCK',
					this.g.fileName, starAST.getToken(), starAST.getToken().getText());
			}

			this.epsilon(entry, blkStart);	// loop enter edge (alt 1)
			this.epsilon(entry, end);		// bypass loop edge (alt 2)
		}
		else {
			// if not greedy, priority to exit branch; make it first
			this.epsilon(entry, end);		// bypass loop edge (alt 1)
			this.epsilon(entry, blkStart);	// loop enter edge (alt 2)
		}
		this.epsilon(blkEnd, loop);		// block end hits loop back
		this.epsilon(loop, entry);		// loop back to entry/exit decision

		starAST.atnState = entry;	// decision is to enter/exit; blk is its own decision
		return new this.Handle(entry, end);
	},
	optional:function(optAST, blk){
		var blkStart = blk.left;
		var blkEnd = blk.right;
		this.preventEpsilonOptionalBlocks.push({a:currentRule, b:blkStart, c:blkEnd});

		var greedy = optAST._greedy;
		blkStart.nonGreedy = !greedy;
		this.epsilon(blkStart, blk.right, !greedy);

		optAST.atnState = blk.left;
		return blk;
	},
	plus:function(plusAST, blk){
		var blkStart = blk.left;
		var blkEnd = blk.right;
		this.preventEpsilonClosureBlocks.push({a:currentRule, b:blkStart, c:blkEnd});

		var loop = this.newState(rt.PlusLoopbackState, plusAST);
		loop.nonGreedy = !plusAST._greedy;
		atn.defineDecisionState(loop);
		var end = this.newState(LoopEndState.class, plusAST);
		blkStart.loopBackState = loop;
		end.loopBackState = loop;

		plusAST.atnState = blkStart;
		this.epsilon(blkEnd, loop);		// blk can see loop back

		var blkAST = plusAST.chr[0];
		if ( plusAST._greedy ) {
			if (this.expectNonGreedy(blkAST)) {
				this.g.tool.errMgr.grammarError('EXPECTED_NON_GREEDY_WILDCARD_BLOCK', this.g.fileName, plusAST);
			}

			this.epsilon(loop, blkStart);	// loop back to start
			this.epsilon(loop, end);			// or exit
		}
		else {
			// if not greedy, priority to exit branch; make it first
			this.epsilon(loop, end);			// exit
			this.epsilon(loop, blkStart);	// loop back to start
		}

		return new this.Handle(blkStart, end);
	},
	epsilon:function(node){
		var left = this.newState(node);
		var right = this.newState(node);
		this.epsilon(left, right);
		node.atnState = left;
		return new this.Handle(left, right);
	},
	expectNonGreedy:function(blkAST){
		if ( this.blockHasWildcardAlt(blkAST) ) {
			return true;
		}

		return false;
	},
	setCurrentRuleName:function(name) {
		this.currentRule = g.getRule(name);
	},
	setCurrentOuterAlt:function(alt){
		this.currentOuterAlt = alt;
	},
	blockHasWildcardAlt:function(block){
		return block.chr.some(function(alt){
			if ( !(alt.className == 'AltAST') ) return false;
			var altAST = alt;
			if ( altAST.chr && altAST.chr.length ==1 ) {
				var e = altAST.chr[0];
				if ( e.type == ANTLRParser.WILDCARD ) {
					return true;
				}
			}
			return false;
		});
	},
	alt:function(els) {
		return this.elemList(els);
	},
	elemList:function(els){
		var n = els.length;
		for (var i = 0; i < n - 1; i++) {	// hook up elements (visit all but last)
			var el = els[i];
			// if el is of form o-x->o for x in {rule, action, pred, token, ...}
			// and not last in alt
            var tr = null;
            if ( el.left.getNumberOfTransitions()==1 ) tr = el.left.transition(0);
            var isRuleTrans = tr instanceof RuleTransition;
            if ( el.left.getStateType() == ATNState.BASIC &&
				el.right.getStateType()== ATNState.BASIC &&
				tr!=null && (isRuleTrans && tr.followState == el.right || tr.target == el.right) )
			{
				// we can avoid epsilon edge to next el
				if ( isRuleTrans ) tr.followState = els[i+1].left;
                else tr.target = els[i+1].left;
				this.atn.removeState(el.right); // we skipped over this state
			}
			else { // need epsilon if previous block's right end node is complicated
				this.epsilon(el.right, els.get(i+1).left);
			}
		}
		var first = els[0];
		var last = els[n -1];
		if ( first==null || last==null ) {
			this.g.tool.errMgr.toolError('INTERNAL_ERROR', "element list has first|last == null");
		}
		return new this.Handle(first.left, last.right);
	}
};
function LexerATNFactory(g){
	ParserATNFactory.call(this, g);
	var language = g.getOptionString("language");
	var gen = new CodeGenerator(g.tool, null, language);
	this.codegenTemplates = gen.getTemplates();
}
LexerATNFactory.prototype = Object.create(ParserATNFactory.prototype);
mixin(LexerATNFactory.prototype, {
	createATN:function(){
		// BUILD ALL START STATES (ONE PER MODE)
		var modes = this.g.modes.keySet();
		for (var modeName in modes) {
			// create s0, start state; implied Tokens rule node
			var startState =
				this.newState(rt.TokensStartState, null);
			this.atn.modeNameToStartState.put(modeName, startState);
			this.atn.modeToStartState.push(startState);
			this.atn.defineDecisionState(startState);
		}

		// INIT ACTION, RULE->TOKEN_TYPE MAP
		this.atn.ruleToTokenType = new Array(this.g.rules.size());
		this.g.rules.values().forEach(function(r) {
			this.atn.ruleToTokenType[r.index] = this.g.getTokenType(r.name);
		}, this);
		//console.log('atn = %s', util.inspect(this.atn));
		// CREATE ATN FOR EACH RULE
		this._createATN(this.g.rules.values());
		/* 
		atn.lexerActions = new LexerAction[indexToActionMap.size()];
		for (Map.Entry<Integer, LexerAction> entry : indexToActionMap.entrySet()) {
			atn.lexerActions[entry.getKey()] = entry.getValue();
		}

		// LINK MODE START STATE TO EACH TOKEN RULE
		for (String modeName : modes) {
			List<Rule> rules = ((LexerGrammar)g).modes.get(modeName);
			TokensStartState startState = atn.modeNameToStartState.get(modeName);
			for (Rule r : rules) {
				if ( !r.isFragment() ) {
					RuleStartState s = atn.ruleToStartState[r.index];
					epsilon(startState, s);
				}
			}
		}

		ATNOptimizer.optimize(g, atn);
		return atn; */
	},
	lexerAltCommands:function( alt, cmds) {
		var h = new this.Handle(alt.left, cmds.right);
		this.epsilon(alt.right, cmds.left);
		return h;
	}
});

function ATNBuilder(/*ATNFactory*/factory){
	this.factory = factory
}

ATNBuilder.prototype = {
	ruleBlock:function(ebnfRoot, blockAST){
		var alts = [], alt = 1;
		this.factory.setCurrentOuterAlt(alt);
		blockAST.chr.forEach(function(c){
			if(AST.isType(c, 'OPTIONS'))
				return;
			alts.push(this.alternative(c));
			this.factory.setCurrentOuterAlt(++alt);
		}, this);
		return this.factory.block(blockAST, ebnfRoot, alts)
	},
	alternative:function(ast){
		var els = [];
		if(ast.type == _A.LEXER_ALT_ACTION){
			var a = this.alternative(ast.chr[0]);
			if(ast.chr.length > 1)
				var lc = this.lexerCommands(ast.chr[1]);
			this.factory.lexerAltCommands(a, lc);
		}else if(ast.type == _A.ALT){
			if(ast.chr[0].type == _A.EPSILON)
				return this.factory.epsilon(ast.chr[0]);
			ast.chr.forEarch(function(c){
					els.push(this.element(c));
			}, this);
			return this.factory.alt(els);
		}
	},
	lexerCommands:function(ast){
		var cmds = [];
		ast.chr.forEach(function(lc){
				var c = this.lexerCommand(lc);
				if(c != null)
					cmds.push(c);
		}, this);
	},
	lexerCommand:function(ast){
		if(ast.type == _A.LEXER_ACTION_CALL)
			return this.factory.lexerCallCommand(ast.chr[0], ast.chr[1]);
		else if(ast.type == _A.ID)
			return this.factory.lexerCommand(ast);
		else
			throw new Error('Incorrect AST type for lexerCommand, type: '+ ast.type);
	},
	element:function(ast){
		switch(ast.type){
			case _A.ASSIGN:
			case _A.PLUS_ASSIGN:
				return this.labeledElement(ast);
			case _A.RANGE:
			case _A.DOT:
			case _A.WILDCARD:
			case _A.SET:
			case _A.STRING_LITERAL:
			case _A.TOKEN_REF:
			case _A.RULE_REF:
				return this.atom(ast);
			case _A.OPTIONAL:
			case _A.CLOSURE:
			case _A.POSITIVE_CLOSURE:
			case _A.BLOCK:
				return this.subrule(ast);
			case _A.ACTION:
				return this.factory.action(ast);
			case _A.SEMPRED:
				return this.factory.sempred(ast);
			case _A.NOT:
				return this.blockSet(true, ast.chr[0]);
			case _A.LEXER_CHAR_SET:
				return this.factory.charSetLiteral(ast);
		}
		//todo
	},
	labeledElement:function(ast){
		if(ast.type == _A.ASSIGN){
			return this.factory.label(this.element(ast.chr[1]));
		}else if(ast.type == _A.PLUS_ASSIGN){
			return this.factory.listLabel(this.element(ast.chr[1]));
		}
	},
	atom:function(ast){
		switch(ast.type){
			case _A.RANGE:
				return this.range();
			case _A.DOT:
				if(ast.chr.length == 2 && ast.chr[0].type == _A.ID){
					if(ast.chr[1].type == _A.RULE_REF)
						return this.ruleref(ast.chr[1]);
					else
						return this.terminal(ast.chr[1]);
				}
				break;
			case _A.WILDCARD:
				return this.factory.wildcard(ast);
			case _A.SET:
				return this.blockSet(false, ast);
			case _A.STRING_LITERAL:
			case _A.TOKEN_REF:
				return this.terminal(ast);
			case _A.RULE_REF:
				return this.ruleref(ast);
		}
	},
	range:function(ast){
		return this.factory.range(ast.chr[0], ast.chr[1]);
	},
	blockSet:function(invert, ast){
		var alts = [];
		ast.chr.forEach(function(c){
				alts.push(this.setElement(c));
		}, this);
		this.factory.set(ast, alts, invert);
	},
	terminal:function(ast){
		if(ast.type == _A.STRING_LITERAL)
			this.factory.stringLiteral(ast);
		else if(ast.type == _A.TOKEN_REF)
			this.factory.tokenRef(ast);
	},
	ruleref:function(ast){
		return this.factory.ruleRef(ast);
	},
	subrule:function(ast){
		switch(ast.type){
		case _A.OPTIONAL:
		case _A.CLOSURE:
		case _A.POSITIVE_CLOSURE:
			return this.block(ast, ast.chr[0]);
		default:
			return this.block(null, ast);
		}
	},
	/** ^(BLOCK (^(OPTIONS .*))? (a=alternative {alts.add($a.p);})+) */
	block:function(start, ast){
		var alts = [];
		alts.chr.forEach(function(c){
				if(c.type == _A.OPTIONS)
					return;
				else
					alts.push(this.alternative(c));
		}, this);
		this.factory.block(ast, start, alts);
	},
	setElement:function(ast){
		return (ast.chr && ast.chr.length >0) ? ast.chr[0] : ast;
	},
	_findStart:function(ast){
		return AST.firstLeaf(ast);
	}
};
function ATNVisitor(){
}
ATNVisitor.prototype = {
	visit:function(s){
		this.visit_(s, {});
	},
	visit_:function(s, visited) {
		if( s.stateNumber in visited) return;
		//if ( !visited.add(s.stateNumber) ) return;
		visited[s.stateNumber] = true;

		this.visitState(s);
		var n = s.getNumberOfTransitions();
		for (var i=0; i<n; i++) {
			var t = s.transition(i);
			this.visit_(t.target, visited);
		}
	}
};

function TailEpsilonRemover(atn){
	this._atn = atn;
}
extend(TailEpsilonRemover, ATNVisitor, {
	visitState:function(p){
		if (p.getStateType() == rt.ATNState.BASIC && p.getNumberOfTransitions() == 1) {
			var q = p.transition(0).target;
			if (p.transition(0) instanceof rt.RuleTransition) {
				q = p.transition(0).followState;
			}
			if (q.getStateType() == ATNState.BASIC) {
				// we have p-x->q for x in {rule, action, pred, token, ...}
				// if edge out of q is single epsilon to block end
				// we can strip epsilon p-x->q-eps->r
				var trans = q.transition(0);
				if (q.getNumberOfTransitions() == 1 && trans.isEpsilon() && !(trans instanceof rt.ActionTransition)) {
					var r = trans.target;
					if (r instanceof rt.BlockEndState || r instanceof rt.PlusLoopbackState || r instanceof rt.StarLoopbackState) {
						// skip over q
						if (p.transition(0) instanceof rt.RuleTransition) {
							p.transition(0).followState = r;
						} else {
							p.transition(0).target = r;
						}
						this._atn.removeState(q);
					}
				}
			}
		}
	}
});
function CodeGenerator(tool, g, language){
	this.lineWidth = 72;
	this.g = g;
	this.tool = tool;
	this.language = language != null ? language : CodeGenerator.DEFAULT_LANGUAGE;
}
mixin(CodeGenerator, {
	DEFAULT_LANGUAGE: 'Javascript',
	VOCAB_FILE_EXTENSION: '.tokens',
	TEMPLATE_ROOT: ''
});
CodeGenerator.prototype = {
	getTemplates:function(){
		return ['todo template'];
	}
};
module.exports = Tool;

