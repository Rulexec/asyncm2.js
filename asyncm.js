module.exports = AsyncM;

if (typeof window !== 'undefined') {
	window.AsyncM = AsyncM;
}

var ReversedFlowList = require('./flow-list');

function AsyncM(options) {
	let reversedFlowList = options.reversedFlowList;

	this._reversedFlowList = reversedFlowList;

	this.next = function(resultHandler, errorHandler, cancelHandler) {
		return new AsyncM({
			reversedFlowList: reversedFlowList.addLayer(
				resultHandler,
				errorHandler,
				cancelHandler
			)
		});
	};

	this.run = function(onResult, onError, onCancel) {
		var directFlowList = reversedFlowList.toDirectList();

		var mRunner = directFlowList.getData();

		var executionCounter = 0,
		    cancelledAtCounter = null,
		    cancelCallback = null;

		var running, hasFakeRunning;

		doRun();

		function doRun(m) {
			hasFakeRunning = false;

			running = mRunner(
				resultHandling.bind(null, executionCounter),
				errorHandling.bind(null, executionCounter)
			);

			if (!running || !running.cancel) {
				hasFakeRunning = true;

				running = {
					cancel: AsyncM.fun(function(onResult, onError, data) {
						if (cancelledAtCounter !== null) {
							onError(AsyncM.CANCEL_ERROR.ALREADY_CANCELLED);
							return;
						}

						if (!running) {
							onError(AsyncM.CANCEL_ERROR.ALREADY_FINISHED);
							return;
						}

						cancelledAtCounter = executionCounter;
						cancelCallback = function() {
							cancelHandling(data, null, null, onResult, onError);
						};
					})
				};
			}
		}

		function resultHandling(execCounter, result) {
			// Ignore second-time run
			if (executionCounter !== execCounter) return;

			executionCounter++;

			if (cancelledAtCounter === execCounter) {
				cancelCallback();
				return;
			}

			// Ignore... what?
			if (cancelledAtCounter !== null) return;

			while (true) {
				let layer = directFlowList.takeLayer();

				if (!layer) break;

				if (!layer.result) continue;

				let m = layer.result(result);

				if (!m) continue;

				if (!(m instanceof AsyncM)) {
					result = m;
					continue;
				}

				let nextDirectList = m._reversedFlowList.toDirectList();

				nextDirectList.attachDirectList(directFlowList);

				mRunner = nextDirectList.getData();
				directFlowList = nextDirectList;

				doRun();

				return;
			}

			running = null;

			if (onResult) onResult(result);
		}

		function errorHandling(execCounter, error) {
			// Ignore second-time run
			if (executionCounter !== execCounter) return;

			executionCounter++;

			if (cancelledAtCounter === execCounter) {
				cancelCallback();
				return;
			}

			// Ignore... what?
			if (cancelledAtCounter !== null) return;

			while (true) {
				let layer = directFlowList.takeLayer();

				if (!layer) break;

				if (!layer.error) continue;

				let m = layer.error(error);

				if (!m) continue;

				if (!(m instanceof AsyncM)) {
					error = m;
					continue;
				}

				let nextDirectList = m._reversedFlowList.toDirectList();

				nextDirectList.attachDirectList(directFlowList);

				mRunner = nextDirectList.getData();
				directFlowList = nextDirectList;

				doRun();

				return;
			}

			running = null;

			if (onError) onError(error);
		}

		// TODO: must return a monad to be cancellable
		// But anyway, `onCancel` must be called even if cancel is cancelled
		function cancelHandling(originalData, errorData, resultData, onResult, onError) {
			while (true) {
				let layer = directFlowList.takeLayer();

				if (!layer) break;

				if (!layer.cancel) continue;

				let m = layer.cancel(originalData, errorData, resultData);

				if (!(m instanceof AsyncM)) {
					if (m) {
						onCancel(originalData, null, m);
						onResult();
					} else {
						onCancel(originalData, errorData, resultData);
						onResult();
					}

					return;
				}

				m.run(
					function(result) {
						onCancel(originalData, null, result);
						onResult();
					},
					function(error) {
						onCancel(originalData, error);
						onResult();
					},
					// It cannot be cancelled, TODO
					function(){}
				);

				return;
			}

			onCancel(originalData, errorData, resultData);
			onResult();
		}

		return {
			cancel: AsyncM.fun(function(onResult, onError, data) {
				if (!hasFakeRunning) {
					if (!running) {
						onError(AsyncM.CANCEL_ERROR.ALREADY_FINISHED);
						return;
					}

					if (cancelledAtCounter !== null) {
						onError(AsyncM.CANCEL_ERROR.ALREADY_CANCELLED);
						return;
					}

					// Ignore results of function calls
					cancelledAtCounter = executionCounter;
					cancelCallback = function() {};
				}

				// TODO: cancel must be continued with `cancelHandling` monad

				return running.cancel(data).run(
					function(result) {
						cancelHandling(data, null, result, onResult, onError);
					},
					function(error) {
						cancelHandling(data, error, null, onResult, onError);
					},
					function() {}
				);
			})
		};
	};

	this.result = function(resultHandler) {
		return this.next(resultHandler, null, null);
	};
	this.error = function(errorHandler) {
		return this.next(null, errorHandler, null);
	};
	this.cancel = function(cancelHandler) {
		return this.next(null, null, cancelHandler);
	};
}

AsyncM.CANCEL_ERROR = {
	ALREADY_FINISHED: 'already_finished',
	ALREADY_CANCELLED: 'already_cancelled'
};

AsyncM.create = function(runner) {
	return new AsyncM({
		reversedFlowList: new ReversedFlowList({
			data: runner
		})
	});
};

AsyncM.result = function(result) {
	return AsyncM.create(function(onResult) { onResult(result); });
};
AsyncM.error = function(error) {
	return AsyncM.create(function(onResult, onError) { onError(error); });
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

AsyncM.fun = function(f) {
	return function() {
		var args = arguments;

		return AsyncM.create(function(onResult, onError) {
			return f.apply(this, [onResult, onError].concat(Array.from(args)));
		});
	};
};