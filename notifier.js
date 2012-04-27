module.exports = Notifier;

/**
 * Notifier constructor.
 *
 * A notifier sends out notifications to a give user using templates that match the settings found in the user's
 * registrations.
 */
function Notifier(templateStore, registrationStore, generator, senders) {
    this.templateStore = templateStore;
    this.registrationStore = registrationStore;
    this.generator = generator;
    this.senders = senders;
}

Notifier.prototype = {

    postNotification: function(req, res) {
        var self = this;
        var userId = req.params.userId;
        this.registrationStore.getRegistrations(userId, function(err, registrations) {
            if (err !== null) {
                res.send(null, null, 500);
            }

            if (registrations.length == 0) {
                res.send(null, null, 202);
            }

            var body = req.body;
            var eventId = body.eventId;
            var substitutions = body.substitutions;
            for (var index in registrations) {
                var registration = registrations[index];
                self.postToRegistration(registration, eventId, substitutions);
            }
            res.send(null, null, 200);
        });
    },

    postToRegistration: function(registration, eventId, substitutions) {
        for (var index in registration.routes) {
            var route = registration.routes[index];
            this.postToRoute(registration, eventId, substitutions, route);
        }
    },

    postToRoute: function(registration, eventId, substitutions, route) {
        var self = this;
        self.templateStore.locate(eventId, route.name, registration.templateVersion,
                                  registration.templateLanguage, function(err, templates)
        {
            if (err !== null) {
                console.log(err);
            }
            else if (templates.length !== 0) {
                for (var index in templates) {
                    var content = self.generator.transform(templates[index], substitutions);
                    self.deliver(registration.contract, content, route.path);
                }
            }
        });
    },

    deliver: function(contract, content, path) {
        this.senders[contract].send(content, path);
    }
};
