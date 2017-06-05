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

				let fakeRunning = {
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

				running = fakeRunning;
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

				mRunner = directFlowList.prependReversedList(m._reversedFlowList);

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

				mRunner = directFlowList.prependReversedList(m._reversedFlowList);

				doRun();

				return;
			}

			running = null;

			if (onError) onError(error);
		}

		// TODO: must return a monad to be cancellable
		// But anyway, `onCancel` must be called even if cancel is cancelled
		function cancelHandling(originalData, errorData, resultData, onResult, onError) {
			let cancelChainM = errorData ? AsyncM.error(errorData) : AsyncM.result(resultData);

			cancelChainM.next(resultCancelHandler, errorCancelHandler
			).run(function(result) {
				if (onCancel) onCancel(originalData, null, result);
				onResult(result);
			}, function(error) {
				if (onCancel) onCancel(originalData, error);
				onError(error);
			});

			function resultCancelHandler(result) {
				var cancelHandler = takeCancelHandler();

				if (!cancelHandler) {
					return;
				}

				var m = cancelHandler(originalData, null, result);

				if (!(m instanceof AsyncM)) m = AsyncM.result(m || result);

				return m.next(resultCancelHandler, errorCancelHandler);
			}
			function errorCancelHandler(error) {
				var cancelHandler = takeCancelHandler();

				if (!cancelHandler) {
					return;
				}

				var m = cancelHandler(originalData, error);

				if (!(m instanceof AsyncM)) m = m ? AsyncM.result(m) : AsyncM.error(error);

				return m.next(resultCancelHandler, errorCancelHandler);
			}

			function takeCancelHandler() {
				while (true) {
					let layer = directFlowList.takeLayerWithCancelAndDropPrepended();

					if (!layer) return null;

					if (!layer.cancel) continue;

					return layer.cancel;
				}
			}
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

				var cancelWaiters = [],
				    finished = false;

				var cancelRunning = running.cancel(data).run(
					function(result) {
						cancelHandling(data, null, result, cancelFinishHandling(onResult), cancelFinishHandling(onError));
					},
					function(error) {
						cancelHandling(data, error, null, cancelFinishHandling(onResult), cancelFinishHandling(onError));
					}
				);

				if (finished) {
					cancelRunning = null;
				}

				function cancelFinishHandling(cont) {
					return function(data) {
						finished = true;

						cancelRunning = null;

						cancelWaiters.forEach(function(f) {
							f(AsyncM.CANCEL_ERROR.ALREADY_FINISHED);
						});

						cancelWaiters = null;

						cont(data);
					};
				}

				return {
					cancel: AsyncM.fun(function(onResult, onError, data) {
						if (finished) {
							onError(AsyncM.CANCEL_ERROR.ALREADY_FINISHED);
							return;
						}

						cancelWaiters.push(onError);
					})
				};
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

	this.skipAny = function(m) {
		return this.next(function() {
			return m;
		}, function() {
			return m;
		}, null);
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

AsyncM.pureM = function(f) {
	return AsyncM.create(function(onResult, onError) {
		return f().run(onResult, onError);
	});
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