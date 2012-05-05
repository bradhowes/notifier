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
        this.registrationStore.getRegistrations(userId, function(err, registrations)
        {
            if (err !== null) {
                res.send(null, null, 500);
                return;
            }

            if (registrations.length == 0) {
                res.send(null, null, 202);
                return;
            }

            var body = req.body;
            var eventId = body.eventId;
            var substitutions = body.substitutions;

            self.templateStore.locate(eventId, registrations, function(err, templates)
            {
                if (err !== null) {
                    console.log(err);
                    res.send(null, null, 500);
                    return;
                }

                for (var index in registrations) {
                    var template = templates[index];
                    if (template !== null) {
                        var content = self.generator.transform(template, substitutions);
                        var registration = registrations[index];
                        for (var inner in registrations.routes) {
                            var route = registrations.routes[index];
                            self.deliver(registration.contract, route.path, content);
                        }
                    }
                }
                res.send(null, null, 202);
            });
        });
    },

    deliver: function(contract, path, content) {
        this.senders[contract].sendNotification(path, content);
    }
};
