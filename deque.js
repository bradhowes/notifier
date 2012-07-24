'use strict';

/**
 * @fileOverview Defines the Deque prototype and its methods.
 */
module.exports = Deque;

/**
 * Deque constructor.
 *
 * @class
 *
 * An Deque object acts much like the C++ std::deque container. Provides operations to add/remove objects from the
 * start and the end of the containuer.
 */
function Deque() {
    this._head = new Deque.Node();
    this._tail = new Deque.Node();
    this._head._next = this._tail;
    this._tail._prev = this._head;
    this._size = 0;
}

/**
 * Deque Node constructor.
 *
 * @class
 *
 * A Node object simple maintains links to a Deque double linked list.
 */
Deque.Node = function(data) {
    this._data = data;
    this._prev = null;
    this._next = null;
};

/**
 * Deque prototype.
 *
 * Defines the methods available to a Deque instance.
 */
Deque.prototype = {

    /**
     * Determine if the container has no elements.
     *
     * @return true if so
     */
    empty: function () {
        return this._head._next === this._tail;
    },

    /**
     * Obtain the number of elements held in the container.
     *
     * @return {Number} current container capacity
     */
    size: function () {
        return this._size;
    },

    /**
     * Add a new Node instance to the back of the queue.
     *
     * @param {Object} data value to add to the queue
     */
    pushBack: function (data) {
        var node = new Deque.Node(data);
        node._prev = this._tail._prev;
        node._prev._next = node;
        node._next = this._tail;
        this._tail._prev = node;
        ++this._size;
    },

    /**
     * Remove a Node instance from the back of the queue.
     *
     * @returns {Object} held data value
     */
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

    /**
     * Add a new Node instance to the front of the queue.
     *
     * @param {Object} data value to add to the queue
     */
    pushFront: function (data) {
        var node = new Deque.Node(data);
        node._next = this._head._next;
        node._next._prev = node;
        node._prev = this._head;
        this._head._next = node;
        ++this._size;
    },

    /**
     * Remove a Node instance from the front of the queue.
     *
     * @returns {Object} held data value
     */
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
