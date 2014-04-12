var ANTLRParser = require('./constants.js').ANTLRParser;
var util= require('util');

module.exports = function(text){

var OPTIONS = 'options';
var TOKENS_SPEC  = 'tokens';
var IMPORT       = 'import'               ;
var FRAGMENT     = 'fragment'             ;
var LEXER        = 'lexer'                ;
var PARSER       = 'parser'               ;
var GRAMMAR      = 'grammar'              ;
var TREE_GRAMMAR = 'tree';
var PROTECTED    = 'protected'            ;
var PUBLIC       = 'public'               ;
var PRIVATE      = 'private'              ;
var RETURNS      = 'returns'              ;
var LOCALS       = 'locals'               ;
var THROWS       = 'throws'               ;
var CATCH        = 'catch'                ;
var FINALLY      = 'finally'              ;
var MODE         = 'mode'                 ;
var _tokenMap = {
	OPTIONS:'options',
	TOKENS_SPEC:'tokens',
	IMPORT:'import',
	FRAGMENT:'fragment',
	LEXER:'lexer',
	PARSER:'parser',
	GRAMMAR:'grammar',
	TREE_GRAMMAR:'tree',
	PROTECTED:'protected',
	PUBLIC:'public',
	PRIVATE:'private',
	RETURNS:'returns',
	LOCALS:'locals',
	THROWS:'throws',
	CATCH:'catch',
	FINALLY:'finally',
	MODE:'mode'
};
var _litMap={
	'options':  'OPTIONS'			 ,
	'tokens':   'TOKENS_SPEC'        ,
	'import':   'IMPORT'             ,
	'fragment': 'FRAGMENT'           ,
	'lexer':    'LEXER'              ,
	'parser':   'PARSER'             ,
	'grammar':  'GRAMMAR'            ,
	'tree':     'TREE_GRAMMAR'       ,
	'protected':'PROTECTED'          ,
	'public':   'PUBLIC'             ,
	'private':  'PRIVATE'            ,
	'returns':  'RETURNS'            ,
	'locals':   'LOCALS'             ,
	'throws':   'THROWS'             ,
	'catch':    'CATCH'              ,
	'finally':  'FINALLY'            ,
	'mode':     'MODE'               ,
	
	 ':'	:	  'COLON'			,
	 '::'	:     'COLONCOLON'    ,
	 ','    :     'COMMA'         ,
	 ';'    :     'SEMI'          ,
	 '('    :     'LPAREN'        ,
	 ')'    :     'RPAREN'        ,
	 '->'   :     'RARROW'        ,
	 '<'    :     'LT'            ,
	 '>'    :     'GT'            ,
	 '='    :     'ASSIGN'        ,
	 '?'    :     'QUESTION'      ,
	 '=>'   :     'SYNPRED'       ,
	 '*'    :     'STAR'          ,
	 '+'    :     'PLUS'          ,
	 '+='   :     'PLUS_ASSIGN'   ,
	 '|'    :     'OR'            ,
	 '$'    :     'DOLLAR'        ,
	 '.'    :     'DOT'           ,
	 '..'   :     'RANGE'         ,
	 '@'    :     'AT'            ,
	 '#'    :     'POUND'         ,
	 '~'    :     'NOT'           ,
	 '}'    :     'RBRACE'        ,
	 '{'	:	'LBRACE'
};

var COLON =    ':'		, 
COLONCOLON   = '::'                   ,
COMMA        = ','                    ,
SEMI 		  = ';'		,
LPAREN       = '('                    ,
RPAREN       = ')'                    ,
RARROW       = '->'                   ,
LT           = '<'                    ,
GT           = '>'                    ,
ASSIGN       = '='                    ,
QUESTION     = '?'                    ,
SYNPRED      = '=>'		,
STAR         = '*'                    ,
PLUS         = '+'                    ,
PLUS_ASSIGN  = '+='                   ,
OR           = '|'                    ,
DOLLAR       = '$'                    ,
DOT		     = '.'                    , 
RANGE        = '..'                   ,
AT           = '@'                    ,
POUND        = '#'                    ,
NOT          = '~'                    ,
RBRACE       = '}'                    ;
LBRACE = '{';

var ID = 'ID';


var EOF = -1;
var _ch = null;
var _chBuf = [];
var pos = 0;
var lineno = 1;
var input = null;
var token = null;

function init(text){
	input = text;
}
function createAST(text){
	input = text;
	return grammar();
}
function position(){
	return pos;
}

function nextChar(){
	if(pos >= input.length)
		return EOF;
	var c = input.charAt(pos++);
	return c;
}
function LA(n){
	if(n == null)
		n = 1;
	var idx = n - 1;
	while(idx >= _chBuf.length){
		_chBuf.push(nextChar());
	}
	return _chBuf[idx];
}
function consumeChar(){
	if(_chBuf.length == 0)
		LA(1);
	var c = _chBuf.shift();
	if(c == '\n')
		lineno ++;
	return c;
}

function identity(){
	var ch = LA(), text ='';
	if( (ch >= 'a' && ch <= 'z') || 
		(ch >= 'A' && ch <= 'Z') ||
		ch == '_'){
		text += consumeChar();
		ch = LA();
		while((ch >= 'a' && ch <= 'z') || 
		(ch >= 'A' && ch <= 'Z') ||
		ch == '_' || (ch >= '0' && ch<= '9')){
			text += consumeChar();
			ch = LA();
		}
		var sc = text.charAt(0);
		if(sc == sc.toUpperCase())
			return {type:'TOKEN_REF', text:text};
		else
			return {type:'RULE_REF', text:text};
	}else{
		return null;
	}
	return null;
}

function nextToken(){
	
	
	w:while(true){
		var ch = LA();
		var tk;
		switch(ch){
		case EOF:
			tk = EOF; break;
		case '[':
			tk = pLEXER_CHAR_SET();
			break;
		case ';'  :
		case '('  :
		case ')'  :
		case '<'  :
		case '>'  :
		case '?'  :
		case '*'  :
		case '|'  :
		case '$'  :
		case '@'  :
		case '#'  :
		case '~'  :
		case '}'  :
		case '{'  :
			consumeChar();
			tk = {type:_litMap[ch], text:ch}; break;
		case ' '	:
		case '\t'   :
		case '\r'   :
		case '\n'   :
		case '\f'   :
			tk = {type:'WS'}
			consumeChar();
			continue w;
			//break;
		case '+'  :
			if(LA(2) == '='){
				tk = {type:_litMap['+='], text:'+='};
				consumeChar();consumeChar();
			}else{
				tk = {type:_litMap[ch], text:ch};
				consumeChar();
			}
			break;
		case '.'  :
			if(LA(2) == '.'){
				tk = {type:_litMap['..'], text:'..'};
				consumeChar();consumeChar();
			}else{
				tk = {type:_litMap[ch], text:ch};
				consumeChar();
			}
			break;
		case '-' :
			if(LA(2) == '>'){
				tk = {type:_litMap['->'], text:'->'};
				consumeChar();consumeChar();
			}else{
				throw mischar('-');
			}
			break;
		case '='  :
			if(LA(2) == '>'){
				tk = {type:_litMap['=>'], text:'=>'};
				consumeChar();consumeChar();
			}else{
				tk = {type:_litMap[ch], text:ch};
				consumeChar();
			}
			break;
		case ':'  :
			if(LA(2) == ':'){
				tk = {type:_litMap['::'], text:'::'};
				consumeChar();consumeChar();
			}else{
				tk = {type:_litMap[ch], text:ch};
				consumeChar();
			}
			break;
		case '/':
			if(LA(2) == '*'){
				tk = multiLineComment();
				continue w;
			}else if(LA(2) == '/'){
				tk = singleLineComment();
				continue w;
			}else{
				throw mischar('/');
			}
			break;
		case '"': tk = stringlit('"');
			break;
		case "'": tk = stringlit("'")
			break;
		default:
			
			tk = identity();
			if(tk){
				if(tk.text in _litMap){
					tk = {type: _litMap[tk.text], text:tk.text}
				}
				break;
			}else if(ch >= '0' && ch <= '9'){
				var text = '';
				do{
					consumeChar();
					text += ch;
					ch = LA();
				}while(ch >= '0' && ch <= '9');
				tk = {type: 'INT', text: text};
				break;
			}
			throw mischar(ch);
		}
		break;
	}
	if(tk != EOF && tk.type == null){
		throw mischar(tk.text);
	}
	//console.log("token: "+ util.inspect(tk));
	return tk;
}
function multiLineComment(){
	consumeChar();consumeChar();
	var ch = LA(), tk;
	while( true){
		if(ch == EOF){
			throw mischar('<EOF>');
		}else if(ch == '*' && LA(2) == '/'){
			consumeChar();consumeChar();
			tk = {type:'COMMENT'};
			break;
		}
		consumeChar();
		ch = LA();
	}
	return tk;
}
function singleLineComment(){
	consumeChar();consumeChar();
	var ch = LA(), tk;
	while( true){
		if(ch == EOF || ch == '\n'){
			consumeChar();
			tk = {type:'COMMENT'};
			break;
		}
		consumeChar();
		ch = LA();
	}
	return tk;
}

function stringlit(startChar){
	var text = '';
	consumeChar();
	var ch = LA();
	while(ch != startChar){
		if(ch == EOF)
			throw mismatch('<EOF>');
		if(ch == '\\'){
			text += consumeChar();
		}
		text += consumeChar();
		ch = LA();
	}
	consumeChar();
	return {type:'STRING_LITERAL', text:text};
}

function pLEXER_CHAR_SET(){
	var text = '';
	text += consumeChar();
	while(true){
		var chr = LA();
		if(chr == '\\'){
			consumeChar();
			chr = LA();
			if(chr != '\n' && chr != '\r'){
				text += '\\'+chr;
				consumeChar();
				continue;
			}else{
				throw mischar(chr);
			}
		}else if(chr == ']'){
			text += ']';
			consumeChar();
			break;
		}else if(chr == EOF){
			throw mischar('<EOF>');
		}else if(chr == '\n' || chr == '\r'){
			throw mischar(chr);
		}else{
			text += chr;
			consumeChar();
		}
	}
	return {type:'LEXER_CHAR_SET', text:text};
}
//--parser-- starts
var _tokenBuf = [];
function consume(){
	if(_tokenBuf.length == 0)
		lt(1);
	var c = _tokenBuf.shift();
	return c;
}

var _lastLt;
var _lastLtCount = 0;
function lt(n, type, type2, type3){
	if(n == undefined)
		n = 1;
	if(type != undefined){
	    return isLT.apply(this, arguments);
	}
	var idx = n-1;
	while(idx >= _tokenBuf.length){
		_tokenBuf.push(nextToken());
	}
	if(_tokenBuf[idx] == _lastLt)
		_lastLtCount ++;
	else{
		_lastLt = _tokenBuf[idx];
		_lastLtCount = 0;
	}
	/* if(_lastLtCount > 20){
		//console.log("endless loop on lt(), token="+ _tokenBuf[idx].type);
	} */
	if(_lastLtCount > 25){
		throw new Error("endless loop on lt(), token="+ _tokenBuf[idx].type);
	}
	return _tokenBuf[idx];
}
function isLT(n, type, type2, type3){
	var t = lt(n);
	
	if(t.type){
		for(var i=1,l=arguments.length; i<l; i++){
			if(arguments[i] == t.type) return true;
			if(arguments[i].type == t.type) return true;
		}
		return false;
	}else{
		for(var i=1,l=arguments.length; i<l; i++){
			if(arguments[i] == t) return true;
			if(arguments[i].type == t) return true;
		}
		return false;
	}
}
function _location(){
	return 'at line '+ lineno + ', position '+ pos + ',';
}
function mischar(cha){
	return new Error(_location()+ 'unknown char:' + cha );
}
function mismatch(expects){
	return new Error(_location() + 'expect token:' + JSON.stringify(expects, null, '  ')
		+' found:'+ util.inspect(lt()));
}
function grammar(){
	var g = grammarType();
		g.chr = [];
	var _id = id();
		g.chr.push(_id);
	match(_litMap[';']);
	while(lt(1,'TOKENS_SPEC') || lt(1, 'AT') || lt(1, 'OPTIONS'))
		g.chr.push(prequelConstruct());
	g.chr.push(rules());
	while(lt(1) == MODE){
		modeSpec();
	}
	match(EOF);
	
	return g;
}

function grammarType(){
	if(lt(1).type && lt(1).type == 'LEXER'){
		consume();
		match('GRAMMAR');
		return { type:ANTLRParser.GRAMMAR, grammarType:'LEXER' };
	}else if(lt(1).type && lt(1).type == 'PARSER'){
		consume();
		match('GRAMMAR');
		return { type:ANTLRParser.GRAMMAR, grammarType:'PARSER' };
	}else if(lt(1, 'GRAMMAR')){
		consume();
		return { type:ANTLRParser.GRAMMAR, grammarType:'COMBINED' };
	}else{
		throw mismatch([LEXER, PARSER, GRAMMAR]);
	}
}
function id(){
	if(lt(1, 'TOKEN_REF') || lt(1, 'RULE_REF') ){
		var t = lt();
		consume();
		t.type = 'ID';
		return t;
	}
	throw mismatch(['TOKEN_REF', 'RULE_REF']);
}
function prequelConstruct(){
	if(lt(1).type == 'TOKENS_SPEC')
		return tokensSpec();
	else if(lt(1).type == 'AT')
		return action();
	else if(lt(1, 'OPTIONS'))
		return optionsSpec();
	else
		throw mismatch(['tokens','@']);
}
function rules(){
	var children = [];
	while(!lt(1, 'MODE') && !lt(1, EOF)){
		if(lt(1, 'RULE_REF'))
			children.push(parserRule());
		else if(lt(1, 'TOKEN_REF', 'FRAGMENT'))
			children.push(lexerRule());
		else
			throw mismatch('RULE_REF','TOKEN_REF','FRAGMENT');
	}
	return {type:'RULES', chr:children};
}
function parserRule(){
	var chr = [];
	chr.push(match('RULE_REF'));
	chr = chr.concat(rulePrequels());
	match('COLON');
	chr.push(ruleBlock());
	match('SEMI');
	return {type:'RULE', chr:chr};
}
function rulePrequels(){
	var ret = [];
	while(lt(1, 'OPTIONS', 'AT')){
		ret.push(rulePrequel());
	}
	return ret;
}
function rulePrequel(){
	if(lt(1, 'OPTIONS')){
		return optionsSpec();
	}else{
		return ruleAction();
	}
}

function ruleAction(){
	var at = match('AT');
	at.chr = [];
	at.chr.push(id());
	at.chr.push(match('ACTION'));
	return at;
}

function ruleBlock(){
	var chr = ruleAltList();
	return {type:'BLOCK', chr: chr};
}

function ruleAltList(){
	var list = [labeledAlt()];
	
	while(lt(1, 'OR')){
		consume();
		list.push(labeledAlt());
	}
	return list;
}

function labeledAlt(){
	//todo
	var ret = alternative();
	if(lt(1, 'POUND')){
		ret.altLabel = id();
	}
	return ret;
}

function alternative(){
	
	if(lt(1, 'LT') || is_element()){
		var e = [];
		if(lt(1, 'LT')){
			e.push(elementOptions());
		}
		e.push(element());
		while(is_element()){
			e.push(element());
		}
		return {type: 'ALT', chr:e};
	}else{
		return {type:'ALT', chr:[{type:'EPSILON'}]};
	}
}
/** 
	labeledElement: (id (ass=ASSIGN|ass=PLUS_ASSIGN) ) 
	| atom
			range  (STRING_LITERAL)
		|	terminal (TOKEN_REF | STRING_LITERAL )
		|   ruleref	 (RULE_REF)
		|	notSet	(NOT)
		|	wildcard (DOT)
    | ebnf (LPAREN) 
    | actionElement (ACTION | SEMPRED)
*/
var element_lt = {
	TOKEN_REF:1, RULE_REF:1, STRING_LITERAL:1, NOT:1, DOT:1, LPAREN:1, ACTION:1, SEMPRED:1
};
function is_element(){
	var t = lt();
	return t.type in element_lt;
}
function element(){
	//todo
	switch(lt().type){
	case 'TOKEN_REF':
	case 'RULE_REF':
		if(lt(2, 'ASSIGN', 'PLUS_ASSIGN')){
			var le = labeledElement();
			if(lt(1, 'QUESTION', 'START', 'PLUS')){
				var ret = ebnfSuffix();
				ret.chr = [{type:'BLOCK', chr:[{type: 'ALT', chr: [le]}] }];
				return ret;
			}
			return le;
		}
	case 'STRING_LITERAL':
	case 'NOT':
	case 'DOT':
		var ret = atom();
		if(lt(1, 'QUESTION', 'STAR', 'PLUS')){
			var bnf = ebnfSuffix();
			bnf.chr = [{
				type:'BLOCK',
				chr:[{
						type: 'ALT',
						chr:[ ret ]
					} ]
			}];
			return bnf;
		}else
			return ret;
		break;
	case 'LPAREN':
		return ebnf();
	case 'ACTION':
	case 'SEMPRED':
		return actionElement();
	default:
		throw mismatch('element');
	}
}
/**
		range  (STRING_LITERAL RANGE^ STRING_LITERAL)
	|	terminal (TOKEN_REF | STRING_LITERAL )
	|   ruleref	 (RULE_REF)
	|	notSet	(NOT)
	|	wildcard (DOT)
*/
function atom(){
	switch(lt().type){
	case 'STRING_LITERAL':
		if(lt(2, 'RANGE')){
			var chr = [];
			chr.push(consume());
			var rangeNode = consume();
			chr.push(match('STRING_LITERAL'));
			rangeNode.chr = chr;
			return rangeNode;
		}
		return consume();
	case 'TOKEN_REF':
		return consume();
	case 'RULE_REF':
		return ruleref();
	case 'NOT':
		return notSet();
	case 'DOT':
		return wildcard();
	}
}
function ruleref(){
	return match('RULE_REF');
}

function ebnf(){
	var bl = block();
	if(lt(1, 'QUESTION', 'STAR', 'PLUS')){
		var ret = blockSuffix();
		ret.chr = [bl];
		return ret;
	}
	return bl;
}
/**
LPAREN
        ( optionsSpec? ra+=ruleAction* COLON )?
        altList
		RPAREN
      -> ^(BLOCK<BlockAST>[$LPAREN,"BLOCK"] optionsSpec? $ra* altList )
*/
function block(){
	var chr = [];
	match('LPAREN');
	if(lt(1, 'OPTIONS', 'AT', 'COLON')){
		if(lt(1, 'OPTIONS')){
			chr.push(optionsSpec());
		}
		while(lt(1, 'AT')){
			chr.push(ruleAction());
		}
		match('COLON');
	}
	chr = chr.concat(altList());
	match('RPAREN');
	return {type:'BLOCK', chr:chr};
}
/**
	alternative (OR alternative)* -> alternative+ 
*/
function altList(){
	var list = [alternative()];
	while( lt(1, 'OR') ){
		consume();
		list.push(alternative());
	}
	return list;
}
function blockSuffix(){
	return ebnfSuffix();
}
function actionElement(){
	//todo
}
function lexerRule(){
	var chr = [];
	if(lt(1,'FRAGMENT'))
		chr.push( {type:'RULEMODIFIERS', chr:[consume()]});
	var name = match('TOKEN_REF'); 
	chr.unshift(name);
	match('COLON');
	chr.push(lexerRuleBlock()); match('SEMI');
	return {type:'RULE', chr:chr};
}
function lexerRuleBlock(){
	return {type:'BLOCK', chr:lexerAltList()};
}
function lexerAltList(){
	var list = [];
	list.push(lexerAlt());
	while(lt(1, 'OR')){
		consume();
		list.push(lexerAlt());
	}
	return list;
}
function lexerAlt(){
	if(is_lexerElement()){
		var le = lexerElements();
		if(is_lexerCommands()){
			var lc = lexerCommands();
			return {type:'LEXER_ALT_ACTION', chr:[le].concat(lc)};
		}
		return le;
	}
	return {type:'ALT', chr:[{type:'EPSILON'}]};
}
function lexerElements(){
	var les = [];
	les.push(lexerElement());
	while(is_lexerElement()){
		les.push(lexerElement());
	}
	return {type:'ALT', chr: les};
}
function is_lexerElement(){
	var tk = lt();
	return tk.type in {TOKEN_REF:1, RULE_REF:1, STRING_LITERAL:1, NOT:1, DOT:1, LEXER_CHAR_SET:1,
	LPAREN:1, ACTION:1, SEMPRED:1};
}
function lexerElement(){
	//labeledLexerElement | lexerAtom | lexerBlock | actionElement 
	//console.log("lexerElement() lt="+ util.inspect(lt()));
	var nt = lt();
	switch(nt.type){
	case 'TOKEN_REF':
	case'RULE_REF':
		if(lt(2, 'ASSIGN') || lt(2, 'PLUS_ASSIGN')){
			var lbe = labeledLexerElement();
			if(lt(1, 'QUESTION', 'START', 'PLUS')){
				var bnf = ebnfSuffix();
				bnf.chr = [{
					type:'BLOCK',
					chr:[
						{
							type: 'ALT',
							chr:[ lbe ]
						}
					]}];
				return bnf;
			}else{
				return lbe;
			}
		}
	case 'STRING_LITERAL':
	case 'NOT':
	case 'DOT':
	case 'LEXER_CHAR_SET':
		var latom = lexerAtom();
		if(lt(1, 'QUESTION', 'STAR', 'PLUS')){
			var bnf = ebnfSuffix();
			bnf.chr = [{
				type:'BLOCK',
				chr:[
					{
						type: 'ALT',
						chr:[ latom ]
					}
				]}];
			return bnf;
		}else
			return latom;
		break;
	case 'LPAREN':
		var lblock = lexerBlock();
		if(lt(1, 'QUESTION', 'STAR', 'PLUS')){
			var bnf = ebnfSuffix();
			bnf.chr = [{
				type:'BLOCK',
				chr:[
					{
						type: 'ALT',
						chr:[ lblock ]
					}
				]}];
			return bnf;
		}else
			return lblock;
		break;
	case 'ACTION':
	case 'SEMPRED':
		return actionElement();
	default:
		throw mismatch('lexerElement');
	}
}
function labeledLexerElement(){
	var _id = id();
	var ass = consume();
	if(lt(1, 'LPAREN'))
		var l = lexerBlock();
	else
		var l = lexerAtom();
	ass.chr = [_id, l];
	return ass;
}
/**		range: STRING_LITERAL RANGE^ STRING_LITERAL
	|	terminal: TOKEN_REF elementOptions? | STRING_LITERAL elementOptions?
    |   RULE_REF<RuleRefAST>
    |	notSet
    |	wildcard
    |	LEXER_CHAR_SET
 lookahead: STRING_LITERAL,TOKEN_REF,RULE_REF,NOT,DOT,LEXER_CHAR_SET
    */
function lexerAtom(){
	if(lt(1, 'STRING_LITERAL') && lt(2, 'RANGE')){
		var children = [];
		children.push(consume());
		var r = match('RANGE');
		children.push(match('STRING_LITERAL'));
		r.chr = children;
		return r;
	}else if(lt(1, 'TOKEN_REF') || lt(1, 'STRING_LITERAL')){
		var r = consume();
		r.chr = [];
		if(lt(1, 'LT')){
			r.chr.push(elementOptions());
		}
		return r;
	}else if(lt(1,'RULE_REF')){
		return consume();
	}else if(lt(1, 'NOT')){
		return notSet();
	}else if(lt(1, 'DOT')){
		return wildcard();
	}else if(lt(1,'LEXER_CHAR_SET')){
		return consume();
	}else{
		throw mistach('STRING_LITERAL,TOKEN_REF,RULE_REF,NOT,DOT,LEXER_CHAR_SET');
	}
}
function elementOptions(){
	var chr = [];
	consume();
	if(lt(1, 'TOKEN_REF') || lt(1, 'RULE_REF')){
		chr.push(elementOption());
		while(lt(1, 'COMMA')){
			consume();
			chr.push(elementOption());
		}
	}
	match('GT');
	return {type:'ELEMENT_OPTIONS', chr:chr};
}
function elementOption(){
	var _id = match('TOKEN_REF', 'RULE_REF');
	var text = _id.text;
	if(lt(1, 'DOT')){
		while(lt(1, 'DOT')){
			//qid
			consume();
			text += '.';
			_id = match('TOKEN_REF', 'RULE_REF');
			text += _id.text;
		}
		return {type:'ID', text:text};
	}else if(lt(1, 'ASSIGN')){
		var r = consume();
		var optionValue = consume();
		r.chr = [_id, optionValue];
		return r;
	}else{
		throw mistach(DOT, ASSIGN);
	}
}
/**
LPAREN
        ( optionsSpec COLON )?
        lexerAltList
        RPAREN
*/
function lexerBlock(){
	var chr = [];
	match('LPAREN');
	if(lt(1, 'OPTIONS')){
		chr.push(optionsSpec());
		match('COLON');
	}
	chr = chr.concat(lexerAltList());
	match('RPAREN');
	return {type:'BLOCK', chr:chr};
}

/** OPTIONS (option SEMI)* RBRACE -> ^(OPTIONS[$OPTIONS, "OPTIONS"] option*)
*/
function optionsSpec(){
	var r = match('OPTIONS');
	r.chr = [];
	match('LBRACE');
	
	while(lt(1, 'TOKEN_REF', 'RULE_REF')){
		r.chr.push(option());
		match('SEMI');
	}
	match('RBRACE');
	return r;
}
/** id ASSIGN^ optionValue */
function option(){
	var chr = [];
	chr.push(id());
	var r = match('ASSIGN');
	
	chr.push(optionValue());
	r.chr = chr;
	return r;
}
/**
	qid
    | STRING_LITERAL
	| ACTION<ActionAST>
    | INT
    */
function optionValue(){
	console.log('optionValue() lt ='+ util.inspect(lt()));
	if(lt(1, 'TOKEN_REF', 'RULE_REF'))
		return qid();
	else
		return match('STRING_LITERAL', 'ACTION', 'INT');
}

function qid(){
	var d = id();
	var text = d.text;
	while(lt(1, 'DOT')){
		text += consume();
		text += id().text;
	}
	return {type: 'ID', text:text};
}
function is_lexerCommands(){
	return lt(1, 'RARROW');
}
function lexerCommands(){
	var cmds = [];
	match('RARROW');
	cmds.push(lexerCommand());
	while(lt(1, 'COMMA')){
		cmds.push(lexerCommand());
	}
	return cmds;
}

function lexerCommand(){
	var name = lexerCommandName();
	if(lt(1, 'LPAREN')){
		consume();
		var expr = lexerCommandExpr();
		match('RPAREN');
		return {type: 'LEXER_ACTION_CALL', chr:[name, expr]};
	}
	return name;
}
function lexerCommandExpr(){
	if(lt(1, 'INT')){
		return consume();
	}
	return id();
}
function lexerCommandName(){
	if(lt(1, 'MODE')){
		var m = consume();
		return {type:'ID', text:m.text};
	}else{
		return id();
	}
}
function notSet(){
	var not = match('NOT');
	if(lt(1,'LPAREN')){
		not.chr = [blockSet()];
		
	}else{
		not.chr=[{type:'NOT', chr:[setElement()]}];
	}
	return not;
}
function setElement(){
	switch(lt().type){
	case 'STRING_LITERAL':
		var r = consume();
		if(lt(1,'RANGE')){
			var ra = consume();
			var s = match('STRING_LITERAL');
			ra.chr = [r, s];
			return ra;
		}
		return r;
	case 'TOKEN_REF':
	case 'LEXER_CHAR_SET':
		return consume();
	default:
		throw mismatch(['STRING_LITERAL', 'TOKEN_REF', 'LEXER_CHAR_SET']);
	}
}

function blockSet(){
	var children = [];
	match('LPAREN');
	children.push(setElement());
	while(lt(1, 'OR')){
		consume();
		children.push(setElement());
	}
	match('RPAREN');
	return {type:'SET', chr:children};
}

function wildcard(){
	var chr =[];
	match('DOT');
	if(lt(1, 'LT')){
		chr.push(elementOptions());
	}
	return {type:'WILDCARD', chr:chr};
}

function ebnfSuffix(){
	var t = lt();
	if(t.type == 'QUESTION'){
		consume();
		if(lt(1, 'QUESTION'))
			var nongreedy = consume();
		return { type:'OPTIONAL', nongreedy:nongreedy};
	}else if(t.type == 'STAR'){
		consume();
		if(lt(1, 'QUESTION'))
			var nongreedy = consume();
		return { type:'CLOSURE', nongreedy:nongreedy};
	}else if(t.type == 'PLUS'){
		consume();
		if(lt(1, 'QUESTION'))
			var nongreedy = consume();
		return { type:'POSITIVE_CLOSURE', nongreedy:nongreedy};
	}else{
		throw mismatch([QUESTION, STAR, PLUS]);
	}
}
function tokensSpec(){
	match('TOKENS_SPEC');
	match(_litMap['{']);
	var ids = [];
	if(lt(1, 'TOKEN_REF') || lt(1, 'RULE_REF') ){
		ids.push(id());
		while(lt(1, 'COMMA')){
			consume();
			ids.push(id());
		}
		if(lt(1, _litMap[';'])){
			consume();
			while(lt(1, 'TOKEN_REF') || lt(1, 'RULE_REF')){
				ids.push(id());
				match(_litMap[';']);
			}
		}
	}
	match(_litMap['}']);
	
	return {
		type:'TOKENS_SPEC', chr:ids
	};
}

function match(s, s2, s3){
	//console.log("match() "+ util.inspect(arguments));
	for(var i =0, l=arguments.length; i<l; i++){
		if(lt(1, arguments[i]))
			return consume();
	}
	var expect = s;
	for(i = 1, l=arguments.length; i<l; i++){
		expect += ',';
		expect += arguments[i];
		
	}
	throw mismatch(expect);
}

return {
	createAST:createAST,
	init:init,
	position:position,
	nextToken:nextToken,
	EOF:EOF
};
}
