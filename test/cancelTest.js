var assert = require('assert'),

    M = require('../asyncm');

describe('M', function() {

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
	});

	describe('cancel of cancel', function() {
		it('should process cancel anyway', function(done) {
			var cancelHandlerExecuted = false;

			var running = M.sleep(1000
			).cancel(function() {
				return M.sleep(250).result(function() {
					cancelHandlerExecuted = true;
				});
			}).run();

			running.cancel(1).run().cancel(2).run(null, function(error) {
				assert(cancelHandlerExecuted);
				assert.equal(error, M.CANCEL_ERROR.ALREADY_FINISHED);

				done();
			});
		});

		it('should pass without errors', function(done) {
			var running = M.sleep(1000).run();

			running.cancel().run().cancel().run(null, function(error) {
				assert.equal(error, M.CANCEL_ERROR.ALREADY_FINISHED);

				done();
			});
		});
	});

	describe('cancel of cancel of cancel', function() {
		it('should process cancel anyway', function(done) {
			var cancelHandlerExecuted = false;

			var running = M.sleep(1000
			).cancel(function() {
				return M.sleep(100).result(function() {
					cancelHandlerExecuted = true;
				});
			}).run();

			running.cancel(1).run().cancel(2).cancel(function() {
				return M.sleep(100).result(function() {
					return 42;
				});
			}).run().cancel(3).run(function(result) {
				assert(cancelHandlerExecuted);

				assert.equal(result, 42);

				done();
			});
		});
	});

	describe('empty cancel', function() {
		it('should finish without error after result', function(done) {
			var finished = false;

			var m = M.create(function(onResult) {
				setTimeout(function() {
					finished = true;
					onResult();
				}, 200);
			});

			var running = m.run();

			running.cancel().run(function() {
				assert(finished, 'setTimeout is not finished');

				done();
			}, function(error) {
				assert(false, error);
			});
		});
	});
});
