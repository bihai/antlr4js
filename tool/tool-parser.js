
(function(){

function GrammarParser(){

}
/**
sample:
{
	name:'TestAntlr'
	parser:{
		tokens:[],
		rules:[
			{
				name:'RULE_REF',
				ruleBlock:'<rule block>'
			}
		]
	},
	lexer:{
		tokens:[],
		rules:[
		
		],
		modeSpec:[
		
		]
	}
}

rule block AST:
	[
		// labeledAlt
		[
			//alternative
			{
				type:'labeledElement'
			},
			// ebnfSuffix
			{
				type:'?|+|*',
				labeledElement:{
					type:'labeledElement',
					ass:'+=|=',
					id:'<ID>',
					block/atom:  [ //alternative... ]
				}
			},
			{
				type:'atom',
				range/terminal/ruleref/notSet/wildcard
			},
			{
				type:'ebnf' // block ebnfSuffix
			},
			{
				type:'actionElement'
			}
		],
		// labeledAlt
		[
		]
	]
	
rule block sample:
	
	

*/
exports.createAST = function(json){
	
}

})();
