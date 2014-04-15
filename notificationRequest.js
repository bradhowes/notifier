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
 * A NotificationRequest represents a notification request from an extenal entity.
 *
 * @param {String} registrationId the registration of a user that was used to select a payload
 * @param {String} service the OS-specific service being used for notification delivery
 * @param {String} token the OS-specifc identifier used for notification delivery to a specific device
 * @param {Object} template defines the notification payload to generate.
 */
function NotificationRequest(registrationId, service, token, template) {
    this.log = require('./config').log('NotificationRequest');
    this.registrationId = registrationId;
    this.service = service;
    this.token = token;
    this.template = template;
}

NotificationRequest.prototype = {

    /**
     * Prepare a notification payload using the given values. Updates the content attribute with the payload text.
     *
     * @param {Object} substitutions mapping of placeholder names and the values to use when substituting placeholder
     * tags within a notification template.
     *
     * @param {String} userId the ID of the user being notified
     * @param {RegistrationStore} registrationStore the storage used for registrations. Used if the OS-specific service
     * flags a token as invalid
     * @param {Integer} secondsToLive number of seconds this request is valid
     */
    prepare: function(substitutions, userId, registrationStore, secondsToLive) {
        var log = this.log.child('prepare');
        log.BEGIN('substitutions:', substitutions);
        log.BEGIN('userId:', userId);
        log.BEGIN('secondsToLive:', secondsToLive);
        this.userId = userId;
        this.registrationStore = registrationStore;
        this.secondsToLive = secondsToLive;
        // Generate the notification payload from the parsed template and the given substitution values.
        this.payload = this.template.generator(substitutions);
        log.debug('payload:', this.payload);
        log.END()
    },

    /**
     * Remove the route used to deliver the last notification as it was deemed invalid by the OS-specific service.
     */
    forgetRoute: function () {
        log.BEGIN();
        this.registrationStore.delRoute(this.userId, this.registrationId, this.token);
        log.END();
    }
};
