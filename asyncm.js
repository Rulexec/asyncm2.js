module.exports = AsyncM;

require('./asyncmUtil')(AsyncM);

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

		var runningSync, runnedSync;

		while (true) {
			runningSync = true;
			runnedSync = false;

			doRun();

			runningSync = false;

			if (!runnedSync) break;
		}

		function doRun(m) {
			hasFakeRunning = false;

			var runningFinishedSync = false;

			running = mRunner(
				nextHandling(executionCounter, 'result', onResult),
				nextHandling(executionCounter, 'error', onError)
			);

			if (runningFinishedSync) {
				running = null;

				return;
			}

			if (!running || !running.cancel) {
				hasFakeRunning = true;

				let fakeRunning = {};

				running = fakeRunning;
			}

			function nextHandling(execCounter, layerName, finalHandler) {
				return function(data) {
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

						if (!layer[layerName]) continue;

						let m = layer[layerName](data);

						if (!m) continue;

						if (!(m instanceof AsyncM)) {
							data = m;
							continue;
						}

						if (m.__pureMF) m = m.__pureMF();

						mRunner = directFlowList.prependReversedList(m._reversedFlowList);

						if (runningSync) {
							runnedSync = true;
						} else {
							doRun();
						}

						return;
					}

					running = null;

					runningFinishedSync = true;

					if (finalHandler) finalHandler(data);
				};
			}
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
				if (!running) {
					onError(AsyncM.CANCEL_ERROR.ALREADY_FINISHED);
					return;
				}

				if (cancelledAtCounter !== null) {
					onError(AsyncM.CANCEL_ERROR.ALREADY_CANCELLED);
					return;
				}

				let cancelWaiters = [],
				    finished = false;

				let cancelRunning = null;

				if (!hasFakeRunning) {
					// Ignore results of function calls
					cancelledAtCounter = executionCounter;
					cancelCallback = function() {};

					let oldRunning = running;
					running = null;

					cancelRunning = oldRunning.cancel(data).run(
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
				} else {
					cancelledAtCounter = executionCounter;
					cancelCallback = function() {
						cancelHandling(data, null, null, cancelFinishHandling(onResult), cancelFinishHandling(onError));
					};
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
	var m = AsyncM.create(function(onResult, onError) {
		return f().run(onResult, onError);
	});

	m.__pureMF = f;

	return m;
};
