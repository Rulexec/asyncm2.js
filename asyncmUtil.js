module.exports = inject;

function inject(AsyncM) {

function AsyncMEmptyError() {}
let emptyError = new AsyncMEmptyError();

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
	return this.next(function(result) { return handler.call(this, null, result); }, handler, cancelHandler || null);
};

AsyncM.prototype.skipFinallyAndPassSeq = function(seq) {
	let m = this;

	seq.forEach(ms => {
		m = m.next(
			result => {
				return ms.any(() => AsyncM.result(result));
			},
			(value, opts) => {
				return ms.any(() => AsyncM._error(value, opts));
			},
			value => {
				return ms.any(() => AsyncM.result(value));
			}
		);
	});

	return m;
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

AsyncM.prototype.skipResultSeq = function(seq) {
	let m = this;

	seq.forEach(mr => {
		m = m.skipResult(mr);
	});

	return m;
};

AsyncM.pureF = function(f) {
	let errorException = new Error('pureF must return AsyncM object');

	return function() {
		var that = this,
		    args = arguments;

		return AsyncM.pureM(function() {
			let m = f.apply(that, args);

			if (!m) return AsyncM.error(errorException);

			return m;
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

AsyncM.immediate = function() {
	return AsyncM.create(function(onResult) {
		var finished = false;

		var timeoutId = setImmediate(function() {
			finished = true;

			onResult();
		});

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

AsyncM.Blocker = Blocker;
function Blocker(isBlocked) {
	let unblockWaiters = [];

	let m = AsyncM.create(onResult => {
		if (!isBlocked) onResult();
		else unblockWaiters.push(() => { onResult(); });
	});

	let mb = AsyncM.create(onResult => {
		if (isBlocked) {
			unblockWaiters.push(() => {
				isBlocked = true;

				onResult();
			});
			return;
		}

		isBlocked = true;

		onResult();
	});

	this.get = () => m;
	this.getAndBlock = () => mb;

	this.toggle = function(toggle) {
		if (!!isBlocked === !!toggle) return;

		isBlocked = toggle;

		if (!isBlocked) {
			let count = unblockWaiters.length;
			for (let i = 0; i < count; i++) {
				unblockWaiters.shift()();
				if (isBlocked) break;
			}
		}
	};
}

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
	if (!Array.isArray(ms)) {
		options = ms;
		ms = null;
	}

	let {
		f,
		drop,
		limit,
		waitAll,
		count,
	} = options || {};

	if (typeof limit !== 'number') limit = 0;
	if (!ms && (typeof count !== 'number')) return AsyncM.error(new Error('not array, no count'));

	return AsyncM.create(function(onResult, onError) {
		var results = !drop && [],
		    errors = waitAll && {},
		    errorHappened = false;

		var resultsLeft = ms ? ms.length : count;
		let totalCount = resultsLeft;

		if (!resultsLeft) {
			if (drop) onResult();
			else onResult([]);
		}

		var allFinished = false;

		let cancelled = false;
		let runningSet = new Set();

		let runningIndex;

		if (ms) {
			if (limit) {
				let count = Math.min(resultsLeft, limit);

				runningIndex = count;

				for (let i = 0; i < count; i++) executeSingle(ms[i], i);
			} else {
				ms.forEach((x, i) => { executeSingle(x, i); });
			}
		} else {
			if (limit) {
				let c = Math.min(resultsLeft, limit);

				runningIndex = c;

				for (let i = 0; i < c; i++) executeSingle(i, i);
			} else {
				for (let i = 0; i < count; i++) executeSingle(i, i);
			}
		}

		return {
			cancel: AsyncM.pureF(data => {
				if (!resultsLeft) return AsyncM.error(AsyncM.CANCEL_ERROR.ALREADY_FINISHED);
				if (cancelled) return AsyncM.error(AsyncM.CANCEL_ERROR.ALREADY_CANCELLED);

				allFinished = true;
				cancelled = true;

				let runnings = Array.from(runningSet);
				runningSet = null;

				return AsyncM.parallel(runnings, {
					drop: true,
					f: running => running.cancel(),
				});
			}),
		};

		function executeSingle(x, i) {
			let isSync = true;

			while (true) {
				if (cancelled) return;

				var m;

				if (f) m = f(x, i);
				else m = x;

				if (!drop) results.push(null);

				var finished = false;

				let running;
				running = m.run(function(result) {
					if (finished || allFinished) return;
					finished = true;

					if (running) runningSet.delete(running);

					if (!drop) results[i] = result;

					resultsLeft--;

					if (resultsLeft === 0) {
						if (waitAll && errorHappened) onError(errors);
						else if (drop) onResult(); else onResult(results);
					} else if (limit && runningIndex < totalCount) {
						let i = runningIndex;
						runningIndex++;

						if (ms) {
							requestExecuteSingle(ms[i], i);
						} else {
							requestExecuteSingle(i, i);
						}
					}
				}, function(error) {
					if (finished || allFinished) return;
					finished = true;

					if (running) runningSet.delete(running);

					if (waitAll) {
						errors[i] = error;
						errorHappened = true;

						resultsLeft--;

						if (resultsLeft === 0) {
							onError(errors);
						} else if (limit && runningIndex < totalCount) {
							let i = runningIndex;
							runningIndex++;

							if (ms) {
								requestExecuteSingle(ms[i], i);
							} else {
								requestExecuteSingle(i, i);
							}
						}
					} else {
						allFinished = true;
						onError(error);
					}
				});

				if (!finished) {
					runningSet.add(running);
				}

				if (isSync) {
					isSync = false;
					return;
				}

				isSync = true;
			}

			function requestExecuteSingle(rx, ri) {
				if (isSync) {
					isSync = false;
					x = rx;
					i = ri;
				} else {
					executeSingle(rx, ri);
				}
			}
		}
	});
};

AsyncM.race = race;
function race(ms /*, options*/) {
	let finished = false;

	let result = new AsyncM.Defer();

	AsyncM.parallel(ms, {
		drop: true,

		f(m) {
			return m.result(data => {
				if (finished) return;
				finished = true;
				result.result(data);
			});
		},
	}).run(null, error => {
		if (finished) return;
		finished = true;
		result.error(error);
	});

	return result.get();
};

AsyncM.ParallelPool = ParallelPool;
function ParallelPool(options) {
	let { size } = options;

	let runningCount = 0;
	let queue = [];
	let emptyWaiters = [];

	function onExecutionFinished() {
		runningCount--;

		if (queue.length) {
			queue.shift()()
		} else if (!runningCount) {
			emptyWaiters.forEach(fun => { fun(); });
		}
	}

	this.schedule = function(m) {
		return AsyncM.create(onResult => {
			run();

			function run() {
				if (runningCount >= size) {
					queue.push(run);
					return;
				}

				runningCount++;

				onResult();

				m.run(() => {
					onExecutionFinished();
				}, () => {
					onExecutionFinished();
				});
			}
		});
	};

	this.onEmpty = function() { return AsyncM.create(onResult => {
		checkEmpty();

		function checkEmpty() {
			if (runningCount) emptyWaiters.push(checkEmpty);
			else onResult();
		}
	}); };
}

AsyncM.Defer = Defer;
function Defer() {
	let isError = false;
	let error, result;

	let waiters = [];

	let m = AsyncM.create((onResult, onError) => {
		if (waiters) waiters.push({ onResult, onError });
		else if (isError) onError(error);
		else onResult(result);
	});

	this.get = () => m;

	this.result = function(value) {
		if (!waiters) return;

		isError = false;
		result = value;

		if (waiters) {
			let oldWaiters = waiters;
			waiters = null;

			oldWaiters.forEach(({ onResult }) => { onResult(value); });
		}
	};
	this.error = function(value) {
		if (!waiters) return;

		isError = true;
		error = value;

		if (waiters) {
			let oldWaiters = waiters;
			waiters = null;

			oldWaiters.forEach(({ onError }) => { onError(value); });
		}
	};

	this.reset = function() {
		waiters = [];
	};
}

AsyncM.Cancellable = Cancellable;
function Cancellable(originalM) {
	let needCancel = false;

	let running;
	let errorCallback;

	let m = AsyncM.create((onResult, onError) => {
		if (needCancel) { onError(Cancellable.CANCELLED); return; }

		running = originalM.run(onResult, onError);
		errorCallback = onError;

		return {
			cancel() {
				return running.cancel.apply(this, arguments);
			},
		};
	});

	this.get = () => m;

	this.cancel = AsyncM.pureF(arg => {
		if (needCancel) return AsyncM.result();

		needCancel = true;

		if (errorCallback) errorCallback(Cancellable.CANCELLED);
		if (running) return running.cancel(arg);

		return AsyncM.result();
	});
}
Cancellable.CANCELLED = { type: 'cancelled' };

AsyncM.prototype.runAsPromise = function() {
	return new Promise((resolve, reject) => {
		this.run(resolve, reject);
	});
};

}
