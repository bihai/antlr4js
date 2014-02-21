var process = require('process');

function Tool(args){
	this.grammarFiles = [];
	this.errMgr = new ErrorManager(this);
	this.handleArgs(args);
	this.launch_ST_inspector = false;
	this.return_dont_exit = false;
}

Tool.prototype={
	handleArgs:function(args){
		this.grammarFiles.concat(args);
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
		var sortedGrammars = this.sortGrammarByTokenVocab(this.grammarFiles);
		sortedGrammars.forEach(function(t, i){
		
			var g = this.createGrammar(t);
			g.fileName = t.fileName;
			this.process(g, true);
		});
	},
	sortGrammarByTokenVocab:function(fileNames){
		var g = new Graph();
		var roots = [];
		fileNames.forEach(function( fileName ) {
			var t = this.parseGrammar(fileName);
			if ( t==null || t instanceof GrammarASTErrorNode) continue; // came back as error node
			if ( ((GrammarRootAST)t).hasErrors ) continue;
			GrammarRootAST root = (GrammarRootAST)t;
			roots.add(root);
			root.fileName = fileName;
			String grammarName = root.getChild(0).getText();

			GrammarAST tokenVocabNode = findOptionValueAST(root, "tokenVocab");
			// Make grammars depend on any tokenVocab options
			if ( tokenVocabNode!=null ) {
				String vocabName = tokenVocabNode.getText();
				g.addEdge(grammarName, vocabName);
			}
			// add cycle to graph so we always process a grammar if no error
			// even if no dependency
			g.addEdge(grammarName, grammarName);
		});

		List<String> sortedGrammarNames = g.sort();
//		System.out.println("sortedGrammarNames="+sortedGrammarNames);

		List<GrammarRootAST> sortedRoots = new ArrayList<GrammarRootAST>();
		for (String grammarName : sortedGrammarNames) {
			for (GrammarRootAST root : roots) {
				if ( root.getGrammarName().equals(grammarName) ) {
					sortedRoots.add(root);
					break;
				}
			}
		}

		return sortedRoots;
	},
	parseGrammar:function(file){
		// TODO
	},
	createGrammar:function(ast){
		// TODO
	},
	process:function(g, gencode){
		// TODO
	},
	exit:function(e){
		process.exit(e);
	}
}

function ErrorManager(tool){
	this.tool = tool;
	this.errors = 0;
	this.warnings = 0;
	
}
ErrorManager.prototype ={
	getNumErrors:function(){
		return this.errors;
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
