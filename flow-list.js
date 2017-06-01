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

	this.addLayer = function(resultData, errorData, cancelData) {
		var list = new ReversedFlowList();

		list._prev = this;

		list._result = resultData;
		list._error = errorData;
		list._cancel = cancelData;

		return list;
	};

	this.toDirectList = function() {
		let list = [],
		    attachedLists = [];

		let node = this;

		while (node._prev) {
			list.push({
				result: node._result,
				error: node._error,
				cancel: node._cancel
			});

			node = node._prev;
		}

		let data = null;

		if (node._data) {
			data = node._data;
		}

		return {
			takeLayer: function() {
				if (list.length) {
					return list.pop();
				}

				while (attachedLists.length) {
					let attachedList = attachedLists[0];

					let layer = attachedList.takeLayer();

					if (layer) return layer;

					attachedLists.shift();
				}

				return null;
			},

			getData: function() { return data; },

			attachDirectList: function(otherList) {
				attachedLists.push(otherList);
			}
		};
	};
}