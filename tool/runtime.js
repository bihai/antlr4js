var misc = require('./misc.js');
var util = require('util');
var fs = require('fs');
var Graph = misc.Graph;
var MultiMap = misc.MultiMap;
var IntervalSet = misc.IntervalSet;
var OrderedHashMap = misc.OrderedHashMap;
var LinkedHashMap = OrderedHashMap;
var Utils = misc.Utils;
var MurmurHash = misc.MurmurHash;
var cnst = require('./constants.js');
var ANTLRParser = cnst.ANTLRParser,
	Token = cnst.Token;
	
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
function ATN(grammarType, maxTokenType){
	this.states = [];
	this.decisionToState = [];
	this.modeNameToStartState = new LinkedHashMap();
	this.modeToStartState = [];
	this.grammarType = grammarType;
	this.maxTokenType = maxTokenType;
}

ATN.INVALID_ALT_NUMBER = 0;
ATN.prototype={
	nextTokens:function(s, ctx){
		if(ctx === undefined){
			if ( s.nextTokenWithinRule != null ) return s.nextTokenWithinRule;
			s.nextTokenWithinRule = this.nextTokens(s, null);
			s.nextTokenWithinRule.setReadonly(true);
			return s.nextTokenWithinRule;
        }
		var anal = new LL1Analyzer(this);
		var next = anal.LOOK(s, ctx);
		return next;
	},
	addState:function(state) {
		if (state != null) {
			state.atn = this;
			state.stateNumber = this.states.length;
		}

		this.states.push(state);
	},

	removeState:function( state) {
		this.states[state.stateNumber] = null; // just free mem, don't shift states in list
	},

	defineDecisionState:function( s) {
		this.decisionToState.push(s);
		s.decision = this.decisionToState.length-1;
		return s.decision;
	},

    getDecisionState:function( decision) {
        if ( this.decisionToState.length != 0) {
            return this.decisionToState[decision];
        }
        return null;
    },

	getNumberOfDecisions:function() {
		return this.decisionToState.length;
	},
	getExpectedTokens:function(stateNumber, context) {
		if (stateNumber < 0 || stateNumber >= this.states.length) {
			throw new Error("Invalid state number.");
		}

		var ctx = context;
		var s = this.states[stateNumber];
		var following = this.nextTokens(s);
		if (!following.contains(Token.EPSILON)) {
			return following;
		}

		var expected = new IntervalSet();
		expected.addAll(following);
		expected.remove(Token.EPSILON);
		while (ctx != null && ctx.invokingState >= 0 && following.contains(Token.EPSILON)) {
			var invokingState = this.states[ctx.invokingState];
			var rt = invokingState.transition(0);
			following = this.nextTokens(rt.followState);
			expected.addAll(following);
			expected.remove(Token.EPSILON);
			ctx = ctx.parent;
		}

		if (following.contains(Token.EPSILON)) {
			expected.add(Token.EOF);
		}

		return expected;
	}
};

var LL1Analyzer = (function(){
	
function LL1Analyzer(atn){
	this.atn = atn;
}
var HIT_PRED = LL1Analyzer.HIT_PRED = Token.INVALID_TYPE;
LL1Analyzer.prototype = {
	getDecisionLookahead:function(s){
		if ( s==null ) {
			return null;
		}

		var look = new Array(s.getNumberOfTransitions());
		for (var alt = 0; alt < s.getNumberOfTransitions(); alt++) {
			look[alt] = new IntervalSet();
			var lookBusy = new HashMap();
			var seeThruPreds = false; // fail to get lookahead upon pred
			this._LOOK(s.transition(alt).target, null, PredictionContext.EMPTY,
				  look[alt], lookBusy, new BitSet(), seeThruPreds, false);
			// Wipe out lookahead for this alternative if we found nothing
			// or we had a predicate when we !seeThruPreds
			if ( look[alt].size()==0 || look[alt].contains(HIT_PRED) ) {
				look[alt] = null;
			}
		}
		return look;
	},
	_LOOK:function(s, stopState, ctx, look, lookBusy, calledRuleStack, seeThruPreds, addEOF)
	{
//		System.out.println("_LOOK("+s.stateNumber+", ctx="+ctx);
        var c = new ATNConfig(s, 0, ctx);
        if ( !lookBusy.add(c) ) return;

		if (s == stopState) {
			if (ctx == null) {
				look.add(Token.EPSILON);
				return;
			} else if (ctx.isEmpty() && addEOF) {
				look.add(Token.EOF);
				return;
			}
		}

        if ( s instanceof RuleStopState ) {
            if ( ctx==null ) {
                look.add(Token.EPSILON);
                return;
            } else if (ctx.isEmpty() && addEOF) {
				look.add(Token.EOF);
				return;
			}

			if ( ctx != PredictionContext.EMPTY ) {
				// run thru all possible stack tops in ctx
				for (var i = 0; i < ctx.size(); i++) {
					var returnState = atn.states.get(ctx.getReturnState(i));
//					System.out.println("popping back to "+retState);

					var removed = calledRuleStack.get(returnState.ruleIndex);
					try {
						calledRuleStack.clear(returnState.ruleIndex);
						_LOOK(returnState, stopState, ctx.getParent(i), look, lookBusy, calledRuleStack, seeThruPreds, addEOF);
					}
					finally {
						if (removed) {
							calledRuleStack.set(returnState.ruleIndex);
						}
					}
				}
				return;
			}
        }

        var n = s.getNumberOfTransitions();
        for (var i=0; i<n; i++) {
			var t = s.transition(i);
			if ( t.getClass() == RuleTransition.class ) {
				if (calledRuleStack.get(t.target.ruleIndex)) {
					continue;
				}

				var newContext =
					SingletonPredictionContext.create(ctx, t.followState.stateNumber);

				try {
					calledRuleStack.set(t.target.ruleIndex);
					_LOOK(t.target, stopState, newContext, look, lookBusy, calledRuleStack, seeThruPreds, addEOF);
				}
				finally {
					calledRuleStack.clear(t.target.ruleIndex);
				}
			}
			else if ( t instanceof AbstractPredicateTransition ) {
				if ( seeThruPreds ) {
					_LOOK(t.target, stopState, ctx, look, lookBusy, calledRuleStack, seeThruPreds, addEOF);
				}
				else {
					look.add(HIT_PRED);
				}
			}
			else if ( t.isEpsilon() ) {
				_LOOK(t.target, stopState, ctx, look, lookBusy, calledRuleStack, seeThruPreds, addEOF);
			}
			else if ( t.getClass() == WildcardTransition.class ) {
				look.addAll( IntervalSet.of(Token.MIN_USER_TOKEN_TYPE, atn.maxTokenType) );
			}
			else {
//				System.out.println("adding "+ t);
				var set = t.label();
				if (set != null) {
					if (t instanceof NotSetTransition) {
						set = set.complement(IntervalSet.of(Token.MIN_USER_TOKEN_TYPE, atn.maxTokenType));
					}
					look.addAll(set);
				}
			}
		}
	}
};
return LL1Analyzer;
})();

(function(){
	var INITIAL_NUM_TRANSITIONS = 4;
	var INVALID_TYPE = 0;
	var BASIC = 1;
	var RULE_START = 2;
	var BLOCK_START = 3;
	var PLUS_BLOCK_START = 4;
	var STAR_BLOCK_START = 5;
	var TOKEN_START = 6;
	var RULE_STOP = 7;
	var BLOCK_END = 8;
	var STAR_LOOP_BACK = 9;
	var STAR_LOOP_ENTRY = 10;
	var PLUS_LOOP_BACK = 11;
	var LOOP_END = 12;
	var INVALID_STATE_NUMBER = -1;
	
	function ATNState(){
		this.atn = null;
		this.stateNumber = INVALID_STATE_NUMBER;
		this.ruleIndex = 0;
		this.epsilonOnlyTransitions = false;
		this.transitions = new Array(INITIAL_NUM_TRANSITIONS);
		this.nextTokenWithinRule = null;
	}
	mixin(ATNState, {
		INITIAL_NUM_TRANSITIONS : 4,
		INVALID_TYPE : 0,
		BASIC : 1,
		RULE_START : 2,
		BLOCK_START : 3,
		PLUS_BLOCK_START : 4,
		STAR_BLOCK_START : 5,
		TOKEN_START : 6,
		RULE_STOP : 7,
		BLOCK_END : 8,
		STAR_LOOP_BACK : 9,
		STAR_LOOP_ENTRY : 10,
		PLUS_LOOP_BACK : 11,
		LOOP_END : 12,
		INVALID_STATE_NUMBER : -1
	});
	exports.ATNState = ATNState;
	ATNState.serializationNames = ["INVALID",
		"BASIC",
		"RULE_START",
		"BLOCK_START",
		"PLUS_BLOCK_START",
		"STAR_BLOCK_START",
		"TOKEN_START",
		"RULE_STOP",
		"BLOCK_END",
		"STAR_LOOP_BACK",
		"STAR_LOOP_ENTRY",
		"PLUS_LOOP_BACK",
		"LOOP_END"];
	
	ATNState.prototype = {
		hashCode:function() { return this.stateNumber; },
		equals:function( o) {
			// are these states same object?
			if ( o instanceof ATNState ) return this.stateNumber==o.stateNumber;
			return false;
		},
		isNonGreedyExitState:function(){
			return false;
		},
		toString:function(){
			return this.stateNumber+ '';
		},
		getTransitions:function(){
			return [].concat(this.transitions);
		},
		getNumberOfTransitions:function(){
			return this.transitions.length;
		},
		addTransition:function(index, e){
			if(e === undefined){
				e = index;
				this.addTransition(this.transitions.length, e);
			}
			if (transitions.length == 0) {
				this.epsilonOnlyTransitions = e.isEpsilon();
			}
			else if (this.epsilonOnlyTransitions != e.isEpsilon()) {
				console.error("ATN state %d has both epsilon and non-epsilon transitions.\n", this.stateNumber);
				this.epsilonOnlyTransitions = false;
			}
	
			this.transitions.push(index, e);
		},
		transition:function(i){
			return this.transitions[i];
		},
		setTransition:function(i, e){
			this.transitions[i] = e;
		},
		removeTransition:function(index){
			return this.transitions.splice(index, 1)[0];
		},
		onlyHasEpsilonTransitions:function() {
			return this.epsilonOnlyTransitions;
		},
		setRuleIndex:function(ruleIndex) { this.ruleIndex = ruleIndex; }
	};
	
	function DecisionState(){
		this.decision = -1;
		this.nonGreedy = false;
	}
	extend(DecisionState, ATNState, {
			className:'DecisionState'
	});
	
	function TokensStartState(){
	}
	extend(TokensStartState, DecisionState,{
		getStateType:function() {
			return TOKEN_START;
		},
		className:'TokensStartState'
	});
	exports.TokensStartState = TokensStartState;
	
	function RuleStopState(){
	}
	extend(RuleStopState, ATNState, {
		getStateType:function(){
			return RULE_STOP;
		},
		className:'RuleStopState'
	});
	exports.RuleStopState = RuleStopState;
	
	function RuleStartState(){
		//public RuleStopState stopState;
		//public boolean isPrecedenceRule;
	}
	
	extend(RuleStartState, ATNState, {
		getStateType:function(){
			return RULE_START;
		},
		className:'RuleStartState'
	});
	exports.RuleStartState = RuleStartState;
	
	function BasicBlockStartState(){
	}
	extend(BasicBlockStartState, BlockStartState, {
		getStateType:function(){
			return BLOCK_START;
		},
		className:'BasicBlockStartState'
	});
	exports.BasicBlockStartState = BasicBlockStartState;
	
	function StarBlockStartState(){
	}
	extend(StarBlockStartState, BlockStartState,{
		getStateType:function(){
			return STAR_BLOCK_START;
		},
		className:'StarBlockStartState'
	});
	
	function PlusBlockStartState(){
	}
	extend(PlusBlockStartState, BlockStartState,{
		getStateType:function(){
			return PLUS_BLOCK_START;
		},
		className:'PlusBlockStartState'
	});
	exports.PlusBlockStartState = PlusBlockStartState;
	
	function BlockEndState(){
	}
	extend(BlockEndState, ATNState, {
		getStateType:function(){
			return BLOCK_END;
		},
		className:'BlockEndState'
	});
	exports.BlockEndState = BlockEndState;
	
	function PlusLoopbackState(){
	}
	
	extend(PlusLoopbackState, DecisionState, {
		getStateType:function(){
			return PLUS_LOOP_BACK;
		},
		className:'PlusLoopbackState'
	});
	exports.PlusLoopbackState = PlusLoopbackState;
	
	function StarLoopbackState(){}
	extend(StarLoopbackState, ATNState, {
		getStateType:function(){
			return STAR_LOOP_BACK;
		},
		className:'StarLoopbackState'
	});
	exports.StarLoopbackState = StarLoopbackState;

	function LoopEndState(){}
	extend(LoopEndState, ATNState, {
		getStateType:function(){
			return LOOP_END;
		},
		className:'LoopEndState'
	});
	exports.LoopEndState = LoopEndState;
	
})();

function Transition(target){
	if (target == null) {
		throw new Error("target cannot be null.");
	}
    
	this.target = target;
}
Transition.EPSILON			= 1;
Transition.RANGE			= 2;
Transition.RULE			= 3;
Transition.PREDICATE		= 4; // e.g., {isType(input.LT(1))}?
Transition.ATOM			= 5;
Transition.ACTION			= 6;
Transition.SET				= 7; // ~(A|B) or ~atom, wildcard, which convert to next 2
Transition.NOT_SET			= 8;
Transition.WILDCARD		= 9;
Transition.PRECEDENCE		= 10;
Transition.serializationNames=[
	"INVALID",
	"EPSILON",
	"RANGE",
	"RULE",
	"PREDICATE",
	"ATOM",
	"ACTION",
	"SET",
	"NOT_SET",
	"WILDCARD",
	"PRECEDENCE"
];
Transition.serializationTypes={
	EpsilonTransition: Transition.EPSILON,
	RangeTransition: Transition.RANGE,
	RuleTransition: Transition.RULE,
	PredicateTransition: Transition.PREDICATE,
	AtomTransition: Transition.ATOM,
	ActionTransition: Transition.ACTION,
	SetTransition: Transition.SET,
	NotSetTransition: Transition.NOT_SET,
	WildcardTransition: Transition.WILDCARD,
	PrecedencePredicateTransition: Transition.PRECEDENCE
};
Transition.prototype={
	isEpsilon:function() { return false; },
	label:function() { return null; }
};

function RuleTransition(ruleStart, ruleIndex, precedence, followState){
	this.ruleIndex = 0;
	this.precedence = 0;
	if(arguments.length == 3)
		RuleTransition(ruleStart, ruleIndex, 0, precedence)
	else{
		RuleTransition.superclass.call(this, ruleStart);
		this.ruleIndex = ruleIndex;
		this.precedence = precedence;
		this.followState = followState;
	}
}
extend(RuleTransition, Transition, {
	getSerializationType:function() {
		return Transition.RULE;
	},
	
	isEpsilon:function() { return true; },
	
	matches:function(symbol, minVocabSymbol, maxVocabSymbol) {
		return false;
	}
});

function ActionTransition(target, ruleIndex, actionIndex, isCtxDependent){
	if(actionIndex === undefined)
		actionIndex = -1;
	if(isCtxDependent === undefined)
		isCtxDependent = false;
	this.ruleIndex = ruleIndex;
	this.actionIndex = actionIndex;
	this.isCtxDependent = isCtxDependent;
}
extend(ActionTransition, Transition, {
	getSerializationType:function() {
		return Transition.ACTION;
	},
	isEpsilon:function() {
		return true; // we are to be ignored by analysis 'cept for predicates
	},
	matches:function(symbol, minVocabSymbol, maxVocabSymbol) {
		return false;
	},
	toString:function() {
		return "action_"+ this.ruleIndex+":"+ this.actionIndex;
	}
});
exports.RuleTransition = RuleTransition;
exports.ActionTransition = ActionTransition;
exports.Transition = Transition;
exports.LL1Analyzer = LL1Analyzer;
exports.ATN = ATN;

