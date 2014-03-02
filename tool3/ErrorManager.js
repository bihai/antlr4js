(function(){
		
var ErrorState = {
	errors:0,
	warnings:0,
	infos:0,
	/** Track all msgIDs; we use to abort later if necessary
	 *  also used in Message to find out what type of message it is via getMessageType()
	 */
	errorMsgIDs: [],
	warningMsgIDs:[]
};
var self = {
	getErrorState:function(){
		return ErrorState;
	},
	getNumErrors:function(){
		// TODO: return self.getErrorState().errors;
		return 0;
	},
	info:function(m){
		this.getErrorState().infos++;
		console.info(m);
	},
	error:function(msgID, arg, arg2){
		this.getErrorState().errors++;
		this.getErrorState().errorMsgIDs.add(msgID);
		var msg = msgID;
		
		if(arg){
			if(typeof(arg) == 'object'){
				msg += '\n' + arg;
			}else{
				msg += " "+ arg;
				if(arg2){
					msg += " "+ arg2;
				}
			}
		}
		console.error(i18n_message(msgID));
	}
}

function i18n_message(msgID){
	return msgID;
}
module.exports = self;
})();
