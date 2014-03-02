'use strict';
var ErrorManager = require('./ErrorManager.js');

var VERSION = 'ANTLR JS 3.5';

function uuid(obj){
	return typeof(obj) == 'string'? obj: obj.uuid();
}

function OrderedHashSet(){
	this.arr = [];
	this.map = {};
	this._size = 0;
}

OrderedHashSet.prototype={
	add:function(e){
		if(!this.contains(e)){
			this.arr.push(e);
			this.map[uuid(e)] = e;
			this._size++;
		}
	},
	contains:function(e){
		return uuid(e) in this.map;
	},
	size:function(){
		return this._size;
	}
};

var Graph = (function(){
	function Graph(){
		this.nodes = {};
	}
	function Node(payload){
		this.payload = payload;
	}
	Node.prototype={
		toString:function() { return this.payload.toString(); },
		addEdge:function(n) {
            if ( this.edges==null ){
            	this.edges = [];
            }
            if ( edges.indexOf(n) == -1 ) edges.push(n);
        }
	};
	Graph.prototype ={
		/**
		a, b must be string or have uuid() function
		*/
		addEdge:function( a,  b) {
			var a_node = this.getNode(a);
			var b_node = this.getNode(b);
			a_node.addEdge(b_node);
		},
		getNode:function( a) {
			var existing = this.nodes[uuid(a)];
			if ( existing!=null ) return existing;
			var n = new Node(a);
			this.nodes[uuid(a)] = n;
			return n;
		},
		sort:function() {
			var visited = new OrderedHashSet();
			var sorted = [];
			while ( visited.size() < this.nodes.length ) {
				// pick any unvisited node, n
				var n = null;
				for( var id in this.nodes){
				//for (Iterator it = nodes.values().iterator(); it.hasNext();) {
					n = this.nodes[id];
					if ( !visited.contains(n) ) break;
				}
				this.DFS(n, visited, sorted);
			}
			return sorted;
		},
		DFS:function(n, visited, sorted) {
			if ( visited.contains(n) ) return;
			visited.add(n);
			if ( n.edges!=null ) {
				for(var i=0,l=n.edges.length; i<l; i++){
					var target = n.edges[i];
					this.DFS(target, visited, sorted);
				}
			}
			sorted.push(n.payload);
		}
	};
	return Graph;
})();

function Tool3(args){
	this.showBanner = true;
	this.verbose = false;
	this.outputDirectory = '.';
	this.generate_NFA_dot = false;
    this.generate_DFA_dot = false;
    this.haveOutputDir = false;
    this.inputDirectory = null;
/*     this.parentGrammarDirectory; 
    this.grammarOutputDirectory; */
    this.haveInputDir = false;
    this.libDirectory = ".";
    this.debug = false;
    this.trace = false;
    this.profile = false;
    this.report = false;
    this.printGrammar = false;
    this.depend = false;
    this.forceAllFilesToOutputDir = false;
    this.forceRelativeOutput = false;
    this.deleteTempLexer = true;
    /** Don't process grammar file if generated files are newer than grammar */
    this.make = false;
    this.grammarFileNames = [];
	this.processArgs(args);
}

Tool3.prototype={
	process:function(){
		var exceptionWhenWritingLexerFile = false;
        var lexerGrammarFileName = null;		// necessary at this scope to have access in the catch below

        // Have to be tricky here when Maven or build tools call in and must new Tool()
        // before setting options. The banner won't display that way!
        if (this.verbose && this.showBanner) {
            ErrorManager.info("ANTLR Parser Generator  Version " + VERSION);
            this.showBanner = false;
        }
        try {
            this.sortGrammarFiles(); // update grammarFileNames
        }
        catch (e) {
            ErrorManager.error('MSG_INTERNAL_ERROR', e);
        }
        grammarFileNames.forEach(function ( grammarFileName ) {
			if (make) {
				//TODO
				//try {
				//	if ( !this.buildRequired(grammarFileName) ) continue;
				//}
				//catch (e) {
				//	ErrorManager.error('MSG_INTERNAL_ERROR',e);
				//}
			}
			if (this.verbose && !this.depend) {
                console.log(grammarFileName);
            }
            try {
            	//if (isDepend()) {
                //    BuildDependencyGenerator dep =
                //        new BuildDependencyGenerator(this, grammarFileName);
                //    /*
                //    List outputFiles = dep.getGeneratedFileList();
                //    List dependents = dep.getDependenciesFileList();
                //    System.out.println("output: "+outputFiles);
                //    System.out.println("dependents: "+dependents);
                //     */
                //    System.out.println(dep.getDependencies());
                //    continue;
                //}
            }catch(e){
            }
        });
	},
	sortGrammarFiles:function(){
		var g = new Graph();
        var missingFiles = [];
        for (var i=0,l=this.grammarFileNames.length; i<l;i++) {
        	var gfile = this.grammarFileNames[i];
            try {
                var grammar = new GrammarSpelunker(this.inputDirectory, gfile);
                grammar.parse();
                var vocabName = grammar.getTokenVocab();
                var grammarName = grammar.getGrammarName();
                // Make all grammars depend on any tokenVocab options
                if ( vocabName!=null ) g.addEdge(gfile, vocabName+ '.tokens');
                // Make all generated tokens files depend on their grammars
                g.addEdge(grammarName+ '.tokens', gfile);
            }
            catch ( fnfe) {
                ErrorManager.error('MSG_CANNOT_OPEN_FILE', gfile);
                missingFiles.push(gfile);
            }
        }
        var sorted = g.sort();
        //System.out.println("sorted="+sorted);
        this.grammarFileNames=[]; // wipe so we can give new ordered list
        for (var i = 0; i < sorted.length; i++) {
            var f = sorted[i];
            if ( missingFiles.indexOf(f) >= 0) continue;
            //if ( !(f.endsWith(".g") || f.endsWith(".g3")) ) continue;
            this.grammarFileNames.push(f);
        }
	},
	processArgs:function(args){
		if (this.verbose) {
            ErrorManager.info("ANTLR Parser Generator  Version " + VERSION);
            this.showBanner = false;
        }

        if (args == null || args.length == 0) {
            this.help();
            return;
        }
        for (var i = 0; i < args.length; i++) {
            if (args[i].equals("-o") || args[i].equals("-fo")) {
                if (i + 1 >= args.length) {
                    console.log("missing output directory with -fo/-o option; ignoring");
                }
                else {
                    if (args[i].equals("-fo")) { // force output into dir
                        this.forceAllFilesToOutputDir = true;
                    }
                    i++;
                    this.outputDirectory = args[i];
                    var de = this.outputDirectory.charAt(this.outputDirectory.length -1);
                    if (de == "/" || de == "\\" ){
                        this.outputDirectory =
                            this.outputDirectory.substring(0, this.outputDirectory.length - 1);
                    }
                    this.haveOutputDir = true;
                }
            }
            //TODO
        }
	},
	help:function(){
		ErrorManager.info("ANTLR Parser Generator  Version " + VERSION);
        console.log("usage: node tool3.js [args] file.g [file2.g file3.g ...]");
        console.log("  -o outputDir          specify output directory where all output is generated");
        console.log("  -fo outputDir         same as -o but force even files with relative paths to dir");
        console.log("  -lib dir              specify location of token files");
        console.log("  -depend               generate file dependencies");
        console.log("  -report               print out a report about the grammar(s) processed");
        console.log("  -print                print out the grammar without actions");
        console.log("  -debug                generate a parser that emits debugging events");
		console.log("  -profile              generate a parser that computes profiling information");
		console.log("  -trace                generate a recognizer that traces rule entry/exit");
        console.log("  -nfa                  generate an NFA for each rule");
        console.log("  -dfa                  generate a DFA for each decision point");
        console.log("  -message-format name  specify output style for messages");
        console.log("  -verbose              generate ANTLR version and other information");
        console.log("  -make                 only build if generated files older than grammar");
        console.log("  -version              print the version of ANTLR and exit.");
        console.log("  -X                    display extended argument list");
	}
};
var exitNow = false;
function main(){
	var args = process.argv.slice(2);
	var antlr = new Tool3(args);
	if (!exitNow) {
            antlr.process();
            if (ErrorManager.getNumErrors() > 0) {
                process.exit(1);
            }
            process.exit(0);
        }
}
main();
