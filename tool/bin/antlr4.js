var Tool = require('./tool.js');

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
