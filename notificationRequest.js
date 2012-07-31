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
function NotificationRequest(userId, token, content, secondsToLive, removeRegistrationProc) {
    this.userId = userId;
    this.token = token;
    this.content = content;
    this.secondsToLive = secondsToLive;
    this.removeRegistrationProc = removeRegistrationProc;
}
