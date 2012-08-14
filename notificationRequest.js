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
 * @param {Object} payload the notification payload to send to the device. The 'content' attribute holds the actual
 *  payload to deliver.
 * @param {Number} secondsToLive how long this notification is valid
 * @param {Function} removeRegistrationProc function to call to remove a token from further notifications
 */
function NotificationRequest(registrationId, service, token, template) {
    this.registrationId = registrationId;
    this.service = service;
    this.token = token;
    this.template = template;
    this.content = null;
}

NotificationRequest.prototype = {

    prepare: function(substitutions, userId, registrationStore, secondsToLive) {
        this.userId = userId;
        this.registrationStore = registrationStore;
        this.secondsToLive = secondsToLive;
        // Generate the notification payload from the parsed template and the given substitution values.
        this.content = this.template.content(substitutions);
    },

    forgetRoute: function () {
        this.registrationStore.delRoute(this.userId, this.registrationId, this.token);
    }
};
