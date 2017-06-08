module.exports = inject;

function inject(AsyncM) {

AsyncM.prototype.result = function(resultHandler) {
	return this.next(resultHandler, null, null);
};
AsyncM.prototype.error = function(errorHandler) {
	return this.next(null, errorHandler, null);
};
AsyncM.prototype.cancel = function(cancelHandler) {
	return this.next(null, null, cancelHandler);
};

AsyncM.prototype.skipAny = function(m) {
	return this.next(function() {
		return m;
	}, function() {
		return m;
	}, null);
};

AsyncM.sleep = function(t) {
	return AsyncM.create(function(onResult) {
		var finished = false;

		var timeoutId = setTimeout(function() {
			finished = true;

			onResult();
		}, t);

		return {
			cancel: function(data) {
				return AsyncM.create(function(onResult, onError) {
					if (timeoutId === null) {
						onError(AsyncM.CANCEL_ERROR.ALREADY_CANCELLED);
						return;
					}

					if (finished) {
						onError(AsyncM.CANCEL_ERROR.ALREADY_FINISHED);
						return;
					}

					clearTimeout(timeoutId);

					timeoutId = null;

					onResult(data);
				});
			}
		};
	});
};

AsyncM.never = function() {
	return AsyncM.create(function(){
		return {cancel: function() { return AsyncM.result(); }};
	});
};

AsyncM.fun = function(f) {
	return function() {
		var args = arguments;

		return AsyncM.create(function(onResult, onError) {
			return f.apply(this, [onResult, onError].concat(Array.from(args)));
		});
	};
};

}