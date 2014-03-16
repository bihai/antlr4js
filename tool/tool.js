var misc = require('./misc.js');
var util = require('util');
var fs = require('fs');
var Graph = misc.Graph;
var MultiMap = misc.MultiMap;
var IntervalSet = misc.IntervalSet;
var OrderedHashMap = misc.OrderedHashMap;
var LinkedHashMap = OrderedHashMap;
var Utils = misc.Utils;
var ANTLRParser = require('./parser.js').ANTLRParser;
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
		else if(typeof(types) == 'string')
			types = IntervalSet.of(ANTLRParser[types]);
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
	type:function(tree){
		if(typeof(tree.type) == 'string')
			return ANTLRParser[tree.type];
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
			callback(node, type, p);
			if ( node.chr ==null ) return;
			for(var i=0,l=node.chr.length; i<l; i++){
				var c = node.chr[i];
					if(c.parent == null)
						c.parent = node;
					work.push(c);
			}
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
			debugger;
			if(not && !AST.isType(tree, arguments[i].substring(1))  ||
				!not && AST.isType(tree, arguments[i])) 
				tree = tree.parent;
			else{
				console.log('type:'+ arguments[i]);
				debugger;
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
	}
}
AST.Token.prototype={
	getLine:function(){
		return this.line;
	}
};
var Token ={
	INVALID_TYPE:0,
    EPSILON:-2,
	MIN_USER_TOKEN_TYPE:1,
    EOF: -1,//IntStream.EOF;
	DEFAULT_CHANNEL: 0,
	HIDDEN_CHANNEL:1
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
		this.indexToRule.add(r);
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
		tokenNameToTypeMap.put(name, ttype);
		this.setTokenForType(ttype, name);
		this.maxTokenType = Math.max(maxTokenType, ttype);
		return ttype;
	},
	getNewTokenType:function() {
		this.maxTokenType++;
		return this.maxTokenType;
	},
	importTokensFromTokensFile:function(){
		
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
		var i = (I!=null)? I : Token.INVALID_TYPE;
		//tool.log("grammar", "grammar type "+type+" "+tokenName+"->"+i);
		return i;
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
		var json = fs.readFileSync(fileNames == null || fileNames[0] == null? 'grammar-ast.json': fileNames[0],
			'utf-8');
		console.log("read:\n"+ json);
		//json = JSON.parse(json)
		json = eval(json);
		console.log(">>:\n"+ json);
		json.forEach(function(grmJson){
				AST.processRaw(grmJson);
		}, this);
		return json;
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
		if ( this.errMgr.getNumErrors()>prevErrors ) return;
		var factory = null;
		if ( g.isLexer() )
			factory = new LexerATNFactory(g);
		else factory = new ParserATNFactory(g);
		g.atn = factory.createATN();

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
		}
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
		var id = root.chr[0];
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
		var rref = first.chr[1];
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
				if(AST.isType(node.chr[1], 'RULE_REF')){
					self.discoverRule(node, node.chr[0], 
						AST.getAllChildrenWithType(node, ANTLRParser.AT), block);
					
				}else if(AST.isType(node.chr[1], 'TOKEN_REF')){
					var modiNode = AST.getFirstChildWithType(node, ANTLRParser.RULEMODIFIERS);
					if(modiNode && modi.chr){
						var modi = modiNode.chr[0];
					}
					self.discoverLexerRule(node, ID, modi, block);
					
				}
				var l = block.chr ? block.chr.length: 0;
				for(var i=0; i<l; i++)
					self.discoverOuterAlt(block.chr[i]);//LEXER_ALT_ACTION | ALT
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
			ruleToAltLabels.map(currentRuleName, alt.altLabel);
			var altLabel = alt.altLabel.text;
			this.altLabelToRuleName.put(Utils.capitalize(altLabel), currentRuleName);
			this.altLabelToRuleName.put(Utils.decapitalize(altLabel), currentRuleName);
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
	this.alt = new Array(numberOfAlts+1); // 1..n
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
		var labels = [];
		for (var i=1; i<=this.numberOfAlts; i++) {
			var altLabel = this.alt[i].ast.altLabel;
			if ( altLabel!=null ) {
				labels.push({a:i, b: this.alt[i].ast, c:altLabel.text});
			}
		}
		if ( labels.length == 0 ) return null;
		return labels;
	},
	isFragment:function() {
		if ( this.modifiers==null ) return false;
		this.modifiers.some(function(a){
			return  a.type =="FRAGMENT"|| ANTLRParser.FRAGMENT ;
		}, this);
		return false;
	}
};
function Alternative(r, altNum) {
	this.actions = [];
	this.rule = r; this.altNum = altNum;
	this.labelDefs = new MultiMap();
	this.tokenRefs = new MultiMap();
}

function SymbolCollector(g){
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
		AST.visit(ast, function(node, type, parent){
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
					//if(AST.isType(node.chr[1], 'RULE_REF')){
					self.discoverRule(node.chr[0]);
					var block = AST.getFirstChildWithType(node, ANTLRParser.BLOCK);
					var l = block.chr ? block.chr.length: 0;
					for(var i=0; i<l; i++)
						self.discoverOuterAlt(block.chr[i]);
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
					if( !(this.g.isLexer() && AST.isType(parent, 'RANGE')) && !AST.isType(parent.parent, 'ELEMENT_OPTIONS')){
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
		console.log('SymbolCollor.discoverRule '+ ID.text);
	},
	discoverOuterAlt:function(alt) {
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
        this.tokenIDs.add(tokenId.text);
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
		var ruleCollector = new RuleCollector(g);
		ruleCollector.process(g.ast);

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
				this.g.defineRule(r);
		});

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

		g.tool.log("semantics", "tokens="+g.tokenNameToTypeMap);
        g.tool.log("semantics", "strings="+g.stringLiteralToTypeMap);
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
module.exports = Tool;

