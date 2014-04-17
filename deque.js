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
 * Deque.Node constructor.
 *
 * @class
 *
 * A Node object simple maintains links to a Deque double linked list.
 */
Deque.Node = function(data) {
    this.data = data;
    this._prev = null;
    this._next = null;
};

Deque.Node.prototype = {

    /**
     * Remove this node from the queue.
     */
    extricate: function () {
        this._prev._next = this._next;
        this._next._prev = this._prev;
    }
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

    backNode: function () {
        if (this.empty()) {
            throw new Error("backNode called on empty deque");
        }
        return this._tail._prev;
    },

    back: function () {
        return this.backNode().data;
    },

    frontNode: function () {
        if (this.empty()) {
            throw new Error("frontNode called on empty deque");
        }
        return this._head._next;
    },

    front: function () {
        return this.frontNode().data;
    },

    /**
     * Remove a node from the queue.
     *
     * @param {Node} node the node to remove
     */
    removeNode: function(node) {
        node.extricate();
        --this._size;
    },

    /**
     * Add an existing Node instance to the back of the queue.
     *
     * @param {Node} node Node instance to add to the queue
     */
    pushBackNode: function (node) {
        node._prev = this._tail._prev;
        node._prev._next = node;
        node._next = this._tail;
        this._tail._prev = node;
        ++this._size;
        return node;
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
        return node;
    },

    /**
     * Remove a Node instance from the back of the queue.
     *
     * @returns {Node} last Node in the queue
     */
    popBackNode: function () {
        if (this.empty()) {
            throw new Error("popBack called on empty deque");
        }
        --this._size;
        var node = this._tail._prev;
        this._tail._prev = node._prev;
        node._prev._next = this._tail;
        return node;
    },

    popBack: function() {
        return this.popBackNode().data;
    },

    /**
     * Add an existing Node instance to the front of the queue.
     *
     * @param {Node} node Node instance to add to the queue
     */
    pushFrontNode: function (node) {
        node._next = this._head._next;
        node._next._prev = node;
        node._prev = this._head;
        this._head._next = node;
        ++this._size;
        return node;
    },

    /**
     * Add a new Node instance to the front of the queue.
     *
     * @param {Node} data value to add to the queue
     */
    pushFront: function (data) {
        var node = new Deque.Node(data);
        node._next = this._head._next;
        node._next._prev = node;
        node._prev = this._head;
        this._head._next = node;
        ++this._size;
        return node;
    },

    /**
     * Remove a Node instance from the front of the queue.
     *
     * @returns {Object} first Node in the queue
     */
    popFrontNode: function () {
        if (this.empty()) {
            throw new Error("popFront called on empty deque");
        }
        --this._size;
        var node = this._head._next;
        this._head._next = node._next;
        node._next._prev = this._head;
        return node;
    },

    popFront: function() {
        return this.popFrontNode().data;
    }
};
