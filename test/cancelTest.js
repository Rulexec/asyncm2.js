var assert = require('assert'),

    M = require('../asyncm'),
    testUtil = require('./util'),
		util = require('util');

describe('M', function() {
	var resultTwo = M.result(2),
	    errorTwo = M.error(2);

	var incrementToResult = testUtil.incrementToResult,
	    incrementToError = testUtil.incrementToError;

	describe('simple cancel', function() {
		it('should result cancel argument', function(done) {
			var cancelHandlerExecuted = false;

			var running = M.sleep(1000).run(null, null, function(data) {
				cancelHandlerExecuted = true;

				assert.equal(data, 42);
			});

			running.cancel(42).run(function() {
				assert(cancelHandlerExecuted);

				done();
			});
		});

		it('should not fail on no handler', function(done) {
			var running = M.sleep(1000).run();

			running.cancel().run(function() {
				done();
			});
		});
	});
	
	describe('chained cancel', function() {
		it('should not execute handler', function(done) {
			var handlerExecuted = false,
			    cancelHandlerExecuted = false;

			var running = M.sleep(1000).result(function() {
				firstHandlerExecuted = true;
				assert(false);
				return M.sleep(1000);
			}).run(null, null, function(data) {
				cancelHandlerExecuted = true;

				assert.equal(data, 42);
			});

			running.cancel(42).run(function() {
				assert(cancelHandlerExecuted);
				assert(!handlerExecuted);

				done();
			});
		});

		it('should not execute second handler', function(done) {
			var firstHandlerExecuted = false,
			    secondHandlerExecuted = false,
			    cancelHandlerExecuted = false;

			var running = M.sleep(100).result(function() {
				firstHandlerExecuted = true;
				return M.sleep(100);
			}).result(function() {
				secondHandlerExecuted = true;
				assert(false);
				return M.sleep(1000);
			}).run(null, null, function(data) {
				cancelHandlerExecuted = true;

				assert.equal(data, 42);
			});

			setTimeout(function() {
				running.cancel(42).run(function() {
					assert(cancelHandlerExecuted);
					assert(firstHandlerExecuted);
					assert(!secondHandlerExecuted);

					done();
				});
			}, 150);
		});

		it('should error, if already finished', function(done) {
			var firstHandlerExecuted = false,
			    secondHandlerExecuted = false,
			    cancelHandlerExecuted = false,
					resultHandlerExecuted = false;

			var running = M.sleep(5).result(function() {
				firstHandlerExecuted = true;
				return M.sleep(5);
			}).result(function() {
				secondHandlerExecuted = true;
				return M.sleep(5);
			}).run(function() {
				resultHandlerExecuted = true;
			}, null, function() {
				cancelHandlerExecuted = true;
				assert(false);
			});

			setTimeout(function() {
				running.cancel(42).run(null, function(error) {
					assert(error === M.CANCEL_ERROR.ALREADY_FINISHED);

					assert(firstHandlerExecuted);
					assert(secondHandlerExecuted);
					assert(!cancelHandlerExecuted);
					assert(resultHandlerExecuted);

					done();
				});
			}, 50);
		});
	});

	describe('cancel', function() {
		it('should be notified, when cancel happens', function(done) {
			var firstHandlerExecuted = false,
			    secondHandlerExecuted = false,
			    cancelHandlerExecuted = false,
					cancelNotified = false,
					secondCancelNotified = false;

			var running = M.sleep(100).result(function() {
				firstHandlerExecuted = true;
				return M.sleep(100);
			}).cancel(function(data) {
				cancelNotified = true;
				assert.equal(data, 42);
			}).result(function() {
				secondHandlerExecuted = true;
				assert(false);
				return M.sleep(1000);
			}).cancel(function() {
				secondCancelNotified = true;
				assert(false);
			}).run(null, null, function(data) {
				cancelHandlerExecuted = true;

				assert.equal(data, 42);
			});

			setTimeout(function() {
				running.cancel(42).run(function() {
					assert(cancelHandlerExecuted);
					assert(firstHandlerExecuted);
					assert(!secondHandlerExecuted);
					assert(cancelNotified);
					assert(!secondCancelNotified);

					done();
				});
			}, 150);
		});

		it('should not notify finished branch', function(done) {
			var firstHandlerExecuted = false,
			    secondHandlerExecuted = false,
			    cancelHandlerExecuted = false,
					firstCancelNotified = false,
					secondCancelNotified = false;

			var running = M.sleep(100).result(function() {
				firstHandlerExecuted = true;
				return M.sleep(100);
			}).cancel(function() {
				firstCancelNotified = true;
				assert(false);
			}).result(function() {
				secondHandlerExecuted = true;
				return M.sleep(1000);
			}).cancel(function(data) {
				secondCancelNotified = true;
				assert.equal(data, 42);
			}).run(null, null, function(data) {
				cancelHandlerExecuted = true;

				assert.equal(data, 42);
			});

			setTimeout(function() {
				running.cancel(42).run(function() {
					assert(cancelHandlerExecuted);
					assert(firstHandlerExecuted);
					assert(secondHandlerExecuted);
					assert(!firstCancelNotified);
					assert(secondCancelNotified);

					done();
				});
			}, 250);
		});
	});

	describe('nested cancel', function() {
		it('should be processed by each handler', function(done) {
			var firstCancelHandlerExecuted = false,
			    secondCancelHandlerExecuted = false,
			    finalCancelHandlerExecuted = false;

			var wrongCancelExecuted = false;

			var running = M.sleep(0
			).result(function() {
				return M.sleep(0
				).result(function() {
					return M.sleep(10000);
				}).cancel(function() {
					firstCancelHandlerExecuted = true;
				}).cancel(function() {
					wrongCancelExecuted = true;
				});
			}).cancel(function() {
				secondCancelHandlerExecuted = true;
			}).run(null, null, function() {
				finalCancelHandlerExecuted = true;
			});

			setTimeout(function() {
				running.cancel(42).run(function() {
					assert(finalCancelHandlerExecuted, 'final');
					assert(firstCancelHandlerExecuted, 'first');
					assert(secondCancelHandlerExecuted, 'second');

					assert(!wrongCancelExecuted);

					done();
				});
			}, 50);
		});
	})
});
