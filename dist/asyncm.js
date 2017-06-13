!function(n){function r(e){if(t[e])return t[e].exports;var u=t[e]={i:e,l:!1,exports:{}};return n[e].call(u.exports,u,u.exports,r),u.l=!0,u.exports}var t={};r.m=n,r.c=t,r.i=function(n){return n},r.d=function(n,t,e){r.o(n,t)||Object.defineProperty(n,t,{configurable:!1,enumerable:!0,get:e})},r.n=function(n){var t=n&&n.__esModule?function(){return n.default}:function(){return n};return r.d(t,"a",t),t},r.o=function(n,r){return Object.prototype.hasOwnProperty.call(n,r)},r.p="",r(r.s=2)}([function(n,r,t){"use strict";function e(n){n.prototype.result=function(n){return this.next(n,null,null)},n.prototype.error=function(n){return this.next(null,n,null)},n.prototype.cancel=function(n){return this.next(null,null,n)},n.prototype.skipAny=function(n){return this.next(function(){return n},function(){return n},null)},n.sleep=function(r){return n.create(function(t){var e=!1,u=setTimeout(function(){e=!0,t()},r);return{cancel:function(r){return n.create(function(t,i){return null===u?void i(n.CANCEL_ERROR.ALREADY_CANCELLED):e?void i(n.CANCEL_ERROR.ALREADY_FINISHED):(clearTimeout(u),u=null,void t(r))})}}})},n.never=function(){return n.create(function(){return{cancel:function(){return n.result()}}})},n.fun=function(r){return function(){var t=arguments;return n.create(function(n,e){return r.apply(this,[n,e].concat(Array.from(t)))})}}}n.exports=e},function(n,r,t){"use strict";function e(n){this._data=n&&n.data,this._prev=null,this._result=null,this._error=null,this._cancel=null,this.addLayer=function(n,r,t){var u=new e;return u._prev=this,u._result=n,u._error=r,u._cancel=t,u},this.toDirectList=function(){function n(n){for(var r=[],t=n;t._prev;)r.push({result:t._result,error:t._error,cancel:t._cancel}),t=t._prev;return{list:r,data:t._data}}var r=[],t=n(this),e=t.data;return r.push(t.list),{prependReversedList:function(t){var e=n(t);return r.unshift(e.list),e.data},takeLayer:function(){for(;r.length;){for(var n=r[0];n.length;)return n.pop();r.shift()}return null},takeLayerWithCancelAndDropPrepended:function(){for(;r.length;){for(var n=r[0];n.length;){var t=n.pop();if(t.cancel)return r.shift(),t}r.shift()}return null},getData:function(){return e}}}}n.exports=e},function(n,r,t){"use strict";function e(n){var r=n.reversedFlowList;this._reversedFlowList=r,this.next=function(n,t,u){return new e({reversedFlowList:r.addLayer(n,t,u)})},this.run=function(n,t,u){function i(r){function u(n,r,t){return function(u){if(v===n){if(v++,p===n)return void _();if(null===p){for(;;){var o=s.takeLayer();if(!o)break;if(o[r]){var l=o[r](u);if(l){if(l instanceof e)return l.__pureMF&&(l=l.__pureMF()),d=s.prependReversedList(l._reversedFlowList),void(f?a=!0:i());u=l}}}c=null,E=!0,t&&t(u)}}}}l=!1;var E=!1;if(c=d(u(v,"result",n),u(v,"error",t)),E)return void(c=null);if(!c||!c.cancel){l=!0;var L={cancel:e.fun(function(n,r,t){return null!==p?void r(e.CANCEL_ERROR.ALREADY_CANCELLED):c?(p=v,void(_=function(){o(t,null,null,n,r)})):void r(e.CANCEL_ERROR.ALREADY_FINISHED)})};c=L}}function o(n,r,t,i,o){function c(r){var t=f();if(t){var u=t(n,null,r);return u instanceof e||(u=e.result(u||r)),u.next(c,l)}}function l(r){var t=f();if(t){var u=t(n,r);return u instanceof e||(u=u?e.result(u):e.error(r)),u.next(c,l)}}function f(){for(;;){var n=s.takeLayerWithCancelAndDropPrepended();if(!n)return null;if(n.cancel)return n.cancel}}(r?e.error(r):e.result(t)).next(c,l).run(function(r){u&&u(n,null,r),i(r)},function(r){u&&u(n,r),o(r)})}for(var c,l,f,a,s=r.toDirectList(),d=s.getData(),v=0,p=null,_=null;;)if(f=!0,a=!1,i(),f=!1,!a)break;return{cancel:e.fun(function(n,r,t){function u(n){return function(r){f=!0,s=null,i.forEach(function(n){n(e.CANCEL_ERROR.ALREADY_FINISHED)}),i=null,n(r)}}if(!c)return void r(e.CANCEL_ERROR.ALREADY_FINISHED);if(!l&&null!==p)return void r(e.CANCEL_ERROR.ALREADY_CANCELLED);p=v,_=function(){};var i=[],f=!1,a=c;c=null;var s=a.cancel(t).run(function(e){o(t,null,e,u(n),u(r))},function(e){o(t,e,null,u(n),u(r))});return f&&(s=null),{cancel:e.fun(function(n,r,t){if(f)return void r(e.CANCEL_ERROR.ALREADY_FINISHED);i.push(r)})}})}}}n.exports=e,t(0)(e),"undefined"!=typeof window&&(window.AsyncM=e);var u=t(1);e.CANCEL_ERROR={ALREADY_FINISHED:"already_finished",ALREADY_CANCELLED:"already_cancelled"},e.create=function(n){return new e({reversedFlowList:new u({data:n})})},e.result=function(n){return e.create(function(r){r(n)})},e.error=function(n){return e.create(function(r,t){t(n)})},e.pureM=function(n){var r=e.create(function(r,t){return n().run(r,t)});return r.__pureMF=n,r}}]);