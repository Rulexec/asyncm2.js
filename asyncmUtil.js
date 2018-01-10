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

AsyncM.prototype.any = function(handler, cancelHandler) {
	return this.next(handler, handler, cancelHandler || null);
};

AsyncM.prototype.skipAny = function(m) {
	return this.next(function() {
		return m;
	}, function() {
		return m;
	}, null);
};

AsyncM.prototype.skipResult = function(m) {
	return this.result(function() { return m; });
};

AsyncM.prototype.skipError = function(m) {
	return this.error(function() { return m; });
};

AsyncM.pureF = function(f) {
	return function() {
		var that = this,
		    args = arguments;

		return AsyncM.pureM(function() {
			return f.apply(that, args)
		});
	};
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

AsyncM.parallel = function(ms, options) {
	var f = options && options.f,
	    drop = options && options.drop;

	return AsyncM.create(function(onResult, onError) {
		var results = !drop && [];

		var results_left = ms.length;

		ms.forEach(function(x, i) {
			var m;

			if (f) m = f(x, i);
			else m = x;

			if (!drop) results.push(null);

			var finished = false;

			m.run(function(result) {
				if (finished) return;
				finished = true;

				if (!drop) results[i] = result;

				results_left--;

				if (results_left === 0) {
					if (drop) onResult(); else onResult(results);
				}
			}, function(error) {
				if (finished) return;
				finished = true;

				onError(error);
			});
		});
	});
};

}
