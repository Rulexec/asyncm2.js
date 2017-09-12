/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = inject;

function inject(AsyncM) {

	AsyncM.prototype.result = function (resultHandler) {
		return this.next(resultHandler, null, null);
	};
	AsyncM.prototype.error = function (errorHandler) {
		return this.next(null, errorHandler, null);
	};
	AsyncM.prototype.cancel = function (cancelHandler) {
		return this.next(null, null, cancelHandler);
	};

	AsyncM.prototype.skipAny = function (m) {
		return this.next(function () {
			return m;
		}, function () {
			return m;
		}, null);
	};

	AsyncM.prototype.skipResult = function (m) {
		return this.result(function () {
			return m;
		});
	};

	AsyncM.prototype.skipError = function (m) {
		return this.error(function () {
			return m;
		});
	};

	AsyncM.pureF = function (f) {
		return function () {
			return AsyncM.pureM(f.bind(this, arguments));
		};
	};

	AsyncM.sleep = function (t) {
		return AsyncM.create(function (onResult) {
			var finished = false;

			var timeoutId = setTimeout(function () {
				finished = true;

				onResult();
			}, t);

			return {
				cancel: function cancel(data) {
					return AsyncM.create(function (onResult, onError) {
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

	AsyncM.never = function () {
		return AsyncM.create(function () {
			return { cancel: function cancel() {
					return AsyncM.result();
				} };
		});
	};

	AsyncM.fun = function (f) {
		return function () {
			var args = arguments;

			return AsyncM.create(function (onResult, onError) {
				return f.apply(this, [onResult, onError].concat(Array.from(args)));
			});
		};
	};

	AsyncM.parallel = function (ms, options) {
		var f = options && options.f,
		    drop = options && options.drop;

		return AsyncM.create(function (onResult, onError) {
			var results = !drop && [];

			var results_left = ms.length;

			ms.forEach(function (x, i) {
				var m;

				if (f) m = f(x, i);else m = x;

				if (!drop) results.push(null);

				var finished = false;

				m.run(function (result) {
					if (finished) return;
					finished = true;

					if (!drop) results[i] = result;

					results_left--;

					if (results_left === 0) {
						onResult(results);
					}
				}, function (error) {
					if (finished) return;
					finished = true;

					onError(error);
				});
			});
		});
	};
}

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/*
 * This is immutable tree of async control flow.
 *
 * It has a start node, that represent currently executing monad (or that will be executed),
 * and this node connected to 3 types of handlers: result, error, cancel.
 *
 * And then every handler can be connected to next layer of handlers.
 */

module.exports = ReversedFlowList;

function ReversedFlowList(options) {
	this._data = options && options.data;

	this._prev = null;

	this._result = null;
	this._error = null;
	this._cancel = null;

	this.addLayer = function (resultData, errorData, cancelData) {
		var list = new ReversedFlowList();

		list._prev = this;

		list._result = resultData;
		list._error = errorData;
		list._cancel = cancelData;

		return list;
	};

	this.toDirectList = function () {
		var lists = [];

		var direct = reversedToListAndData(this);

		var data = direct.data;

		lists.push(direct.list);

		function reversedToListAndData(reversedList) {
			var list = [];

			var node = reversedList;

			while (node._prev) {
				list.push({
					result: node._result,
					error: node._error,
					cancel: node._cancel
				});

				node = node._prev;
			}

			return {
				list: list,
				data: node._data
			};
		}

		return {
			prependReversedList: function prependReversedList(reversedList) {
				var direct = reversedToListAndData(reversedList);

				lists.unshift(direct.list);

				return direct.data;
			},

			takeLayer: function takeLayer() {
				while (lists.length) {
					var list = lists[0];

					while (list.length) {
						return list.pop();
					}

					lists.shift();
				}

				return null;
			},
			takeLayerWithCancelAndDropPrepended: function takeLayerWithCancelAndDropPrepended() {
				while (lists.length) {
					var list = lists[0];

					while (list.length) {
						var layer = list.pop();

						if (layer.cancel) {
							lists.shift();

							return layer;
						}
					}

					lists.shift();
				}

				return null;
			},

			getData: function getData() {
				return data;
			}
		};
	};
}

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = AsyncM;

__webpack_require__(0)(AsyncM);

if (typeof window !== 'undefined') {
	window.AsyncM = AsyncM;
}

var ReversedFlowList = __webpack_require__(1);

function AsyncM(options) {
	var reversedFlowList = options.reversedFlowList;

	this._reversedFlowList = reversedFlowList;

	this.next = function (resultHandler, errorHandler, cancelHandler) {
		return new AsyncM({
			reversedFlowList: reversedFlowList.addLayer(resultHandler, errorHandler, cancelHandler)
		});
	};

	this.run = function (onResult, onError, onCancel) {
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

			running = mRunner(nextHandling(executionCounter, 'result', onResult), nextHandling(executionCounter, 'error', onError));

			if (runningFinishedSync) {
				running = null;

				return;
			}

			if (!running || !running.cancel) {
				hasFakeRunning = true;

				var fakeRunning = {
					cancel: AsyncM.fun(function (onResult, onError, data) {
						if (cancelledAtCounter !== null) {
							onError(AsyncM.CANCEL_ERROR.ALREADY_CANCELLED);
							return;
						}

						if (!running) {
							onError(AsyncM.CANCEL_ERROR.ALREADY_FINISHED);
							return;
						}

						cancelledAtCounter = executionCounter;
						cancelCallback = function cancelCallback() {
							cancelHandling(data, null, null, onResult, onError);
						};
					})
				};

				running = fakeRunning;
			}

			function nextHandling(execCounter, layerName, finalHandler) {
				return function (data) {
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
						var layer = directFlowList.takeLayer();

						if (!layer) break;

						if (!layer[layerName]) continue;

						var _m = layer[layerName](data);

						if (!_m) continue;

						if (!(_m instanceof AsyncM)) {
							data = _m;
							continue;
						}

						if (_m.__pureMF) _m = _m.__pureMF();

						mRunner = directFlowList.prependReversedList(_m._reversedFlowList);

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
			var cancelChainM = errorData ? AsyncM.error(errorData) : AsyncM.result(resultData);

			cancelChainM.next(resultCancelHandler, errorCancelHandler).run(function (result) {
				if (onCancel) onCancel(originalData, null, result);
				onResult(result);
			}, function (error) {
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
					var layer = directFlowList.takeLayerWithCancelAndDropPrepended();

					if (!layer) return null;

					if (!layer.cancel) continue;

					return layer.cancel;
				}
			}
		}

		return {
			cancel: AsyncM.fun(function (onResult, onError, data) {
				if (!running) {
					onError(AsyncM.CANCEL_ERROR.ALREADY_FINISHED);
					return;
				}

				if (!hasFakeRunning) {
					if (cancelledAtCounter !== null) {
						onError(AsyncM.CANCEL_ERROR.ALREADY_CANCELLED);
						return;
					}
				}

				// Ignore results of function calls
				cancelledAtCounter = executionCounter;
				cancelCallback = function cancelCallback() {};

				var cancelWaiters = [],
				    finished = false;

				var oldRunning = running;
				running = null;

				var cancelRunning = oldRunning.cancel(data).run(function (result) {
					cancelHandling(data, null, result, cancelFinishHandling(onResult), cancelFinishHandling(onError));
				}, function (error) {
					cancelHandling(data, error, null, cancelFinishHandling(onResult), cancelFinishHandling(onError));
				});

				if (finished) {
					cancelRunning = null;
				}

				function cancelFinishHandling(cont) {
					return function (data) {
						finished = true;

						cancelRunning = null;

						cancelWaiters.forEach(function (f) {
							f(AsyncM.CANCEL_ERROR.ALREADY_FINISHED);
						});

						cancelWaiters = null;

						cont(data);
					};
				}

				return {
					cancel: AsyncM.fun(function (onResult, onError, data) {
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

AsyncM.create = function (runner) {
	return new AsyncM({
		reversedFlowList: new ReversedFlowList({
			data: runner
		})
	});
};

AsyncM.result = function (result) {
	return AsyncM.create(function (onResult) {
		onResult(result);
	});
};
AsyncM.error = function (error) {
	return AsyncM.create(function (onResult, onError) {
		onError(error);
	});
};

AsyncM.pureM = function (f) {
	var m = AsyncM.create(function (onResult, onError) {
		return f().run(onResult, onError);
	});

	m.__pureMF = f;

	return m;
};

/***/ })
/******/ ]);