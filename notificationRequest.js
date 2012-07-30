'use strict';

/**
 * @fileOverview Defines the NotficationRequest prototype and its methods.
 */
module.exports = NotificationRequest;

/**
 * NotificationRequest constructor
 *
 * @class
 *
 * A NotificationRequest represents a notification request
 *
 */
function NotificationRequest(userId, token, content, secondsToLive) {
    this.log = require('./config').log('NotificationRequest');
    this.userId = userId;
    this.token = token;
    this.content = content;
    this.lifetime = Date.now() + secondsToLive;
}

/**
 * NotificationRequest prototype.
 *
 * Defines the methods available to a NotificationPrototype instance.
 */
NotificationRequest.prototype = {

    /**
     * Determine if reqeust is still valid
     *
     * @return true if so
     */
    isValid: function() {
        log.BEGIN();
        return Date.now() < this.lifetime;
    }
};
