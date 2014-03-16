var ANTLRParser = require('./parser.js').ANTLRParser;
var util= require('util');
(function(){
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
	'mode':     'MODE'               
};

var COLON = ':', 
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
DOT		     = '.'                    , // can be WILDCARD or DOT in qid or imported rule ref
RANGE        = '..'                   ,
AT           = '@'                    ,
POUND        = '#'                    ,
NOT          = '~'                    ,
RBRACE       = '}'                    ;

var ID = 'ID';


var EOF = -1;
var _ch = null;
var _chBuf = [];
var pos = 0;
var lineno = 1;
var input = null;
var token = null;

exports.init=function(text){
	input = text;
}
exports.createAST = function(text){
	input = text;
	return grammar();
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
	var c = ch.charCodeAt(0);
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
			tk = ch; break;
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
				tk = '+=';
				consumeChar();consumeChar();
			}else{
				tk = ch;
				consumeChar();
			}
			break;
		case '.'  :
			if(LA(2) == '.'){
				tk = '..';
				consumeChar();consumeChar();
			}else{
				tk = ch;
				consumeChar();
			}
			break;
		case '-' :
			if(LA(2) == '>'){
				tk = '->';
				consumeChar();consumeChar();
			}else{
				throw mischar('-');
			}
			break;
		case '='  :
			if(LA(2) == '>'){
				tk = '=>';
				consumeChar();consumeChar();
			}else{
				tk = ch;
				consumeChar();
			}
			break;
		case ':'  :
			if(LA(2) == ':'){
				tk = '::';
				consumeChar();consumeChar();
			}else{
				tk = ch;
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
			}
			throw mischar(ch);
		}
		break;
	}
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
		text += consumeChar();
		ch = LA();
	}
	consumeChar();
	return {type:'STRING_LITERAL', text:text};
}

//--parser-- starts
var _tokenBuf = [];
function consume(){
	if(_tokenBuf.length == 0)
		lt(1);
	var c = _tokenBuf.shift();
	return c;
}

function lt(n, type){
	if(n == undefined)
		n = 1;
	if(type != undefined){
	    return isLT(n, type);
	}
	var idx = n-1;
	while(idx >= _tokenBuf.length){
		_tokenBuf.push(nextToken());
	}
	return _tokenBuf[idx];
}
function isLT(n, type){
	var t = lt(n);
	if(type == t) return true;
	if(t.type){
		return t.type == type;
	}
	return t == null? false: t == type.type;
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
	match(';');
	while(isLT(1,'TOKENS_SPEC') || isLT(1, 'AT'))
		g.chr.push(prequelConstruct());
	rules();
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
	}else if(isLT(1, 'GRAMMAR')){
		consume();
		return { type:ANTLRParser.GRAMMAR, grammarType:'COMBINED' };
	}else{
		throw mismatch([LEXER, PARSER, GRAMMAR]);
	}
}
function id(){
	if(isLT(1, 'TOKEN_REF') || isLT(1, 'RULE_REF') ){
		var t = lt();
		consume();
		return t;
	}
	throw mismatch(['TOKEN_REF', 'RULE_REF']);
}
function prequelConstruct(){
	if(lt(1).type == 'TOKENS_SPEC')
		return tokensSpec();
	else if(lt(1).type == AT)
		return action();
	else
		throw mismatch(['tokens','@']);
}
function rules(){
	while(lt(1, 'MODE') && lt(1, EOF)){
		match('RULE_REF'); match(COLON);
	}
	return {type:'RULES', chr:[]};
}
function tokensSpec(){
	match('TOKENS_SPEC');
	match('{');
	var ids = [];
	if(isLT(1, 'TOKEN_REF') || isLT(1, 'RULE_REF') ){
		ids.push(id());
		while(isLT(1, COMMA)){
			consume();
			ids.push(id());
		}
		if(isLT(1, ';')){
			consume();
			while(isLT(1, 'TOKEN_REF') || isLT(1, 'RULE_REF')){
				ids.push(id());
				match(';');
			}
		}
	}
	match('}');
	
	return {
		type:'TOKENS_SPEC', chr:ids
	};
}

function match(s){
	if(!isLT(1, s))
		throw mismatch(s);
	consume();
}

exports.nextToken = nextToken;
exports.EOF = EOF;
})();
