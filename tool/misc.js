var util = require('util');
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

function OrderedHashMap(){
	this.map = {};
	this.elements = [];
	this._size = 0;
}
OrderedHashMap.prototype={
	getKey:function(i){ return this.elements.get(i); },
	getElement:function(i) { return this.get(this.elements.get(i)); },
	get:function(key){
		return this.map[key];
	},
	put:function(key, value) {
		this.map[key] = value;
		this.elements.push(key);
	},
	putAll:function(m) {
		for(k in m){
			this.put(k, m[k]);
		}
	},
	values:function(){
		var v = [];
		this.elements.forEach(function(k){
				v.push(this.get(k));
		}, this);
		return v;
	}
};
exports.OrderedHashMap = OrderedHashMap;

exports.Utils={
	capitalize:function(s){
		return s.charAt(0).toUpperCase() + s.substring(1);
	},
	decapitalize:function(s){
		return s.charAt(0).toLowerCase() + s.substring(1);
	}
};
exports.Graph = (function(){
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

exports.MultiMap = (function(){
	function MultiMap(){
		this.obj ={};
	}
	MultiMap.prototype ={
		map:function(key,value){
			var elementsForKey = this.obj[key];
			if ( elementsForKey==null ) {
				elementsForKey = [];
				this.obj[key] = elementsForKey;
			}
			elementsForKey.push(value);
		},
		getPairs:function(){
			var pairs =[];
			for(var key in this.obj){
				pairs.push({a:key, b:this.obj[key]});
			}
			return pairs;
		}
	};
	return MultiMap;
})();

//-- runtime misc
(function(){
	var INTERVAL_POOL_MAX_VALUE=1000;
	var cache = new Array(INTERVAL_POOL_MAX_VALUE + 1);
	function Interval(a, b){
		this.a=a; this.b=b;
	}
	Interval.of = function(a, b) {
		// cache just a..a
		if ( a!=b || a<0 || a>INTERVAL_POOL_MAX_VALUE ) {
			return new Interval(a,b);
		}
		if ( cache[a]==null ) {
			cache[a] = new Interval(a,a);
		}
		return cache[a];
	}
	Interval.prototype={
		length:function() {
			if ( b<a ) return 0;
			return b-a+1;
		},
		equals:function(o) {
			if ( o==null || !(o instanceof Interval) ) {
				return false;
			}
			return this.a==o.a && this.b==o.b;
		},
		hashCode:function() {
			var hash = 23;
			hash = hash * 31 + this.a;
			hash = hash * 31 + this.b;
			return hash;
		},
		startsBeforeDisjoint:function(other) {
			return this.a<other.a && this.b<other.a;
		},
		startsBeforeNonDisjoint:function( other) {
			return this.a<=other.a && this.b>=other.a;
		},
		startsAfter:function(other) { return this.a>other.a; },
	
		startsAfterDisjoint:function( other) {
			return this.a>other.b;
		},
		startsAfterNonDisjoint:function( other) {
			return this.a>other.a && this.a<=other.b; 
		},
		union:function(other) {
			return Interval.of(Math.min(a, other.a), Math.max(b, other.b));
		},
		disjoint:function(other) {
			return this.startsBeforeDisjoint(other) || this.startsAfterDisjoint(other);
		},
		adjacent:function( other) {
			return this.a == other.b+1 || this.b == other.a-1;
		},
		toString:function() {
			return this.a +".."+ this.b;
		}
	};
	var INVALID = new Interval(-1,-2);
	
	function IntervalSet(intervals){
		this.readonly = false;
		if(arguments.length == 0){
			this.intervals = new Array(2);
		}else if(arguments.length == 1 && util.isArray(intervals)){
			this.intervals = intervals;
		}else{
			this.intervals = new Array(arguments.length);
			for(var i=0,l=arguments.length;i<l;i++){
				this.add(arguments[i]);
			}
		}
	}
	IntervalSet.of=function(a, b){
		var s = new IntervalSet();
		if(b == null)
			s.add(a);
		else
			s.add(a, b);
		return s;
	};
	IntervalSet.prototype={
		add:function(el, el2) {
			if ( this.readonly ) throw new Error("can't alter readonly IntervalSet");
			if(el2 === undefined){
				this._add(Interval.of(el, el));
			}else{
				this._add(Interval.of(el, el2));
			}
        },
        _add:function(addition){
        	if ( addition.b<addition.a ) {
				return;
			}
			// find position in list
			// Use iterators as we modify list in place
			var intervals = this.intervals;
			for(var i=0; i<intervals.length; i++){
				var r = intervals[i];
				if ( addition.equals(r) ) {
					return;
				}
				if ( addition.adjacent(r) || !addition.disjoint(r) ) {
					// next to each other, make a single larger interval
					var bigger = addition.union(r);
					intervals[i] = bigger;
					// make sure we didn't just create an interval that
					// should be merged with next interval in list
					while ( i+1 < intervals.length ) {
						var next = intervals[++i];
						if ( !bigger.adjacent(next) && bigger.disjoint(next) ) {
							break;
						}
						
						// if we bump up against or overlap next, merge
						intervals.splice(i, 1);  // remove this one
						i--;// move backwards to what we just set
						intervals[i] = bigger.union(next);// set to 3 merged ones
						// first call to next after previous duplicates the result
					}
					return;
				}
				if ( addition.startsBeforeDisjoint(r) ) {
					// insert before r
					i--;
					iter.add(addition);
					return;
				}
				// if disjoint and after r, a future iteration will handle it
			}
			// ok, must be after last interval (and disjoint from last interval)
			// just add it
			intervals.add(addition);
        },
        contains:function(el) {
			var n = this.intervals.length;
			for (var i = 0; i < n; i++) {
				var I = this.intervals[i];
				var a = I.a;
				var b = I.b;
				if ( el<a ) {
					break; // list is sorted and el is before this interval; not here
				}
				if ( el>=a && el<=b ) {
					return true; // found in this interval
				}
			}
			return false;
		},
		isNil:function() {
			return this.intervals==null || this.intervals.length === 0;
		}
    };
	exports.IntervalSet = IntervalSet;
	exports.Interval = Interval;
})();
