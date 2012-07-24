'use strict';

module.exports = Deque;

function Deque() {
    this._head = new Deque.Node();
    this._tail = new Deque.Node();
    this._head._next = this._tail;
    this._tail._prev = this._head;
    this._size = 0;
}

Deque.Node = function(data) {
    this._data = data;
    this._prev = null;
    this._next = null;
};

Deque.prototype = {

    empty: function () {
        return this._head._next === this._tail;
    },

    size: function () {
        return this._size;
    },

    pushBack: function (data) {
        var node = new Deque.Node(data);
        node._prev = this._tail._prev;
        node._prev._next = node;
        node._next = this._tail;
        this._tail._prev = node;
        ++this._size;
    },

    popBack: function () {
        if (this.empty()) {
            throw new Error("popBack called on empty deque");
        }
        --this._size;
        var node = this._tail._prev;
        this._tail._prev = node._prev;
        node._prev._next = this._tail;
        return node._data;
    },

    pushFront: function (data) {
        var node = new Deque.Node(data);
        node._next = this._head._next;
        node._next._prev = node;
        node._prev = this._head;
        this._head._next = node;
        ++this._size;
    },

    popFront: function () {
        if (this.empty()) {
            throw new Error("popFront called on empty deque");
        }
        --this._size;
        var node = this._head._next;
        this._head._next = node._next;
        node._next._prev = this._head;
        return node._data;
    }
};
