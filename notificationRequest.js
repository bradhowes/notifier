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
 * A NotificationRequest represents a notification request.
 *
 * @param {String} userId user to notify
 * @param {String} token the value used to reach a specific device
 * @param {Object} content the notification payload to send to the device. The 'content' attribute holds the actual
 *  payload to deliver. Additional attributes may exist depending on the os-specific notification service being used
 *  for delivery.
 * @param {Number} secondsToLive how long this notification is valid
 * @param {Function} removeRegistrationProc function to call to remove a token from further notifications
 */
function NotificationRequest(userId, token, content, secondsToLive, removeRegistrationProc) {
    this.userId = userId;
    this.token = token;
    this.content = content;
    this.secondsToLive = secondsToLive;
    this.removeRegistrationProc = removeRegistrationProc;
}
