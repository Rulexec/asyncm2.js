AsyncM
======
Declarative asynchronous control flow
-------------------------------------

This library provides a way to manage async control flow and be able to cancel some computations, if needed.

`Callback hell` is solved by `Promises`, which are, in fact, only subscription for some result, but not controllers of **computations**.

`AsyncM` objects, therefore, defining some computations, that can be runned and will return controller of this runned computation.

`AsyncM` objects have next methods:

* `.run(onResult, onError, onCancel) → {cancel: Function<Object, AsyncM>}` — starts computation, returns object, that have method to cancel it
* `.next(resultHandler, errorHandler, cancelHandler) → AsyncM` — immutable operation

Also, there is shortcuts:

* `.result(resultHandler)`, `.error(errorHandler)`, `.cancel(cancelHandler)`
* `.skipResult(asyncM)`, `.skipError(asyncM)`, `.skipAny(asyncM)`

Handlers that are passed in `run` method are just callbacks, handlers that passed in `next` can return new `AsyncM` object that will continue computation as in `Promises`.

If `cancel` method of `run` result object is called and `runned`, all result/error handlers are ignored and then `cancelHandlers` are called for each layer of handlers. It is easiest to demonstate, than to describe:

```
var running = AsyncM.sleep(10).result(function() {
	return AsyncM.sleep(100).cancel(function() {
		console.log(1);
	}).result(function() {
		return AsyncM.sleep(500).result(function() {
			console.log(2);
		}).cancel(function() {
			console.log(3);
		});
	}).cancel(function() {
		console.log(4);
	}).cancel(function() {
		console.log(5);
	})
}).cancel(function() {
	console.log(6);
}).run();

setTimeout(function() {
	running.cancel().run();
}, 200)
```

In result of execution that code will print only **3, 4 and 6**.

* `1` will be not printed cause `10ms + 110ms` passed and this operations are already got executed
* `2` will be not printed cause it need to await `10ms + 110ms + 500ms`, but operation is cancelled at `200ms` and handler will be not called (and `setTimeout` for this `500ms` is cleared)
* `5` will be not printed cause at this layer one `cancelHandler`, that follows execution order already executed

... to be continued